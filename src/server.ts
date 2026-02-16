/**
 * MCP Server definition — registers all tools, resources, and prompts.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Config } from "./config.js";
import { JsonApiClient } from "./api/jsonapi-client.js";
import { LegacyClient } from "./api/legacy-client.js";

// Tools
import { registerAgentTools } from "./tools/agents.js";
import { registerTargetTools } from "./tools/targets.js";
import { registerTestTools } from "./tools/tests.js";
import { registerIncidentTools } from "./tools/incidents.js";
import { registerAlertTools } from "./tools/alerts.js";
import { registerWifiTools } from "./tools/wifi.js";
import { registerScheduledTestTools } from "./tools/scheduled-tests.js";
import { registerStatisticsTools } from "./tools/statistics.js";
import { registerPathAnalysisTools } from "./tools/path-analysis.js";
import { registerActionTools } from "./tools/actions.js";

// Resources
import {
  DATA_MODEL_URI,
  DATA_MODEL_NAME,
  DATA_MODEL_DESCRIPTION,
  DATA_MODEL_MIME,
  DATA_MODEL_CONTENT,
} from "./resources/data-model.js";
import {
  CORRELATION_GUIDE_URI,
  CORRELATION_GUIDE_NAME,
  CORRELATION_GUIDE_DESCRIPTION,
  CORRELATION_GUIDE_MIME,
  CORRELATION_GUIDE_CONTENT,
} from "./resources/correlation-guide.js";
import {
  TROUBLESHOOTING_GUIDE_URI,
  TROUBLESHOOTING_GUIDE_NAME,
  TROUBLESHOOTING_GUIDE_DESCRIPTION,
  TROUBLESHOOTING_GUIDE_MIME,
  TROUBLESHOOTING_GUIDE_CONTENT,
} from "./resources/troubleshooting-guide.js";

// Prompts
import { z } from "zod";
import { TROUBLESHOOT_TARGET_PROMPT } from "./prompts/troubleshoot-target.js";
import { ANALYZE_AGENT_HEALTH_PROMPT } from "./prompts/analyze-agent-health.js";
import { INVESTIGATE_INCIDENT_PROMPT } from "./prompts/investigate-incident.js";
import { NETWORK_OVERVIEW_PROMPT } from "./prompts/network-overview.js";

export function createServer(config: Config): McpServer {
  const server = new McpServer({
    name: "netbeez-mcp-server",
    version: "1.0.0",
  });

  // Initialize API clients
  const jsonApiClient = new JsonApiClient(config);
  const legacyClient = new LegacyClient(config);

  // ──────────────────────────────────────────────
  // Register Tools (18 total)
  // ──────────────────────────────────────────────

  // Agent tools (5): list_agents, get_agent, search_agents, get_agent_logs, get_agent_performance_metrics
  registerAgentTools(server, jsonApiClient);

  // Target tools (2): list_targets, get_target
  registerTargetTools(server, jsonApiClient);

  // Test tools (2): list_tests, get_test_results
  registerTestTools(server, jsonApiClient);

  // Incident tools (1): list_incidents
  registerIncidentTools(server, jsonApiClient);

  // Alert tools (1): list_alerts
  registerAlertTools(server, jsonApiClient);

  // WiFi tools (1): list_wifi_profiles
  registerWifiTools(server, jsonApiClient);

  // Scheduled test tools (1): get_scheduled_test_results
  registerScheduledTestTools(server, jsonApiClient);

  // Statistics tools (3): get_test_statistics, get_agent_statistics, get_access_point_metrics
  registerStatisticsTools(server, legacyClient);

  // Path analysis tools (1): get_path_analysis_results
  registerPathAnalysisTools(server, jsonApiClient);

  // Action tools (1): run_adhoc_test
  registerActionTools(server, jsonApiClient);

  // ──────────────────────────────────────────────
  // Register Resources (3 contextual documents)
  // ──────────────────────────────────────────────

  server.resource(DATA_MODEL_NAME, DATA_MODEL_URI, { description: DATA_MODEL_DESCRIPTION, mimeType: DATA_MODEL_MIME }, async () => ({
    contents: [
      {
        uri: DATA_MODEL_URI,
        mimeType: DATA_MODEL_MIME,
        text: DATA_MODEL_CONTENT,
      },
    ],
  }));

  server.resource(CORRELATION_GUIDE_NAME, CORRELATION_GUIDE_URI, { description: CORRELATION_GUIDE_DESCRIPTION, mimeType: CORRELATION_GUIDE_MIME }, async () => ({
    contents: [
      {
        uri: CORRELATION_GUIDE_URI,
        mimeType: CORRELATION_GUIDE_MIME,
        text: CORRELATION_GUIDE_CONTENT,
      },
    ],
  }));

  server.resource(TROUBLESHOOTING_GUIDE_NAME, TROUBLESHOOTING_GUIDE_URI, { description: TROUBLESHOOTING_GUIDE_DESCRIPTION, mimeType: TROUBLESHOOTING_GUIDE_MIME }, async () => ({
    contents: [
      {
        uri: TROUBLESHOOTING_GUIDE_URI,
        mimeType: TROUBLESHOOTING_GUIDE_MIME,
        text: TROUBLESHOOTING_GUIDE_CONTENT,
      },
    ],
  }));

  // ──────────────────────────────────────────────
  // Register Prompts (4 workflow templates)
  // ──────────────────────────────────────────────

  server.prompt(
    TROUBLESHOOT_TARGET_PROMPT.name,
    TROUBLESHOOT_TARGET_PROMPT.description,
    {
      target_name: z.string().optional().describe("Target name to troubleshoot"),
      target_id: z.string().optional().describe("Target ID to troubleshoot"),
    },
    (args) => ({
      messages: TROUBLESHOOT_TARGET_PROMPT.messages(args),
    })
  );

  server.prompt(
    ANALYZE_AGENT_HEALTH_PROMPT.name,
    ANALYZE_AGENT_HEALTH_PROMPT.description,
    {
      agent_name: z.string().optional().describe("Agent name to analyze"),
      agent_id: z.string().optional().describe("Agent ID to analyze"),
    },
    (args) => ({
      messages: ANALYZE_AGENT_HEALTH_PROMPT.messages(args),
    })
  );

  server.prompt(
    INVESTIGATE_INCIDENT_PROMPT.name,
    INVESTIGATE_INCIDENT_PROMPT.description,
    {
      incident_id: z.string().describe("Incident ID to investigate"),
    },
    (args) => ({
      messages: INVESTIGATE_INCIDENT_PROMPT.messages(args),
    })
  );

  server.prompt(
    NETWORK_OVERVIEW_PROMPT.name,
    NETWORK_OVERVIEW_PROMPT.description,
    (extra) => ({
      messages: NETWORK_OVERVIEW_PROMPT.messages(),
    })
  );

  return server;
}
