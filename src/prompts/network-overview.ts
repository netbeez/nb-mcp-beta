/**
 * MCP Prompt: Network Overview
 *
 * Generate a summary of overall network health.
 */

export const NETWORK_OVERVIEW_PROMPT = {
  name: "network-overview",
  description:
    "Generate a comprehensive summary of overall network health: agent status distribution, open incidents, top alerts, and monitoring coverage. Use for daily check-ins, shift handoffs, or executive summaries.",
  arguments: [],
  messages: () => {
    return [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Please generate a comprehensive network health overview:

## Step 1: Agent Fleet Status
- Use list_agents to get all agents
- Count: Total agents, active vs inactive, by agent class (wired/wireless/container/etc.)
- Identify any offline agents

## Step 2: Open Incidents
- Use list_incidents to find all currently open incidents (filter for no end_ts)
- Count: Total open incidents, unacknowledged incidents
- List the top incidents by duration (longest-running first)

## Step 3: Active Alerts
- Use list_alerts with filter_status=open
- Count: Total open alerts by severity (critical=1, warning=4)
- Group by: Agent, Target, Test Type — identify patterns

## Step 4: Target Health
- Use list_targets with filter_open_incident=true
- Which targets currently have open incidents?

## Step 5: WiFi Status (if applicable)
- Use list_wifi_profiles with filter_open_incident=true
- Any WiFi networks with active issues?

## Generate the Overview Report

Format the results as a clear, executive-friendly summary:

### Network Health Dashboard
- **Agents**: X active / Y total (Z% online)
- **Open Incidents**: N (M unacknowledged)
- **Active Alerts**: N critical, N warning
- **Affected Targets**: list the targets with issues
- **WiFi Issues**: any WiFi-specific problems

### Top Issues (ranked by severity and duration)
List the most important issues requiring attention

### Agent Status Summary
Table of agent classes with counts and health percentages

### Recommendations
- Immediate actions needed
- Items to monitor
- Trends to watch`,
        },
      },
    ];
  },
};
