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
    `Get pre-aggregated test statistics over time (Legacy API: GET /nb_test_statistics.json). Use this — instead of the raw test result endpoints — when you want trend analysis over a long window: averages, percentiles, variability, jitter, or MOS already bucketed into time windows.

How the response is shaped:
- Each row is one (time-window, metric_type) pair for one matched test.
- The unit/scale of 'value' depends on metric_type (ms for mean / percentile_mean / stdev / jitter; 1.0–5.0 for mos).
- Omitting metric_type returns every type the matched test(s) produce; one row per (window, metric_type).

Scoping the query (combine as needed; all narrow the same set of underlying tests):
- nb_test_id — exactly one test instance.
- nb_test_template_id — every test instance derived from a template (one per agent).
- agent_id — restrict to tests run by this agent.
- nb_target_id — restrict to tests against this target.
- test_type_id — restrict to a class of tests (Ping/DNS/HTTP/Traceroute/etc.).

Time range (mutually exclusive — pick one):
- from + to — explicit interval (epoch ms, epoch seconds, or ISO 8601; normalized to ms).
- last — the most recent N data points (no from/to needed).

Aggregation control:
- window_size sets the bucket size in seconds (e.g. 60 = 1-minute buckets, 300 = 5-minute, 3600 = 1-hour).
- granularity is an alternative aggregation hint accepted by the upstream API; pass either window_size OR granularity, not both.
- grouping changes how rows are grouped within the response. Known value: 'nb_test_id' (per-test breakdown — useful when scoped to a template to get one series per agent). Other values are passed through to the API.

Value (watermark) filtering:
- value_operator + value_watermark together filter rows by the aggregated 'value' (e.g. value_operator='>' with value_watermark=200 returns only buckets whose aggregated value exceeds 200). Both must be supplied for the filter to apply.

To retrieve jitter or MOS: scope to a test that produces them (a VoIP test, or a Ping test with jitter/MOS enabled) via nb_test_id, nb_test_template_id, or test_type_id, then either set metric_type='jitter' / metric_type='mos', or omit metric_type and pick rows whose metric_type field equals 'jitter' / 'mos'. If the matched test does not produce that metric, no rows are returned for it.

Response: { nb_test_statistics: [{ id, nb_test_id, timestamp, value, metric_type, window_size, datapoint_count, error_count }] }`,
    {
      nb_test_id: z
        .number()
        .optional()
        .describe(
          "Filter by a single test instance ID (one agent + one template). Combinable with the other ID filters as an AND."
        ),
      agent_id: z
        .number()
        .optional()
        .describe(
          "Filter to tests run by this agent. Combinable with the other ID filters as an AND."
        ),
      nb_test_template_id: z
        .number()
        .optional()
        .describe(
          "Filter to all tests derived from this template (one test per agent assigned to the template). Combinable with the other ID filters as an AND."
        ),
      nb_target_id: z
        .number()
        .optional()
        .describe(
          "Filter to tests targeting this target (hostname/IP/URL). Combinable with the other ID filters as an AND."
        ),
      test_type_id: z
        .number()
        .optional()
        .describe(
          "Filter by test type ID — restricts to one class of tests (e.g. Ping, DNS, HTTP, Traceroute). The integer mapping is defined by the upstream API."
        ),
      window_size: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Aggregation bucket size in seconds (e.g. 60 = 1-minute buckets, 300 = 5-minute, 3600 = 1-hour). Pass either window_size OR granularity, not both."
        ),
      granularity: z
        .string()
        .optional()
        .describe(
          "Alternative aggregation control accepted by the upstream API; passed through verbatim. Use this OR window_size, not both. Refer to the NetBeez API docs for accepted values."
        ),
      from: z
        .string()
        .optional()
        .describe(
          "Start of the time range. Accepts Unix epoch ms, Unix epoch seconds, or ISO 8601; the client normalizes to ms. Use together with 'to'. Mutually exclusive with 'last'."
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End of the time range. Accepts Unix epoch ms, Unix epoch seconds, or ISO 8601; the client normalizes to ms. Use together with 'from'. Mutually exclusive with 'last'."
        ),
      last: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Return the most recent N data points. Mutually exclusive with from/to."
        ),
      metric_type: z
        .enum(["mean", "percentile_mean", "stdev", "jitter", "mos"])
        .optional()
        .describe(
          "Which statistical view or derived metric to retrieve. 'mean' / 'percentile_mean' / 'stdev' are computed from the test's primary measurement (e.g. RTT for Ping, lookup time for DNS, response time for HTTP). 'jitter' and 'mos' are only emitted by tests that produce them (VoIP tests, and Ping tests with the jitter/MOS option enabled). Omit to receive all types available for the matched test(s). Determines the unit/scale of the row's 'value'."
        ),
      grouping: z
        .string()
        .optional()
        .describe(
          "Group result rows by the named field. Known value: 'nb_test_id' (per-test breakdown — when scoped to a template, this yields one series per agent running the template). Other values are passed through to the upstream API; refer to the NetBeez API docs for the full list."
        ),
      ts_order: z
        .enum(["asc", "desc"])
        .optional()
        .describe(
          "Order rows by timestamp. 'asc' = oldest first, 'desc' = newest first."
        ),
      sort_by: z
        .string()
        .optional()
        .describe(
          "Field to sort the response by (e.g. a column from the row schema such as 'timestamp' or 'value'). Pair with sort_by_order to choose direction. Refer to the NetBeez API docs for the exact list of sortable fields."
        ),
      sort_by_order: z
        .enum(["asc", "desc"])
        .optional()
        .describe(
          "Sort direction for sort_by. 'asc' = ascending, 'desc' = descending."
        ),
      value_operator: z
        .string()
        .optional()
        .describe(
          "Comparison operator used together with value_watermark to filter rows by their aggregated 'value' (a watermark filter). Conventionally one of '>', '<', '>=', '<=', '='. Has no effect unless value_watermark is also provided."
        ),
      value_watermark: z
        .number()
        .optional()
        .describe(
          "Threshold value compared against each row's aggregated 'value' using value_operator (e.g. value_operator='>' + value_watermark=200 returns only buckets whose value exceeds 200). Has no effect unless value_operator is also provided. Units match the metric_type (e.g. ms for latency-like metrics, MOS scale 1.0–5.0 for 'mos')."
        ),
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
    `Get agent availability/uptime statistics over time (Legacy API: GET /nb_agent_statistics.json). Returns time-bucketed uptime samples for one agent: uptime percentage (0–100), interval, and window size per bucket.

Use this to analyze agent reliability, find patterns of agent disconnections, or verify an agent has been consistently online during a period. agent_id is required (this endpoint only operates on a single agent at a time).

Time range (mutually exclusive — pick one):
- from + to — explicit interval (epoch ms, epoch seconds, or ISO 8601; normalized to ms).
- last — the most recent N data points.

Response: { agent_stats: [{ agent_id, id, interval, timestamp, uptime, window_size }] }`,
    {
      agent_id: z
        .number()
        .describe("Agent ID — required. The endpoint only operates on a single agent."),
      from: z
        .string()
        .optional()
        .describe(
          "Start of the time range. Accepts Unix epoch ms, Unix epoch seconds, or ISO 8601; the client normalizes to ms. Use together with 'to'. Mutually exclusive with 'last'."
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End of the time range. Accepts Unix epoch ms, Unix epoch seconds, or ISO 8601; the client normalizes to ms. Use together with 'from'. Mutually exclusive with 'last'."
        ),
      window_size: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Aggregation bucket size in seconds (e.g. 60 = 1-minute buckets, 300 = 5-minute, 3600 = 1-hour)."
        ),
      last: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Return the most recent N data points. Mutually exclusive with from/to."
        ),
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
    `Get WiFi access point metrics over time (Legacy API: GET /access_point_metrics.json, or GET /access_point_metrics/sample.json when 'cardinality' is set). Returns per-sample WiFi signal quality data: bit_rate (Mbps), channel, link_quality (0.0–1.0), signal_level (dBm), rx_rate / tx_rate (Mbps), and the associated network_interface_id.

Use this for WiFi troubleshooting — correlate signal quality with test performance to determine whether WiFi conditions are causing monitoring issues. Pairs well with agent logs (wpa_supplicant events) and the agent's access_point_connections endpoint.

Endpoint variant:
- Without 'cardinality': returns every sample in the range (can be large for long windows).
- With 'cardinality': switches to the downsampled /sample endpoint, which returns at most that many points — use this for long time ranges to keep the payload manageable.

Response: { metrics: [{ access_point_id, bit_rate, channel, id, link_quality, network_interface_id, rx_rate, signal_level, timestamp, tx_rate }] }`,
    {
      agent_id: z
        .number()
        .optional()
        .describe("Filter to samples produced by this agent. Combinable with access_point_id."),
      access_point_id: z
        .number()
        .optional()
        .describe("Filter to samples for this access point (BSSID-keyed AP). Combinable with agent_id."),
      from: z
        .string()
        .optional()
        .describe(
          "Start of the time range. Accepts Unix epoch ms, Unix epoch seconds, or ISO 8601; the client normalizes to ms. Use together with 'to'."
        ),
      to: z
        .string()
        .optional()
        .describe(
          "End of the time range. Accepts Unix epoch ms, Unix epoch seconds, or ISO 8601; the client normalizes to ms. Use together with 'from'."
        ),
      cardinality: z
        .number()
        .int()
        .positive()
        .optional()
        .describe(
          "Target number of points to return. When set, the tool calls the downsampled /access_point_metrics/sample.json endpoint and the response is reduced to ~this many evenly-spaced samples. Recommended for long time ranges."
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
