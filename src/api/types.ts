/**
 * TypeScript types for all NetBeez API entities.
 */

// ──────────────────────────────────────────────
// JSON:API envelope types
// ──────────────────────────────────────────────

export interface JsonApiResponse<T = JsonApiResource> {
  data: T | T[];
  included?: JsonApiResource[];
  meta?: {
    page?: { next: boolean; offset: number; limit: number };
    [key: string]: unknown;
  };
}

export interface JsonApiResource {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<
    string,
    { data: { id: string; type: string } | { id: string; type: string }[] | null }
  >;
}

// ──────────────────────────────────────────────
// Agent
// ──────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  active: boolean;
  agent_class: string;
  software_version: string;
  category: string;
  ip_address?: string;
  mac_address?: string;
  model?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  nb_test_ids?: number[];
  network_interfaces?: NetworkInterface[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface NetworkInterface {
  id: string;
  name: string;
  ip_address: string;
  mac_address: string;
  interface_type: string;
  [key: string]: unknown;
}

export interface AgentLog {
  id: string;
  log_type: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface AgentPerformanceMetric {
  id: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  timestamp: string;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Target
// ──────────────────────────────────────────────

export interface Target {
  id: string;
  name: string;
  target: string;
  description?: string;
  test_templates?: TestTemplate[];
  [key: string]: unknown;
}

export interface TestTemplate {
  id: string;
  test_type_id: number;
  target: string;
  interval: number;
  alert_detector_ids?: number[];
  nb_test_ids?: number[];
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Test (nb_test)
// ──────────────────────────────────────────────

export interface NbTest {
  id: string;
  agent_id: number;
  nb_target_id: number;
  nb_test_template_id: number;
  test_type: string;
  schedule_type: string;
  current_state: string;
  alert_mode: string;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Test Results
// ──────────────────────────────────────────────

export interface PingResult {
  id: string;
  timestamp: string;
  value: number;
  lost: boolean;
  sequence_number: number;
  [key: string]: unknown;
}

export interface DnsResult {
  id: string;
  timestamp: string;
  value: number;
  [key: string]: unknown;
}

export interface HttpResult {
  id: string;
  timestamp: string;
  value: number;
  http_status?: number;
  [key: string]: unknown;
}

export interface TracerouteResult {
  id: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface PathAnalysisResult {
  id: string;
  timestamp: string;
  rtt: number;
  ip_address: string;
  natted: boolean;
  destination: string;
  dest_port: number;
  hop_number: number;
  error_code?: string;
  error_message?: string;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Alerts & Incidents
// ──────────────────────────────────────────────

export interface Alert {
  id: string;
  severity: number;
  message: string;
  ts: string;
  closed_ts?: string;
  status: string;
  [key: string]: unknown;
}

export interface Incident {
  id: string;
  start_ts: string;
  end_ts?: string;
  ack_ts?: string;
  [key: string]: unknown;
}

export interface IncidentLog {
  id: string;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// WiFi
// ──────────────────────────────────────────────

export interface WifiProfile {
  id: string;
  ssid: string;
  description?: string;
  encryption_method: string;
  authentication_method: string;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Scheduled Tests
// ──────────────────────────────────────────────

export interface ScheduledTestTemplate {
  id: string;
  name: string;
  test_type: string;
  [key: string]: unknown;
}

export interface ScheduledTestResult {
  id: string;
  timestamp: string;
  agent_id: number;
  result_values: Record<string, unknown>;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Ad-hoc Test Runs
// ──────────────────────────────────────────────

export interface AdHocTestRun {
  id: string;
  state: string;
  test_type_id: number;
  [key: string]: unknown;
}

// ──────────────────────────────────────────────
// Legacy API — Statistics
// ──────────────────────────────────────────────

export interface TestStatistic {
  id: number;
  nb_test_id: number;
  timestamp: number;
  value: number;
  metric_type: string;
  window_size: number;
  datapoint_count: number;
  error_count: number;
}

export interface AgentStatistic {
  agent_id: number;
  id: number;
  interval: number;
  timestamp: number;
  uptime: number;
  window_size: number;
}

export interface AccessPointMetric {
  access_point_id: number;
  bit_rate: number;
  channel: number;
  id: number;
  link_quality: number;
  network_interface_id: number;
  rx_rate: number;
  signal_level: number;
  timestamp: number;
  tx_rate: number;
}

// ──────────────────────────────────────────────
// Common filter types
// ──────────────────────────────────────────────

export interface TimestampFilter {
  operator: ">" | "<" | ">=" | "<=" | "<=>" | "=" ;
  value1: string;
  value2?: string; // required for <=> (between) operator
}

export interface PaginationParams {
  page?: number;
  page_size?: number;
}
