/**
 * MCP Prompt: Troubleshoot Target
 *
 * Guided workflow to diagnose issues with a specific monitoring target.
 */

export const TROUBLESHOOT_TARGET_PROMPT = {
  name: "troubleshoot-target",
  description:
    "Guided workflow to troubleshoot a monitoring target: check status across all agents, identify failing tests, correlate test types, and suggest root cause. Start here when investigating 'X is down' or 'X is slow' reports.",
  arguments: [
    {
      name: "target_name",
      description: "The name of the target to troubleshoot (use this OR target_id)",
      required: false,
    },
    {
      name: "target_id",
      description: "The numeric ID of the target (use this OR target_name)",
      required: false,
    },
  ],
  messages: (args: { target_name?: string; target_id?: string }) => {
    const targetIdentifier = args.target_id
      ? `target ID ${args.target_id}`
      : args.target_name
        ? `target named "${args.target_name}"`
        : "the specified target";

    return [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please troubleshoot ${targetIdentifier} using the following systematic workflow:

## Step 1: Identify the Target
${args.target_id ? `- Get target details: use list_targets with filter to find target ID ${args.target_id}` : `- Search for the target: use list_targets with filter_name_regex to find "${args.target_name}"`}
- Include test_templates to see what monitoring is configured

## Step 2: Check for Open Incidents
- Use list_incidents filtered to this target
- Note incident start times, severity, and whether they're acknowledged

## Step 3: Check Current Alerts
- Use list_alerts with filter_targets for this target and filter_status=open
- Group the alerts by:
  - Agent (which monitoring points are affected?)
  - Test type (ping/dns/http/traceroute — which protocols are failing?)
  - Severity (critical failures vs warnings?)

## Step 4: Analyze the Alert Pattern
Based on which test types are alerting:
- Ping + DNS + HTTP all failing → Complete connectivity loss
- Only DNS failing → DNS resolution issue
- Only HTTP failing → Application-level issue
- Intermittent failures → Check path analysis and statistics trends

## Step 5: Get Test Results
- Use get_test_results for the failing test type(s) to see actual values
- Compare results across agents to determine if it's localized or widespread

## Step 6: Check Path Analysis (if relevant)
- Use get_path_analysis_results to examine the network path
- Look for high-RTT hops, path changes, or error codes

## Step 7: Check Trends
- Use get_test_statistics for historical context
- Is this a sudden change or gradual degradation?

## Summarize
Provide a clear summary with:
1. What is happening (symptoms)
2. How many agents are affected (scope)
3. Which test types are failing (impact)
4. Most likely root cause
5. Recommended next steps`,
        },
      },
    ];
  },
};
