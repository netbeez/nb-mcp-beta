/**
 * Incident tools — list_incidents
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

export function registerIncidentTools(server: McpServer, client: JsonApiClient) {
  // ─── list_incidents ─────────────────────────────────────
  server.tool(
    "list_incidents",
    `List network incidents. Incidents are aggregated groups of related alerts for an agent/target/WiFi scope. Each incident has a start time, optional end time, and acknowledgement status. Use include=incident_logs to get the detailed event timeline within each incident. Filter by agents, targets, categories, or time ranges to find specific incidents.

Incident severity is inherited from the highest-severity alert within it. An open incident (no end_ts) means the issue is ongoing. Acknowledged incidents (has ack_ts) have been seen by an operator but may still be open.`,
    {
      filter_ids: z
        .string()
        .optional()
        .describe("Filter by incident IDs (comma-separated)"),
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
      filter_targets: z
        .string()
        .optional()
        .describe("Filter by target IDs (comma-separated)"),
      filter_wifi_profile: z
        .string()
        .optional()
        .describe("Filter by WiFi profile IDs (comma-separated)"),
      filter_ack_ts_operator: z
        .string()
        .optional()
        .describe("Acknowledgement time filter operator"),
      filter_ack_ts_value1: z.string().optional(),
      filter_ack_ts_value2: z.string().optional(),
      filter_end_ts_operator: z
        .string()
        .optional()
        .describe("End time filter operator (use to find open vs closed incidents)"),
      filter_end_ts_value1: z.string().optional(),
      filter_end_ts_value2: z.string().optional(),
      filter_start_ts_operator: z
        .string()
        .optional()
        .describe("Start time filter operator"),
      filter_start_ts_value1: z.string().optional(),
      filter_start_ts_value2: z.string().optional(),
      include: z
        .string()
        .optional()
        .describe("Relationships to include: incident_logs (for event timeline)"),
      page: z.number().optional().describe("Page offset"),
      page_size: z.number().optional().describe("Results per page"),
    },
    async (params) => {
      const response = await client.listIncidents({
        filters: {
          ids: params.filter_ids,
          agents: params.filter_agents,
          categories: params.filter_categories,
          agent_classes: params.filter_agent_classes,
          targets: params.filter_targets,
          wifi_profile: params.filter_wifi_profile,
        },
        timestampFilters: {
          ack_ts:
            params.filter_ack_ts_operator && params.filter_ack_ts_value1
              ? {
                  operator: params.filter_ack_ts_operator as any,
                  value1: params.filter_ack_ts_value1,
                  value2: params.filter_ack_ts_value2,
                }
              : undefined,
          end_ts:
            params.filter_end_ts_operator && params.filter_end_ts_value1
              ? {
                  operator: params.filter_end_ts_operator as any,
                  value1: params.filter_end_ts_value1,
                  value2: params.filter_end_ts_value2,
                }
              : undefined,
          start_ts:
            params.filter_start_ts_operator && params.filter_start_ts_value1
              ? {
                  operator: params.filter_start_ts_operator as any,
                  value1: params.filter_start_ts_value1,
                  value2: params.filter_start_ts_value2,
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
