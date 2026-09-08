#Requires -Version 5.1
# ─────────────────────────────────────────────────────────────────────────────
# NetBeez MCP Server — Windows Installer
#
# Idempotent install script. Safe to run multiple times.
#   irm https://raw.githubusercontent.com/netbeez/nb-mcp-server/main/install.ps1 | iex
#
# Options:
#   --dev   Use the current repo as the install directory (no download).
#           From the repo root in PowerShell:
#             Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#             .\install.ps1 --dev
#           Or: $env:NETBEEZ_MCP_DEV = '1'; .\install.ps1
#
# What it does:
#   1. Checks / installs Node.js 18+
#   2. Downloads (or updates) the repo to %USERPROFILE%\.netbeez-mcp via GitHub
#      archive — skipped if --dev
#   3. Installs npm dependencies and builds the server
#   4. Prompts for NetBeez API credentials
#   5. Configures Cursor/Claude/Windsurf/Codex/Kiro MCP client(s)
# ─────────────────────────────────────────────────────────────────────────────
#
# Invocation notes:
#   No top-level param() so `irm | iex` works. Dev mode is enabled when:
#     - $args contains --dev / -Dev / -dev / /Dev / dev
#     - $global:Dev is $true
#     - $env:NETBEEZ_MCP_DEV is '1' or 'true'

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# TLS 1.2 is required on older Windows 10 / PowerShell 5.1 stacks.
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {
    # Ignore — the OS default is used if this type is unavailable.
}

$ArchiveUrl = 'https://github.com/netbeez/nb-mcp-server/archive/refs/heads/main.zip'
$MinNodeMajor = 18

# ── Dev-mode detection (iex-safe: no top-level param()) ──────────────────────

$script:DevMode = $false
if ($env:NETBEEZ_MCP_DEV -eq '1' -or $env:NETBEEZ_MCP_DEV -eq 'true') {
    $script:DevMode = $true
}
foreach ($arg in $args) {
    if ($arg -in @('-Dev', '--dev', '-dev', '/Dev', 'dev')) {
        $script:DevMode = $true
    }
}
if (-not $script:DevMode) {
    if ($global:Dev -eq $true -or $global:Dev -eq 'true') {
        $script:DevMode = $true
    }
}

if ($script:DevMode) {
    if ($PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'package.json'))) {
        $script:InstallDir = $PSScriptRoot
    } else {
        $script:InstallDir = (Get-Location).Path
    }
} else {
    $script:InstallDir = Join-Path $env:USERPROFILE '.netbeez-mcp'
}

$script:NbUrl = ''
$script:NbKey = ''
$script:NbSsl = 'true'
$script:NodeExe = $null

# ── Colours & helpers ────────────────────────────────────────────────────────

function Write-Info {
    param([string]$Message)
    Write-Host "[info]  $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[ok]    $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[warn]  $Message" -ForegroundColor Yellow
}

function Write-Err {
    param([string]$Message)
    Write-Host "[error] $Message" -ForegroundColor Red
}

function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "── $Message ──" -ForegroundColor Cyan
    Write-Host ""
}

# Strip ASCII control characters (0x00–0x1F, 0x7F) from a string.
function Get-StrippedInput {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return '' }
    $chars = $Value.ToCharArray() | Where-Object {
        $code = [int]$_
        $code -ge 32 -and $code -ne 127
    }
    return (-join $chars)
}

function Read-PromptValue {
    param(
        [string]$PromptText,
        [string]$Default = ''
    )
    if ($Default) {
        $answer = Read-Host "$PromptText [$Default]"
    } else {
        $answer = Read-Host $PromptText
    }
    $answer = Get-StrippedInput $answer
    if ([string]::IsNullOrEmpty($answer)) { return $Default }
    return $answer
}

