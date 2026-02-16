#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# NetBeez MCP Server — Installer
#
# Idempotent install script. Safe to run multiple times.
#   curl -fsSL https://raw.githubusercontent.com/netbeez/nb-mcp-beta/main/install.sh | bash
#
# What it does:
#   1. Checks / installs Node.js 18+
#   2. Clones (or updates) the repo to ~/.netbeez-mcp
#   3. Installs npm dependencies and builds the server
#   4. Prompts for NetBeez API credentials
#   5. Configures Cursor and/or Claude Desktop MCP client(s)
# ─────────────────────────────────────────────────────────────────────────────

INSTALL_DIR="$HOME/.netbeez-mcp"
REPO_URL="https://github.com/netbeez/nb-mcp-beta.git"
MIN_NODE_MAJOR=18

# ── Colours & helpers ────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Colour

info()    { printf "${BLUE}[info]${NC}  %s\n" "$*"; }
success() { printf "${GREEN}[ok]${NC}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[warn]${NC}  %s\n" "$*"; }
error()   { printf "${RED}[error]${NC} %s\n" "$*" >&2; }
header()  { printf "\n${BOLD}── %s ──${NC}\n\n" "$*"; }

prompt_value() {
  local varname="$1" prompt_text="$2" default="${3:-}"
  local input

  # Disable bracketed paste so \e[200~ … \e[201~ don't leak into input
  printf '\e[?2004l' > /dev/tty 2>/dev/null || true

  if [[ -n "$default" ]]; then
    printf "${BOLD}%s${NC} [%s]: " "$prompt_text" "$default" > /dev/tty
  else
    printf "${BOLD}%s${NC}: " "$prompt_text" > /dev/tty
  fi
  read -r input < /dev/tty

  printf '\e[?2004h' > /dev/tty 2>/dev/null || true

  input="${input:-$default}"
  input="$(strip_control_chars "$input")"
  eval "$varname=\"\$input\""
}

prompt_secret() {
  local varname="$1" prompt_text="$2" default="${3:-}"
  local input

  # Disable bracketed paste — this is the primary defence against ESC-sequence
  # corruption. When bracketed paste is active the terminal wraps pasted text
  # in \e[200~ … \e[201~ and read -rs captures those bytes verbatim because
  # silent mode disables the line editor that would normally strip them.
  printf '\e[?2004l' > /dev/tty 2>/dev/null || true

  if [[ -n "$default" ]]; then
    local masked="${default:0:8}…"
    printf "${BOLD}%s${NC} [%s]: " "$prompt_text" "$masked" > /dev/tty
  else
    printf "${BOLD}%s${NC}: " "$prompt_text" > /dev/tty
  fi
  read -rs input < /dev/tty
  echo "" > /dev/tty

  # Re-enable bracketed paste for the rest of the terminal session
  printf '\e[?2004h' > /dev/tty 2>/dev/null || true

  input="${input:-$default}"

  # Belt-and-suspenders: strip any control characters that survived.
  # This catches Option-key combos (ESC + char), leftover CSI sequences,
  # or any other non-printable bytes that have no business in an API key.
  input="$(strip_control_chars "$input")"

  eval "$varname=\"\$input\""
}

prompt_yn() {
  local prompt_text="$1" default="${2:-y}"
  local input
  if [[ "$default" == "y" ]]; then
    printf "${BOLD}%s${NC} [Y/n]: " "$prompt_text" > /dev/tty
  else
    printf "${BOLD}%s${NC} [y/N]: " "$prompt_text" > /dev/tty
  fi
  read -r input < /dev/tty
  input="${input:-$default}"
  [[ "$input" =~ ^[Yy] ]]
}

# Strip ASCII control characters (0x00–0x1F, 0x7F) from a string.
# Catches ESC sequences leaked by bracketed-paste mode, Option-key combos,
# terminal colour codes embedded in clipboard content, etc.
strip_control_chars() {
  printf '%s' "$1" | LC_ALL=C tr -d '[:cntrl:]'
}

