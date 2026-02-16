/**
 * Target tools — list_targets, get_target
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

export function registerTargetTools(server: McpServer, client: JsonApiClient) {
  // ─── list_targets ───────────────────────────────────────
  server.tool(
    "list_targets",
    `List all monitoring targets (hosts, URLs, IPs being monitored). Returns targets with their associated test templates and alert counts. Use this to see what is being monitored, find targets with open incidents, or filter by agent/category/connectivity type.`,
    {
      filter_name_regex: z
        .string()
        .optional()
        .describe("Filter targets by name using regex pattern"),
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
      filter_open_incident: z
        .boolean()
        .optional()
        .describe("Filter to only targets with open incidents (true) or without (false)"),
      filter_wifi: z
        .boolean()
        .optional()
        .describe("Filter to targets monitored over WiFi"),
      filter_wired: z
        .boolean()
        .optional()
        .describe("Filter to targets monitored over wired connections"),
      include: z
        .string()
        .optional()
        .describe("Relationships to include: test_templates"),
      page: z.number().optional().describe("Page offset"),
      page_size: z.number().optional().describe("Results per page"),
    },
    async (params) => {
      const response = await client.listTargets({
        filters: {
          "name[regex]": params.filter_name_regex,
          agents: params.filter_agents,
          categories: params.filter_categories,
          agent_classes: params.filter_agent_classes,
          agent_groups: params.filter_agent_groups,
          open_incident: params.filter_open_incident,
          wifi: params.filter_wifi,
          wired: params.filter_wired,
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

  // ─── get_target ─────────────────────────────────────────
  server.tool(
    "get_target",
    `Get detailed information about a specific monitoring target by its ID. Returns the target with its test templates, test configuration, and associated tests. Use this after list_targets to drill into a specific target's monitoring setup.`,
    {
      target_id: z
        .number()
        .describe("The numeric ID of the target"),
      include: z
        .string()
        .optional()
        .describe("Relationships to include: test_templates"),
    },
    async (params) => {
      // Use filter[ids] to get a specific target
      const response = await client.listTargets({
        filters: { ids: String(params.target_id) },
        include: params.include,
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