function Read-PromptSecret {
    param(
        [string]$PromptText,
        [string]$Default = ''
    )
    if ($Default) {
        $masked = if ($Default.Length -ge 8) { $Default.Substring(0, 8) + [char]0x2026 } else { $Default }
        $label = "$PromptText [$masked]"
    } else {
        $label = $PromptText
    }

    $secure = Read-Host -Prompt $label -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }

    $plain = Get-StrippedInput $plain
    if ([string]::IsNullOrEmpty($plain)) { return $Default }
    return $plain
}

function Read-PromptYN {
    param(
        [string]$PromptText,
        [string]$Default = 'y'
    )
    if ($Default -eq 'y') {
        $hint = 'Y/n'
    } else {
        $hint = 'y/N'
    }
    $answer = Read-Host "$PromptText [$hint]"
    if ([string]::IsNullOrWhiteSpace($answer)) { $answer = $Default }
    return [bool]($answer -match '^[Yy]')
}

# Validate that an API key contains only safe printable characters.
# Returns $true on success, $false on failure (with user-facing error messages).
function Test-ApiKey {
    param([string]$Key)

    if ([string]::IsNullOrEmpty($Key)) {
        Write-Err 'API key is empty.'
        return $false
    }

    if ($Key -match '[^A-Za-z0-9._+/=:-]') {
        Write-Err 'API key contains invalid characters.'
        Write-Err 'It should only contain letters, digits, and symbols like . - _ + / = :'
        Write-Err 'This usually happens when the key is pasted from a terminal that injects'
        Write-Err 'escape sequences (bracketed-paste mode, Option-key held, etc.).'
        Write-Err 'Try copying the key from the NetBeez Dashboard and pasting into a plain'
        Write-Err 'text editor first, then copy it again from there.'
        return $false
    }

    if ($Key.Length -lt 10) {
        Write-Err "API key seems too short ($($Key.Length) characters). Please verify and try again."
        return $false
    }

    return $true
}

# Trust all certificates for the current process (PS 5.1 has no -SkipCertificateCheck).
function Enable-InsecureSsl {
    if (-not ([System.Management.Automation.PSTypeName]'TrustAllCertsPolicy').Type) {
        Add-Type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint sp, X509Certificate cert, WebRequest req, int problem) {
        return true;
    }
}
"@
    }
    [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
}

# Make a lightweight API call to verify credentials and network connectivity.
# Returns: 0 = success, 1 = network error, 2 = auth failure.
function Test-ApiConnection {
    param(
        [string]$BaseUrl,
        [string]$ApiKey,
        [string]$SslVerify
    )

    if ($SslVerify -eq 'false') {
        Enable-InsecureSsl
    }

    $headers = @{
        Authorization = "Bearer $ApiKey"
        Accept        = 'application/json'
    }
    $uri = "$BaseUrl/agents?type=beta&page_size=1"

    try {
        $response = Invoke-WebRequest -Uri $uri -Headers $headers -UseBasicParsing -TimeoutSec 10
        $httpCode = [int]$response.StatusCode
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $httpCode = [int]$resp.StatusCode
        } else {
            $httpCode = 0
        }
    }

    if ($httpCode -ge 200 -and $httpCode -lt 300) {
        return 0
    }
    if ($httpCode -eq 401 -or $httpCode -eq 403) {
        Write-Err "Authentication failed (HTTP $httpCode). Check your API key."
        return 2
    }
    if ($httpCode -eq 0) {
        Write-Err "Could not reach $BaseUrl — connection failed or timed out."
        Write-Err 'Check the URL, your network/VPN, and any firewall rules.'
        return 1
    }

    Write-Warn "Unexpected HTTP response: $httpCode"
    return 1
}

function Update-SessionPath {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    if ($machine -and $user) {
        $env:Path = "$machine;$user"
    } elseif ($machine) {
        $env:Path = $machine
    } elseif ($user) {
        $env:Path = $user
    }
}

