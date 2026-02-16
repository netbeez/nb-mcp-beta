/**
 * Legacy API client — for the 3 statistics endpoints only.
 *
 * Auth: Authorization: <API_KEY> (no "Bearer" prefix) + API-VERSION: v1
 * Endpoints: /apis/*.json
 */

import { Config } from "../config.js";
import { BaseClient } from "./base-client.js";
import type { TestStatistic, AgentStatistic, AccessPointMetric } from "./types.js";

export interface LegacyQueryParams {
  [key: string]: string | number | boolean | undefined;
}

export class LegacyClient extends BaseClient {
  constructor(config: Config) {
    super(config);
  }

  /**
   * GET a legacy API endpoint.
   */
  private async legacyGet<T = unknown>(
    path: string,
    params: LegacyQueryParams = {}
  ): Promise<T> {
    // Convert all params to strings
    const stringParams: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        stringParams[key] = String(value);
      }
    }

    return this.request<T>(path, {
      params: stringParams,
      headers: {
        Authorization: this.config.apiKey,
        "API-VERSION": "v1",
      },
    });
  }

  // ──────────────────────────────────────────────
  // Test Statistics
  // ──────────────────────────────────────────────

  async getTestStatistics(params: {
    nb_test_id?: number;
    agent_id?: number;
    nb_test_template_id?: number;
    nb_target_id?: number;
    window_size?: number;
    granularity?: string;
    from?: string;
    to?: string;
    last?: number;
    metric_type?: string;
    grouping?: string;
    test_type_id?: number;
    ts_order?: string;
    sort_by?: string;
    sort_by_order?: string;
    value_operator?: string;
    value_watermark?: number;
  } = {}): Promise<{ nb_test_statistics: TestStatistic[] }> {
    return this.legacyGet("/apis/nb_test_statistics.json", params);
  }

  // ──────────────────────────────────────────────
  // Agent Statistics
  // ──────────────────────────────────────────────

  async getAgentStatistics(params: {
    agent_id: number;
    from?: string;
    to?: string;
    window_size?: number;
    last?: number;
  }): Promise<{ agent_stats: AgentStatistic[] }> {
    return this.legacyGet("/apis/nb_agent_statistics.json", params);
  }

  // ──────────────────────────────────────────────
  // Access Point Metrics
  // ──────────────────────────────────────────────

  async getAccessPointMetrics(params: {
    agent_id?: number;
    access_point_id?: number;
    from?: string;
    to?: string;
  } = {}): Promise<{ metrics: AccessPointMetric[] }> {
    return this.legacyGet("/apis/access_point_metrics.json", params);
  }

  async getAccessPointMetricsSample(params: {
    agent_id?: number;
    access_point_id?: number;
    from?: string;
    to?: string;
    cardinality?: number;
  } = {}): Promise<{ metrics: AccessPointMetric[] }> {
    return this.legacyGet("/apis/access_point_metrics/sample.json", params);
  }
}
