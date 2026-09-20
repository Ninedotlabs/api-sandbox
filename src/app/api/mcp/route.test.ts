import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { ApiClient } from "@/mcp/client";
import { createMcpServer } from "@/mcp/server";
import { TOOLS } from "@/mcp/tools";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("@/lib/auth/api-token", () => ({ authenticateApiToken: mocks.authenticate }));

import { DELETE, GET, POST } from "./route";

const REAL_TOKEN = "ua_test-token-12345-unique";

function routeFetch(): FetchLike {
  return async (input, init) => {
    const req = new Request(input, init);
    switch (req.method) {
      case "GET":
        return GET(req);
      case "POST":
        return POST(req);
      case "DELETE":
        return DELETE(req);
      default:
        throw new Error(`Unsupported method in test fetch shim: ${req.method}`);
    }
  };
}

function connectClient(token?: string) {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    fetch: routeFetch(),
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
  const client = new Client({ name: "test-client", version: "0.0.0" });
  return { client, transport };
}

describe("/api/mcp route", () => {
  beforeEach(() => {
    mocks.authenticate.mockImplementation(async (token: string) => (token === REAL_TOKEN ? "usr_1" : null));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a request with no Authorization header with a 401", async () => {
    const { client, transport } = connectClient();
    await expect(client.connect(transport)).rejects.toThrow();
  });

  it("rejects a request with the wrong token with a 401", async () => {
    const { client, transport } = connectClient("wrong-token");
    await expect(client.connect(transport)).rejects.toThrow();
  });

  it("accepts a request with the correct bearer token and exposes the full TOOLS list", async () => {
    const { client, transport } = connectClient(REAL_TOKEN);
    await client.connect(transport);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());

    await client.close();
  });

  // The property that matters most: both transports import the same TOOLS module, so a tool
  // that exists in one and not the other should be impossible. This compares the HTTP
  // transport's own exposed list directly against the stdio transport's (via createMcpServer,
  // the same factory src/mcp/stdio.ts uses) rather than against TOOLS twice - a shared bug in
  // both call sites wouldn't be caught by comparing each to TOOLS separately.
  it("exposes the exact same tool list as the stdio transport", async () => {
    const stubClient: ApiClient = {
      get: async () => ({}),
      post: async () => ({}),
      patch: async () => ({}),
      put: async () => ({}),
      del: async () => ({}),
      callEndpoint: async () => ({ status: 200, headers: {}, body: undefined }),
    };
    const stdioServer = createMcpServer(stubClient);
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const stdioClient = new Client({ name: "stdio-test-client", version: "0.0.0" });
    await Promise.all([stdioServer.connect(serverTransport), stdioClient.connect(clientTransport)]);
    const { tools: stdioTools } = await stdioClient.listTools();

    const { client: httpClient, transport: httpTransport } = connectClient(REAL_TOKEN);
    await httpClient.connect(httpTransport);
    const { tools: httpTools } = await httpClient.listTools();

    expect(httpTools.map((t) => t.name).sort()).toEqual(stdioTools.map((t) => t.name).sort());

    await stdioClient.close();
    await stdioServer.close();
    await httpClient.close();
  });

  it("returns a 401 (not a 500) for an unknown personal token", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer anything", "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const response = await POST(req);
    expect(response.status).toBe(401);
  });
});
