#!/usr/bin/env node
/**
 * The local MCP entry point: `claude mcp add universal-api -- node ./dist/mcp/stdio.js`.
 * Reads `UNIVERSAL_API_URL` (default: see `getAppOrigin` in `src/lib/app-origin.ts`) and
 * `UNIVERSAL_API_TOKEN` from the environment and speaks MCP over stdio - see
 * `src/app/api/mcp/route.ts` for the deployed, HTTP counterpart. Both register the exact same
 * `TOOLS` (see `src/mcp/server.ts`).
 *
 * This file is meant to be run, not imported - it starts the server unconditionally at module
 * load. Its config logic lives in `stdio-config.ts` instead, precisely so that logic can be
 * imported and tested without also standing up a real stdio server.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createApiClient } from "./client";
import { createMcpServer } from "./server";
import { loadConfig } from "./stdio-config";

async function main(): Promise<void> {
  const { baseUrl, token } = loadConfig();
  const client = createApiClient(baseUrl, token);
  const server = createMcpServer(client);
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "The MCP server failed to start.");
  process.exitCode = 1;
});
