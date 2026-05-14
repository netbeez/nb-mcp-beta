# NetBeez Platform Overview & MCP Server Specification

This document summarizes how **NetBeez** works, how data is produced and correlated (based on the [NetBeez Tutorial](https://netbeez.github.io/netbeez-tutorial/)), and documents the **MCP (Model Context Protocol) server** implementation that retrieves, understands, and manages NetBeez data.

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

When an agent connects, the dashboard can tag it with **ISP name** and **ASN** (from external IP). Used for filtering and troubleshooting (e.g. "all agents on ISP X").

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
- **Performance Watermark**: Short-term average vs user-defined threshold (e.g. loss > 5%, DNS > 100 ms).
- **Baseline + Watermark**: Both conditions required.
- **Down-Up**: Test succeeds (e.g. content filtering / firewall checks).

Optional: **percentile-based mean** (e.g. 95th percentile) to reduce outliers and false positives.

### 3.3 Incidents

- **Incident** = period of degraded/abnormal performance for an **agent**, **target**, or **WiFi network**.
- Triggered when a **configurable percentage** of tests (in that scope) trigger alerts.
- **Incident threshold** is set under Anomaly Detection → Incidents Configuration.
- Incidents can be **acknowledged** and **commented**.
- When an agent is unreachable, its tests go to "unknown" and incidents/alerts for that agent are cleared.

### 3.4 Device Alerts

- Agent unreachable from dashboard.
- WiFi agent unable to connect to WiFi for a configured time (e.g. WiFi disconnection threshold).

### 3.5 Cross-Agent Correlation (Troubleshooting)

By comparing **the same target** across **multiple agents**:

- If **Ping** fails for all agents → likely **network** or **destination** issue.
- If **Ping** OK, **DNS** fails for all → **DNS** issue.
- If **Ping** and **DNS** OK, **HTTP** fails → **web server / application** issue.
- If only **one agent** has issues → likely **path or access** specific to that agent (e.g. site, ISP).

This logic is what makes "target + many agents" powerful for root-cause analysis.

---

## 4. Reports and API

- **Legacy reports**: Network summary, Agents, Targets, Scheduled tests; PDF export; presets for email scheduling.
- **Reports Beta**: Network status, agent reports (more in future); no email/PDF yet.
- **Report schedules**: Cron-like; email with link (can be public).
- **Weekly reports**: Email with "5 least performing" agents, targets, WiFi networks.
- **API**: REST API documented in Swagger at `https://<NETBEEZ_HOSTNAME>/swagger/index.html`. Used by the [public dashboard](https://github.com/netbeez/public-dashboard) (PHP) for status, alerts, availability, speed, HTTP response times.

---

## 5. MCP Server Implementation

The NetBeez MCP server (`netbeez-mcp-server` v1.0.0) retrieves, understands, and manages NetBeez data via the REST API. It is built with the [Model Context Protocol SDK](https://github.com/modelcontextprotocol/sdk) and exposes **33 tools**, **4 resources**, and **4 prompts**.

### 5.1 Configuration

| Environment Variable | Required | Default | Description |
|----------------------|----------|---------|-------------|
| `NETBEEZ_BASE_URL` | **Yes** | — | BeezKeeper instance URL (e.g. `https://demo1.netbeezcloud.net`) |
| `NETBEEZ_API_KEY` | **Yes** | — | API key from Dashboard → Settings → API Keys |
| `NETBEEZ_SSL_VERIFY` | No | `true` | Set to `false` to skip SSL certificate verification (for on-prem instances with self-signed certs) |
| `MCP_TRANSPORT` | No | `stdio` | Transport mode: `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | No | `3000` | Port for HTTP transport |

### 5.2 Transport Modes

| Mode | Description |
|------|-------------|
| **stdio** | Standard I/O transport for local MCP clients (Cursor, Claude Desktop). Default. |
| **http** | Streamable HTTP transport — serves MCP at `/mcp` (or `/`), health check at `/health`. |
| **both** | Starts both stdio and HTTP transports simultaneously. |

### 5.3 API Clients

The server uses two API clients to cover the full NetBeez API surface:

| Client | Auth Scheme | Used For |
|--------|-------------|----------|
| **JSON:API Client** | `Authorization: Bearer <API_KEY>` + `Content-Type: application/json` | All entity CRUD and test results (31 of 33 tools) |
| **Legacy Client** | `Authorization: <API_KEY>` (no Bearer) + `API-VERSION: v1` | Statistics endpoints: `get_test_statistics`, `get_agent_statistics`, `get_access_point_metrics` |

Both clients share a base client with retry logic (2 retries on 5xx with exponential backoff, no retry on 4xx) and structured error handling via `ApiError`.

### 5.4 Tools — Read Operations (23 tools)

#### Agents (6 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **list_agents** | List agents with optional filters | `filter_name`, `filter_name_regex`, `filter_categories` (network_agent, remote_worker_agent), `filter_agent_classes` (container, faste, wireless, gige, virtual, external, software, mac, windows), `filter_active`, `page`, `page_size` |
| **get_agent** | Get a single agent by ID | `agent_id` (required), `include` (network_interfaces, agent_groups) |
| **search_agents** | Search agents by name or regex | `query` (required), `use_regex`, `filter_categories`, `filter_agent_classes`, `filter_active` |
| **get_agent_logs** | Agent connection/disconnection event logs | `agent_id` (required), `filter_types`, timestamp filters (`filter_ts_operator`, `filter_ts_value1`, `filter_ts_value2`), `page`, `page_size` |
| **get_agent_performance_metrics** | CPU, memory, disk usage over time | `agent_id` (required), `from_ts`, `to_ts` |
| **get_agent_access_point_connections** | WiFi AP connection history | `agent_id` (required), timestamp filters, `order_by`, `order_direction`, `page`, `page_size` |

#### Targets (2 read tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **list_targets** | List monitoring targets | `filter_agents`, `filter_categories`, `filter_agent_classes`, `filter_agent_groups`, `filter_open_incident`, `filter_wifi`, `filter_wired`, `include`, `page`, `page_size` |
| **get_target** | Get a single target by ID | `target_id` (required), `include` |

#### Tests & Results (3 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **list_tests** | List test instances (nb_tests) | `filter_agents`, `filter_targets`, `filter_test_templates`, `filter_test_types`, `filter_ad_hoc`, `filter_current_states`, `filter_current_alert_modes`, `filter_wifi_profiles`, `page`, `page_size` |
| **get_test_results** | Get raw results by test type | `test_type` (required: ping, dns, http, traceroute), `filter_agents`, `filter_tests`, `filter_test_templates`, timestamp filters, `page`, `page_size` |
| **get_path_analysis_results** | Hop-by-hop path analysis data | `filter_agents`, `filter_tests`, `filter_test_templates`, `filter_ip_address`, timestamp filters, `timestamp` (for a single result at an exact time), `include`, `page`, `page_size` |

#### Alerts & Incidents (3 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **list_alerts** | List alerts with rich filtering | `filter_agents`, `filter_targets`, `filter_tests`, `filter_test_templates`, `filter_alert_detectors`, `filter_categories`, `filter_agent_classes`, `filter_agent_groups`, `filter_severity_operator`, `filter_severity_value1`, `filter_status` (open, closed), `filter_message`, timestamp filters for `ts` and `closed_ts`, `page`, `page_size` |
| **list_alert_detectors** | List alert detector rule definitions | `filter_default`, `filter_alert_detector_types` (AgentUpDown, UpDown, Watermark, Baseline, BaselineWatermark), `filter_alerting_entity_types` (Agent, NbTest), `filter_test_types`, `filter_tests`, `filter_agents`, `order_by`, `order_direction`, `page`, `page_size` |
| **list_incidents** | List incidents | `filter_ids`, `filter_agents`, `filter_categories`, `filter_agent_classes`, `filter_targets`, `filter_wifi_profile`, timestamp filters for `ack_ts`, `end_ts`, `start_ts`, `include` (incident_logs), `page`, `page_size` |

#### WiFi (1 tool)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **list_wifi_profiles** | List WiFi profile configurations | `filter_ssid`, `filter_description`, `filter_encryption_method`, `filter_authentication_method`, `filter_open_incident`, `page`, `page_size` |

#### Scheduled Tests (3 read tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **list_scheduled_test_templates** | List Iperf/Speed/VoIP templates | `label`, `test_type_id` (5=iperf, 7=speed, 8=VoIP), `agent_ids`, `destination_agent_id`, `by_destination`, `order_by`, `order_direction`, `page`, `page_size` |
| **get_scheduled_test_template** | Get a single scheduled test template | `template_id` (required) |
| **get_scheduled_test_results** | Get results for a scheduled test template | `template_id` (required), `filter_agents`, timestamp filters, `order_by`, `order_direction`, `page`, `page_size` |

#### Agent Groups (2 read tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **list_agent_groups** | List agent groups | `filter_name`, `filter_name_regex`, `order_by`, `order_direction`, `page`, `page_size` |
| **get_agent_group** | Get a single agent group | `agent_group_id` (required), `include` |

#### Statistics (3 tools — Legacy API)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **get_test_statistics** | Aggregated test performance statistics. `metric_type` selects which statistical view or derived metric to retrieve — one of `mean`, `percentile_mean`, `stdev`, `jitter`, `mos` (`jitter`/`mos` only for VoIP tests, or Ping tests with jitter/MOS enabled). | `nb_test_id`, `agent_id`, `nb_test_template_id`, `nb_target_id`, `window_size`, `granularity`, `from`, `to`, `last`, `metric_type`, `grouping`, `test_type_id`, `ts_order`, `sort_by`, `sort_by_order`, `value_operator`, `value_watermark` |
| **get_agent_statistics** | Agent uptime/availability over time | `agent_id` (required), `from`, `to`, `window_size`, `last` |
| **get_access_point_metrics** | WiFi signal quality metrics | `agent_id`, `access_point_id`, `from`, `to`, `cardinality` (triggers downsampled endpoint) |

### 5.5 Tools — Write Operations (10 tools)

#### Targets (4 write tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **create_target** | Create a custom monitoring target | `body` (required — JSON:API document or JSON string) |
| **create_target_saas** | Create a SaaS target (e.g. Google, Zoom) | `body` (required) |
| **create_target_from_template** | Create a target from a predefined template | `body` (required) |
| **update_target** | Update an existing target | `target_id` (required), `body` (required) |

#### Scheduled Tests (2 write tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **create_scheduled_test_template** | Create Iperf/Speed/VoIP template | `test_type_id` (5, 7, 8), `label`, `cron_schedule`, `agent_ids[]`, `target`, `target_is_agent`, `secure`, Iperf params (`iperf_port`, `iperf_time`, `iperf_type`, `iperf_version`, `parallel_streams`, `reverse`, `bandwidth`), Speed params (`speedtest_type`: 1–4), VoIP params (`codec`, `voip_port`, `voip_time`, `num_of_concurrent_calls`) |
| **update_scheduled_test_template** | Update an existing template | `template_id` (required) + same optional fields as create |

#### Agent Groups (2 write tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **create_agent_group** | Create a new agent group | `name` (required), `agent_ids[]` (required), `nb_target_ids`, `auto_assign`, `force` |
| **update_agent_group** | Update an existing agent group | `agent_group_id` (required), `name`, `agent_ids[]`, `nb_target_ids`, `auto_assign`, `force` |

#### Ad-Hoc Tests (2 tools)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| **run_adhoc_test** | Run an on-demand Iperf/Speed/VoIP test | `agent_ids[]` (required), `test_type_id` (5/7/8 or iperf/speed/voip), `speedtest_type` (for speed), `target`, `secure`, `destination_agent_id`, Iperf params (`iperf_time`, `iperf_type`, `iperf_port`, `iperf_version`, `parallel_streams`, `reverse`, `bandwidth`). Polls for completion every 5 s, up to 5 minutes. |
| **get_multiagent_test_run_status** | Check status of an ad-hoc test run | `multiagent_nb_test_run_id` (required) |

### 5.6 MCP Resources (4 contextual documents)

Resources are read-only reference documents that MCP clients can fetch to provide context to the LLM.

| Resource | URI | Description |
|----------|-----|-------------|
| **NetBeez Data Model** | `netbeez://data-model` | Entity relationships (Agent, Target, Test, Alert Detector, Alert, Incident, WiFi Profile), timeseries data catalog, and ID relationships. |
| **NetBeez Correlation Guide** | `netbeez://correlation-guide` | Cross-agent correlation methodology: how to determine localized vs widespread issues, decision tree by test type, timeline correlation, alert severity interpretation (1=critical, 4=warning, 6=cleared), incident aggregation patterns. |
| **NetBeez Troubleshooting Guide** | `netbeez://troubleshooting-guide` | Step-by-step troubleshooting workflows: (1) network vs DNS vs application, (2) single agent vs all agents, (3) WiFi vs wired comparison, (4) path analysis for hop-by-hop diagnosis, (5) agent health investigation. Includes a quick-reference tool selection guide. |
| **NetBeez API Reference** | `netbeez://api-reference` | Complete API documentation covering both JSON:API and Legacy endpoints — authentication, pagination, filtering (simple, regex, timestamp/operator), ordering, includes, response envelope structure, all endpoint paths, and response schemas. |

### 5.7 MCP Prompts (4 workflow templates)

Prompts are pre-built, multi-step investigation workflows that guide the LLM through structured troubleshooting.

| Prompt | Arguments | Description |
|--------|-----------|-------------|
| **troubleshoot-target** | `target_name?`, `target_id?` | 7-step workflow: identify target → check incidents → check alerts → analyze alert pattern → get test results → check path analysis → check trends. For "X is down" or "X is slow" reports. |
| **analyze-agent-health** | `agent_name?`, `agent_id?` | 7-step workflow: agent status → connection history → system resources → uptime statistics → current alerts → test results spot-check → WiFi health (if wireless). For unreliable or unhealthy agents. |
| **investigate-incident** | `incident_id` (required) | 7-step workflow: incident overview → timeline (incident_logs) → related alerts → agent status → test results during incident → cross-agent comparison → path analysis. Produces a comprehensive incident report. |
| **network-overview** | *(none)* | 5-step workflow: agent fleet status → open incidents → active alerts → target health → WiFi status. Generates an executive-friendly network health dashboard summary. For daily check-ins or shift handoffs. |

### 5.8 Data Shapes

The server normalizes and exposes these key entity shapes:

- **Agent**: id, name, active (boolean), agent_class (container, faste, wireless, gige, virtual, external, software, mac, windows), category (network_agent, remote_worker_agent), software_version, ip_address, mac_address, location, latitude, longitude, isp_name, isp_asn, logged_in_user, in_incident (boolean). Has many: tests, network interfaces, tags, agent groups, performance metrics, logs, access point connections.

- **Target**: id, name, target (hostname/IP/URL), description. Has many: test templates (each defining test_type_id, target, interval, alert_detector_ids, nb_test_ids).

- **Test (nb_test)**: id, test_type, schedule_type, current_state, alert_mode. Belongs to: agent, target, test template. Produces results (ping/dns/http/traceroute/path_analysis).

- **Alert Detector**: id, name, alert_detector_type (AgentUpDown, UpDown, Watermark, Baseline, BaselineWatermark), type_of_alerting_entity (Agent, NbTest), alerts_severity, attach_by_default, alert_condition, reverse_alert_condition, message, reverse_message, stats_function, stream_source, window_type, window_size, function_arguments.

- **Alert**: id, severity (1=critical, 4=warning, 6=cleared), message, ts, closed_ts, status (open, closed). Relates to: agents, targets, test templates, alert detectors.

- **Incident**: id, start_ts, end_ts (null if still open), ack_ts (null if unacknowledged). Can include: incident_logs (timeline). Relates to: agents, targets, WiFi profiles.

- **WiFi Profile**: id, ssid, description, encryption_method, authentication_method.

- **Scheduled Test Template**: id, label, test_type_id (5=iperf, 7=speed, 8=VoIP), cron_schedule, agent_ids, target, codec, iperf params, speedtest_type. Has results.

- **Test Results** (per type):
  - **Ping**: timestamp, value (RTT ms), lost (packet loss), sequence_number.
  - **DNS**: timestamp, value (lookup time), resolution data.
  - **HTTP**: timestamp, value (response time), HTTP status.
  - **Traceroute**: timestamp, hop-by-hop data.
  - **Path Analysis**: per-hop rtt, ip_address, natted, destination, dest_port, hop_number, error_code/message.

- **Test Statistics** (aggregated): timestamp, value (avg/min/max), window_size, datapoint_count, error_count.
- **Agent Statistics**: timestamp, uptime (0–100%), interval, window_size.
- **Access Point Metrics**: bit_rate, channel, link_quality (0–1), signal_level (dBm), rx_rate, tx_rate, timestamp.

### 5.9 Timestamp Handling

All tools that accept timestamps support flexible input formats:

| Input Format | Example | Handling |
|--------------|---------|----------|
| Unix epoch milliseconds | `1700000000000` | Used as-is |
| Unix epoch seconds | `1700000000` | Converted to milliseconds |
| ISO 8601 string | `2024-01-15T10:30:00Z` | Parsed and converted to epoch ms |

Response timestamps are always Unix epoch milliseconds (integer).

### 5.10 Implementation Notes

1. **Two API surfaces**: The NetBeez platform exposes both a JSON:API and a Legacy API. The MCP server abstracts both behind a unified tool interface. Tools using the Legacy API: `get_test_statistics`, `get_agent_statistics`, `get_access_point_metrics`.
2. **Pagination**: JSON:API endpoints use offset-based pagination (`page[offset]`, `page[limit]`). Response `meta.page.next` indicates whether more pages exist. Legacy endpoints return all matching records filtered by time range.
3. **Retry logic**: 5xx errors are retried up to 2 times with exponential backoff. 4xx errors are not retried.
4. **SSL verification**: Can be disabled via `NETBEEZ_SSL_VERIFY=false` for on-prem instances with self-signed certificates. Sets `NODE_TLS_REJECT_UNAUTHORIZED=0`.
5. **Ad-hoc test polling**: `run_adhoc_test` submits the test then polls for completion every 5 seconds, up to a 5-minute timeout, returning the final result.
6. **JSON:API beta flag**: Most JSON:API endpoints require the `type=beta` query parameter, which the client adds automatically.

---

## 6. Summary

- **NetBeez** = BeezKeeper (server + dashboard + API) + distributed agents (Beez) running **real-time** and **scheduled** tests against **targets**.
- **Data production**: Agents run tests (ping, DNS, HTTP, traceroute, path analysis, Iperf, speed, VoIP) and report results and WiFi/endpoint metrics to the BeezKeeper.
- **Correlation**: **Alert detectors** on targets produce **alerts**; **incident thresholds** aggregate alerts into **incidents**; **notifications** are sent on alerts/incidents; comparing the same target across agents supports **root-cause reasoning** (network vs DNS vs application).
- The **MCP server** (`netbeez-mcp-server` v1.0.0) uses both the **JSON:API** and **Legacy** NetBeez REST APIs to implement **33 tools** (23 read + 10 write), **4 contextual resources** (data model, correlation guide, troubleshooting guide, API reference), and **4 prompt workflows** (troubleshoot-target, analyze-agent-health, investigate-incident, network-overview). It supports **stdio** and **HTTP** transports, flexible timestamp handling, and automatic retry with exponential backoff.

---

*References: [NetBeez Tutorial](https://netbeez.github.io/netbeez-tutorial/), [Public Dashboard](https://github.com/netbeez/public-dashboard), NetBeez instance Swagger at `https://<hostname>/swagger/index.html`, [MCP SDK](https://github.com/modelcontextprotocol/sdk).*
