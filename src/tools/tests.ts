/**
 * Test tools — list_tests, get_test_results
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

export function registerTestTools(server: McpServer, client: JsonApiClient) {
  // ─── list_tests ─────────────────────────────────────────
  server.tool(
    "list_tests",
    `List all monitoring tests (nb_tests) with optional filters. Each test represents a specific monitoring check (ping, DNS, HTTP, traceroute, path_analysis) running from an agent to a target on a schedule. Returns test type, current state, alert mode, and associated agent/target/template IDs. Use this to understand what monitoring is configured or to find tests in specific states.`,
    {
      filter_agents: z
        .string()
        .optional()
        .describe("Filter by agent IDs (comma-separated)"),
      filter_targets: z
        .string()
        .optional()
        .describe("Filter by target IDs (comma-separated)"),
      filter_test_templates: z
        .string()
        .optional()
        .describe("Filter by test template IDs (comma-separated)"),
      filter_test_types: z
        .string()
        .optional()
        .describe("Filter by test types: ping, dns, http, traceroute, path_analysis (comma-separated)"),
      filter_ad_hoc: z
        .boolean()
        .optional()
        .describe("Filter for ad-hoc tests only (true) or scheduled tests (false)"),
      filter_current_states: z
        .string()
        .optional()
        .describe("Filter by current test state (comma-separated)"),
      filter_current_alert_modes: z
        .string()
        .optional()
        .describe("Filter by current alert mode (comma-separated)"),
      filter_wifi_profiles: z
        .string()
        .optional()
        .describe("Filter by WiFi profile IDs (comma-separated)"),
      page: z.number().optional().describe("Page offset"),
      page_size: z.number().optional().describe("Results per page"),
    },
    async (params) => {
      const response = await client.listTests({
        filters: {
          agents: params.filter_agents,
          targets: params.filter_targets,
          test_templates: params.filter_test_templates,
          test_types: params.filter_test_types,
          ad_hoc: params.filter_ad_hoc,
          current_states: params.filter_current_states,
          current_alert_modes: params.filter_current_alert_modes,
          wifi_profiles: params.filter_wifi_profiles,
        },
        pagination: { page: params.page, page_size: params.page_size },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );

  // ─── get_test_results ───────────────────────────────────
  server.tool(
    "get_test_results",
    `Get test results for a specific test type (ping, DNS, HTTP, or traceroute). Returns timestamped result data including values (RTT for ping, lookup time for DNS, response time for HTTP), packet loss, and other metrics. Filter by agents, tests, templates, and time range. Use this to analyze test performance over time or investigate specific failures.

Result types:
- **ping**: timestamp, value (RTT ms), lost (packet loss), sequence_number
- **dns**: timestamp, value (lookup time), resolution data
- **http**: timestamp, value (response time), HTTP status
- **traceroute**: timestamp, hop-by-hop data

For path analysis results, use the get_path_analysis_results tool instead.`,
    {
      test_type: z
        .enum(["ping", "dns", "http", "traceroute"])
        .describe("The type of test results to retrieve"),
      filter_agents: z
        .string()
        .optional()
        .describe("Filter by agent IDs (comma-separated)"),
      filter_tests: z
        .string()
        .optional()
        .describe("Filter by test IDs (comma-separated)"),
      filter_test_templates: z
        .string()
        .optional()
        .describe("Filter by test template IDs (comma-separated)"),
      filter_ts_operator: z
        .string()
        .optional()
        .describe("Timestamp filter operator: >, <, >=, <=, <=>, ="),
      filter_ts_value1: z
        .string()
        .optional()
        .describe("Timestamp filter value (ISO 8601 or Unix timestamp)"),
      filter_ts_value2: z
        .string()
        .optional()
        .describe("Second timestamp value (required for <=> between operator)"),
      page: z.number().optional().describe("Page offset"),
      page_size: z.number().optional().describe("Results per page"),
    },
    async (params) => {
      const response = await client.getTestResults(params.test_type, {
        filters: {
          agents: params.filter_agents,
          tests: params.filter_tests,
          test_templates: params.filter_test_templates,
        },
        timestampFilters: {
          ts:
            params.filter_ts_operator && params.filter_ts_value1
              ? {
                  operator: params.filter_ts_operator as any,
                  value1: params.filter_ts_value1,
                  value2: params.filter_ts_value2,
                }
              : undefined,
        },
        pagination: { page: params.page, page_size: params.page_size },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    }
  );
}