# Validate that an API key contains only safe printable characters.
# Returns 0 on success, 1 on failure (with user-facing error messages).
validate_api_key() {
  local key="$1"

  if [[ -z "$key" ]]; then
    error "API key is empty."
    return 1
  fi

  # Reject anything that isn't alphanumeric or a common token symbol
  if [[ "$key" =~ [^A-Za-z0-9._+/=:-] ]]; then
    error "API key contains invalid characters."
    error "It should only contain letters, digits, and symbols like . - _ + / = :"
    error "This usually happens when the key is pasted from a terminal that injects"
    error "escape sequences (bracketed-paste mode, Option-key held, etc.)."
    error "Try copying the key from the NetBeez Dashboard and pasting into a plain"
    error "text editor first, then copy it again from there."
    return 1
  fi

  if (( ${#key} < 10 )); then
    error "API key seems too short (${#key} characters). Please verify and try again."
    return 1
  fi

  return 0
}

# Make a lightweight API call to verify credentials and network connectivity.
# Returns: 0 = success, 1 = network error, 2 = auth failure.
test_api_connection() {
  local base_url="$1" api_key="$2" ssl_verify="$3"
  local curl_opts=("-sS" "-o" "/dev/null" "-w" "%{http_code}" "--max-time" "10")

  if [[ "$ssl_verify" == "false" ]]; then
    curl_opts+=("-k")
  fi

  local http_code
  http_code=$(curl "${curl_opts[@]}" \
    -H "Authorization: Bearer ${api_key}" \
    -H "Accept: application/json" \
    "${base_url}/agents?type=beta&page_size=1" 2>/dev/null) || http_code="000"

  case "$http_code" in
    2*)
      return 0
      ;;
    401|403)
      error "Authentication failed (HTTP ${http_code}). Check your API key."
      return 2
      ;;
    000)
      error "Could not reach ${base_url} — connection failed or timed out."
      error "Check the URL, your network/VPN, and any firewall rules."
      return 1
      ;;
    *)
      warn "Unexpected HTTP response: ${http_code}"
      return 1
      ;;
  esac
}

# ── Pre-flight: detect OS ───────────────────────────────────────────────────

detect_os() {
  case "$(uname -s)" in
    Darwin*) OS="macos" ;;
    Linux*)  OS="linux" ;;
    *)       error "Unsupported OS: $(uname -s)"; exit 1 ;;
  esac
}

# ── Step 1: Node.js ─────────────────────────────────────────────────────────

check_node() {
  header "Checking Node.js"

  if command -v node &>/dev/null; then
    local node_version
    node_version="$(node --version | sed 's/^v//')"
    local node_major="${node_version%%.*}"

    if (( node_major >= MIN_NODE_MAJOR )); then
      success "Node.js v${node_version} found (>= ${MIN_NODE_MAJOR} required)"
      return 0
    else
      warn "Node.js v${node_version} found but v${MIN_NODE_MAJOR}+ is required"
    fi
  else
    warn "Node.js not found"
  fi

  install_node
}

install_node() {
  info "Node.js ${MIN_NODE_MAJOR}+ is required. Attempting to install…"

  if [[ "$OS" == "macos" ]]; then
    if command -v brew &>/dev/null; then
      info "Installing Node.js via Homebrew…"
      brew install node
    else
      info "Installing Node.js via the official installer…"
      install_node_official
    fi
  elif [[ "$OS" == "linux" ]]; then
    if command -v apt-get &>/dev/null; then
      info "Installing Node.js via NodeSource (apt)…"
      curl -fsSL "https://deb.nodesource.com/setup_${MIN_NODE_MAJOR}.x" | sudo -E bash -
      sudo apt-get install -y nodejs
    elif command -v yum &>/dev/null; then
      info "Installing Node.js via NodeSource (yum)…"
      curl -fsSL "https://rpm.nodesource.com/setup_${MIN_NODE_MAJOR}.x" | sudo bash -
      sudo yum install -y nodejs
    else
      install_node_official
    fi
  fi

  # Verify installation
  if ! command -v node &>/dev/null; then
    error "Failed to install Node.js. Please install Node.js ${MIN_NODE_MAJOR}+ manually:"
    error "  https://nodejs.org/en/download/"
    exit 1
  fi

  success "Node.js $(node --version) installed"
}