function Test-RealNodeVersion {
    param([string]$NodePath)
    if (-not $NodePath) { return $null }
    # Windows Store "App Execution Alias" is not a real Node binary.
    if ($NodePath -match '[\\/]WindowsApps[\\/]') { return $null }
    try {
        $output = & $NodePath --version 2>$null
        if (-not $output) { return $null }
        $version = ([string]$output).Trim().TrimStart('v')
        if ($version -notmatch '^\d+') { return $null }
        return $version
    } catch {
        return $null
    }
}

function Get-NodePath {
    $cmds = @(Get-Command node -All -ErrorAction SilentlyContinue)
    foreach ($cmd in $cmds) {
        if ($cmd.Source -and (Test-RealNodeVersion -NodePath $cmd.Source)) {
            return $cmd.Source
        }
    }

    $candidates = @()
    if ($env:ProgramFiles) {
        $candidates += (Join-Path $env:ProgramFiles 'nodejs\node.exe')
    }
    $programFilesX86 = ${env:ProgramFiles(x86)}
    if ($programFilesX86) {
        $candidates += (Join-Path $programFilesX86 'nodejs\node.exe')
    }
    foreach ($candidate in $candidates) {
        if ((Test-Path -LiteralPath $candidate) -and (Test-RealNodeVersion -NodePath $candidate)) {
            return $candidate
        }
    }
    return $null
}

function Get-NpmPath {
    $cmds = @(Get-Command npm.cmd -All -ErrorAction SilentlyContinue)
    if (-not $cmds) { $cmds = @(Get-Command npm -All -ErrorAction SilentlyContinue) }
    foreach ($cmd in $cmds) {
        if ($cmd.Source -and $cmd.Source -notmatch '[\\/]WindowsApps[\\/]') {
            return $cmd.Source
        }
    }

    $candidates = @()
    if ($env:ProgramFiles) {
        $candidates += (Join-Path $env:ProgramFiles 'nodejs\npm.cmd')
    }
    $programFilesX86 = ${env:ProgramFiles(x86)}
    if ($programFilesX86) {
        $candidates += (Join-Path $programFilesX86 'nodejs\npm.cmd')
    }
    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }
    return $null
}

function Get-DotEnvValue {
    param(
        [string]$Path,
        [string]$Key
    )
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    $prefix = "$Key="
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -like "$prefix*") {
            return $line.Substring($prefix.Length)
        }
    }
    return ''
}

# Forward slashes are valid on Windows and safe in JSON / TOML (backslash is an escape).
function Get-ConfigPath {
    param([string]$Path)
    return ($Path -replace '\\', '/')
}

# ── Step 1: Node.js ─────────────────────────────────────────────────────────

function Write-NodeDownloadHelp {
    param([string]$Reason = '')
    if ($Reason) { Write-Err $Reason }
    Write-Err "Please install Node.js $MinNodeMajor+ manually:"
    Write-Err '  https://nodejs.org/en/download/'
    exit 1
}

function Install-Node {
    Write-Info "Node.js $MinNodeMajor+ is required. Attempting to install…"

    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Info 'Installing Node.js via winget (OpenJS.NodeJS.LTS)…'
        & $winget.Source install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
        Update-SessionPath
        $script:NodeExe = Get-NodePath
        if (-not $script:NodeExe) {
            Write-NodeDownloadHelp -Reason 'Failed to install Node.js via winget.'
        }
        Write-Ok "Node.js $(& $script:NodeExe --version) installed"
        return
    }

    Write-Warn 'winget is not available.'
    Write-NodeDownloadHelp
}

