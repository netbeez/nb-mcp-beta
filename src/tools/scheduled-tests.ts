/**
 * Scheduled test tools — get_scheduled_test_results
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

export function registerScheduledTestTools(server: McpServer, client: JsonApiClient) {
  // ─── get_scheduled_test_results ─────────────────────────
  server.tool(
    "get_scheduled_test_results",
    `Get results for a scheduled test template (Iperf, Network Speed Test, VoIP). Scheduled tests run at defined intervals and produce key-value result pairs (e.g., download_speed, upload_speed, latency, jitter, MOS score). Returns timestamped results filtered by agent and time range.

Use this for bandwidth testing results, VoIP quality metrics, or Iperf throughput analysis. These are distinct from continuous monitoring tests (ping/dns/http/traceroute) — they run on a schedule and measure throughput/quality.`,
    {
      template_id: z
        .number()
        .describe("The scheduled test template ID"),
      filter_agents: z
        .string()
        .optional()
        .describe("Filter by agent IDs (comma-separated)"),
      filter_ts_operator: z
        .string()
        .optional()
        .describe("Timestamp filter operator: >, <, >=, <=, <=>, ="),
      filter_ts_value1: z
        .string()
        .optional()
        .describe("Timestamp filter value"),
      filter_ts_value2: z
        .string()
        .optional()
        .describe("Second timestamp value (for between operator)"),
      order_by: z
        .string()
        .optional()
        .describe("Order results by field"),
      order_direction: z
        .enum(["asc", "desc"])
        .optional()
        .describe("Sort direction"),
      page: z.number().optional().describe("Page offset"),
      page_size: z.number().optional().describe("Results per page"),
    },
    async (params) => {
      const response = await client.getScheduledTestResults(params.template_id, {
        filters: {
          agents: params.filter_agents,
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
        order: params.order_by
          ? { attributes: params.order_by, direction: params.order_direction || "desc" }
          : undefined,
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
