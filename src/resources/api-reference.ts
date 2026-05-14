/**
 * MCP Resource: NetBeez API Reference
 *
 * Comprehensive documentation for all available API endpoints, including
 * JSON:API endpoints and the three Legacy/Swagger statistics endpoints.
 */

export const API_REFERENCE_URI = "netbeez://api-reference";
export const API_REFERENCE_NAME = "NetBeez API Reference";
export const API_REFERENCE_DESCRIPTION =
  "Complete reference for all NetBeez API endpoints — JSON:API and Legacy statistics — with authentication, filtering, pagination, ordering, and response schemas";
export const API_REFERENCE_MIME = "text/markdown";

export const API_REFERENCE_CONTENT = `# NetBeez API Reference

The NetBeez platform exposes two API surfaces:

1. **JSON:API** — The primary REST API for all entity CRUD operations and test results. Uses \`Bearer\` token auth and JSON:API conventions.
2. **Legacy API** — Three statistics/metrics endpoints. Uses plain API key auth with \`API-VERSION: v1\`.

Both APIs are served from the same base URL (e.g. \`https://your-instance.netbeezcloud.net\`).

---

## Authentication

### JSON:API Endpoints (full documentation at https://api.netbeez.net)

\`\`\`
Authorization: Bearer <API_KEY>
Content-Type: application/json
\`\`\`

Most JSON:API endpoints also require the query parameter \`type=beta\`.

**Note:** Although these endpoints follow the JSON:API \`{ data: { type, attributes, relationships } }\` payload shape, the beta server only parses request bodies when the \`Content-Type\` is \`application/json\` (not \`application/vnd.api+json\`).

### Legacy API Endpoints

\`\`\`
Authorization: <API_KEY>
API-VERSION: v1
\`\`\`

Note: No \`Bearer\` prefix for legacy endpoints.

---

## Pagination

### JSON:API Pagination

All JSON:API list endpoints support offset-based pagination:

| Parameter | Description | Default |
|-----------|-------------|---------|
| \`page[offset]\` | Page number (1-based) | 1 |
| \`page[limit]\` | Items per page | 25 |

**Response metadata** includes pagination info in \`meta.page\`:

\`\`\`json
{
  "meta": {
    "page": {
      "offset": 1,
      "limit": 25,
      "next": true
    }
  }
}
\`\`\`

- \`next: true\` means there are more pages available.
- To fetch the next page, increment \`page[offset]\` by 1.
- Continue until \`next\` is \`false\` or absent.

**Example — page through all agents, 50 per page:**

\`\`\`
GET /agents?type=beta&page[offset]=1&page[limit]=50
GET /agents?type=beta&page[offset]=2&page[limit]=50
GET /agents?type=beta&page[offset]=3&page[limit]=50
... continue until meta.page.next is false
\`\`\`

### Legacy API Pagination

Legacy endpoints do **not** use offset pagination. They return all matching records. Use \`from\`/\`to\` time-range parameters or the \`last\` parameter to control the volume of data returned.

---

## Filtering

### Simple Filters

\`\`\`
filter[field]=value
\`\`\`

Multiple values are comma-separated: \`filter[agents]=1,2,3\`

### Regex Filters

\`\`\`
filter[name][regex]=pattern
\`\`\`

### Timestamp / Operator Filters

\`\`\`
filter[ts][operator]=<=>&filter[ts][value1]=1700000000000&filter[ts][value2]=1700100000000
\`\`\`

Supported operators: \`>\`, \`<\`, \`>=\`, \`<=\`, \`<=>\` (between), \`=\`

When using \`<=>\` (between), both \`value1\` and \`value2\` are required.

Timestamp values should be Unix epoch **milliseconds**.

---

## Ordering

\`\`\`
order[attributes]=field_name&order[direction]=asc|desc
\`\`\`

Multiple fields can be comma-separated: \`order[attributes]=ts,name\`

---

## Includes (Sideloading Relationships)

\`\`\`
include=relationship1,relationship2
\`\`\`

Included resources appear in the \`included\` array of the JSON:API response.

---

## JSON:API Response Envelope

All JSON:API responses follow this structure:

\`\`\`json
{
  "data": [
    {
      "id": "123",
      "type": "agent",
      "attributes": { ... },
      "relationships": {
        "agent_groups": {
          "data": [{ "id": "1", "type": "agent_group" }]
        }
      }
    }
  ],
  "included": [ ... ],
  "meta": { "page": { "offset": 1, "limit": 25, "next": true } }
}
\`\`\`

For single-resource responses, \`data\` is an object instead of an array.

---

## JSON:API Endpoints

### Agents

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/agents\` | List agents |
| GET | \`/agents/:id\` | Get single agent |
| PUT | \`/agents/:id\` | Update agent |
| DELETE | \`/agents/:id\` | Delete agent |
| PUT | \`/agents\` | Bulk update agents |

**List filters:** \`name\`, \`name[regex]\`, \`categories\` (network_agent, remote_worker_agent), \`agent_classes\` (container, faste, wireless, gige, virtual, external, software, mac, windows), \`active\` (boolean), \`active_ts\`, \`agent_groups\`, \`critical_alerts\`, \`warning_alerts\`, \`in_incident\`

**Includes:** \`network_interfaces\`, \`agent_groups\`

**Agent attributes (details):** Each agent resource includes connectivity metadata: **\`isp_name\`** (name of the Internet Service Provider for the agent’s connection) and **\`isp_asn\`** (Autonomous System Number of the ISP). These are derived from the agent’s external/public IP. The response may also include \`logged_in_user\` (user associated with the agent, when applicable).

**Stubbed mode:** Pass \`stubbed=true\` query param for a lighter response.

#### Agent Sub-resources

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/agents/:agent_id/logs\` | Agent connection/disconnection event logs |
| GET | \`/agents/:agent_id/logs/:id\` | Single log entry |
| GET | \`/agents/:agent_id/access_point_connections\` | WiFi AP connection history |
| GET | \`/agents/:agent_id/access_point_connections/:id\` | Single AP connection |
| GET | \`/agents/:agent_id/performance_metrics\` | CPU, memory, disk utilization over time |
| GET | \`/agents/grouped_alert_counts\` | Alert counts grouped by agent |

**Log filters:** \`event_code\`, \`ts\` (timestamp operator filter)
**AP connection filters:** \`error_states\`, \`ts\`

#### Agent Performance Metrics — \`GET /agents/:agent_id/performance_metrics\`

Returns CPU, memory, and disk utilization samples for the agent over time. Use this to check whether an agent's hardware resources are stressed (which can affect monitoring accuracy) or for capacity-planning trends.

**Filters:** \`ts\` (timestamp operator filter — same syntax as elsewhere in the JSON:API)

**Pagination:** Standard JSON:API offset pagination (\`page[offset]\`, \`page[limit]\`).

**Resource type:** \`agent_performance_metric\`

**Attributes:**

| Field | Type | Description |
|-------|------|-------------|
| \`ts\` | integer | Sample timestamp (Unix epoch milliseconds) |
| \`cpu_utilization\` | number | CPU utilization at \`ts\` (percentage, 0–100) |
| \`memory_utilization\` | number | Memory utilization at \`ts\` (percentage, 0–100) |
| \`disk_utilization\` | number | Disk utilization at \`ts\` (percentage, 0–100) |

**Relationships:** \`agent\` — the agent the sample belongs to.

**Response shape:**

\`\`\`json
{
  "data": [
    {
      "id": "<metric_id>",
      "type": "agent_performance_metric",
      "attributes": {
        "ts": 1700000000000,
        "cpu_utilization": 12.4,
        "memory_utilization": 47.8,
        "disk_utilization": 63.1
      },
      "relationships": {
        "agent": {
          "data": { "id": "<agent_id>", "type": "agent" }
        }
      }
    }
  ],
  "meta": {
    "page": { "offset": 1, "limit": 25, "total": 1440 }
  }
}
\`\`\`

That's the full payload — four attributes, an \`agent\` relationship, and standard pagination meta. No \`included\` block is returned by default.

---

### Agent Groups

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/agent_groups\` | List agent groups |
| GET | \`/agent_groups/:id\` | Get single agent group |
| POST | \`/agent_groups\` | Create agent group |
| PUT | \`/agent_groups/:id\` | Update agent group |

**Create/Update payload (JSON:API):**

\`\`\`json
{
  "data": {
    "type": "agent_group",
    "attributes": {
      "name": "Group Name",
      "auto_assign": false,
      "force": false
    },
    "relationships": {
      "agents": {
        "data": [{ "type": "agent", "id": "1" }, { "type": "agent", "id": "2" }]
      },
      "targets": {
        "data": [{ "type": "target", "id": "10" }]
      }
    }
  }
}
\`\`\`

---

### Targets

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/targets\` | List targets |
| POST | \`/targets\` | Create custom target |
| POST | \`/targets/saas\` | Create SaaS target |
| POST | \`/targets/target_template\` | Create target from template |
| PUT | \`/targets/:id\` | Update target |

**List filters:** \`name[regex]\`, \`agents\`, \`categories\`, \`agent_groups\`, and more.

**Includes:** Available via \`include\` param.

---

### Tests (nb_tests)

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/nb_tests\` | List all tests |

**List filters:** \`agents\`, \`targets\`, \`test_templates\`, \`test_types\`, and more.

#### Test Results

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/nb_tests/ping/results\` | Ping test results |
| GET | \`/nb_tests/dns/results\` | DNS test results |
| GET | \`/nb_tests/http/results\` | HTTP test results |
| GET | \`/nb_tests/traceroutes/results\` | Traceroute results |
| GET | \`/nb_tests/path_analysis/results\` | Path analysis results |
| GET | \`/nb_tests/path_analysis/results/:timestamp\` | Single path analysis result |

**Common result filters:** \`agents\`, \`tests\`, \`test_templates\`, \`ts\` (timestamp operator filter)

**Path analysis additional filters:** \`ip_address\`

**Path analysis includes:** Supports \`include\` for related resources.

#### Test State Transitions

| Method | Path | Description |
|--------|------|-------------|
| PUT | \`/nb_tests/:nb_test_id/transition_states/:state\` | Transition a single test |
| PUT | \`/nb_tests/transition_states/:state\` | Bulk transition tests |

---

### Scheduled Test Templates

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/scheduled_nb_test_templates.json\` | List templates |
| GET | \`/scheduled_nb_test_templates/:id\` | Get single template |
| POST | \`/scheduled_nb_test_templates\` | Create template |
| PUT | \`/scheduled_nb_test_templates/:id\` | Update template |

**List filters:** \`label\`, \`test_types\`, \`agents\`, \`destination_agent\`, \`by_destination\`

**Test types:** 5 (iperf), 7 (speed test), 8 (VoIP)

#### Scheduled Test Results

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/scheduled_nb_test_templates/:template_id/results\` | Get results for a template |
| GET | \`/scheduled_nb_test_templates/:template_id/results/statistics\` | Get result statistics |

**Result filters:** \`agents\`, \`ts\` (timestamp operator filter)

---

### Ad-hoc / Multiagent Test Runs

| Method | Path | Description |
|--------|------|-------------|
| POST | \`/multiagent_nb_test_runs/ad_hoc\` | Run an ad-hoc test |
| GET | \`/multiagent_nb_test_runs\` | Get test run status |

**GET filters:** \`multiagent_nb_test_runs\` (run ID)
**GET includes:** \`results\`

---

### Alerts

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/alerts\` | List alerts |
| GET | \`/alerts/ai_summary\` | AI-generated alert summary |

**Alert filters:** \`targets\`, \`agents\`, \`tests\`, \`test_templates\`, \`alert_detectors\`, \`categories\`, \`agent_classes\`, \`agent_groups\`, \`severity\` (operator filter), \`ts\` (timestamp operator filter), \`closed_ts\` (timestamp operator filter), \`message\`, \`status\` (open|closed)

**Alert severity values:** 1 = failure/critical, 4 = warning, 6 = cleared/recovered

---

### Alert Detectors

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/alert_detectors\` | List alert detector definitions |

Alert detectors are rules that evaluate test results or agent heartbeats and trigger alerts when conditions are met.

**Filters:**

| Parameter | Description |
|-----------|-------------|
| \`filter[default]\` | Filter by whether the detector attaches to new targets by default (\`true\` or \`false\`) |
| \`filter[alert_detector_types]\` | Filter by type (comma-separated): \`AgentUpDown\`, \`Baseline\`, \`BaselineWatermark\`, \`UpDown\`, \`Watermark\` |
| \`filter[alerting_entity_types]\` | Filter by alerting entity (comma-separated): \`Agent\`, \`NbTest\` |
| \`filter[test_types]\` | Filter by test type (comma-separated): \`Ping\`, \`HTTP\`, \`DNS\`, \`Traceroute\` |
| \`filter[tests]\` | Filter by test IDs (comma-separated) |
| \`filter[agents]\` | Filter by agent IDs (comma-separated) |

**Ordering:** \`id\`, \`name\`

**Alert detector attributes:**

| Field | Type | Description |
|-------|------|-------------|
| \`name\` | string | Human-readable name (e.g. "PING Up Down", "HTTP Loading > 1 sec") |
| \`alert_detector_type\` | string | Type: AgentUpDown, UpDown, Watermark, Baseline, BaselineWatermark |
| \`type_of_alerting_entity\` | string | What this detector monitors: Agent or NbTest |
| \`alerts_severity\` | integer | Severity of alerts produced: 1 (critical) or 4 (warning) |
| \`attach_by_default\` | boolean | Whether this detector is auto-assigned to new targets |
| \`alert_condition\` | string | JS expression evaluated to trigger an alert |
| \`reverse_alert_condition\` | string | JS expression evaluated to clear an alert |
| \`message\` | string | Alert message template |
| \`reverse_message\` | string | Alert-cleared message template |
| \`stats_function\` | string | Statistical function applied to the data stream |
| \`stream_source\` | string | Data source: results, statistics, heartbeats, network_updates |
| \`window_type\` | string | Evaluation window type: sliding or monotonic |
| \`window_size\` | integer | Evaluation window size (minutes for sliding, milliseconds for monotonic) |
| \`function_arguments\` | string/null | JSON string with extra parameters (alert_metric, baseline_window_size) |
| \`created_at\` | string | ISO 8601 creation timestamp |
| \`updated_at\` | string | ISO 8601 last-update timestamp |

**Relationships:** \`nb_test_type\` (the test type this detector applies to, null for Agent-level detectors)

---

### Incidents

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/incidents\` | List incidents |
| GET | \`/incidents/ai_summary\` | AI-generated incident summary |

**Includes:** \`incident_logs\` (timeline of events within the incident)

---

### WiFi Profiles

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/wifi_profiles\` | List WiFi profiles |
| GET | \`/wifi_profiles/:id\` | Get single WiFi profile |
| POST | \`/wifi_profiles\` | Create WiFi profile |
| PUT | \`/wifi_profiles/:id\` | Update WiFi profile |

---

### WiFi Hopping Groups

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/wifi_hopping_groups\` | List WiFi hopping groups |
| GET | \`/wifi_hopping_groups/:id\` | Get single group |
| POST | \`/wifi_hopping_groups\` | Create group |
| PUT | \`/wifi_hopping_groups/:id\` | Update group |

---

### Scheduled Test State Transitions

| Method | Path | Description |
|--------|------|-------------|
| PUT | \`/scheduled_nb_tests/:scheduled_nb_test_id/:state\` | Transition scheduled test state |

---

### Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/reports/generated_reports\` | List generated reports |
| GET | \`/reports/generated_reports/:id\` | Get single report |
| DELETE | \`/reports/generated_reports/:id\` | Delete report |
| GET | \`/reports/scheduled_reports\` | List scheduled reports |
| POST | \`/reports/scheduled_reports\` | Create scheduled report |
| PUT | \`/reports/scheduled_reports\` | Update scheduled report |
| DELETE | \`/reports/scheduled_reports/:id\` | Delete scheduled report |

---

### Other Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | \`/monitoring_conditions\` | List monitoring conditions |
| GET | \`/settings/maintenance_mode\` | Get maintenance mode status |
| PUT | \`/settings/maintenance_mode\` | Toggle maintenance mode |

---

## Legacy Statistics Endpoints

These three endpoints use the legacy authentication scheme (\`Authorization: <API_KEY>\` without \`Bearer\`, plus \`API-VERSION: v1\` header).

They return pre-aggregated timeseries data and do **not** follow JSON:API conventions.

### 1. Test Statistics — \`GET /nb_test_statistics.json\`

Returns pre-aggregated test performance statistics over time. Best for analyzing trends over longer periods rather than individual raw results.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`nb_test_id\` | integer | No | Single test instance ID (one agent + one template). Combinable with the other ID filters as an AND. |
| \`agent_id\` | integer | No | Filter to tests run by this agent. Combinable with the other ID filters. |
| \`nb_test_template_id\` | integer | No | Filter to all tests derived from this template (one test per agent assigned to the template). Combinable with the other ID filters. |
| \`nb_target_id\` | integer | No | Filter to tests targeting this target (hostname/IP/URL). Combinable with the other ID filters. |
| \`test_type_id\` | integer | No | Filter by test type — restricts to one class of tests (e.g. Ping, DNS, HTTP, Traceroute). |
| \`window_size\` | integer | No | Aggregation bucket size **in seconds** (e.g. 60 = 1-minute, 300 = 5-minute, 3600 = 1-hour). Pass either \`window_size\` OR \`granularity\`, not both. |
| \`granularity\` | string | No | Alternative aggregation control accepted by the upstream API; passed through verbatim. Use this OR \`window_size\`, not both. |
| \`from\` | integer | No | Start of the time range (Unix epoch ms; the client also accepts seconds and ISO 8601 and normalizes to ms). Use together with \`to\`. **Mutually exclusive with \`last\`.** |
| \`to\` | integer | No | End of the time range (Unix epoch ms; the client also accepts seconds and ISO 8601 and normalizes to ms). Use together with \`from\`. **Mutually exclusive with \`last\`.** |
| \`last\` | integer | No | Return the most recent N data points. **Mutually exclusive with \`from\`/\`to\`.** |
| \`metric_type\` | string | No | Which statistical view or derived metric to retrieve. One of \`mean\`, \`percentile_mean\`, \`stdev\`, \`jitter\`, \`mos\` (see "\`metric_type\` values" below). Omit to receive every type the matched test(s) produce. Determines the unit/scale of the row's \`value\`. |
| \`grouping\` | string | No | Group result rows by the named field. Known value: \`nb_test_id\` (per-test breakdown — when scoped to a template, this yields one series per agent running the template). Other values are passed through to the upstream API. |
| \`ts_order\` | string | No | Order rows by timestamp: \`asc\` (oldest first) or \`desc\` (newest first). |
| \`sort_by\` | string | No | Field to sort the response by (e.g. a column from the row schema such as \`timestamp\` or \`value\`). Pair with \`sort_by_order\`. |
| \`sort_by_order\` | string | No | Sort direction for \`sort_by\`: \`asc\` or \`desc\`. |
| \`value_operator\` | string | No | Comparison operator used **together with \`value_watermark\`** to filter rows by their aggregated \`value\` (a watermark filter). Conventionally one of \`>\`, \`<\`, \`>=\`, \`<=\`, \`=\`. Has no effect unless \`value_watermark\` is also supplied. |
| \`value_watermark\` | number | No | Threshold compared against each row's aggregated \`value\` using \`value_operator\` (e.g. \`value_operator=>\` + \`value_watermark=200\` returns only buckets whose value exceeds 200). Units match the row's \`metric_type\` (e.g. ms for latency-like metrics, 1.0–5.0 for \`mos\`). Has no effect unless \`value_operator\` is also supplied. |

**Filter combinability:** ID filters (\`nb_test_id\`, \`agent_id\`, \`nb_test_template_id\`, \`nb_target_id\`, \`test_type_id\`) are AND-combined when more than one is supplied — they all narrow the same underlying set of tests.

**Response:**

\`\`\`json
{
  "nb_test_statistics": [
    {
      "id": 12345,
      "nb_test_id": 100,
      "timestamp": 1700000000000,
      "value": 42.5,
      "metric_type": "mean",
      "window_size": 300,
      "datapoint_count": 60,
      "error_count": 0
    }
  ]
}
\`\`\`

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | integer | Record ID |
| \`nb_test_id\` | integer | Associated test ID |
| \`timestamp\` | integer | Unix epoch milliseconds |
| \`value\` | float | Aggregated metric value |
| \`metric_type\` | string | Which statistical view or derived metric this row represents — one of \`mean\`, \`percentile_mean\`, \`stdev\`, \`jitter\`, \`mos\`. One row per (window, \`metric_type\`). The unit/scale of \`value\` depends on this (e.g. \`mean\`/\`stdev\` of RTT in ms for Ping, \`mos\` on a 1–5 quality scale, \`jitter\` in ms). |
| \`window_size\` | integer | Aggregation window in seconds |
| \`datapoint_count\` | integer | Number of raw data points in this window |
| \`error_count\` | integer | Number of errors in this window |

**\`metric_type\` values:**

For each test, the endpoint emits one row per \`metric_type\` per window. Five values are accepted (lowercase, exact strings):

| Value | Meaning |
|-------|---------|
| \`mean\` | Arithmetic mean of the test's primary measurement within the window (e.g. RTT for Ping, lookup time for DNS, response time for HTTP). |
| \`percentile_mean\` | Percentile-based mean of the same primary measurement (excludes outliers). |
| \`stdev\` | Standard deviation of the same primary measurement, indicating variability. |
| \`jitter\` | Jitter measurement (in ms). Only emitted by tests that produce jitter — VoIP tests, and Ping tests with the jitter option enabled. |
| \`mos\` | Mean Opinion Score (1.0–5.0 voice-quality scale). Only emitted by tests that produce MOS — VoIP tests, and Ping tests with the MOS option enabled. |

The query parameter \`metric_type\` filters the response to a single one of these. Omit it to receive every type the matched test(s) produce. The unit/scale of the row's \`value\` depends on which \`metric_type\` it is.

> **Retrieving jitter or MOS:** call \`GET /nb_test_statistics.json\` scoped to a test that produces them — a VoIP test, or a Ping test with jitter/MOS enabled — using \`nb_test_id\`, \`nb_test_template_id\`, or \`test_type_id\`. Then either pass \`metric_type=jitter\` (or \`metric_type=mos\`) to filter, or omit \`metric_type\` and pick the rows whose \`metric_type\` field equals \`jitter\` / \`mos\` from the response. If the test doesn't produce that metric, no rows will be returned for it.

**Single record:** \`GET /nb_test_statistics/{id}.json\` with optional filters: \`nb_test_id\`, \`nb_test_template_id\`, \`nb_target_id\`.

---

### 2. Agent Statistics — \`GET /nb_agent_statistics.json\`

Returns agent availability/uptime statistics over time. Use this to track agent health, identify patterns of disconnections, or verify an agent was consistently online.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`agent_id\` | integer | **Yes** | The agent to query (required) |
| \`from\` | integer | No | Start time (Unix epoch milliseconds) |
| \`to\` | integer | No | End time (Unix epoch milliseconds) |
| \`window_size\` | integer | No | Aggregation window size in seconds |
| \`last\` | integer | No | Return last N data points |

**Response:**

\`\`\`json
{
  "agent_stats": [
    {
      "agent_id": 5,
      "id": 67890,
      "interval": 300,
      "timestamp": 1700000000000,
      "uptime": 100.0,
      "window_size": 300
    }
  ]
}
\`\`\`

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| \`agent_id\` | integer | The agent ID |
| \`id\` | integer | Record ID |
| \`interval\` | integer | Measurement interval in seconds |
| \`timestamp\` | integer | Unix epoch milliseconds |
| \`uptime\` | float | Uptime percentage (0-100) |
| \`window_size\` | integer | Aggregation window in seconds |

---

### 3. Access Point Metrics — \`GET /access_point_metrics.json\`

Returns WiFi signal quality metrics over time. Use for WiFi troubleshooting — correlate signal quality with test performance.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`agent_id\` | integer | No | Filter by agent ID |
| \`access_point_id\` | integer | No | Filter by access point ID |
| \`from\` | integer | No | Start time (Unix epoch milliseconds) |
| \`to\` | integer | No | End time (Unix epoch milliseconds) |

**Response:**

\`\`\`json
{
  "metrics": [
    {
      "access_point_id": 10,
      "bit_rate": 54,
      "channel": 6,
      "id": 99999,
      "link_quality": 0.85,
      "network_interface_id": 3,
      "rx_rate": 72,
      "signal_level": -55,
      "timestamp": 1700000000000,
      "tx_rate": 65
    }
  ]
}
\`\`\`

**Response fields:**

| Field | Type | Description |
|-------|------|-------------|
| \`access_point_id\` | integer | Associated access point ID |
| \`bit_rate\` | integer | Connection bit rate (Mbps) |
| \`channel\` | integer | WiFi channel number |
| \`id\` | integer | Record ID |
| \`link_quality\` | float | Link quality ratio (0.0 – 1.0) |
| \`network_interface_id\` | integer | Associated network interface ID |
| \`rx_rate\` | integer | Receive rate (Mbps) |
| \`signal_level\` | integer | Signal strength in dBm (e.g. -55) |
| \`timestamp\` | integer | Unix epoch milliseconds |
| \`tx_rate\` | integer | Transmit rate (Mbps) |

#### Downsampled variant — \`GET /access_point_metrics/sample.json\`

Same parameters as above plus:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| \`cardinality\` | integer | No | Target number of data points to return (downsamples to this count) |

Use this for long time ranges to avoid returning too many data points.

---

## Timestamp Handling

- **JSON:API timestamp filters** accept Unix epoch milliseconds, Unix epoch seconds, or ISO 8601 strings. The client normalizes all values to epoch milliseconds before sending.
- **Legacy API** \`from\`/\`to\` parameters accept Unix epoch milliseconds. The client normalizes epoch seconds and ISO 8601 strings to milliseconds automatically.
- **Response timestamps** are Unix epoch milliseconds (integer).

---

## Common Patterns

### Fetch all pages of a JSON:API list endpoint

\`\`\`
1. GET /endpoint?type=beta&page[offset]=1&page[limit]=100
2. Check response meta.page.next
3. If true, GET /endpoint?type=beta&page[offset]=2&page[limit]=100
4. Repeat until next is false
\`\`\`

### Filter test results by time range

\`\`\`
GET /nb_tests/ping/results?type=beta&filter[agents]=5&filter[ts][operator]=<=>&filter[ts][value1]=1700000000000&filter[ts][value2]=1700100000000
\`\`\`

### Get aggregated statistics for a test over the last 24 hours

\`\`\`
GET /nb_test_statistics.json?nb_test_id=100&from=<24h_ago_epoch_ms>&to=<now_epoch_ms>
\`\`\`

### Check agent uptime over the last week

\`\`\`
GET /nb_agent_statistics.json?agent_id=5&last=168
\`\`\`
`;
