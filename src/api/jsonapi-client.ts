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
import { toEpochMs } from "../utils/timestamp.js";
import type {
  JsonApiResponse,
  TimestampFilter,
  PaginationParams,
  AgentGroupPayload,
} from "./types.js";

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

    // Timestamp/operator filters — normalize ts values to Unix epoch milliseconds
    // For <=> (between): use value1 + value2
    // For all other operators: use value (not value1)
    if (options.timestampFilters) {
      for (const [key, filter] of Object.entries(options.timestampFilters)) {
        if (filter) {
          params[`filter[${key}][operator]`] = filter.operator;
          if (filter.operator === "<=>") {
            params[`filter[${key}][value1]`] = toEpochMs(filter.value1);
            if (filter.value2) {
              params[`filter[${key}][value2]`] = toEpochMs(filter.value2);
            }
          } else {
            params[`filter[${key}][value]`] = toEpochMs(filter.value1);
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

  /**
   * PUT to a JSON:API endpoint.
   */
  async put<T = JsonApiResponse>(
    path: string,
    body: unknown,
    options: JsonApiQueryOptions = {}
  ): Promise<T> {
    return this.request<T>(path, {
      method: "PUT",
      body,
      params: this.buildParams(options),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
  }

  /**
   * Request helper for endpoints that are present in the JSON:API collection
   * but currently require non-JSON:API payload/query format, while still
   * using Bearer auth.
   */
  private async requestNonJsonApi<T = unknown>(
    path: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE";
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    } = {}
  ): Promise<T> {
    const params: Record<string, string | undefined> = {};
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== "") {
          params[key] = String(value);
        }
      }
    }

    return this.request<T>(path, {
      method: options.method ?? "GET",
      body: options.body,
      params,
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

  /** Create target (JSON:API) */
  async createTarget(body: unknown) {
    return this.post<JsonApiResponse>("/targets", body, { beta: true });
  }

  /** Create target from built-in SaaS app (JSON:API) */
  async createTargetSaaS(body: unknown) {
    return this.post<JsonApiResponse>("/targets/saas", body, { beta: true });
  }

  /** Create target from template shortcut (JSON:API) */
  async createTargetFromTemplate(body: unknown) {
    return this.post<JsonApiResponse>("/targets/target_template", body, { beta: true });
  }

  /** Update target (JSON:API) */
  async updateTarget(targetId: string | number, body: unknown) {
    return this.put<JsonApiResponse>(`/targets/${targetId}`, body, { beta: true });
  }

  /** List agent groups (JSON:API) */
  async listAgentGroups(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/agent_groups", { beta: true, ...options });
  }

  /** Get single agent group (JSON:API) */
  async getAgentGroup(id: string | number, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>(`/agent_groups/${id}`, { beta: true, ...options });
  }

  /**
   * Create agent group.
   * Uses JSON:API payload.
   */
  async createAgentGroup(payload: AgentGroupPayload) {
    const jsonApiBody: Record<string, unknown> = {
      data: {
        type: "agent_group",
        attributes: {
          name: payload.name,
          auto_assign: payload.auto_assign,
          force: payload.force,
        },
        relationships: {
          agents: {
            data: payload.agent_ids.map((id) => ({ type: "agent", id: String(id) })),
          },
          targets: {
            data: (payload.nb_target_ids ?? []).map((id) => ({ type: "target", id: String(id) })),
          },
        },
      },
    };
    return this.post<JsonApiResponse>("/agent_groups", jsonApiBody, { beta: true });
  }

  /**
   * Update agent group.
   * Uses JSON:API payload.
   */
  async updateAgentGroup(id: string | number, payload: AgentGroupPayload) {
    const jsonApiBody: Record<string, unknown> = {
      data: {
        id: String(id),
        type: "agent_group",
        attributes: {
          name: payload.name,
          auto_assign: payload.auto_assign,
          force: payload.force,
        },
        relationships: {
          agents: {
            data: payload.agent_ids.map((agentId) => ({
              type: "agent",
              id: String(agentId),
            })),
          },
          targets: {
            data: (payload.nb_target_ids ?? []).map((targetId) => ({
              type: "target",
              id: String(targetId),
            })),
          },
        },
      },
    };
    return this.put<JsonApiResponse>(`/agent_groups/${id}`, jsonApiBody, { beta: true });
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

  /** Get a single path analysis result by timestamp (accepts epoch ms, seconds, or ISO 8601; sent as epoch ms) */
  async getPathAnalysisResultByTimestamp(timestamp: string, options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>(`/nb_tests/path_analysis/results/${toEpochMs(timestamp)}`, { beta: true, ...options });
  }

  /** List alerts */
  async listAlerts(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/alerts", { beta: true, ...options });
  }

  /** List alert detectors */
  async listAlertDetectors(options: JsonApiQueryOptions = {}) {
    return this.get<JsonApiResponse>("/alert_detectors", { beta: true, ...options });
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

  /**
   * Scheduled template list/get/create/update currently use non-JSON:API
   * payload/query format.
   */
  async listScheduledTestTemplates(params: {
    label?: string;
    test_type_id?: number;
    agent_ids?: string;
    destination_agent_id?: number;
    by_destination?: string;
    order_by?: string;
    order_direction?: "asc" | "desc";
    page?: number;
    page_size?: number;
  } = {}) {
    return this.requestNonJsonApi<JsonApiResponse>("/scheduled_nb_test_templates.json", {
      params: {
        "filter[label]": params.label,
        "filter[test_types]": params.test_type_id,
        "filter[agents]": params.agent_ids,
        "filter[destination_agent]": params.destination_agent_id,
        "filter[by_destination]": params.by_destination,
        "order[attributes]": params.order_by,
        "order[direction]": params.order_direction,
        "page[offset]": params.page,
        "page[limit]": params.page_size,
      },
    });
  }

  async getScheduledTestTemplate(id: string | number) {
    return this.requestNonJsonApi<JsonApiResponse>(`/scheduled_nb_test_templates/${id}`);
  }

  async createScheduledTestTemplate(body: unknown) {
    return this.post<JsonApiResponse>("/scheduled_nb_test_templates", body, { beta: true });
  }

  async updateScheduledTestTemplate(
    id: string | number,
    body: unknown
  ) {
    return this.put<JsonApiResponse>(`/scheduled_nb_test_templates/${id}`, body, { beta: true });
  }

  /** Run ad-hoc test. */
  async runAdHocTest(body: unknown) {
    return this.request<JsonApiResponse>("/multiagent_nb_test_runs/ad_hoc", {
      method: "POST",
      body,
      params: this.buildParams({ beta: true }),
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });
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
