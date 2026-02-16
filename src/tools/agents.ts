/**
 * Agent tools — list_agents, get_agent, search_agents, get_agent_logs, get_agent_performance_metrics
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

export function registerAgentTools(server: McpServer, client: JsonApiClient) {
  // ─── list_agents ────────────────────────────────────────
  server.tool(
    "list_agents",
    `List all NetBeez monitoring agents with optional filtering. Returns agent name, active status, class, software version, network interfaces, and associated test IDs. Use this to get an overview of your monitoring infrastructure or find agents by category/class/status.`,
    {
      filter_name: z
        .string()
        .optional()
        .describe("Filter by exact agent name"),
      filter_name_regex: z
        .string()
        .optional()
        .describe("Filter by agent name using regex pattern"),
      filter_categories: z
        .string()
        .optional()
        .describe("Filter by category: network_agent or remote_worker_agent (comma-separated)"),
      filter_agent_classes: z
        .string()
        .optional()
        .describe(
          "Filter by agent class: container, faste, wireless, gige, virtual, external, software, mac, windows (comma-separated)"
        ),
      filter_active: z
        .boolean()
        .optional()
        .describe("Filter by active status (true=online, false=offline)"),
      page: z.number().optional().describe("Page offset (default 1)"),
      page_size: z
        .number()
        .optional()
        .describe("Results per page (default 25, max 100)"),
    },
    async (params) => {
      const response = await client.listAgents({
        filters: {
          name: params.filter_name,
          "name[regex]": params.filter_name_regex,
          categories: params.filter_categories,
          agent_classes: params.filter_agent_classes,
          active: params.filter_active,
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

  // ─── get_agent ──────────────────────────────────────────
  server.tool(
    "get_agent",
    `Get detailed information about a specific NetBeez agent by its ID. Returns full agent details including network interfaces, tags, test associations, and group memberships. Use this after list_agents to drill into a specific agent.`,
    {
      agent_id: z
        .number()
        .describe("The numeric ID of the agent"),
      include: z
        .string()
        .optional()
        .describe(
          "Relationships to include: network_interfaces, agent_groups (comma-separated)"
        ),
    },
    async (params) => {
      const response = await client.getAgent(params.agent_id, {
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

  // ─── search_agents ──────────────────────────────────────
  server.tool(
    "search_agents",
    `Search for NetBeez agents by name (exact match or regex pattern). Use this when looking for specific agents by name rather than browsing the full list. Supports additional filters for category, class, and active status.`,
    {
      query: z
        .string()
        .describe("Agent name search string or regex pattern"),
      use_regex: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, treat query as a regex pattern (default: false)"),
      filter_categories: z
        .string()
        .optional()
        .describe("Filter by category: network_agent or remote_worker_agent"),
      filter_agent_classes: z
        .string()
        .optional()
        .describe("Filter by agent class (comma-separated)"),
      filter_active: z
        .boolean()
        .optional()
        .describe("Filter by active status"),
    },
    async (params) => {
      const filters: Record<string, string | boolean | undefined> = {
        categories: params.filter_categories,
        agent_classes: params.filter_agent_classes,
        active: params.filter_active,
      };

      if (params.use_regex) {
        filters["name[regex]"] = params.query;
      } else {
        filters["name"] = params.query;
      }

      const response = await client.listAgents({ filters });

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

  // ─── get_agent_logs ─────────────────────────────────────
  server.tool(
    "get_agent_logs",
    `Get connection/disconnection event logs for a specific agent. Shows CONNECT, DISCONNECT events with timestamps. For wireless agents, also includes wpa_supplicant events (WiFi association/authentication state changes, SSID roaming, 4-way handshake) and DHCP events (lease acquire, renew, release, fail). Critical for diagnosing agent availability issues, WiFi connectivity problems, and DHCP issues.`,
    {
      agent_id: z
        .number()
        .describe("The numeric ID of the agent"),
      filter_types: z
        .string()
        .optional()
        .describe("Filter by log type: DISCONNECT, CONNECT, etc. (comma-separated)"),
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
      const response = await client.getAgentLogs(params.agent_id, {
        filters: {
          types: params.filter_types,
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

  // ─── get_agent_performance_metrics ──────────────────────
  server.tool(
    "get_agent_performance_metrics",
    `Get system performance metrics (CPU usage, memory usage, disk usage) for a specific agent over time. Use this to check if an agent's hardware resources are stressed, which could affect monitoring accuracy. Useful when investigating agent-side issues or capacity planning.`,
    {
      agent_id: z
        .number()
        .describe("The numeric ID of the agent"),
      from_ts: z
        .string()
        .optional()
        .describe("Start timestamp (ISO 8601 or Unix)"),
      to_ts: z
        .string()
        .optional()
        .describe("End timestamp (ISO 8601 or Unix)"),
    },
    async (params) => {
      const options: any = {};
      if (params.from_ts || params.to_ts) {
        options.extraParams = {};
        if (params.from_ts) options.extraParams["from"] = params.from_ts;
        if (params.to_ts) options.extraParams["to"] = params.to_ts;
      }

      const response = await client.getAgentPerformanceMetrics(
        params.agent_id,
        options
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
  );
}
