/**
 * MCP Resource: Cross-Agent Correlation Guide
 *
 * How to compare results across agents and identify patterns.
 */

export const CORRELATION_GUIDE_URI = "netbeez://correlation-guide";
export const CORRELATION_GUIDE_NAME = "NetBeez Correlation Guide";
export const CORRELATION_GUIDE_DESCRIPTION =
  "Cross-agent correlation methodology, alert severity interpretation, and incident aggregation patterns";
export const CORRELATION_GUIDE_MIME = "text/markdown";

export const CORRELATION_GUIDE_CONTENT = `# NetBeez Cross-Agent Correlation Guide

## Core Principle

NetBeez deploys multiple monitoring agents across the network, each running the same tests to the same targets. By comparing results across agents, you can determine whether an issue is:
- **Localized** (one agent/site affected) → likely a local network or agent issue
- **Widespread** (many agents affected) → likely a target, service, or backbone issue

## Correlation Methodology

### Step 1: Identify the Scope

When investigating an issue, first determine how many agents are affected:

1. **Use \`list_alerts\`** with \`filter_status=open\` to see current open alerts
2. **Group by target**: Are multiple agents alerting on the same target?
3. **Group by agent**: Is one agent alerting on multiple targets?

**Pattern: Same target, multiple agents alerting** → Target or service is likely down/degraded
**Pattern: Same agent, multiple targets alerting** → Agent or its local network is likely the issue
**Pattern: One agent, one target** → Could be either; investigate further

### Step 2: Compare Test Types (Decision Tree)

For a given target, check results across test types:

\`\`\`
Ping failing?
├── YES → DNS also failing?
│   ├── YES → Network connectivity issue (can't reach anything)
│   │   → Check: Is the agent itself online? (get_agent, get_agent_logs)
│   │   → Check: Are other targets from this agent also failing?
│   └── NO → Ping-specific issue
│       → Target may be blocking ICMP
│       → Check: HTTP results for the same target
│
├── NO (ping OK but slow) → DNS results?
│   ├── DNS slow → DNS resolution issue
│   │   → Check: Which DNS server? Is it shared across agents?
│   └── DNS OK → HTTP results?
│       ├── HTTP slow → Application-level issue
│       │   → Check: Path analysis for routing problems
│       └── HTTP OK → Intermittent issue
│           → Check: Test statistics for trends over time
\`\`\`

### Step 3: Timeline Correlation

Align events across data sources using timestamps:

1. **Alert timestamps** (\`ts\`, \`closed_ts\`) — when did the problem start/end?
2. **Agent logs** — did the agent disconnect around the same time?
3. **Test results** — what were the actual values before/during/after?
4. **Path analysis** — did the network path change?
5. **WiFi metrics** (if wireless) — did signal quality degrade?

## Alert Severity Interpretation

| Severity | Meaning | Typical Trigger |
|----------|---------|-----------------|
| **1** | Failure (Critical) | Test completely failing (100% packet loss, DNS SERVFAIL, HTTP timeout) |
| **4** | Warning | Test degraded (high latency, partial packet loss, slow response) |
| **6** | Cleared (Recovered) | Issue resolved, test returned to normal |

### Alert Detector Types

- **Up-Down**: Binary — test is either passing or failing. Severity 1 when failing.
- **Baseline**: Statistical — compares current values against historical baseline. Triggers when values deviate significantly from normal.
- **Watermark**: Threshold — triggers when values exceed a configured threshold (e.g., latency > 200ms).

## Incident Aggregation

Incidents group related alerts:

- An incident is scoped to an **agent + target** (or **agent + WiFi profile**)
- Multiple test type alerts (ping + DNS + HTTP) for the same agent-target pair roll into one incident
- Incident **start_ts** = first alert timestamp
- Incident **end_ts** = when all alerts in the scope have cleared (null = still open)
- Incident **ack_ts** = when an operator acknowledged it (null = unacknowledged)

### Using Incidents for Triage

1. **Open incidents without ack_ts**: Unacknowledged issues needing attention
2. **Long-running incidents**: \`start_ts\` far in the past with no \`end_ts\` → persistent problems
3. **Incident with many logs**: Complex or flapping issues — check incident_logs for timeline

## WiFi-Specific Correlation

For wireless agents:

1. **Check WiFi signal** (\`get_access_point_metrics\`): Is link_quality < 0.5 or signal_level < -75 dBm?
2. **Check AP connections**: Is the agent roaming between APs frequently?
3. **Check agent logs for wpa_supplicant events**: Authentication failures? DHCP issues?
4. **Compare WiFi vs wired agents**: If wired agents to the same target are fine, the issue is WiFi-related

## Cross-Agent Performance Comparison

To compare the same test across agents:

1. Use \`get_test_statistics\` with \`nb_test_template_id\` (shared across agents) and different \`agent_id\` values
2. Compare values at the same timestamps
3. If one agent consistently shows higher latency → local network issue for that agent
4. If all agents show similar degradation → target or backbone issue
`;
