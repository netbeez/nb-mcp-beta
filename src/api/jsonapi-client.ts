/**
 * JSON:API client — handles Bearer auth, filter/include params, pagination, ordering.
 *
 * All entity/relationship endpoints use JSON:API format.
 * Auth: Authorization: Bearer <API_KEY>
 * Pagination: page[offset]=N&page[limit]=N
 * Filtering: filter[field]=value, filter[ts][operator]=<=> etc.
 * Includes: include=relationship1,relationship2
 * Ordering: order[attributes]=field&order[direction]=asc|desc
 */

import { Config } from "../config.js";
import { BaseClient } from "./base-client.js";
import type { JsonApiResponse, TimestampFilter, PaginationParams } from "./types.js";

export interface JsonApiQueryOptions {
  /** filter[key]=value pairs */
  filters?: Record<string, string | boolean | number | undefined>;
  /** Timestamp/numeric filters with operators: filter[key][operator]=... */
  timestampFilters?: Record<string, TimestampFilter | undefined>;
  /** Relationships to include (comma-separated or array) */
  include?: string | string[];
  /** Ordering: { attributes: "field1,field2", direction: "asc" | "desc" } */
  order?: { attributes: string; direction: "asc" | "desc" };
  /** Pagination */
  pagination?: PaginationParams;
  /** Add type=beta query param */
  beta?: boolean;
  /** Any additional raw query params */
  extraParams?: Record<string, string | undefined>;
}

export class JsonApiClient extends BaseClient {
  constructor(config: Config) {
    super(config);
  }

  /**
   * Build query params from JsonApiQueryOptions.
   */
  private buildParams(options: JsonApiQueryOptions): Record<string, string | undefined> {
    const params: Record<string, string | undefined> = {};

    // Filters
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== "") {
          params[`filter[${key}]`] = String(value);
        }
      }
    }

    // Timestamp/operator filters
    if (options.timestampFilters) {
      for (const [key, filter] of Object.entries(options.timestampFilters)) {
        if (filter) {
          params[`filter[${key}][operator]`] = filter.operator;
          params[`filter[${key}][value1]`] = filter.value1;
          if (filter.value2) {
            params[`filter[${key}][value2]`] = filter.value2;
          }
        }
      }
    }

    // Includes
    if (options.include) {
      const includeStr = Array.isArray(options.include)
        ? options.include.join(",")
        : options.include;
      params["include"] = includeStr;
    }

    // Ordering
    if (options.order) {
      params["order[attributes]"] = options.order.attributes;
      params["order[direction]"] = options.order.direction;
    }

    // Pagination
    if (options.pagination) {
      if (options.pagination.page !== undefined) {
        params["page[offset]"] = String(options.pagination.page);
      }
      if (options.pagination.page_size !== undefined) {
        params["page[limit]"] = String(options.pagination.page_size);
      }
    }

    // Beta flag
    if (options.beta) {
      params["type"] = "beta";
    }

    // Extra params
    if (options.extraParams) {
      for (const [key, value] of Object.entries(options.extraParams)) {
        if (value !== undefined) {
          params[key] = value;
        }
      }
    }

    return params;
  }

  /**
   * GET a JSON:API endpoint.
   */
  async get<T = JsonApiResponse>(
    path: string,
    options: JsonApiQueryOptions = {}
  ): Promise<T> {
    return this.request<T>(path, {
      params: this.buildParams(options),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
  }

  /**
   * POST to a JSON:API endpoint.
   */
  async post<T = JsonApiResponse>(
    path: string,
    body: unknown,
    options: JsonApiQueryOptions = {}
  ): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body,
      params: this.buildParams(options),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
  }

  // ──────────────────────────────────────────────
  // Convenience methods for common entity endpoints
  // ──────────────────────────────────────────────

  /** List agents with optional filters */
  async listAgents(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/agents", { beta: true, ...options });
  }

  /** Get a single agent by ID */
  async getAgent(id: string | number, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>(`/agents/${id}`, { beta: true, ...options });
  }

  /** Get agent logs */
  async getAgentLogs(agentId: string | number, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>(`/agents/${agentId}/logs`, { beta: true, ...options });
  }

  /** Get agent performance metrics */
  async getAgentPerformanceMetrics(agentId: string | number, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>(`/agents/${agentId}/performance_metrics`, { beta: true, ...options });
  }

  /** Get agent access point connections */
  async getAgentAccessPointConnections(agentId: string | number, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>(`/agents/${agentId}/access_point_connections`, { beta: true, ...options });
  }

  /** List targets */
  async listTargets(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/targets", { beta: true, ...options });
  }

  /** List tests (nb_tests) */
  async listTests(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/nb_tests", { beta: true, ...options });
  }

  /** Get test results by test type */
  async getTestResults(
    testType: "ping" | "dns" | "http" | "traceroute",
    options: JsonApiQueryOptions = {}
  ) {
    const path =
      testType === "traceroute"
        ? "/nb_tests/traceroutes/results"
        : `/nb_tests/${testType}/results`;
    return this.get<JsonApiResponse>(path, { beta: true, ...options });
  }

  /** Get path analysis results */
  async getPathAnalysisResults(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/nb_tests/path_analysis/results", { beta: true, ...options });
  }

  /** Get a single path analysis result by timestamp */
  async getPathAnalysisResultByTimestamp(timestamp: string, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>(`/nb_tests/path_analysis/results/${timestamp}`, { beta: true, ...options });
  }

  /** List alerts */
  async listAlerts(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/alerts", { beta: true, ...options });
  }

  /** List incidents */
  async listIncidents(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/incidents", { beta: true, ...options });
  }

  /** List WiFi profiles */
  async listWifiProfiles(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/wifi_profiles", { beta: true, ...options });
  }

  /** Get scheduled test template results */
  async getScheduledTestResults(templateId: string | number, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>(
      `/scheduled_nb_test_templates/${templateId}/results`,
      { beta: true, ...options }
    );
  }

  /** Run ad-hoc test */
  async runAdHocTest(body: unknown) {
    return this.post<JsonApiResponse>("/multiagent_nb_test_runs/ad_hoc", body, { beta: true });
  }

  /** Get ad-hoc test run results */
  async getAdHocTestRun(testRunId: string, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/multiagent_nb_test_runs", {
      beta: true,
      ...options,
      filters: {
        ...options.filters,
        multiagent_nb_test_runs: testRunId,
      },
      include: "results",
    });
  }
}
