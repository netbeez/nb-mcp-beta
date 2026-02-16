/**
 * WiFi tools — list_wifi_profiles
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

export function registerWifiTools(server: McpServer, client: JsonApiClient) {
  // ─── list_wifi_profiles ─────────────────────────────────
  server.tool(
    "list_wifi_profiles",
    `List WiFi profiles configured in NetBeez. WiFi profiles define SSID, encryption, and authentication settings used by wireless agents. Use this to see which WiFi networks are being monitored, or to find profiles with open incidents indicating WiFi issues. Cross-reference with wireless agent data and access point metrics for WiFi troubleshooting.`,
    {
      filter_ssid: z
        .string()
        .optional()
        .describe("Filter by SSID name"),
      filter_description: z
        .string()
        .optional()
        .describe("Filter by description text"),
      filter_encryption_method: z
        .string()
        .optional()
        .describe("Filter by encryption method"),
      filter_authentication_method: z
        .string()
        .optional()
        .describe("Filter by authentication method"),
      filter_open_incident: z
        .boolean()
        .optional()
        .describe("Filter to profiles with open incidents (true) or without (false)"),
      page: z.number().optional().describe("Page offset"),
      page_size: z.number().optional().describe("Results per page"),
    },
    async (params) => {
      const response = await client.listWifiProfiles({
        filters: {
          ssid: params.filter_ssid,
          description: params.filter_description,
          encryption_method: params.filter_encryption_method,
          authentication_method: params.filter_authentication_method,
          open_incident: params.filter_open_incident,
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
