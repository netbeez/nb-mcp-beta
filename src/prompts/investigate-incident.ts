/**
 * MCP Prompt: Investigate Incident
 *
 * Deep dive into a specific incident with full context gathering.
 */

export const INVESTIGATE_INCIDENT_PROMPT = {
  name: "investigate-incident",
  description:
    "Deep investigation of a specific incident: pull full details, related alerts, affected agents and targets, timeline of events, and suggest resolution steps.",
  arguments: [
    {
      name: "incident_id",
      description: "The numeric ID of the incident to investigate",
      required: true,
    },
  ],
  messages: (args: Record<string, string>) => {
    return [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please investigate incident ID ${args.incident_id} in detail:

## Step 1: Incident Overview
- Use list_incidents with filter_ids=${args.incident_id} and include=incident_logs
- Note: start_ts, end_ts (is it still open?), ack_ts (acknowledged?), affected agents/targets

## Step 2: Incident Timeline
- Review the incident_logs for the sequence of events
- Identify: When did it start? Any intermediate changes? When did it end (if closed)?

## Step 3: Related Alerts
- Use list_alerts filtered to the same agent(s) and target(s) from the incident
- Filter by the incident's time window (start_ts to end_ts or now)
- Analyze: Which test types alerted? What severities? How many alerts?

## Step 4: Agent Status
- For each affected agent, use get_agent to check current status
- Use get_agent_logs to see if the agent had connectivity issues during the incident

## Step 5: Test Results During the Incident
- Use get_test_results for the relevant test types during the incident time window
- Look for: When exactly did values degrade? How bad was the degradation?

## Step 6: Cross-Agent Comparison
- Check if other agents monitoring the same target were affected
- Use list_alerts with filter_targets to see the full scope

## Step 7: Path Analysis (if applicable)
- Use get_path_analysis_results during the incident timeframe
- Did the network path change? Any new error hops?

## Summary
Provide a comprehensive incident report:
1. **Impact**: What was affected and for how long
2. **Root Cause Analysis**: Most likely cause based on the evidence
3. **Timeline**: Key events in chronological order
4. **Scope**: How widespread was the impact
5. **Current Status**: Resolved or ongoing
6. **Recommendations**: Steps to prevent recurrence`,
        },
      },
    ];
  },
};
