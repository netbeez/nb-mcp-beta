/**
 * Action tools — run_adhoc_test (Network Speed Test, VoIP, and Iperf)
 */

import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { JsonApiClient } from "../api/jsonapi-client.js";

/** Default poll interval in ms */
const POLL_INTERVAL_MS = 5000;
/** Maximum time to wait for completion in ms (5 minutes) */
const MAX_WAIT_MS = 300_000;

export function registerActionTools(server: McpServer, client: JsonApiClient) {
  // ─── run_adhoc_test ─────────────────────────────────────
  server.tool(
    "run_adhoc_test",
    `Run an ad-hoc network test on one or more agents. IMPORTANT: Only Iperf Tests, Network Speed Tests, and VoIP Tests are supported — regular tests (ping/dns/http/traceroute) cannot be created ad-hoc via the API.

This is a two-phase operation:
1. Creates the test run (POST)
2. Polls for completion until all agents finish

For Iperf Tests: returns throughput metrics between two agents. Requires destination_agent_id.
For Network Speed Tests: returns download/upload speeds and latency.
For VoIP Tests: returns latency, jitter, packet loss, and MOS score.

Test type IDs: 5 = Iperf Test, 7 = Network Speed Test, 10 = VoIP Test.
Speed test types: 2 = NDT test, 3 = fast.com test.`,
    {
      agent_ids: z
        .array(z.number())
        .min(1)
        .describe("Array of agent IDs to run the test on (at least 1)"),
      test_type_id: z
        .enum(["5", "7", "10"])
        .describe(
          "Test type: 5 = Iperf Test, 7 = Network Speed Test, 10 = VoIP Test"
        ),
      speedtest_type: z
        .enum(["2", "3"])
        .optional()
        .describe(
          "Speed test type (only for Network Speed Tests): 2 = NDT test, 3 = fast.com test"
        ),
      target: z
        .string()
        .optional()
        .describe("Target hostname or IP (for VoIP tests)"),
      secure: z
        .boolean()
        .optional()
        .describe("Use secure connection (for VoIP tests)"),
      destination_agent_id: z
        .number()
        .optional()
        .describe(
          "Destination agent ID for Iperf tests (required when test_type_id is 5). The iperf server runs on this agent."
        ),
      iperf_time: z
        .number()
        .optional()
        .describe("Iperf test duration in seconds (default 10)"),
      iperf_type: z
        .enum(["1", "2"])
        .optional()
        .describe("Iperf protocol: 1 = TCP (default), 2 = UDP"),
      iperf_port: z
        .number()
        .optional()
        .describe("Iperf server port, 1-65535 (default 5001)"),
      iperf_version: z
        .enum(["2", "3"])
        .optional()
        .describe("Iperf version: 2 or 3 (default 3)"),
      parallel_streams: z
        .number()
        .optional()
        .describe("Number of parallel streams, 1-16 (default 1)"),
      reverse: z
        .boolean()
        .optional()
        .describe("Reverse mode — server sends, client receives (default false)"),
      bandwidth: z
        .number()
        .optional()
        .describe("Bandwidth limit in Mbps (UDP only, optional)"),
    },
    async (params) => {
      // Phase 1: Create the ad-hoc test run
      const testTypeId = parseInt(params.test_type_id, 10);

      const payload: Record<string, unknown> = {
        data: {
          type: "multiagent_nb_test_runs",
          attributes: {
            agent_ids: params.agent_ids,
            test_type_id: testTypeId,
          },
        },
      };

      const attrs = (payload.data as any).attributes;

      if (testTypeId === 5) {
        if (!params.destination_agent_id) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Error: destination_agent_id is required for Iperf tests (test_type_id 5).",
              },
            ],
          };
        }
        const iperfConfig: Record<string, unknown> = {
          target_is_agent: params.destination_agent_id,
          iperf_time: params.iperf_time ?? 10,
          iperf_type: parseInt(params.iperf_type ?? "1", 10),
          iperf_port: params.iperf_port ?? 5001,
          iperf_version: parseInt(params.iperf_version ?? "3", 10),
          parallel_streams: params.parallel_streams ?? 1,
          reverse: params.reverse ?? false,
          tcp_window: 1,
        };
        if (params.bandwidth !== undefined) {
          iperfConfig.bandwidth = params.bandwidth;
        }
        attrs.configuration = iperfConfig;
      }

      if (params.speedtest_type) {
        attrs.speedtest_type = parseInt(params.speedtest_type, 10);
      }
      if (params.target) {
        attrs.target = params.target;
      }
      if (params.secure !== undefined) {
        attrs.secure = params.secure;
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
