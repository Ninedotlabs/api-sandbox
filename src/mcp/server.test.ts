import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { ApiClient } from "./client";
import { createMcpServer } from "./server";
import { TOOLS } from "./tools";

function stubApiClient(): ApiClient {
  return {
    baseUrl: "http://localhost:3000",
    get: async () => ({}),
    post: async () => ({}),
    patch: async () => ({}),
    put: async () => ({}),
    del: async () => ({}),
    callEndpoint: async () => ({ status: 200, headers: {}, body: undefined }),
  };
}

describe("createMcpServer", () => {
  it("registers exactly the tools in TOOLS - same names, in an MCP client's eyes", async () => {
    const server = createMcpServer(stubApiClient());
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS.map((t) => t.name).sort());

    await client.close();
    await server.close();
  });

  it("a registered tool call reaches the underlying handler and returns its result as JSON text", async () => {
    const client: ApiClient = { ...stubApiClient(), get: async () => [{ id: "prj_1" }] };
    const server = createMcpServer(client);
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
    const result = await mcpClient.callTool({ name: "list_projects", arguments: {} });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual([{ id: "prj_1" }]);
    expect(result.isError).toBeFalsy();

    await mcpClient.close();
    await server.close();
  });

  it("surfaces a handler failure as an error tool result carrying the server's plain message", async () => {
    const client: ApiClient = {
      ...stubApiClient(),
      get: async () => {
        throw new Error("This API no longer exists.");
      },
    };
    const server = createMcpServer(client);
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const mcpClient = new Client({ name: "test-client", version: "0.0.0" });

    await Promise.all([server.connect(serverTransport), mcpClient.connect(clientTransport)]);
    const result = await mcpClient.callTool({ name: "get_project", arguments: { projectId: "missing" } });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(result.isError).toBe(true);
    expect(content[0].text).toBe("This API no longer exists.");

    await mcpClient.close();
    await server.close();
  });
});
