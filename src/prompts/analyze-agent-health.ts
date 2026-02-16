/**
 * MCP Prompt: Analyze Agent Health
 *
 * Comprehensive health check for a specific monitoring agent.
 */

export const ANALYZE_AGENT_HEALTH_PROMPT = {
  name: "analyze-agent-health",
  description:
    "Comprehensive health check for a monitoring agent: verify status, check system resources, review connection history, examine test results, and assess WiFi metrics (if wireless). Use when an agent appears unhealthy or unreliable.",
  arguments: [
    {
      name: "agent_name",
      description: "The name of the agent to analyze (use this OR agent_id)",
      required: false,
    },
    {
      name: "agent_id",
      description: "The numeric ID of the agent (use this OR agent_name)",
      required: false,
    },
  ],
  messages: (args: { agent_name?: string; agent_id?: string }) => {
    const agentIdentifier = args.agent_id
      ? `agent ID ${args.agent_id}`
      : args.agent_name
        ? `agent named "${args.agent_name}"`
        : "the specified agent";

    return [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please perform a comprehensive health analysis of ${agentIdentifier}:

## Step 1: Agent Status
${args.agent_id ? `- Use get_agent with agent_id=${args.agent_id} including network_interfaces and agent_groups` : `- Use search_agents to find "${args.agent_name}", then get_agent with its ID`}
- Check: Is it active? What's the software version? What class (wired/wireless)?

## Step 2: Connection History
- Use get_agent_logs to review recent connect/disconnect events
- Look for: Frequent disconnections, long offline periods, patterns

## Step 3: System Resources
- Use get_agent_performance_metrics for CPU, memory, and disk usage
- Look for: High utilization, trends, resource exhaustion

## Step 4: Uptime Statistics
- Use get_agent_statistics with the agent_id for historical uptime
- Calculate: Overall uptime percentage, any declining trends

## Step 5: Current Alerts
- Use list_alerts filtered to this agent with status=open
- What tests are alerting? What severity?

## Step 6: Test Results (spot check)
- Use get_test_results for ping tests from this agent (recent results)
- Look for: Packet loss, high latency, test failures

## Step 7: WiFi Health (if wireless agent)
If the agent is a wireless agent:
- Use get_access_point_metrics for signal quality
- Check: link_quality (should be > 0.5), signal_level (should be > -75 dBm)
- Use get_agent_logs for wpa_supplicant and DHCP events
- Look for: Roaming, authentication failures, DHCP issues

## Summary
Provide an overall health assessment:
1. **Status**: Online/Offline, how long
2. **Stability**: Connection reliability, any flapping
3. **Resources**: CPU/memory/disk health
4. **Monitoring**: Are tests running normally? Any alerts?
5. **WiFi** (if applicable): Signal quality, roaming stability
6. **Recommendations**: Any actions needed`,
        },
      },
    ];
  },
};