install_node_official() {
  # Use nvm as a fallback
  if command -v nvm &>/dev/null || [[ -s "$HOME/.nvm/nvm.sh" ]]; then
    [[ -s "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"
    info "Installing Node.js ${MIN_NODE_MAJOR} via nvm…"
    nvm install "$MIN_NODE_MAJOR"
    nvm use "$MIN_NODE_MAJOR"
    return
  fi

  info "Installing nvm and Node.js ${MIN_NODE_MAJOR}…"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  [[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
  nvm install "$MIN_NODE_MAJOR"
  nvm use "$MIN_NODE_MAJOR"
}

# ── Step 2: Clone or update repo ────────────────────────────────────────────

setup_repo() {
  header "Setting up NetBeez MCP Server"

  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Existing installation found at ${INSTALL_DIR}"
    info "Pulling latest changes…"
    git -C "$INSTALL_DIR" pull --ff-only origin main 2>/dev/null || {
      warn "Fast-forward pull failed; resetting to origin/main"
      git -C "$INSTALL_DIR" fetch origin
      git -C "$INSTALL_DIR" reset --hard origin/main
    }
    success "Updated to latest version"
  else
    info "Cloning repository to ${INSTALL_DIR}…"
    git clone "$REPO_URL" "$INSTALL_DIR"
    success "Cloned successfully"
  fi
}

# ── Step 3: Install & build ─────────────────────────────────────────────────

build_server() {
  header "Installing dependencies & building"

  cd "$INSTALL_DIR"
  npm install --no-fund --no-audit </dev/null 2>&1 | tail -1
  success "Dependencies installed"

  npm run build </dev/null 2>&1 | tail -1
  success "Server built → ${INSTALL_DIR}/dist/index.js"
}

# ── Step 4: Prompt for configuration ────────────────────────────────────────

configure_credentials() {
  header "NetBeez Configuration"

  # Load existing values if .env already exists (for idempotency)
  local existing_url="" existing_key="" existing_ssl=""
  if [[ -f "$INSTALL_DIR/.env" ]]; then
    existing_url="$(grep -E '^NETBEEZ_BASE_URL=' "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"
    existing_key="$(grep -E '^NETBEEZ_API_KEY=' "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"
    existing_ssl="$(grep -E '^NETBEEZ_SSL_VERIFY=' "$INSTALL_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"
    info "Existing configuration found. Press Enter to keep current values."
  fi

  prompt_value NB_URL "NetBeez instance URL (e.g. https://demo1.netbeezcloud.net)" "$existing_url"
  if [[ -z "$NB_URL" ]]; then
    error "NetBeez instance URL is required."
    exit 1
  fi
  # Strip trailing slashes
  NB_URL="${NB_URL%/}"

  # Prompt for API key with validation and retry loop.
  # The key is read in silent mode which is prone to capturing escape sequences
  # from bracketed paste, Option-key combos, etc.  We sanitize the input and
  # then validate it before accepting.
  local max_attempts=3
  local attempt=0
  NB_KEY=""
  while (( attempt < max_attempts )); do
    (( ++attempt ))
    prompt_secret NB_KEY "NetBeez API key (Dashboard → Settings → API Keys)" "$existing_key"

    if validate_api_key "$NB_KEY"; then
      break
    fi

    if (( attempt < max_attempts )); then
      warn "Please try again (attempt ${attempt}/${max_attempts})."
      # Clear the default so a bad existing key isn't reused
      existing_key=""
    else
      error "Failed after ${max_attempts} attempts."
      error "Tip: paste the key into a plain text editor first to verify it looks clean,"
      error "then copy it from there."
      exit 1
    fi
  done

  NB_SSL="${existing_ssl:-true}"
  if ! prompt_yn "Verify SSL certificates? (set to No for self-signed certs)" "y"; then
    NB_SSL="false"
  else
    NB_SSL="true"
  fi

  # Test API connectivity before writing anything
  info "Testing connection to ${NB_URL}…"
  if test_api_connection "$NB_URL" "$NB_KEY" "$NB_SSL"; then
    success "API connection verified — credentials are valid"
  else
    warn "Could not verify the connection."
    if ! prompt_yn "Save configuration anyway?" "n"; then
      error "Aborting. Fix the URL / API key / network and re-run the installer."
      exit 1
    fi
    warn "Saving configuration despite failed connection test."
  fi

  # Write .env (idempotent — overwrites)
  cat > "$INSTALL_DIR/.env" <<EOF
# NetBeez MCP Server Configuration (auto-generated by installer)
NETBEEZ_BASE_URL=${NB_URL}
NETBEEZ_API_KEY=${NB_KEY}
NETBEEZ_SSL_VERIFY=${NB_SSL}
MCP_TRANSPORT=stdio
EOF

  success "Configuration saved to ${INSTALL_DIR}/.env"
}

# ── Step 5: Configure MCP clients ───────────────────────────────────────────

# Portable JSON config writer — uses Node.js (already verified) so we don't
# need to depend on jq or python.

write_mcp_config() {
  local config_file="$1"
  local node_path
  node_path="$(which node)"

  # Create parent directory if it doesn't exist
  mkdir -p "$(dirname "$config_file")"

  # Use Node.js to merge the netbeez server entry into existing config.
  # The API key is passed via environment variable (_NB_KEY) rather than
  # command-line args to avoid shell-escaping issues and ps(1) visibility.
  _NB_KEY="$NB_KEY" node -e "
    const fs = require('fs');
    const configPath = process.argv[1];
    const installDir = process.argv[2];
    const baseUrl = process.argv[3];
    const apiKey = process.env._NB_KEY;
    const sslVerify = process.argv[4];

    let config = {};
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      // File doesn't exist or is invalid — start fresh
    }

    if (!config.mcpServers) config.mcpServers = {};

    const env = {
      NETBEEZ_BASE_URL: baseUrl,
      NETBEEZ_API_KEY: apiKey,
    };
    if (sslVerify === 'false') {
      env.NETBEEZ_SSL_VERIFY = 'false';
    }

    config.mcpServers.netbeez = {
      command: 'node',
      args: [installDir + '/dist/index.js'],
      env: env,
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  " "$config_file" "$INSTALL_DIR" "$NB_URL" "$NB_SSL"
}

# Codex uses config.toml (TOML format), not config.json.
# This function writes/updates the [mcp_servers.netbeez] section in the
# Codex config.  Prefers the `codex mcp add` CLI when available, with a
# Node.js-based TOML text-manipulation fallback.

write_codex_config() {
  local config_file="$HOME/.codex/config.toml"

  mkdir -p "$(dirname "$config_file")"

  # ── Option A: use the codex CLI if it's installed ──
  if command -v codex &>/dev/null; then
    codex mcp remove netbeez 2>/dev/null || true
    local env_args=(--env "NETBEEZ_BASE_URL=$NB_URL" --env "NETBEEZ_API_KEY=$NB_KEY")
    if [[ "$NB_SSL" == "false" ]]; then
      env_args+=(--env "NETBEEZ_SSL_VERIFY=false")
    fi
    codex mcp add netbeez "${env_args[@]}" -- node "$INSTALL_DIR/dist/index.js"
    success "Codex configured (via codex CLI) → ${config_file}"
    return
  fi

  # ── Option B: manipulate the TOML file directly via Node.js ──
  _NB_KEY="$NB_KEY" node -e "
    const fs   = require('fs');
    const path = process.argv[1];
    const dir  = process.argv[2];
    const url  = process.argv[3];
    const key  = process.env._NB_KEY;
    const ssl  = process.argv[4];

    let lines = [];
    try { lines = fs.readFileSync(path, 'utf8').split('\n'); } catch (_) {}

    // Strip existing [mcp_servers.netbeez] and [mcp_servers.netbeez.env] blocks
    const out = [];
    let skip = false;
    for (const line of lines) {
      const hdr = line.match(/^\[(.+)\]/);
      if (hdr) {
        skip = /^mcp_servers\.netbeez(\.|$)/.test(hdr[1].trim());
      }
      if (!skip) out.push(line);
    }

    // Remove trailing blank lines, then append netbeez config
    while (out.length && out[out.length - 1].trim() === '') out.pop();

    out.push('');
    out.push('[mcp_servers.netbeez]');
    out.push('command = \"node\"');
    out.push('args = [\"' + dir + '/dist/index.js\"]');
    out.push('');
    out.push('[mcp_servers.netbeez.env]');
    out.push('NETBEEZ_BASE_URL = \"' + url + '\"');
    out.push('NETBEEZ_API_KEY = \"' + key + '\"');
    if (ssl === 'false') {
      out.push('NETBEEZ_SSL_VERIFY = \"false\"');
    }
    out.push('');

    fs.writeFileSync(path, out.join('\n'));
  " "$config_file" "$INSTALL_DIR" "$NB_URL" "$NB_SSL"

  success "Codex configured → ${config_file}"
}

configure_clients() {
  header "MCP Client Configuration"

  local configured=0

  # ── Cursor ──
  local cursor_config="$HOME/.cursor/mcp.json"
  if prompt_yn "Configure Cursor IDE?" "y"; then
    write_mcp_config "$cursor_config"
    success "Cursor configured → ${cursor_config}"
    info "Restart Cursor or reload MCP servers to activate."
    configured=1
  fi

  # ── Claude Desktop ──
  local claude_config
  if [[ "$OS" == "macos" ]]; then
    claude_config="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
  else
    claude_config="$HOME/.config/Claude/claude_desktop_config.json"
  fi

  if prompt_yn "Configure Claude Desktop?" "y"; then
    write_mcp_config "$claude_config"
    success "Claude Desktop configured → ${claude_config}"
    info "Restart Claude Desktop to activate."
    configured=1
  fi

  # ── Windsurf ──
  local windsurf_config="$HOME/.codeium/windsurf/mcp_config.json"
  if prompt_yn "Configure Windsurf?" "n"; then
    write_mcp_config "$windsurf_config"
    success "Windsurf configured → ${windsurf_config}"
    configured=1
  fi

  # ── Codex ──
  if prompt_yn "Configure Codex?" "n"; then
    write_codex_config
    configured=1
  fi

  if (( configured == 0 )); then
    warn "No clients configured. You can re-run this installer or configure manually."
    info "See: ${INSTALL_DIR}/README.md"
  fi
}

# ── Step 6: Verify ──────────────────────────────────────────────────────────

verify_install() {
  header "Verifying installation"

  # Quick smoke test — load the server and exit immediately.
  # macOS doesn't ship with GNU timeout, so use a portable wrapper.
  local timeout_cmd=""
  if command -v timeout &>/dev/null; then
    timeout_cmd="timeout 5"
  elif command -v perl &>/dev/null; then
    # Perl's alarm() provides equivalent functionality on macOS
    timeout_cmd="perl -e 'alarm 5; exec @ARGV' --"
  fi

  if $timeout_cmd node -e "
    process.env.NETBEEZ_BASE_URL = '${NB_URL}';
    process.env.NETBEEZ_API_KEY = '${NB_KEY}';
    process.env.NETBEEZ_SSL_VERIFY = '${NB_SSL}';
    import('${INSTALL_DIR}/dist/config.js').then(m => {
      m.loadConfig();
      console.error('Config OK');
      process.exit(0);
    }).catch(e => {
      console.error(e.message);
      process.exit(1);
    });
  " 2>&1; then
    success "Configuration validated"
  else
    warn "Configuration could not be validated (server may still work)"
  fi

  echo ""
  printf "${GREEN}${BOLD}✓ NetBeez MCP Server installed successfully!${NC}\n"
  echo ""
  info "Install location:  ${INSTALL_DIR}"
  info "Server binary:     ${INSTALL_DIR}/dist/index.js"
  info "Configuration:     ${INSTALL_DIR}/.env"
  echo ""
  info "To update later, re-run this installer — it's safe to run multiple times."
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  echo ""
  printf "${BOLD}╔══════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}║   NetBeez MCP Server — Installer             ║${NC}\n"
  printf "${BOLD}╚══════════════════════════════════════════════╝${NC}\n"
  echo ""

  detect_os
  check_node
  setup_repo
  build_server
  configure_credentials
  configure_clients
  verify_install
}

main "$@"
