# NetBeez MCP Server

A Model Context Protocol (MCP) server that connects LLM clients (Cursor, Claude Desktop, etc.) to the [NetBeez](https://netbeez.net) network monitoring platform. Enables AI-assisted network troubleshooting, monitoring analysis, and incident investigation.

## Features

- **32 tools** for querying and managing agents, agent groups, targets, tests, scheduled test templates, alerts, incidents, WiFi profiles, statistics, path analysis, and running ad-hoc Iperf/speed/VoIP/custom command tests (including multiagent run status)
- **5 resources** providing the LLM with NetBeez data model knowledge, cross-agent correlation methodology, troubleshooting workflows, full API reference, and ad-hoc test guidance
- **5 prompt templates** for common workflows: troubleshoot target, analyze agent health, investigate incident, network overview, run ad-hoc tests
- **Dual transport**: stdio (for Cursor/Claude Desktop) and HTTP (for remote clients)

## Quick Start (Recommended)

Run the one-line installer — it handles everything: Node.js, dependencies, build, credentials, and MCP client configuration:

```bash
curl -fsSL https://raw.githubusercontent.com/netbeez/nb-mcp-server/main/install.sh | bash
```

The installer will prompt you for:
1. Your **NetBeez instance URL** (e.g. `https://demo1.netbeezcloud.net`)
2. Your **API key** (from Dashboard → Settings → API Keys)
3. **SSL verification** preference (disable for self-signed certs)
4. Which **MCP clients** to configure (Cursor, Claude Desktop, Windsurf, Codex, Kiro)

The script is idempotent — re-run it any time to update to the latest version or change your configuration.

## Quick Start (Windows)

Run the one-line installer from PowerShell — it handles everything: Node.js, dependencies, build, credentials, and MCP client configuration:

```powershell
irm https://raw.githubusercontent.com/netbeez/nb-mcp-server/main/install.ps1 | iex
```

The installer will prompt you for the same values as the Unix installer (instance URL, API key, SSL preference, and which MCP clients to configure). It is idempotent — re-run it any time to update or change your configuration.

If execution policy blocks a local run, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1
```

### Development install (no git push required)

From a clone of this repo, run the installer with `--dev` to point Cursor, Claude Desktop, Codex, Windsurf, and Kiro at your local build:

```bash
./install.sh --dev
# or from anywhere:
bash ~/path/to/nb-mcp-server/install.sh --dev
```

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1 --dev
```

Do **not** use `cat install.sh | bash` or `irm install.ps1 | iex` for development mode — those invocations receive no `--dev` flag and will download to the default install directory.

This skips cloning; it uses the current directory, runs `npm install` and `npm run build`, then configures the same MCP clients to use `./dist/index.js`. After making changes, run `npm run build` and restart the client — no need to push to git to test.

### What the installer does

| Step | Detail |
|------|--------|
| Node.js | Checks for Node.js 18+; installs via Homebrew, apt, or nvm (macOS/Linux) or winget (Windows) if missing |
| Download | Downloads the latest source from GitHub (no git required) and extracts to `~/.netbeez-mcp` (`%USERPROFILE%\.netbeez-mcp` on Windows) |
| Build | Runs `npm install` and `npm run build` |
| Configure | Prompts for credentials and writes `~/.netbeez-mcp/.env` |
| MCP clients | Merges the server entry into Cursor / Claude Desktop / Windsurf / Codex / Kiro config |

## Prerequisites

If you prefer to install manually, you'll need:

- Node.js 18+
- A NetBeez BeezKeeper instance with API access
- An API key (Dashboard → Settings → API Keys)

The one-line installer only requires Node.js 18+ and curl (macOS/Linux) or PowerShell 5.1+ (Windows). No git required.

## Manual Installation

### 1. Download & build

```bash
curl -fsSL https://github.com/netbeez/nb-mcp-server/archive/refs/heads/main.tar.gz -o nb-mcp-server.tar.gz
tar -xzf nb-mcp-server.tar.gz && cd nb-mcp-server-main
npm install
npm run build
```

### 2. Configure

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```
NETBEEZ_BASE_URL=https://your-instance.netbeezcloud.net
NETBEEZ_API_KEY=your-api-key-here
```

### 3. Run

```bash
npm start
```

## MCP Client Configuration

### Cursor

Add to your Cursor MCP settings (`~/.cursor/mcp.json` on macOS/Linux, `$env:USERPROFILE\.cursor\mcp.json` on Windows):

```json
{
  "mcpServers": {
    "netbeez": {
      "command": "node",
      "args": ["~/.netbeez-mcp/dist/index.js"],
      "env": {
        "NETBEEZ_BASE_URL": "https://your-instance.netbeezcloud.net",
        "NETBEEZ_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `~/.config/Claude/claude_desktop_config.json` on Linux, `$env:APPDATA\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "netbeez": {
      "command": "node",
      "args": ["~/.netbeez-mcp/dist/index.js"],
      "env": {
        "NETBEEZ_BASE_URL": "https://your-instance.netbeezcloud.net",
        "NETBEEZ_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Windsurf

Add to your Windsurf MCP config (`~/.codeium/windsurf/mcp_config.json` on macOS/Linux, `$env:USERPROFILE\.codeium\windsurf\mcp_config.json` on Windows):

```json
{
  "mcpServers": {
    "netbeez": {
      "command": "node",
      "args": ["~/.netbeez-mcp/dist/index.js"],
      "env": {
        "NETBEEZ_BASE_URL": "https://your-instance.netbeezcloud.net",
        "NETBEEZ_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Codex

Add to your Codex config (`~/.codex/config.toml` on macOS/Linux, `$env:USERPROFILE\.codex\config.toml` on Windows):

```toml
[mcp_servers.netbeez]
command = "node"
args = ["~/.netbeez-mcp/dist/index.js"]

[mcp_servers.netbeez.env]
NETBEEZ_BASE_URL = "https://your-instance.netbeezcloud.net"
NETBEEZ_API_KEY = "your-api-key-here"
```

### Kiro

Add to your Kiro user MCP config (`~/.kiro/settings/mcp.json` on macOS/Linux, `$env:USERPROFILE\.kiro\settings\mcp.json` on Windows):

```json
{
  "mcpServers": {
    "netbeez": {
      "command": "node",
      "args": ["~/.netbeez-mcp/dist/index.js"],
      "env": {
        "NETBEEZ_BASE_URL": "https://your-instance.netbeezcloud.net",
        "NETBEEZ_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Kiro also supports workspace-level MCP config at `.kiro/settings/mcp.json`.

> **Tip:** The installer (`curl | bash` or `irm | iex` above) writes these config files automatically.

## Updating

Re-run the installer to pull the latest version and rebuild:

```bash
curl -fsSL https://raw.githubusercontent.com/netbeez/nb-mcp-server/main/install.sh | bash
```

```powershell
irm https://raw.githubusercontent.com/netbeez/nb-mcp-server/main/install.ps1 | iex
```

Your existing credentials will be shown as defaults — press Enter to keep them.

If you installed with `--dev`, run `npm run build` in the repo and restart your MCP client to pick up changes.

## Uninstalling

```bash
rm -rf ~/.netbeez-mcp
```

```powershell
Remove-Item -Recurse -Force "$env:USERPROFILE\.netbeez-mcp"
```

Then remove the `"netbeez"` entry from your MCP client config file(s).

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NETBEEZ_BASE_URL` | Yes | — | BeezKeeper instance URL |
| `NETBEEZ_API_KEY` | Yes | — | API key for authentication |
| `NETBEEZ_SSL_VERIFY` | No | `true` | Set to `false` for self-signed certs |
| `MCP_TRANSPORT` | No | `stdio` | Transport mode: `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | No | `3000` | HTTP transport port |

## Tools (32)

### Agent Tools (6)
| Tool | Description |
|------|-------------|
| `list_agents` | List all agents with filtering by name, category, class, active status |
| `get_agent` | Get detailed info for a specific agent by ID |
| `search_agents` | Search agents by name (exact or regex) |
| `get_agent_logs` | Get connection/disconnection event logs (including WiFi/DHCP for wireless) |
| `get_agent_performance_metrics` | Get CPU, memory, disk usage over time |
| `get_agent_access_point_connections` | Get WiFi access point connection history (SSID/BSSID, signal, DHCP) for wireless troubleshooting |

### Agent Group Tools (4)
| Tool | Description |
|------|-------------|
| `list_agent_groups` | List agent groups with filtering and pagination |
| `get_agent_group` | Get a single agent group with relationships |
| `create_agent_group` | Create an agent group with member agents and optional target assignment |
| `update_agent_group` | Update an existing agent group (name, members, targets, auto_assign) |

### Target Tools (6)
| Tool | Description |
|------|-------------|
| `list_targets` | List monitoring targets with filters (agent groups, open incident, WiFi/wired, etc.) |
| `get_target` | Get target details with test templates |
| `create_target` | Create a custom monitoring target (raw JSON:API payload) |
| `create_target_saas` | Create a target from a built-in SaaS application |
| `create_target_from_template` | Create a target from simplified templates (Website, DNS, VPN, Gateway) |
| `update_target` | Update an existing target by ID (raw JSON:API payload) |

### Test & Results Tools (3)
| Tool | Description |
|------|-------------|
| `list_tests` | List all monitoring tests (ping/dns/http/traceroute/path_analysis) |
| `get_test_results` | Get test results by type with time range and agent filters |
| `get_path_analysis_results` | Get hop-by-hop path analysis data |

### Scheduled Test Tools (5)
| Tool | Description |
|------|-------------|
| `list_scheduled_test_templates` | List scheduled Iperf, Network Speed, and VoIP templates with filters |
| `get_scheduled_test_template` | Get a scheduled test template by ID |
| `create_scheduled_test_template` | Create a scheduled Iperf/Speed/VoIP template |
| `update_scheduled_test_template` | Update an existing scheduled test template |
| `get_scheduled_test_results` | Get results for a scheduled template (bandwidth, VoIP quality, Iperf) by time range and agents |

### Alert & Incident Tools (2)
| Tool | Description |
|------|-------------|
| `list_alerts` | List alerts with extensive filtering (severity, status, time, agents, targets) |
| `list_incidents` | List incidents with timeline, acknowledgement status, and event logs |

### Statistics Tools (3)
| Tool | Description |
|------|-------------|
| `get_test_statistics` | Aggregated test performance statistics over time |
| `get_agent_statistics` | Agent uptime/availability statistics |
| `get_access_point_metrics` | WiFi signal quality metrics (signal, quality, rates) |

### Ad-hoc & Other (3)
| Tool | Description |
|------|-------------|
| `run_adhoc_test` | Run an on-demand Iperf test (agent-to-agent or agent-to-server via IP/FQDN), network speed test, VoIP test (agent-to-agent), or custom command test (script on one or more agents); returns multiagent run ID |
| `get_multiagent_test_run_status` | Get status and results of a multiagent test run by ID (use after `run_adhoc_test` to poll or retrieve results) |
| `list_wifi_profiles` | List WiFi profiles and their incident status |

## Resources (5)

| Resource | URI | Description |
|----------|-----|-------------|
| NetBeez Data Model | `netbeez://data-model` | Entity relationships, data shapes, timeseries data catalog |
| Correlation Guide | `netbeez://correlation-guide` | Cross-agent correlation methodology, alert interpretation |
| Troubleshooting Guide | `netbeez://troubleshooting-guide` | Step-by-step troubleshooting workflows |
| API Reference | `netbeez://api-reference` | Comprehensive endpoint reference for JSON:API and legacy stats APIs |
| Ad-hoc Tests Guide | `netbeez://ad-hoc-tests` | Ad-hoc Iperf/Speed/VoIP/Custom Command payloads, polling, and result parsing |

## Prompts (5)

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `troubleshoot-target` | `target_name` or `target_id` | Guided workflow to diagnose target issues |
| `analyze-agent-health` | `agent_name` or `agent_id` | Comprehensive agent health check |
| `investigate-incident` | `incident_id` | Deep dive into a specific incident |
| `network-overview` | (none) | Overall network health summary |
| `run-adhoc-test` | `test_type`, `agent_hint`, `destination_hint` | Guided ad-hoc execution flow for Iperf, Speed, VoIP, and Custom Command tests |

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Test with MCP Inspector
npm run inspect
```

## Architecture

```
src/
├── index.ts                  # Entry point, transport setup
├── server.ts                 # MCP server definition, registration
├── config.ts                 # Environment variable loading
├── api/
│   ├── base-client.ts        # Shared HTTP client (fetch, retries, errors)
│   ├── jsonapi-client.ts     # JSON:API client (Bearer auth, filters, pagination)
│   ├── legacy-client.ts      # Legacy API client (API-VERSION v1)
│   └── types.ts              # TypeScript types for all entities
├── tools/
│   ├── agents.ts             # Agent tools (6)
│   ├── agent-groups.ts       # Agent group tools (4)
│   ├── targets.ts            # Target tools (6)
│   ├── tests.ts              # Test tools (2)
│   ├── incidents.ts          # Incident tools (1)
│   ├── alerts.ts             # Alert tools (1)
│   ├── wifi.ts               # WiFi tools (1)
│   ├── scheduled-tests.ts    # Scheduled test template & results tools (5)
│   ├── statistics.ts         # Statistics tools (3)
│   ├── path-analysis.ts      # Path analysis tools (1)
│   ├── actions.ts            # Ad-hoc test tools (2): run_adhoc_test, get_multiagent_test_run_status
│   └── ad-hoc.ts             # Re-exports actions for ad-hoc tests
├── resources/
│   ├── data-model.ts         # Entity relationships and data shapes
│   ├── correlation-guide.ts  # Cross-agent correlation patterns
│   ├── troubleshooting-guide.ts
│   ├── api-reference.ts      # API endpoint reference
│   └── ad-hoc-tests.ts       # Ad-hoc tests payloads and result parsing guide
└── prompts/
    ├── troubleshoot-target.ts
    ├── analyze-agent-health.ts
    ├── investigate-incident.ts
    ├── network-overview.ts
    └── run-adhoc-test.ts
```

## API Coverage

The server communicates with two NetBeez API layers:

- **JSON:API** (primary): All entity and relationship endpoints using `Authorization: Bearer <key>` authentication. Supports filtering, pagination, includes, and ordering.
- **Legacy API**: Three statistics endpoints (`nb_test_statistics`, `nb_agent_statistics`, `access_point_metrics`) using `Authorization: <key>` + `API-VERSION: v1` headers.

## License

MIT
