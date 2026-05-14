/**
 * MCP Resource: NetBeez Data Model
 *
 * Entity relationships, data shapes, and the timeseries data catalog.
 */

export const DATA_MODEL_URI = "netbeez://data-model";
export const DATA_MODEL_NAME = "NetBeez Data Model";
export const DATA_MODEL_DESCRIPTION =
  "Entity relationships, data shapes, and timeseries data catalog for the NetBeez monitoring platform";
export const DATA_MODEL_MIME = "text/markdown";

export const DATA_MODEL_CONTENT = `# NetBeez Data Model

## Entity Relationships

### Agent
- **Has many**: Tests (nb_tests), Network Interfaces, Tags, Agent Groups
- **Has**: Performance Metrics (CPU, memory, disk), Logs (connect/disconnect events), Access Point Connections (WiFi agents)
- **Key fields**: id, name, active (boolean), agent_class (container|faste|wireless|gige|virtual|external|software|mac|windows), category (network_agent|remote_worker_agent), software_version, ip_address, mac_address, location, latitude, longitude, **isp_name**, **isp_asn**, logged_in_user, in_incident (boolean)
- **ISP fields**: \`isp_name\` — name of the Internet Service Provider for the agent’s connection; \`isp_asn\` — Autonomous System Number (ASN) of the ISP. Both are derived from the agent’s external/public IP and are included in agent details.
- **Wireless agents** additionally produce: wpa_supplicant logs (WiFi association/auth), DHCP logs, access point metrics

### Target
- **Has many**: Test Templates (each defining a type of monitoring test)
- **Key fields**: id, name, target (hostname/IP/URL being monitored), description
- **Each Test Template**: has test_type_id, target, interval, alert_detector_ids, nb_test_ids, test_statuses

### Test (nb_test)
- **Belongs to**: Agent (agent_id), Target (nb_target_id), Test Template (nb_test_template_id)
- **Produces**: Results (ping/dns/http/traceroute/path_analysis)
- **Key fields**: id, test_type, schedule_type, current_state, alert_mode
- **Test types**: ping, dns, http, traceroute, path_analysis

### Alert Detector
- **Defines**: A rule that evaluates test results or agent heartbeats and triggers alerts when conditions are met
- **Types**: AgentUpDown (agent reachability), UpDown (test pass/fail), Watermark (fixed threshold), Baseline (dynamic threshold vs historical), BaselineWatermark (combined)
- **Key fields**: id, name, alert_detector_type, type_of_alerting_entity (Agent|NbTest), alerts_severity, attach_by_default, alert_condition, reverse_alert_condition, message, reverse_message, stats_function, stream_source, window_type, window_size, function_arguments
- **Relates to**: Test Type (nb_test_type), Tests (via test templates), Alerts (triggers them)

### Alert
- **Triggered by**: Alert Detector (up-down, baseline, watermark) on a test
- **Key fields**: id, severity (1=failure/critical, 4=warning, 6=cleared/recovered), message, ts (timestamp), closed_ts, status (open|closed)
- **Relates to**: Agents, Targets, Test Templates, Alert Detectors

### Incident
- **Aggregates**: Multiple related Alerts for a given scope (agent/target/WiFi profile)
- **Key fields**: id, start_ts, end_ts (null if still open), ack_ts (acknowledgement timestamp)
- **Can include**: incident_logs (timeline of events within the incident)
- **Relates to**: Agents, Targets, WiFi Profiles

### WiFi Profile
- **Defines**: WiFi network configuration used by wireless agents
- **Key fields**: id, ssid, description, encryption_method, authentication_method

---

## Timeseries Data Catalog

All available time-indexed data and how to query it:

### Test Results (per test type, via JSON:API)

| Type | Endpoint | Key Metrics | Filters |
|------|----------|-------------|---------|
| **Ping** | \`/nb_tests/ping/results\` | timestamp, value (RTT ms), lost (packet loss), sequence_number | agent, test, test_template, time range |
| **DNS** | \`/nb_tests/dns/results\` | timestamp, value (lookup time), resolution data | agent, test, test_template, time range |
| **HTTP** | \`/nb_tests/{test_type}/results\` | timestamp, value (response time), HTTP status | agent, test, test_template, time range |
| **Traceroute** | \`/nb_tests/traceroutes/results\` | timestamp, hop-by-hop data | agent, test, test_template, time range |
| **Path Analysis** | \`/nb_tests/path_analysis/results\` | per-hop: rtt, ip_address, natted, destination, dest_port, hop_number, error_code/message | agent, test_template, ip_address, time range |

### Test Statistics (aggregated, via Legacy API)

| Endpoint | Key Metrics | Filters |
|----------|-------------|---------|
| \`/nb_test_statistics.json\` | timestamp, value, metric_type (one of \`mean\`, \`percentile_mean\`, \`stdev\`, \`jitter\`, \`mos\` — \`jitter\`/\`mos\` only for VoIP, or Ping with jitter/MOS enabled), window_size, datapoint_count, error_count | nb_test_id, agent_id, nb_test_template_id, nb_target_id, metric_type, granularity, grouping, watermark |

### Agent Health Data

| Type | Endpoint | Key Metrics | Filters |
|------|----------|-------------|---------|
| **Agent Statistics** | \`/nb_agent_statistics.json\` | timestamp, uptime, interval, window_size | agent_id (required), time range, window_size, last N |
| **Performance Metrics** | \`/agents/{id}/performance_metrics\` | \`ts\`, \`cpu_utilization\`, \`memory_utilization\`, \`disk_utilization\` | time range |
| **Agent Logs** | \`/agents/{id}/logs\` | CONNECT/DISCONNECT events; wireless: wpa_supplicant, DHCP events | log type, time range |

### WiFi Data

| Type | Endpoint | Key Metrics | Filters |
|------|----------|-------------|---------|
| **AP Metrics** | \`/access_point_metrics.json\` | bit_rate, channel, link_quality (0-1), signal_level (dBm), rx_rate, tx_rate | agent_id, access_point_id, time range |
| **AP Metrics (sampled)** | \`/access_point_metrics/sample.json\` | Same as above, downsampled | agent_id, access_point_id, time range, cardinality |
| **AP Connections** | \`/agents/{id}/access_point_connections\` | BSSID, SSID, signal strength, DHCP status | agent_id |

### Scheduled Test Results

| Endpoint | Key Metrics | Filters |
|----------|-------------|---------|
| \`/scheduled_nb_test_templates/{id}/results\` | Iperf/Speed/VoIP key-value results (download_speed, upload_speed, latency, jitter, MOS) | agent, time range |

---

## ID Relationships

- **agent_id** → Agent performing the test
- **nb_target_id** → Target being monitored
- **nb_test_template_id** → Template defining the test configuration (links agent+target+test_type)
- **nb_test_id** → Individual test instance (unique per agent-template combination)
- **alert_detector_id** → Alert rule checking test results (up-down, baseline, or watermark)
`;
