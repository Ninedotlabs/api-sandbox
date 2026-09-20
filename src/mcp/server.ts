/**
 * Builds an `McpServer` with every tool in `TOOLS` registered against it. Both transports
 * (`src/mcp/stdio.ts` and `src/app/api/mcp/route.ts`) call this one function, so registration
 * itself - not just the tool list - can never drift between them.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ApiClient } from "./client";
import { TOOLS } from "./tools";

const SERVER_INFO = { name: "universal-api", version: "0.1.0" };

export function createMcpServer(client: ApiClient): McpServer {
  const server = new McpServer(SERVER_INFO);

  for (const tool of TOOLS) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.schema }, async (args) => {
      try {
        const result = await tool.handler(args, client);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
        return { content: [{ type: "text" as const, text: message }], isError: true };
      }
    });
  }

  return server;
}