function Test-Node {
    Write-Header 'Checking Node.js'

    $script:NodeExe = Get-NodePath
    if ($script:NodeExe) {
        $nodeVersion = Test-RealNodeVersion -NodePath $script:NodeExe
        $nodeMajor = 0
        if ($nodeVersion) {
            [void][int]::TryParse($nodeVersion.Split('.')[0], [ref]$nodeMajor)
        }
        if ($nodeMajor -ge $MinNodeMajor) {
            Write-Ok "Node.js v$nodeVersion found (>= $MinNodeMajor required)"
            return
        }
        if ($nodeMajor -gt 0) {
            Write-Warn "Node.js v$nodeVersion found but v$MinNodeMajor+ is required"
        } else {
            Write-Warn 'Node.js not found'
        }
    } else {
        Write-Warn 'Node.js not found'
    }

    Install-Node
}

# ── Step 2: Download or update (no git required) ─────────────────────────────

function Install-Repo {
    Write-Header 'Setting up NetBeez MCP Server'

    if ($script:DevMode) {
        Write-Info "Development mode: using repo at $($script:InstallDir)"
        if (-not (Test-Path -LiteralPath (Join-Path $script:InstallDir 'package.json'))) {
            Write-Err 'Not a valid project root (no package.json). Run install.ps1 --dev from the repo root.'
            exit 1
        }
        Write-Ok 'Using development directory — no clone/update'
        return
    }

    $tmpDir = Join-Path $env:TEMP ("nb-mcp-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmpDir | Out-Null
    $envBackup = $null

    try {
        $existingEnv = Join-Path $script:InstallDir '.env'
        if ((Test-Path -LiteralPath $script:InstallDir) -and (Test-Path -LiteralPath (Join-Path $script:InstallDir 'package.json'))) {
            Write-Info "Existing installation found at $($script:InstallDir)"
            Write-Info 'Downloading latest version…'
            if (Test-Path -LiteralPath $existingEnv) {
                $envBackup = Join-Path $tmpDir '.env.bak'
                Copy-Item -LiteralPath $existingEnv -Destination $envBackup -Force
            }
            Remove-Item -LiteralPath $script:InstallDir -Recurse -Force
        } else {
            Write-Info "Downloading repository to $($script:InstallDir)…"
        }

        New-Item -ItemType Directory -Path $script:InstallDir -Force | Out-Null

        $zipPath = Join-Path $tmpDir 'nb-mcp-server.zip'
        try {
            Invoke-WebRequest -Uri $ArchiveUrl -OutFile $zipPath -UseBasicParsing
        } catch {
            Write-Err 'Download failed. Check your network and try again.'
            exit 1
        }

        try {
            Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force
        } catch {
            Write-Err 'Extract failed. Corrupted download?'
            exit 1
        }

        $extracted = Join-Path $tmpDir 'nb-mcp-server-main'
        if (-not (Test-Path -LiteralPath $extracted)) {
            $extracted = Get-ChildItem -LiteralPath $tmpDir -Directory |
                Where-Object { $_.Name -like 'nb-mcp-server-*' } |
                Select-Object -First 1
            if ($extracted) { $extracted = $extracted.FullName }
        }
        if (-not $extracted -or -not (Test-Path -LiteralPath $extracted)) {
            Write-Err 'Extract failed. Unexpected archive layout.'
            exit 1
        }

        try {
            Get-ChildItem -LiteralPath $extracted -Force | ForEach-Object {
                Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $script:InstallDir $_.Name) -Recurse -Force
            }
        } catch {
            Write-Err "Copy failed. Check permissions for $($script:InstallDir)."
            exit 1
        }

        if ($envBackup -and (Test-Path -LiteralPath $envBackup)) {
            Copy-Item -LiteralPath $envBackup -Destination (Join-Path $script:InstallDir '.env') -Force
            Write-Info 'Restored existing configuration (.env)'
        }

        Write-Ok 'Downloaded successfully'
    } finally {
        Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# ── Step 3: Install & build ─────────────────────────────────────────────────

function Build-Server {
    Write-Header 'Installing dependencies & building'

    Update-SessionPath
    $npm = Get-NpmPath
    if (-not $npm) {
        Write-Err 'npm was not found. Re-install Node.js 18+ and re-run this installer.'
        exit 1
    }
    if (-not $script:NodeExe) {
        $script:NodeExe = Get-NodePath
    }

    Push-Location $script:InstallDir
    try {
        $installOut = & $npm install --no-fund --no-audit 2>&1
        $installExit = $LASTEXITCODE
        $installOut | Select-Object -Last 1
        if ($installExit -ne 0) {
            Write-Err 'npm install failed.'
            exit 1
        }
        Write-Ok 'Dependencies installed'

        $buildOut = & $npm run build 2>&1
        $buildExit = $LASTEXITCODE
        $buildOut | Select-Object -Last 1
        if ($buildExit -ne 0) {
            Write-Err 'npm run build failed.'
            exit 1
        }
        Write-Ok "Server built → $(Join-Path $script:InstallDir 'dist\index.js')"
    } finally {
        Pop-Location
    }
}

# ── Step 4: Prompt for configuration ────────────────────────────────────────

function Set-Credentials {
    Write-Header 'NetBeez Configuration'

    $envPath = Join-Path $script:InstallDir '.env'
    $existingUrl = ''
    $existingKey = ''
    $existingSsl = ''
    if (Test-Path -LiteralPath $envPath) {
        $existingUrl = Get-DotEnvValue -Path $envPath -Key 'NETBEEZ_BASE_URL'
        $existingKey = Get-DotEnvValue -Path $envPath -Key 'NETBEEZ_API_KEY'
        $existingSsl = Get-DotEnvValue -Path $envPath -Key 'NETBEEZ_SSL_VERIFY'
        Write-Info 'Existing configuration found. Press Enter to keep current values.'
    }

    $script:NbUrl = Read-PromptValue -PromptText 'NetBeez instance URL (e.g. https://demo1.netbeezcloud.net)' -Default $existingUrl
    if ([string]::IsNullOrEmpty($script:NbUrl)) {
        Write-Err 'NetBeez instance URL is required.'
        exit 1
    }
    $script:NbUrl = $script:NbUrl.TrimEnd('/')

    $maxAttempts = 3
    $attempt = 0
    $script:NbKey = ''
    $keyDefault = $existingKey
    while ($attempt -lt $maxAttempts) {
        $attempt = $attempt + 1
        $script:NbKey = Read-PromptSecret -PromptText 'NetBeez API key (Dashboard → Settings → API Keys)' -Default $keyDefault
        if (Test-ApiKey -Key $script:NbKey) { break }

        if ($attempt -lt $maxAttempts) {
            Write-Warn "Please try again (attempt $attempt/$maxAttempts)."
            $keyDefault = ''
        } else {
            Write-Err "Failed after $maxAttempts attempts."
            Write-Err 'Tip: paste the key into a plain text editor first to verify it looks clean,'
            Write-Err 'then copy it from there.'
            exit 1
        }
    }

    if ($existingSsl) {
        $script:NbSsl = $existingSsl
    } else {
        $script:NbSsl = 'true'
    }
    if (-not (Read-PromptYN -PromptText 'Verify SSL certificates? (set to No for self-signed certs)' -Default 'y')) {
        $script:NbSsl = 'false'
    } else {
        $script:NbSsl = 'true'
    }

    Write-Info "Testing connection to $($script:NbUrl)…"
    $conn = Test-ApiConnection -BaseUrl $script:NbUrl -ApiKey $script:NbKey -SslVerify $script:NbSsl
    if ($conn -eq 0) {
        Write-Ok 'API connection verified — credentials are valid'
    } else {
        Write-Warn 'Could not verify the connection.'
        if (-not (Read-PromptYN -PromptText 'Save configuration anyway?' -Default 'n')) {
            Write-Err 'Aborting. Fix the URL / API key / network and re-run the installer.'
            exit 1
        }
        Write-Warn 'Saving configuration despite failed connection test.'
    }

    $envBody = @"
# NetBeez MCP Server Configuration (auto-generated by installer)
NETBEEZ_BASE_URL=$($script:NbUrl)
NETBEEZ_API_KEY=$($script:NbKey)
NETBEEZ_SSL_VERIFY=$($script:NbSsl)
MCP_TRANSPORT=stdio

"@
    # PS 5.1 Set-Content -Encoding UTF8 writes a BOM that can break .env parsers.
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($envPath, $envBody, $utf8NoBom)

    Write-Ok "Configuration saved to $envPath"
}

# ── Step 5: Configure MCP clients ───────────────────────────────────────────
# JSON is written with Node.js (already required), matching install.sh.
# ConvertTo-Json in Windows PowerShell 5.1 collapses single-element arrays,
# which would break MCP `args: ["…/dist/index.js"]`.

function Write-McpConfig {
    param([string]$ConfigFile)

    $parent = Split-Path -Parent $ConfigFile
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $configPath = Get-ConfigPath $ConfigFile
    $installDir = Get-ConfigPath $script:InstallDir

    $prevKey = $env:_NB_KEY
    $env:_NB_KEY = $script:NbKey
    try {
        & $script:NodeExe -e @'
const fs = require("fs");
const configPath = process.argv[1];
const installDir = process.argv[2];
const baseUrl = process.argv[3];
const apiKey = process.env._NB_KEY;
const sslVerify = process.argv[4];

let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (e) {
  // File doesn't exist or is invalid — start fresh
}

if (!config.mcpServers) config.mcpServers = {};

const env = {
  NETBEEZ_BASE_URL: baseUrl,
  NETBEEZ_API_KEY: apiKey,
};
if (sslVerify === "false") {
  env.NETBEEZ_SSL_VERIFY = "false";
}

config.mcpServers.netbeez = {
  command: "node",
  args: [installDir + "/dist/index.js"],
  env: env,
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
'@ $configPath $installDir $script:NbUrl $script:NbSsl
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to write MCP config: $ConfigFile"
            exit 1
        }
    } finally {
        if ($null -eq $prevKey) {
            Remove-Item Env:_NB_KEY -ErrorAction SilentlyContinue
        } else {
            $env:_NB_KEY = $prevKey
        }
    }
}

function Write-CodexConfig {
    $configFile = Join-Path $env:USERPROFILE '.codex\config.toml'
    $parent = Split-Path -Parent $configFile
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $codex = Get-Command codex -ErrorAction SilentlyContinue
    if (-not $codex) { $codex = Get-Command codex.cmd -ErrorAction SilentlyContinue }
    if ($codex) {
        & $codex.Source mcp remove netbeez 2>$null
        $envArgs = @(
            '--env', "NETBEEZ_BASE_URL=$($script:NbUrl)"
            '--env', "NETBEEZ_API_KEY=$($script:NbKey)"
        )
        if ($script:NbSsl -eq 'false') {
            $envArgs += @('--env', 'NETBEEZ_SSL_VERIFY=false')
        }
        $serverJs = Join-Path $script:InstallDir 'dist\index.js'
        & $codex.Source mcp add netbeez @envArgs -- node $serverJs
        if ($LASTEXITCODE -eq 0) {
            Write-Ok "Codex configured (via codex CLI) → $configFile"
            return
        }
        Write-Warn 'codex mcp add failed; falling back to config.toml edit.'
    }

    $configPath = Get-ConfigPath $configFile
    $installDir = Get-ConfigPath $script:InstallDir

    $prevKey = $env:_NB_KEY
    $env:_NB_KEY = $script:NbKey
    try {
        & $script:NodeExe -e @'
const fs = require("fs");
const path = process.argv[1];
const dir = process.argv[2];
const url = process.argv[3];
const key = process.env._NB_KEY;
const ssl = process.argv[4];

let lines = [];
try { lines = fs.readFileSync(path, "utf8").split("\n"); } catch (_) {}

const out = [];
let skip = false;
for (const line of lines) {
  const hdr = line.match(/^\[(.+)\]/);
  if (hdr) {
    skip = /^mcp_servers\.netbeez(\.|$)/.test(hdr[1].trim());
  }
  if (!skip) out.push(line);
}

while (out.length && out[out.length - 1].trim() === "") out.pop();

out.push("");
out.push("[mcp_servers.netbeez]");
out.push("command = \"node\"");
out.push("args = [\"" + dir + "/dist/index.js\"]");
out.push("");
out.push("[mcp_servers.netbeez.env]");
out.push("NETBEEZ_BASE_URL = \"" + url + "\"");
out.push("NETBEEZ_API_KEY = \"" + key + "\"");
if (ssl === "false") {
  out.push("NETBEEZ_SSL_VERIFY = \"false\"");
}
out.push("");

fs.writeFileSync(path, out.join("\n"));
'@ $configPath $installDir $script:NbUrl $script:NbSsl
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Failed to write Codex config: $configFile"
            exit 1
        }
    } finally {
        if ($null -eq $prevKey) {
            Remove-Item Env:_NB_KEY -ErrorAction SilentlyContinue
        } else {
            $env:_NB_KEY = $prevKey
        }
    }

    Write-Ok "Codex configured → $configFile"
}

function Set-McpClients {
    Write-Header 'MCP Client Configuration'

    $configured = 0

    $cursorConfig = Join-Path $env:USERPROFILE '.cursor\mcp.json'
    if (Read-PromptYN -PromptText 'Configure Cursor IDE?' -Default 'y') {
        Write-McpConfig -ConfigFile $cursorConfig
        Write-Ok "Cursor configured → $cursorConfig"
        Write-Info 'Restart Cursor or reload MCP servers to activate.'
        $configured = $configured + 1
    }

    $claudeConfig = Join-Path $env:APPDATA 'Claude\claude_desktop_config.json'
    if (Read-PromptYN -PromptText 'Configure Claude Desktop?' -Default 'y') {
        Write-McpConfig -ConfigFile $claudeConfig
        Write-Ok "Claude Desktop configured → $claudeConfig"
        Write-Info 'Restart Claude Desktop to activate.'
        $configured = $configured + 1
    }

    $windsurfConfig = Join-Path $env:USERPROFILE '.codeium\windsurf\mcp_config.json'
    if (Read-PromptYN -PromptText 'Configure Windsurf?' -Default 'n') {
        Write-McpConfig -ConfigFile $windsurfConfig
        Write-Ok "Windsurf configured → $windsurfConfig"
        $configured = $configured + 1
    }

    if (Read-PromptYN -PromptText 'Configure Codex?' -Default 'n') {
        Write-CodexConfig
        $configured = $configured + 1
    }

    $kiroConfig = Join-Path $env:USERPROFILE '.kiro\settings\mcp.json'
    if (Read-PromptYN -PromptText 'Configure Kiro IDE?' -Default 'n') {
        Write-McpConfig -ConfigFile $kiroConfig
        Write-Ok "Kiro configured → $kiroConfig"
        Write-Info 'Restart Kiro or reload MCP servers to activate.'
        $configured = $configured + 1
    }

    if ($configured -eq 0) {
        Write-Warn 'No clients configured. You can re-run this installer or configure manually.'
        Write-Info "See: $(Join-Path $script:InstallDir 'README.md')"
    }
}

# ── Step 6: Verify ──────────────────────────────────────────────────────────

function Test-Install {
    Write-Header 'Verifying installation'

    if (-not $script:NodeExe) {
        $script:NodeExe = Get-NodePath
    }

    $configJs = Join-Path $script:InstallDir 'dist\config.js'
    $ok = $false

    $prevUrl = $env:NETBEEZ_BASE_URL
    $prevKey = $env:NETBEEZ_API_KEY
    $prevSsl = $env:NETBEEZ_SSL_VERIFY
    $env:NETBEEZ_BASE_URL = $script:NbUrl
    $env:NETBEEZ_API_KEY = $script:NbKey
    $env:NETBEEZ_SSL_VERIFY = $script:NbSsl

    $tmpJs = Join-Path $env:TEMP ("nb-mcp-verify-" + [guid]::NewGuid().ToString('N') + '.js')
    $prevConfigJs = $env:_NB_CONFIG_JS
    $env:_NB_CONFIG_JS = $configJs
    try {
        # Temp file + env var: avoids -e quoting and paths-with-spaces. argv[1] would be
        # the temp script itself (unlike `node -e`, where the first extra arg is argv[1]).
        $verifyJs = "const {pathToFileURL}=require('url');import(pathToFileURL(process.env._NB_CONFIG_JS).href).then(m=>{m.loadConfig();console.error('Config OK');process.exit(0);}).catch(e=>{console.error(e.message);process.exit(1);});`n"
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($tmpJs, $verifyJs, $utf8NoBom)

        $proc = Start-Process -FilePath $script:NodeExe -ArgumentList "`"$tmpJs`"" -NoNewWindow -PassThru
        if (-not $proc.WaitForExit(5000)) {
            try { $proc.Kill() } catch { }
            $ok = $false
        } elseif ($proc.ExitCode -eq 0) {
            $ok = $true
        }
    } catch {
        $ok = $false
    } finally {
        if (Test-Path -LiteralPath $tmpJs) {
            Remove-Item -LiteralPath $tmpJs -Force -ErrorAction SilentlyContinue
        }
        if ($null -eq $prevConfigJs) { Remove-Item Env:_NB_CONFIG_JS -ErrorAction SilentlyContinue } else { $env:_NB_CONFIG_JS = $prevConfigJs }
        if ($null -eq $prevUrl) { Remove-Item Env:NETBEEZ_BASE_URL -ErrorAction SilentlyContinue } else { $env:NETBEEZ_BASE_URL = $prevUrl }
        if ($null -eq $prevKey) { Remove-Item Env:NETBEEZ_API_KEY -ErrorAction SilentlyContinue } else { $env:NETBEEZ_API_KEY = $prevKey }
        if ($null -eq $prevSsl) { Remove-Item Env:NETBEEZ_SSL_VERIFY -ErrorAction SilentlyContinue } else { $env:NETBEEZ_SSL_VERIFY = $prevSsl }
    }

    if ($ok) {
        Write-Ok 'Configuration validated'
    } else {
        Write-Warn 'Configuration could not be validated (server may still work)'
    }

    Write-Host ""
    Write-Host '✓ NetBeez MCP Server installed successfully!' -ForegroundColor Green
    Write-Host ""
    Write-Info "Install location:  $($script:InstallDir)"
    Write-Info "Server binary:     $(Join-Path $script:InstallDir 'dist\index.js')"
    Write-Info "Configuration:     $(Join-Path $script:InstallDir '.env')"
    Write-Host ""
    if ($script:DevMode) {
        Write-Info "Development mode: agents use this directory. Run 'npm run build' to deploy changes."
    } else {
        Write-Info 'To update later, re-run this installer — it''s safe to run multiple times.'
    }
    Write-Host ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

function Invoke-Main {
    Write-Host ""
    Write-Host '╔══════════════════════════════════════════════╗' -ForegroundColor Cyan
    Write-Host '║   NetBeez MCP Server — Installer             ║' -ForegroundColor Cyan
    if ($script:DevMode) {
        Write-Host '║   (development mode)                          ║' -ForegroundColor Yellow
    }
    Write-Host '╚══════════════════════════════════════════════╝' -ForegroundColor Cyan
    Write-Host ""

    Test-Node
    Install-Repo
    Build-Server
    Set-Credentials
    Set-McpClients
    Test-Install
}

Invoke-Main
