/**
 * Statistics tools (via Legacy API) — get_test_statistics, get_agent_statistics, get_access_point_metrics
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LegacyClient } from "../api/legacy-client.js";

export function registerStatisticsTools(server: McpServer, client: LegacyClient) {
  // ─── get_test_statistics ────────────────────────────────
  server.tool(
    "get_test_statistics",
    `Get pre-aggregated test statistics over time (Legacy API). Returns time-series data with aggregated values (avg/min/max depending on metric_type), window size, datapoint counts, and error counts.

This is the best tool for analyzing test performance trends over longer periods — it provides statistically aggregated data rather than raw individual results. Supports flexible querying by test ID, agent, template, target, and time range. Use granularity and grouping parameters to control aggregation level.

Response: { nb_test_statistics: [{ id, nb_test_id, timestamp, value, metric_type, window_size, datapoint_count, error_count }] }`,
    {
      nb_test_id: z.number().optional().describe("Filter by specific test ID"),
      agent_id: z.number().optional().describe("Filter by agent ID"),
      nb_test_template_id: z.number().optional().describe("Filter by test template ID"),
      nb_target_id: z.number().optional().describe("Filter by target ID"),
      window_size: z
        .number()
        .optional()
        .describe("Aggregation window size in seconds"),
      granularity: z
        .string()
        .optional()
        .describe("Aggregation granularity"),
      from: z
        .string()
        .optional()
        .describe("Start time (Unix timestamp or ISO 8601)"),
      to: z
        .string()
        .optional()
        .describe("End time (Unix timestamp or ISO 8601)"),
      last: z
        .number()
        .optional()
        .describe("Get last N data points"),
      metric_type: z
        .string()
        .optional()
        .describe("Type of metric to retrieve"),
      grouping: z
        .string()
        .optional()
        .describe("Grouping parameter for aggregation"),
      test_type_id: z
        .number()
        .optional()
        .describe("Filter by test type ID"),
      ts_order: z
        .string()
        .optional()
        .describe("Timestamp ordering: asc or desc"),
      sort_by: z.string().optional().describe("Sort by field"),
      sort_by_order: z
        .string()
        .optional()
        .describe("Sort order: asc or desc"),
      value_operator: z
        .string()
        .optional()
        .describe("Value comparison operator for watermark filtering"),
      value_watermark: z
        .number()
        .optional()
        .describe("Watermark threshold value"),
    },
    async (params) => {
      const response = await client.getTestStatistics(params);

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

  // ─── get_agent_statistics ───────────────────────────────
  server.tool(
    "get_agent_statistics",
    `Get agent availability/uptime statistics over time (Legacy API). Returns time-series data showing agent health: uptime percentage, interval, and window size for each data point.

Use this to analyze agent reliability, identify patterns of agent disconnections, or verify an agent has been consistently online during a period. The agent_id parameter is required.

Response: { agent_stats: [{ agent_id, id, interval, timestamp, uptime, window_size }] }`,
    {
      agent_id: z
        .number()
        .describe("Agent ID (required)"),
      from: z
        .string()
        .optional()
        .describe("Start time (Unix timestamp or ISO 8601)"),
      to: z
        .string()
        .optional()
        .describe("End time (Unix timestamp or ISO 8601)"),
      window_size: z
        .number()
        .optional()
        .describe("Aggregation window size in seconds"),
      last: z
        .number()
        .optional()
        .describe("Get last N data points"),
    },
    async (params) => {
      const response = await client.getAgentStatistics(params);

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

  // ─── get_access_point_metrics ───────────────────────────
  server.tool(
    "get_access_point_metrics",
    `Get WiFi access point metrics over time (Legacy API). Returns time-series data for WiFi signal quality: bit rate, channel, link quality (0.0-1.0), signal level (dBm), receive/transmit rates.

Use this for WiFi troubleshooting — correlate signal quality with test performance to determine if WiFi issues are causing monitoring problems. Combine with agent logs (wpa_supplicant events) and access point connections for comprehensive WiFi diagnosis.

Response: { metrics: [{ access_point_id, bit_rate, channel, id, link_quality, network_interface_id, rx_rate, signal_level, timestamp, tx_rate }] }`,
    {
      agent_id: z
        .number()
        .optional()
        .describe("Filter by agent ID"),
      access_point_id: z
        .number()
        .optional()
        .describe("Filter by access point ID"),
      from: z
        .string()
        .optional()
        .describe("Start time (Unix timestamp or ISO 8601)"),
      to: z
        .string()
        .optional()
        .describe("End time (Unix timestamp or ISO 8601)"),
      cardinality: z
        .number()
        .optional()
        .describe(
          "If set, uses the downsampled /sample endpoint with this many data points. Useful for long time ranges."
        ),
    },
    async (params) => {
      let response;
      if (params.cardinality !== undefined) {
        response = await client.getAccessPointMetricsSample({
          agent_id: params.agent_id,
          access_point_id: params.access_point_id,
          from: params.from,
          to: params.to,
          cardinality: params.cardinality,
        });
      } else {
        response = await client.getAccessPointMetrics({
          agent_id: params.agent_id,
          access_point_id: params.access_point_id,
          from: params.from,
          to: params.to,
        });
      }

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
