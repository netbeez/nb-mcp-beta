/**
 * Configuration module — loads and validates environment variables.
 */

export interface Config {
  /** BeezKeeper instance URL (e.g. https://demo1.netbeezcloud.net) */
  baseUrl: string;
  /** API key for authentication */
  apiKey: string;
  /** Whether to verify SSL certificates (default true) */
  sslVerify: boolean;
  /** MCP transport mode */
  transport: "stdio" | "http" | "both";
  /** HTTP transport port */
  httpPort: number;
}

export function loadConfig(): Config {
  const baseUrl = process.env.NETBEEZ_BASE_URL;
  const apiKey = process.env.NETBEEZ_API_KEY;

  if (!baseUrl) {
    throw new Error(
      "NETBEEZ_BASE_URL environment variable is required. " +
        "Set it to your BeezKeeper instance URL (e.g. https://demo1.netbeezcloud.net)"
    );
  }

  if (!apiKey) {
    throw new Error(
      "NETBEEZ_API_KEY environment variable is required. " +
        "Get your API key from Dashboard > Settings > API Keys"
    );
  }

  const sslVerifyEnv = process.env.NETBEEZ_SSL_VERIFY?.toLowerCase();
  const sslVerify = sslVerifyEnv !== "false" && sslVerifyEnv !== "0";

  const transport = (process.env.MCP_TRANSPORT || "stdio") as Config["transport"];
  if (!["stdio", "http", "both"].includes(transport)) {
    throw new Error(`Invalid MCP_TRANSPORT value: ${transport}. Must be stdio, http, or both`);
  }

  const httpPort = parseInt(process.env.MCP_HTTP_PORT || "3000", 10);
  if (isNaN(httpPort) || httpPort < 1 || httpPort > 65535) {
    throw new Error(`Invalid MCP_HTTP_PORT value. Must be a number between 1 and 65535`);
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""), // strip trailing slashes
    apiKey,
    sslVerify,
    transport,
    httpPort,
  };
}
