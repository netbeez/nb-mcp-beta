# NetBeez MCP Server

A Model Context Protocol (MCP) server that connects LLM clients (Cursor, Claude Desktop, etc.) to the [NetBeez](https://netbeez.net) network monitoring platform. Enables AI-assisted network troubleshooting, monitoring analysis, and incident investigation.

## Features

- **18 tools** for querying agents, targets, tests, alerts, incidents, WiFi profiles, statistics, path analysis, and running ad-hoc speed/VoIP tests
- **3 contextual resources** providing the LLM with NetBeez data model knowledge, cross-agent correlation methodology, and troubleshooting workflows
- **4 prompt templates** for common workflows: troubleshoot target, analyze agent health, investigate incident, network overview
- **Dual transport**: stdio (for Cursor/Claude Desktop) and HTTP (for remote clients)

## Quick Start (Recommended)

Run the one-line installer — it handles everything: Node.js, dependencies, build, credentials, and MCP client configuration:

```bash
curl -fsSL https://raw.githubusercontent.com/netbeez/nb-mcp-beta/main/install.sh | bash
```

The installer will prompt you for:
1. Your **NetBeez instance URL** (e.g. `https://demo1.netbeezcloud.net`)
2. Your **API key** (from Dashboard → Settings → API Keys)
3. **SSL verification** preference (disable for self-signed certs)
4. Which **MCP clients** to configure (Cursor, Claude Desktop, Windsurf, Codex)

The script is idempotent — re-run it any time to update to the latest version or change your configuration.

### What the installer does

| Step | Detail |
|------|--------|
| Node.js | Checks for Node.js 18+; installs via Homebrew, apt, or nvm if missing |
| Clone | Clones the repo to `~/.netbeez-mcp` (or pulls latest if already installed) |
| Build | Runs `npm install` and `npm run build` |
| Configure | Prompts for credentials and writes `~/.netbeez-mcp/.env` |
| MCP clients | Merges the server entry into Cursor / Claude Desktop / Windsurf / Codex config |

## Prerequisites

If you prefer to install manually, you'll need:

- Node.js 18+
- Git
- A NetBeez BeezKeeper instance with API access
- An API key (Dashboard → Settings → API Keys)

## Manual Installation

### 1. Clone & build

```bash
git clone https://github.com/netbeez/nb-mcp-beta.git ~/.netbeez-mcp
cd ~/.netbeez-mcp
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

Add to your Cursor MCP settings (`~/.cursor/mcp.json`):

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

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

Add to your Windsurf MCP config (`~/.codeium/windsurf/mcp_config.json`):

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

Add to your Codex config (`~/.codex/config.json`):

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

> **Tip:** The installer (`curl | bash` above) writes these config files automatically.

## Updating

Re-run the installer to pull the latest version and rebuild:

```bash
curl -fsSL https://raw.githubusercontent.com/netbeez/nb-mcp-beta/main/install.sh | bash
```

Your existing credentials will be shown as defaults — press Enter to keep them.

## Uninstalling

```bash
rm -rf ~/.netbeez-mcp
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

## Tools (18)

### Agent Tools (5)
| Tool | Description |
|------|-------------|
| `list_agents` | List all agents with filtering by name, category, class, active status |
| `get_agent` | Get detailed info for a specific agent by ID |
| `search_agents` | Search agents by name (exact or regex) |
| `get_agent_logs` | Get connection/disconnection event logs (including WiFi/DHCP for wireless) |
| `get_agent_performance_metrics` | Get CPU, memory, disk usage over time |

### Target Tools (2)
| Tool | Description |
|------|-------------|
| `list_targets` | List monitoring targets with filters |
| `get_target` | Get target details with test templates |

### Test & Results Tools (3)
| Tool | Description |
|------|-------------|
| `list_tests` | List all monitoring tests (ping/dns/http/traceroute/path_analysis) |
| `get_test_results` | Get test results by type with time range and agent filters |
| `get_path_analysis_results` | Get hop-by-hop path analysis data |

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

### Other Tools (3)
| Tool | Description |
|------|-------------|
| `list_wifi_profiles` | List WiFi profiles and their incident status |
| `get_scheduled_test_results` | Get results for scheduled tests (Iperf/Speed/VoIP) |
| `run_adhoc_test` | Run an on-demand speed test, VoIP test, or Iperf test |

## Resources (3)

| Resource | URI | Description |
|----------|-----|-------------|
| NetBeez Data Model | `netbeez://data-model` | Entity relationships, data shapes, timeseries data catalog |
| Correlation Guide | `netbeez://correlation-guide` | Cross-agent correlation methodology, alert interpretation |
| Troubleshooting Guide | `netbeez://troubleshooting-guide` | Step-by-step troubleshooting workflows |

## Prompts (4)

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| `troubleshoot-target` | `target_name` or `target_id` | Guided workflow to diagnose target issues |
| `analyze-agent-health` | `agent_name` or `agent_id` | Comprehensive agent health check |
| `investigate-incident` | `incident_id` | Deep dive into a specific incident |
| `network-overview` | (none) | Overall network health summary |

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
│   ├── agents.ts             # Agent tools (5)
│   ├── targets.ts            # Target tools (2)
│   ├── tests.ts              # Test tools (2)
│   ├── incidents.ts          # Incident tools (1)
│   ├── alerts.ts             # Alert tools (1)
│   ├── wifi.ts               # WiFi tools (1)
│   ├── scheduled-tests.ts    # Scheduled test tools (1)
│   ├── statistics.ts         # Statistics tools (3)
│   ├── path-analysis.ts      # Path analysis tools (1)
│   └── actions.ts            # Action tools (1)
├── resources/
│   ├── data-model.ts         # Entity relationships and data shapes
│   ├── correlation-guide.ts  # Cross-agent correlation patterns
│   └── troubleshooting-guide.ts
└── prompts/
    ├── troubleshoot-target.ts
    ├── analyze-agent-health.ts
    ├── investigate-incident.ts
    └── network-overview.ts
```

## API Coverage

The server communicates with two NetBeez API layers:

- **JSON:API** (primary): All entity and relationship endpoints using `Authorization: Bearer <key>` authentication. Supports filtering, pagination, includes, and ordering.
- **Legacy API**: Three statistics endpoints (`nb_test_statistics`, `nb_agent_statistics`, `access_point_metrics`) using `Authorization: <key>` + `API-VERSION: v1` headers.

## License

MIT
