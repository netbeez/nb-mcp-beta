/**
 * Alert tools — list_alerts
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

export function registerAlertTools(server: McpServer, client: JsonApiClient) {
  // ─── list_alerts ────────────────────────────────────────
  server.tool(
    "list_alerts",
    `List network monitoring alerts with extensive filtering options. Alerts are triggered by alert detectors (up-down, baseline, watermark) when test results cross thresholds.

Alert severity levels: 1=failure (critical), 4=warning, 6=cleared (recovered).
Alert status: "open" (active issue) or "closed" (resolved).

Use this to find active alerts, investigate alert patterns across agents/targets, or analyze alert history over a time range. Combine with list_incidents to see how alerts are grouped into incidents.`,
    {
      filter_agents: z
        .string()
        .optional()
        .describe("Filter by agent IDs (comma-separated)"),
      filter_categories: z
        .string()
        .optional()
        .describe("Filter by category: network_agent or remote_worker_agent"),
      filter_agent_classes: z
        .string()
        .optional()
        .describe("Filter by agent class (comma-separated)"),
      filter_agent_groups: z
        .string()
        .optional()
        .describe("Filter by agent group IDs (comma-separated)"),
      filter_targets: z
        .string()
        .optional()
        .describe("Filter by target IDs (comma-separated)"),
      filter_tests: z
        .string()
        .optional()
        .describe("Filter by test IDs (comma-separated)"),
      filter_test_templates: z
        .string()
        .optional()
        .describe("Filter by test template IDs (comma-separated)"),
      filter_alert_detectors: z
        .string()
        .optional()
        .describe("Filter by alert detector IDs (comma-separated)"),
      filter_severity_operator: z
        .string()
        .optional()
        .describe("Severity filter operator: >, <, >=, <=, ="),
      filter_severity_value1: z.string().optional().describe("Severity filter value"),
      filter_ts_operator: z
        .string()
        .optional()
        .describe("Alert time filter operator"),
      filter_ts_value1: z.string().optional(),
      filter_ts_value2: z.string().optional(),
      filter_closed_ts_operator: z
        .string()
        .optional()
        .describe("Closed time filter operator"),
      filter_closed_ts_value1: z.string().optional(),
      filter_closed_ts_value2: z.string().optional(),
      filter_message: z
        .string()
        .optional()
        .describe("Filter by alert message text"),
      filter_status: z
        .enum(["open", "closed"])
        .optional()
        .describe("Filter by alert status: open or closed"),
      page: z.number().optional().describe("Page offset"),
      page_size: z.number().optional().describe("Results per page"),
    },
    async (params) => {
      const response = await client.listAlerts({
        filters: {
          agents: params.filter_agents,
          categories: params.filter_categories,
          agent_classes: params.filter_agent_classes,
          agent_groups: params.filter_agent_groups,
          targets: params.filter_targets,
          tests: params.filter_tests,
          test_templates: params.filter_test_templates,
          alert_detectors: params.filter_alert_detectors,
          message: params.filter_message,
          status: params.filter_status,
        },
        timestampFilters: {
          severity:
            params.filter_severity_operator && params.filter_severity_value1
              ? {
                  operator: params.filter_severity_operator as any,
                  value1: params.filter_severity_value1,
                }
              : undefined,
          ts:
            params.filter_ts_operator && params.filter_ts_value1
              ? {
                  operator: params.filter_ts_operator as any,
                  value1: params.filter_ts_value1,
                  value2: params.filter_ts_value2,
                }
              : undefined,
          closed_ts:
            params.filter_closed_ts_operator && params.filter_closed_ts_value1
              ? {
                  operator: params.filter_closed_ts_operator as any,
                  value1: params.filter_closed_ts_value1,
                  value2: params.filter_closed_ts_value2,
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
