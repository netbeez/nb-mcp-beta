#!/usr/bin/env node

/**
 * NetBeez MCP Server — Entry Point
 *
 * Supports stdio and HTTP transports for connecting to LLM clients
 * like Cursor, Claude Desktop, or remote MCP clients.
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer as createHttpServer } from "node:http";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main() {
  // Load and validate configuration
  const config = loadConfig();

  // Disable SSL verification if configured
  if (!config.sslVerify) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const transport = config.transport;

  if (transport === "stdio" || transport === "both") {
    await startStdio(config);
  }

  if (transport === "http" || transport === "both") {
    await startHttp(config);
  }
}

async function startStdio(config: ReturnType<typeof loadConfig>) {
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio transport
  console.error("NetBeez MCP Server running on stdio");
  console.error(`  Connected to: ${config.baseUrl}`);
}

async function startHttp(config: ReturnType<typeof loadConfig>) {
  const server = createServer(config);

  const httpServer = createHttpServer(async (req, res) => {
    // Health check endpoint
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", server: "netbeez-mcp-server", version: "1.0.0" }));
      return;
    }

    // MCP endpoint
    if (req.url === "/mcp" || req.url === "/") {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      // Clean up on close
      res.on("close", () => {
        transport.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    // 404 for anything else
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(config.httpPort, () => {
    console.error(`NetBeez MCP Server running on HTTP port ${config.httpPort}`);
    console.error(`  MCP endpoint: http://localhost:${config.httpPort}/mcp`);
    console.error(`  Health check: http://localhost:${config.httpPort}/health`);
    console.error(`  Connected to: ${config.baseUrl}`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
