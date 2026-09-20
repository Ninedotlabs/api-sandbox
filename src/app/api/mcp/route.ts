/**
 * The deployed MCP transport: Streamable HTTP at `/api/mcp`, registering the same `TOOLS`
 * (via `createMcpServer`, see `src/mcp/server.ts`) as the local stdio transport
 * (`src/mcp/stdio.ts`) - see `src/mcp/tools.test.ts` for the assertion that the two expose an
 * identical tool list.
 *
 * Unlike `/api/v1` (`requireAccess` in `src/lib/api/auth.ts`), there is deliberately NO
 * same-origin exemption here: a browser reaching this endpoint without a token is not a case
 * we want to allow, since an MCP client is never a same-origin page. Every request needs
 * `Authorization: Bearer <UNIVERSAL_API_TOKEN>`, compared with the same constant-time
 * `tokensMatch` helper `/api/v1` uses, so there is exactly one comparison to get right.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { tokensMatch } from "@/lib/api/auth";
import { createApiClient } from "@/mcp/client";
import { createMcpServer } from "@/mcp/server";

export const runtime = "nodejs";

const UNAUTHORIZED_MESSAGE = "This endpoint needs an API token.";

function isAuthorized(req: Request): boolean {
  const authorization = req.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(authorization);
  const expected = process.env.UNIVERSAL_API_TOKEN;
  return Boolean(match && expected && tokensMatch(match[1], expected));
}

function unauthorized(): Response {
  return Response.json({ error: UNAUTHORIZED_MESSAGE }, { status: 401 });
}

async function handle(req: Request): Promise<Response> {
  if (!isAuthorized(req)) return unauthorized();

  // The token is checked above, so it's guaranteed set here; the MCP tools call back into
  // this same deployment's own `/api/v1`, using the same token they were just presented with.
  const token = process.env.UNIVERSAL_API_TOKEN as string;
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
