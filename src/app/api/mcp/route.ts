/**
 * The deployed MCP transport: Streamable HTTP at `/api/mcp`, registering the same `TOOLS`
 * (via `createMcpServer`, see `src/mcp/server.ts`) as the local stdio transport
 * (`src/mcp/stdio.ts`) - see `src/mcp/tools.test.ts` for the assertion that the two expose an
 * identical tool list.
 *
 * There is deliberately no browser-session fallback here: an MCP client is not the dashboard.
 * Every request presents a personal `ua_…` token. Only its SHA-256 hash is stored, and resolving
 * it yields the owner whose projects the management API will expose to this request.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateApiToken } from "@/lib/auth/api-token";
import { createApiClient } from "@/mcp/client";
import { createMcpServer } from "@/mcp/server";

export const runtime = "nodejs";

const UNAUTHORIZED_MESSAGE = "This endpoint needs an API token.";

function bearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(authorization);
  return match?.[1] ?? null;
}

function unauthorized(): Response {
  return Response.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
}

async function handle(req: Request): Promise<Response> {
  const token = bearerToken(req);
  if (!token || !(await authenticateApiToken(token))) return unauthorized();

  // The MCP tools call this deployment's own scoped management API with the same personal
  // token. No deployment-wide credential exists or crosses between accounts.
  const baseUrl = new URL(req.url).origin;
  const client = createApiClient(baseUrl, token);

  // A fresh server and transport per request (stateless mode - no `sessionIdGenerator`) is
  // the pattern the SDK itself recommends for a serverless HTTP handler: nothing here needs
  // to persist across requests, and Vercel functions don't guarantee the same instance
  // handles the next one anyway.
  const server = createMcpServer(client);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}

export async function DELETE(req: Request): Promise<Response> {
  return handle(req);
}
