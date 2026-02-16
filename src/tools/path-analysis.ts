/**
 * Path analysis tools — get_path_analysis_results
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

export function registerPathAnalysisTools(server: McpServer, client: JsonApiClient) {
  // ─── get_path_analysis_results ──────────────────────────
  server.tool(
    "get_path_analysis_results",
    `Get path analysis (hop-by-hop traceroute) results showing the network path between an agent and a target. Each result contains per-hop data: RTT (round-trip time), IP address, NAT detection, destination, port, hop number, and any error codes/messages.

This is essential for diagnosing routing issues, identifying bottleneck hops, detecting NAT boundaries, and understanding the network topology between monitoring points. Use alongside ping/HTTP results to correlate high latency or packet loss with specific network hops.

Relationships include the agent and test template for each result. Use the include=supplemental parameter for additional hop metadata.`,
    {
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
      filter_ip_address: z
        .string()
        .optional()
        .describe("Filter by specific IP address in the path"),
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
      timestamp: z
        .string()
        .optional()
        .describe("Get a single path analysis result at this exact timestamp"),
      include: z
        .string()
        .optional()
        .describe("Relationships to include: supplemental"),
      page: z.number().optional().describe("Page offset"),
      page_size: z.number().optional().describe("Results per page"),
    },
    async (params) => {
      // If a specific timestamp is requested, use the single-result endpoint
      if (params.timestamp) {
        const response = await client.getPathAnalysisResultByTimestamp(
          params.timestamp,
          { include: params.include }
        );
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      }

      const response = await client.getPathAnalysisResults({
        filters: {
          agents: params.filter_agents,
          tests: params.filter_tests,
          test_templates: params.filter_test_templates,
          ip_address: params.filter_ip_address,
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
        include: params.include,
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
