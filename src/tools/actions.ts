/**
 * Action tools — run_adhoc_test (Iperf, Network Speed, VoIP, Custom Command)
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

/** Default poll interval in ms */
const POLL_INTERVAL_MS = 5000;
/** Maximum time to wait for completion in ms (5 minutes) */
const MAX_WAIT_MS = 300_000;

/** Map human-readable test type to API id. */
const TEST_TYPE_MAP: Record<string, string> = {
  "5": "5",
  "7": "7",
  "8": "8",
  "11": "11",
  iperf: "5",
  speed: "7",
  speedtest: "7",
  voip: "8",
  custom: "11",
  custom_command: "11",
};
/** Map human-readable speed test type to API id (1=Ookla, 2=NDT, 3=fast.com, 4=Cloudflare). */
const SPEEDTEST_TYPE_MAP: Record<string, string> = {
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  ookla: "1",
  ndt: "2",
  fast: "3",
  "fast.com": "3",
  cloudflare: "4",
};
/** Map human-readable Iperf protocol to API id (1=TCP, 2=UDP). */
const IPERF_TYPE_MAP: Record<string, string> = {
  "1": "1",
  "2": "2",
  tcp: "1",
  udp: "2",
};

export function registerActionTools(server: McpServer, client: JsonApiClient) {
  // ─── get_multiagent_test_run_status ─────────────────────
  server.tool(
    "get_multiagent_test_run_status",
    `Get the status and results of a multiagent test run by ID. Use this after run_adhoc_test to poll for completion and retrieve results. Call with the multiagent_nb_test_run_id returned when creating an ad-hoc test. Returns run state (e.g. initialization, running, completed, failed) and included results when available.`,
    {
      multiagent_nb_test_run_id: z
        .union([z.string(), z.number()])
        .describe("The multiagent_nb_test_run ID (returned from run_adhoc_test or from the API)."),
    },
    async (params) => {
      const id = String(params.multiagent_nb_test_run_id);
      const response = await client.getAdHocTestRun(id);
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

  // ─── run_adhoc_test ─────────────────────────────────────
  server.tool(
    "run_adhoc_test",
    `Run an ad-hoc test on one or more agents. Supported test types are Iperf (5), Network Speed (7), VoIP (8), and Custom Command (11). Ping/DNS/HTTP/Traceroute cannot be run ad-hoc via this endpoint.

Creates the test run and polls until completion. Returns the multiagent_nb_test_run_id; after running, use get_multiagent_test_run_status with that ID to check status or retrieve results (e.g. if this tool times out or you need to re-check later).

• test_type: use "iperf" (or "5"), "speed"/"speedtest" (or "7"), "voip" (or "8"), or "custom"/"custom_command" (or "11").
• speedtest_type (for Network Speed only): use "ookla", "ndt", "fast", or "cloudflare" (or "1","2","3","4").
• Iperf: provide either destination_agent_id (agent-to-agent) or target (destination IP or FQDN for agent-to-server; not a NetBeez target entity).
• VoIP: agent-to-agent only; destination_agent_id required.
• Custom Command: provide custom_command (script body with shebang) and output_schema (array of { metric, unit }); no destination is needed.`,
    {
      agent_ids: z
        .array(z.number())
        .min(1)
        .describe("Agent IDs to run the test on (at least one)"),
      test_type_id: z
        .enum([
          "5",
          "7",
          "8",
          "11",
          "iperf",
          "speed",
          "speedtest",
          "voip",
          "custom",
          "custom_command",
        ])
        .describe(
          "Test type. Words: iperf (5), speed or speedtest (7), voip (8), custom or custom_command (11). Numbers: 5, 7, 8, 11."
        ),
      speedtest_type: z
        .enum([
          "1",
          "2",
          "3",
          "4",
          "ookla",
          "ndt",
          "fast",
          "fast.com",
          "cloudflare",
        ])
        .optional()
        .describe(
          "Speed test provider (only for Network Speed tests). Words: ookla (1), ndt (2), fast or fast.com (3), cloudflare (4). Numbers: 1, 2, 3, 4. Default: ndt (2)."
        ),
      target: z
        .string()
        .optional()
        .describe(
          "For Iperf agent-to-server: destination IP or FQDN (the server address; not a NetBeez target entity). Not used for VoIP. Required for Iperf when not using destination_agent_id."
        ),
      secure: z
        .boolean()
        .optional()
        .describe("Use secure connection (e.g. for VoIP)"),
      destination_agent_id: z
        .number()
        .optional()
        .describe(
          "Destination agent ID. Required for VoIP. For Iperf agent-to-agent, the iperf server runs on this agent. Use either this OR target for Iperf, not both."
        ),
      iperf_time: z
        .number()
        .optional()
        .describe("Iperf duration in seconds (default 10)"),
      iperf_type: z
        .enum(["1", "2", "tcp", "udp"])
        .optional()
        .describe("Iperf protocol: tcp (1) or udp (2). Default: tcp."),
      iperf_port: z
        .number()
        .optional()
        .describe("Iperf server port 1-65535 (default 5001)"),
      iperf_version: z
        .enum(["2", "3"])
        .optional()
        .describe("Iperf version: 2 or 3 (default 3)"),
      parallel_streams: z
        .number()
        .optional()
        .describe("Parallel streams 1-16 (default 1)"),
      reverse: z
        .boolean()
        .optional()
        .describe("Reverse mode: server sends, client receives (default false)"),
      bandwidth: z
        .number()
        .optional()
        .describe("Bandwidth limit in Mbps, UDP only (optional)"),
      custom_command: z
        .string()
        .optional()
        .describe(
          "Custom command script body for test_type 11. Must start with #!/usr/bin/env bash or #!/usr/bin/env python."
        ),
      output_schema: z
        .array(
          z.object({
            metric: z.string(),
            unit: z.string(),
          })
        )
        .optional()
        .describe(
          "Custom command metrics schema for test_type 11. Array of { metric, unit } entries matching script output keys."
        ),
    },
    async (params) => {
      // Normalize human-readable values to API numeric IDs
      const test_type_id =
        TEST_TYPE_MAP[params.test_type_id.toLowerCase?.() ?? params.test_type_id] ??
        params.test_type_id;
      const speedtest_type = params.speedtest_type
        ? SPEEDTEST_TYPE_MAP[params.speedtest_type.toLowerCase?.() ?? params.speedtest_type] ??
          params.speedtest_type
        : undefined;
      const iperf_type = params.iperf_type
        ? IPERF_TYPE_MAP[params.iperf_type.toLowerCase?.() ?? params.iperf_type] ??
          params.iperf_type
        : undefined;
      const normalizedParams = {
        ...params,
        test_type_id,
        speedtest_type,
        iperf_type,
      };
      // Phase 1: Create the ad-hoc test run
      const testTypeId = parseInt(normalizedParams.test_type_id, 10);

      // Build attributes object explicitly so the API always receives a full data payload
      const attributes: Record<string, unknown> = {
        schedule_type: "ad_hoc",
      };

      const payload: Record<string, unknown> = {
        data: {
          type: "multiagent_nb_test_run",
          attributes,
          relationships: {
            agents: {
              data: normalizedParams.agent_ids.map((agentId: number) => ({
                id: agentId,
                type: "agent",
              })),
            },
            test_type: {
              data: {
                id: testTypeId,
                type: "test_type",
              },
            },
          },
        },
      };

      const attrs = attributes;

      if (testTypeId === 5) {
        const hasAgentTarget = params.destination_agent_id != null;
        const hasServerTarget =
          params.target !== undefined && params.target.trim() !== "";
        if (!hasAgentTarget && !hasServerTarget) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: For Iperf tests (test_type_id 5) provide either destination_agent_id (agent-to-agent) or target (destination IP or FQDN for agent-to-server).",
              },
            ],
          };
        }
        if (hasAgentTarget && hasServerTarget) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: For Iperf tests use either destination_agent_id (agent-to-agent) or target (destination IP/FQDN for agent-to-server), not both.",
              },
            ],
          };
        }
        if (hasAgentTarget) {
          attrs.target_is_agent = normalizedParams.destination_agent_id;
        } else {
          attrs.target = normalizedParams.target!.trim();
          // Agent-to-server: tell API destination is the server at target, not an agent
          attrs.target_is_agent = 0;
        }
        attrs.iperf_time = normalizedParams.iperf_time ?? 10;
        attrs.iperf_type = parseInt(normalizedParams.iperf_type ?? "1", 10);
        attrs.iperf_port = normalizedParams.iperf_port ?? 5001;
        attrs.iperf_version = parseInt(normalizedParams.iperf_version ?? "3", 10);
        attrs.parallel_streams = normalizedParams.parallel_streams ?? 1;
        attrs.reverse = normalizedParams.reverse ?? false;
        attrs.tcp_window = 1;
        if (normalizedParams.bandwidth !== undefined) {
          attrs.bandwidth = normalizedParams.bandwidth;
        }
      }

      if (testTypeId === 8) {
        if (normalizedParams.destination_agent_id == null) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: VoIP tests (test_type_id 8) are agent-to-agent only. destination_agent_id is required.",
              },
            ],
          };
        }
        attrs.target_is_agent = normalizedParams.destination_agent_id;
      }

      if (testTypeId === 11) {
        if (!normalizedParams.custom_command) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: custom_command (script body) is required for Custom Command tests (test_type_id 11).",
              },
            ],
          };
        }
        const command = normalizedParams.custom_command.trimStart();
        if (
          !command.startsWith("#!/usr/bin/env bash") &&
          !command.startsWith("#!/usr/bin/env python")
        ) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: custom_command must start with '#!/usr/bin/env bash' or '#!/usr/bin/env python'.",
              },
            ],
          };
        }
        if (!normalizedParams.output_schema || normalizedParams.output_schema.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: output_schema (array of { metric, unit }) is required for Custom Command tests (test_type_id 11).",
              },
            ],
          };
        }
        attrs.custom_command = command;
        attrs.output_schema = normalizedParams.output_schema;
      }

      if (testTypeId === 7 && !normalizedParams.speedtest_type) {
        attrs.speedtest_type = 2;
      }
      if (normalizedParams.speedtest_type) {
        attrs.speedtest_type = parseInt(normalizedParams.speedtest_type, 10);
      }
      if (testTypeId === 7) {
        attrs.target = normalizedParams.target ?? "";
        // Match API request shape from Postman (optional fields some backends expect)
        if (attrs.server === undefined) attrs.server = null;
        if (attrs.mini_server === undefined) attrs.mini_server = null;
        if (normalizedParams.secure !== undefined) attrs.secure = normalizedParams.secure;
      } else if (normalizedParams.target && testTypeId !== 8 && testTypeId !== 11) {
        attrs.target = normalizedParams.target;
      }
      if (normalizedParams.secure !== undefined && testTypeId !== 7) {
        attrs.secure = normalizedParams.secure;
      }

      const createResponse = await client.runAdHocTest(payload);

      // Extract the test run ID
      const data = Array.isArray(createResponse.data)
        ? createResponse.data[0]
        : createResponse.data;

      if (!data?.id) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Failed to create ad-hoc test run. Response: ${JSON.stringify(createResponse, null, 2)}`,
            },
          ],
        };
      }

      const testRunId = data.id;

      // Phase 2: Poll for completion
      const startTime = Date.now();
      let pollResponse;
      let state = "initialization";

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        pollResponse = await client.getAdHocTestRun(testRunId);

        const runData = Array.isArray(pollResponse.data)
          ? pollResponse.data[0]
          : pollResponse.data;

        state = runData?.attributes?.state as string || "unknown";

        if (state === "completed" || state === "failed" || state === "error") {
          break;
        }
      }

      if (state !== "completed") {
        return {
          content: [
            {
              type: "text" as const,
              text: `Ad-hoc test run ${testRunId} did not complete within timeout. Last state: ${state}. You can check results later using the test run ID.\n\nPartial response:\n${JSON.stringify(pollResponse, null, 2)}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(pollResponse, null, 2),
          },
        ],
      };
    }
  );
}
