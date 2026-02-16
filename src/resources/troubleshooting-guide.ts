/**
 * MCP Resource: Troubleshooting Guide
 *
 * Step-by-step troubleshooting patterns for common network issues.
 */

export const TROUBLESHOOTING_GUIDE_URI = "netbeez://troubleshooting-guide";
export const TROUBLESHOOTING_GUIDE_NAME = "NetBeez Troubleshooting Guide";
export const TROUBLESHOOTING_GUIDE_DESCRIPTION =
  "Step-by-step troubleshooting workflows for network, DNS, application, WiFi, and agent issues";
export const TROUBLESHOOTING_GUIDE_MIME = "text/markdown";

export const TROUBLESHOOTING_GUIDE_CONTENT = `# NetBeez Troubleshooting Guide

## Workflow 1: "Is it the network, DNS, or application?"

This is the most common troubleshooting scenario. A user reports "X is slow" or "X is down."

### Steps:

1. **Identify the target** → \`list_targets\` with name filter, or \`search_agents\` if the report mentions an agent
2. **Check for open incidents** → \`list_incidents\` filtered to the target
3. **Check alerts across test types**:
   - \`list_alerts\` with \`filter_targets={target_id}&filter_status=open\`
   - Group alerts by test type — which protocols are affected?

4. **Interpret the alert pattern**:

| Ping | DNS | HTTP | Diagnosis |
|------|-----|------|-----------|
| Fail | Fail | Fail | **Complete connectivity loss** — agent offline or network down |
| Fail | OK | Fail | **ICMP blocked + application issue** — or routing problem |
| OK | Fail | Fail | **DNS issue** — name resolution failing, check DNS server |
| OK | OK | Fail | **Application issue** — server may be down, check HTTP status codes |
| OK | OK | Slow | **Application performance** — check path analysis for routing issues |
| Slow | OK | Slow | **Network latency** — check path analysis for bottleneck hop |

5. **Deep dive with test results** → \`get_test_results\` for the failing test type(s)
6. **Check the path** → \`get_path_analysis_results\` for routing/hop-level issues
7. **Check test statistics** → \`get_test_statistics\` for trends (is this sudden or gradual?)

---

## Workflow 2: "Is it one agent or all agents?"

### Steps:

1. **Get the alerts** → \`list_alerts\` with \`filter_status=open\`
2. **Group by target**: For the problematic target, which agents have alerts?
   - **All agents** → Target/service issue
   - **One agent** → Local issue at that agent's site
   - **Some agents** → Possible regional or routing issue

3. **For single-agent issues**:
   - \`get_agent\` → Is the agent active?
   - \`get_agent_logs\` → Recent connect/disconnect events?
   - \`get_agent_performance_metrics\` → CPU/memory/disk stressed?
   - \`get_agent_statistics\` → Uptime trend — is it flapping?

4. **For multi-agent issues**:
   - \`get_test_results\` with different \`filter_agents\` → Compare values
   - \`get_path_analysis_results\` from multiple agents → Do paths converge at a common hop?
   - \`get_test_statistics\` → When did the degradation start across agents?

---

## Workflow 3: "WiFi vs Wired" Comparison

When a wireless agent shows issues, determine if it's WiFi-related:

### Steps:

1. **Check if wired agents have the same issue** for the same target:
   - \`list_alerts\` with \`filter_targets={target_id}\`
   - Compare alert counts between wired and wireless agent classes

2. **If only wireless agents are affected** → WiFi issue:
   - \`get_access_point_metrics\` → Check signal quality:
     - link_quality < 0.5 → Poor signal
     - signal_level < -75 dBm → Weak signal
     - Fluctuating channel → Possible interference
   - \`get_agent_logs\` → Check for:
     - Frequent DISCONNECT/CONNECT events → Agent dropping off network
     - wpa_supplicant errors → WiFi authentication/association failures
     - DHCP failures → IP address allocation problems
   - \`list_wifi_profiles\` with \`filter_open_incident=true\` → Which SSIDs have incidents?

3. **If both wired and wireless agents affected** → Not WiFi-specific, use Workflow 1

---

## Workflow 4: Path Analysis for Hop-by-Hop Diagnosis

When latency is high or intermittent, use path analysis to find the problematic hop.

### Steps:

1. **Get path analysis results** → \`get_path_analysis_results\` for the target
2. **Identify the bottleneck hop**:
   - Which hop has the highest RTT?
   - Which hop shows the biggest RTT increase from the previous hop?
   - Are there hops with error codes?
3. **Check for path changes**:
   - Compare results at different timestamps
   - Did the path change (different IP at same hop number)?
   - NAT detection — are there NAT boundaries in the path?
4. **Correlate with other data**:
   - Do ping results correlate with the bottleneck hop's RTT?
   - Are other agents going through the same bottleneck hop?

---

## Workflow 5: Agent Health Investigation

When an agent appears unhealthy or unreliable:

### Steps:

1. \`get_agent\` → Basic status (active, software version, class, IPs)
2. \`get_agent_logs\` → Connection/disconnection history
   - Frequent disconnects → Network stability issue at the agent's site
   - Long offline periods → Power/hardware issues
3. \`get_agent_performance_metrics\` → Resource usage
   - High CPU → Software issues or insufficient hardware
   - High memory → Possible memory leak or too many tests
   - High disk → Log/data accumulation
4. \`get_agent_statistics\` → Uptime trend over time
   - Declining uptime → Progressive issue
   - Periodic drops → Scheduled maintenance or environmental pattern
5. For wireless agents: \`get_access_point_metrics\` + agent logs for WiFi health

---

## Quick Reference: Tool Selection Guide

| Question | Primary Tool | Supporting Tools |
|----------|-------------|-----------------|
| What's being monitored? | \`list_targets\`, \`list_agents\` | \`list_tests\` |
| What's alerting right now? | \`list_alerts\` (status=open) | \`list_incidents\` |
| What happened to target X? | \`list_incidents\` (target filter) | \`list_alerts\`, \`get_test_results\` |
| Is agent Y healthy? | \`get_agent\` | \`get_agent_logs\`, \`get_agent_performance_metrics\`, \`get_agent_statistics\` |
| What are the ping/DNS/HTTP values? | \`get_test_results\` | \`get_test_statistics\` (for trends) |
| What does the network path look like? | \`get_path_analysis_results\` | \`get_test_results\` (ping for correlation) |
| How is WiFi performing? | \`get_access_point_metrics\` | \`get_agent_logs\`, \`list_wifi_profiles\` |
| Run a speed test now | \`run_adhoc_test\` | (speed/VoIP only) |
| What are the performance trends? | \`get_test_statistics\` | \`get_agent_statistics\` |
`;
