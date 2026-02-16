# NetBeez Platform Overview & MCP Server Specification

This document summarizes how **NetBeez** works, how data is produced and correlated (based on the [NetBeez Tutorial](https://netbeez.github.io/netbeez-tutorial/)), and specifies a design for an **MCP (Model Context Protocol) server** that can retrieve, understand, and potentially manipulate NetBeez data.

---

## 1. How NetBeez Works

### 1.1 Architecture

NetBeez is a **distributed network monitoring platform**. Monitoring is performed from multiple points via agents (called **Beez**), which are managed by a central server called the **BeezKeeper**.

```
┌─────────────────────────────────────────────────────────────────┐
│                     BeezKeeper (Server)                          │
│  • Manages agents                                                │
│  • Stores test results & metrics                                 │
│  • Runs anomaly detection (alerts, incidents)                   │
│  • Generates reports & notifications                           │
│  • Hosts Dashboard + Public API                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Control channel (TCP, port 20018, SSL)
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │  Agent   │        │  Agent   │        │  Agent   │  ...
   │ (Beez)   │        │ (Beez)   │        │ (Beez)   │
   └────┬─────┘        └────┬─────┘        └────┬─────┘
        │                   │                   │
        └───────────────────┴───────────────────┘
                    Run tests → report to server
```

- **Agents** initiate an outbound connection to the BeezKeeper (simplifies deployment behind NAT/firewall).
- **Dashboard**: Web UI on the BeezKeeper for configuration, visualization, and troubleshooting.
- **API**: Public REST API per instance at `https://<NETBEEZ_HOSTNAME>/swagger/index.html` (Swagger). Authentication via API keys (Settings → API Keys).

### 1.2 Agent Types

| Category | Types | Notes |
|----------|--------|------|
| **Network – Physical** | Wired (GigE), Wireless (WiFi 802.11ac) | Hardware sensors; PoE or PSU |
| **Network – Software** | Virtual, Linux (apt), Docker, AWS image | Data center, cloud, Raspberry Pi, etc. |
| **Remote Worker** | Windows, macOS | End-user laptops/desktops; work-from-home |

Remote worker agents support real-time tests (ping, TCP ping, DNS, HTTP/S, traceroute, path analysis), up to 20 real-time + 3 scheduled tests, and WiFi metrics.

### 1.3 Targets

A **target** is an application or service being monitored (e.g. a website, DNS server, VPN gateway).

- Defined by one or more **resources** (IP, FQDN, or URL).
- Each resource has its own **tests** and **alert profiles**.
- Targets can be: **SaaS** (e.g. Google, Zoom, Slack), **templates** (Website, DNS, VPN, Gateway), or **custom** (Ping, DNS, HTTP, Traceroute, Path Analysis).
- Special options: **Gateway testing** (agent uses its default gateway), **tests over VPN** (only when VPN is up).

---

## 2. How Data Is Produced

### 2.1 Real-Time Tests (Target-Based)

Tests are bound to **targets** and run on **agents** assigned to those targets. Results are sent to the BeezKeeper in real time.

| Test | Default interval | Purpose |
|------|------------------|--------|
| **Ping** | 5 s | ICMP or TCP; RTT, packet loss; optional jitter/MOS |
| **DNS** | 30 s | Lookup (e.g. dig); optional DNS server parameter |
| **HTTP** | 60 s | GET (e.g. curl); HTTP/HTTPS, auth, proxy |
| **Traceroute** | 120 s | ICMP/TCP/UDP; path to destination |
| **Path Analysis** | 300 s | Enhanced traceroute; RTT per hop, ASN, Geo-IP, etc. |

- Minimum interval: 1 s (except Path Analysis, 60 s).
- **QoS**: DSCP marking supported on ping, traceroute, Iperf, VoIP.
- **Endpoint metrics** (optional): CPU, RAM, HDD on agent; can be shown on Ping/DNS/HTTP graphs.

### 2.2 Scheduled Tests

Run on a **schedule** (hourly, daily, weekly, custom), not on a fixed second interval.

| Type | Purpose |
|------|--------|
| **Iperf** | Throughput (TCP/UDP); client–client or client–Iperf server; optional reverse mode |
| **Network speed** | Speedtest (Ookla), NDT (M-Lab), or Fast.com; download/upload/latency |
| **VoIP** | Simulated call between two agents; MOS, jitter, packet loss, latency; codec options (G.711, G.729, etc.) |

### 2.3 WiFi Data

- **Network agents (WiFi)**: Configured with SSID profiles on the dashboard; can do SSID hopping (rotate across multiple SSIDs), band hopping, connection timing, packet capture.
- **Remote worker agents**: Report WiFi metrics from the OS (SSID, BSSID, RSSI, bitrate, channel, etc.); connection/disconnection events.
- **WiFi metrics** (examples): TX/RX (Bps), SSID, BSSID, RSSI (dBm), link quality (%), bitrate (Mbps), channel, frequency.

### 2.4 ISP Tagging

When an agent connects, the dashboard can tag it with **ISP name** and **ASN** (from external IP). Used for filtering and troubleshooting (e.g. “all agents on ISP X”).

---

## 3. How Data Is Correlated

### 3.1 Anomaly Detection Pipeline

```
Real-time tests (per agent, per target)
         │
         ▼
   Alert detectors (per test type, per target)
         │
         ▼
   Alerts (e.g. up-down, baseline, watermark)
         │
         ▼
   Incidents (when % of tests in scope cross threshold)
         │
         ▼
   Notifications (email, Slack, SNMP, Syslog, webhooks, etc.)
```

### 3.2 Alert Profiles

Attached to **targets**; **test-specific** (ping, DNS, HTTP, etc.). Types:

- **Up-Down**: Test fails for N consecutive tries (e.g. loss of reachability).
- **Performance Baseline**: Short-term average vs long-term baseline (1m/15m/1h/4h vs 1d/1w/1m); alerts on degradation.
- **Performance Watermark**: Short-term average vs user-defined threshold (e.g. loss &gt; 5%, DNS &gt; 100 ms).
- **Baseline + Watermark**: Both conditions required.
- **Down-Up**: Test succeeds (e.g. content filtering / firewall checks).

Optional: **percentile-based mean** (e.g. 95th percentile) to reduce outliers and false positives.

### 3.3 Incidents

- **Incident** = period of degraded/abnormal performance for an **agent**, **target**, or **WiFi network**.
- Triggered when a **configurable percentage** of tests (in that scope) trigger alerts.
- **Incident threshold** is set under Anomaly Detection → Incidents Configuration.
- Incidents can be **acknowledged** and **commented**.
- When an agent is unreachable, its tests go to “unknown” and incidents/alerts for that agent are cleared.

### 3.4 Device Alerts

- Agent unreachable from dashboard.
- WiFi agent unable to connect to WiFi for a configured time (e.g. WiFi disconnection threshold).

### 3.5 Cross-Agent Correlation (Troubleshooting)

By comparing **the same target** across **multiple agents**:

- If **Ping** fails for all agents → likely **network** or **destination** issue.
- If **Ping** OK, **DNS** fails for all → **DNS** issue.
- If **Ping** and **DNS** OK, **HTTP** fails → **web server / application** issue.
- If only **one agent** has issues → likely **path or access** specific to that agent (e.g. site, ISP).

This logic is what makes “target + many agents” powerful for root-cause analysis.

---

## 4. Reports and API

- **Legacy reports**: Network summary, Agents, Targets, Scheduled tests; PDF export; presets for email scheduling.
- **Reports Beta**: Network status, agent reports (more in future); no email/PDF yet.
- **Report schedules**: Cron-like; email with link (can be public).
- **Weekly reports**: Email with “5 least performing” agents, targets, WiFi networks.
- **API**: REST API documented in Swagger at `https://<NETBEEZ_HOSTNAME>/swagger/index.html`. Used by the [public dashboard](https://github.com/netbeez/public-dashboard) (PHP) for status, alerts, availability, speed, HTTP response times.

---

## 5. MCP Server Specification

This section defines an MCP server that can **retrieve**, **understand**, and **manipulate** NetBeez data via the existing REST API and, where applicable, by guiding the user through the Dashboard.

### 5.1 Configuration

- **Base URL**: `https://<NETBEEZ_HOSTNAME>` (or custom port).
- **API key**: From NetBeez Dashboard → Settings → API Keys.
- **API version**: Referenced as `v1` in public dashboard; Swagger should be checked for actual path (e.g. `/api/v1` or similar).
- **SSL**: Support optional skip of peer/host verification for on-prem instances (document only; recommend secure defaults).

Suggested MCP server env vars:

- `NETBEEZ_BASE_URL` – BeezKeeper base URL.
- `NETBEEZ_API_KEY` – API key for authentication.

### 5.2 Proposed MCP Tools (Retrieve & Understand)

| Tool | Purpose | NetBeez concept |
|------|--------|------------------|
| **list_agents** | List agents with optional filters (group, type, ISP, ASN, status) | Agents |
| **get_agent** | Agent details: tests, metrics, WiFi, endpoint metrics, last seen | Agent |
| **list_targets** | List targets (and optionally resources) | Targets, resources |
| **get_target** | Target details, resources, assigned agents, test config | Target |
| **list_tests** | Tests for a target or agent (real-time + scheduled) | Tests |
| **get_test_results** | Historical or recent results for a test (e.g. CSV-like or JSON) | Test results |
| **list_incidents** | Open/recent incidents (agent, target, WiFi); filters by time/scope | Incidents |
| **get_incident** | Incident details, related alerts, comments | Incident |
| **list_alerts** | Alerts (by agent, target, time range) | Alerts |
| **list_wifi_networks** | WiFi networks and assigned agents | WiFi networks |
| **get_scheduled_test_results** | Iperf, speed, VoIP results (with filters: agent, date range) | Scheduled tests |
| **get_buzz_summary** | High-level “Buzz” view: agent/target performance, open incidents | Buzz tab / dashboard summary |
| **search_agents** | Search by name, group, tag, ISP, ASN | Agents + ISP tagging |
| **get_path_analysis** | Path analysis data for agent/target (hops, RTT, ASN) | Path Analysis |

These tools map to “read-only” usage of the API; exact endpoints come from Swagger.

### 5.3 Proposed MCP Tools (Manipulate)

| Tool | Purpose | NetBeez concept |
|------|--------|------------------|
| **run_adhoc_test** | Run one-off ping, DNS, HTTP, traceroute, etc. (agent + destination) | Ad-hoc tests |
| **acknowledge_incident** | Set incident to acknowledged (if API supports it) | Incidents |
| **add_incident_comment** | Add comment to incident (if API supports it) | Incidents |
| **trigger_ssid_scan** | Request SSID scan for an agent (if API supports it) | WiFi / SSID scan |

Create/update of agents, targets, alert profiles, and notification config are typically done in the Dashboard; the MCP server can either expose them only via “guidance” (e.g. return links + steps) or add tools later if the API supports them.

### 5.4 Data Shapes (Understanding)

The MCP server should normalize and describe key entities so that an LLM or client can “understand” the data:

- **Agent**: id, name, type (network/remote worker), group(s), status (online/offline/unknown), IPs (IPv4, IPv6, external), ISP, ASN, tags, last seen.
- **Target**: id, name, resources (address, type), test types, alert profiles, assigned agents.
- **Resource**: address (IP/FQDN/URL), tests enabled, alert profile.
- **Test (real-time)**: type (ping, DNS, HTTP, traceroute, path_analysis), interval, target/resource, agents.
- **Test (scheduled)**: type (iperf, speed, voip), schedule, participants (agents/servers).
- **Alert**: test, agent/target, trigger type (up-down, baseline, watermark), time, state.
- **Incident**: scope (agent/target/wifi), start/end, acknowledged, alerts/comments.
- **WiFi network**: SSID, security, agents, metrics schema (RSSI, bitrate, channel, etc.).

The server can return short “summary” fields (e.g. “last 24h alerts count”, “current status”) where the API provides them.

### 5.5 Correlation Helpers (Optional)

- **correlate_target_health**: For one target, return status (or last N results) per agent to suggest “all agents down” vs “one agent down”.
- **suggest_root_cause**: Given an incident or set of alerts, return a short textual hint (network vs DNS vs application vs single-agent) based on which tests failed and on how many agents (implemented using the correlation rules in §3.5).

These can be implemented as MCP tools that call the same list/get tools and apply the correlation logic in the server.

### 5.6 Implementation Notes

1. **Swagger**: On first integration, fetch `https://<NETBEEZ_HOSTNAME>/swagger/index.html` (or OpenAPI JSON) to get exact endpoints, query params, and response schemas.
2. **Pagination**: Follow API pagination for list endpoints (agents, targets, incidents, alerts).
3. **Rate limiting**: Respect any rate limits; optional client-side throttling.
4. **Errors**: Map HTTP 401/403 to “invalid or insufficient API key”; 5xx to “server error” with optional retry.
5. **Public dashboard**: Reuse or mirror the public dashboard’s API usage (agents, targets, status, alerts, availability, speed, HTTP) for the “retrieve & understand” tools.
6. **Write operations**: Only implement manipulate tools for endpoints that are documented and stable in the API.

---

## 6. Summary

- **NetBeez** = BeezKeeper (server + dashboard + API) + distributed agents (Beez) running **real-time** and **scheduled** tests against **targets**.
- **Data production**: Agents run tests (ping, DNS, HTTP, traceroute, path analysis, Iperf, speed, VoIP) and report results and WiFi/endpoint metrics to the BeezKeeper.
- **Correlation**: **Alert profiles** on targets produce **alerts**; **incident thresholds** aggregate alerts into **incidents**; **notifications** are sent on alerts/incidents; comparing the same target across agents supports **root-cause reasoning** (network vs DNS vs application).
- An **MCP server** can use the **NetBeez REST API** (Swagger) and **API keys** to implement **list/get** tools for agents, targets, tests, results, incidents, alerts, WiFi, and scheduled tests, plus **manipulate** tools for ad-hoc tests and (where supported) incident acknowledgment and comments. Data shapes and optional correlation helpers will let an LLM or client **retrieve**, **understand**, and **manipulate** NetBeez data in a structured way.

---

*References: [NetBeez Tutorial](https://netbeez.github.io/netbeez-tutorial/), [Public Dashboard](https://github.com/netbeez/public-dashboard), NetBeez instance Swagger at `https://<hostname>/swagger/index.html`.*
