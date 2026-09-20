import { deployedAddCommand, deployedDesktopConfig, localAddCommand, localDesktopConfig, resolveOrigin, TOKEN_PLACEHOLDER } from "./mcp-snippets";

describe("mcp-snippets", () => {
  it("builds the local claude mcp add command with a placeholder token, never a real one", () => {
    expect(localAddCommand()).toBe(`claude mcp add universal-api -e UNIVERSAL_API_TOKEN=${TOKEN_PLACEHOLDER} -- node ./dist/mcp/stdio.js`);
  });

  it("builds Claude Desktop's local (stdio) config", () => {
    const config = JSON.parse(localDesktopConfig());
    expect(config).toEqual({
      mcpServers: {
        "universal-api": {
          command: "node",
          args: ["./dist/mcp/stdio.js"],
          env: { UNIVERSAL_API_TOKEN: TOKEN_PLACEHOLDER },
        },
      },
    });
  });

  it("builds the deployed claude mcp add command against the given origin", () => {
    expect(deployedAddCommand("https://api.example.com")).toBe(
      `claude mcp add --transport http universal-api https://api.example.com/api/mcp --header "Authorization: Bearer ${TOKEN_PLACEHOLDER}"`,
    );
  });

  it("builds Claude Desktop's deployed (HTTP) config", () => {
    const config = JSON.parse(deployedDesktopConfig("https://api.example.com"));
    expect(config).toEqual({
      mcpServers: {
        "universal-api": {
          type: "http",
          url: "https://api.example.com/api/mcp",
          headers: { Authorization: `Bearer ${TOKEN_PLACEHOLDER}` },
        },
      },
    });
  });

  it("resolves the request's own origin from its host and protocol headers", () => {
    expect(resolveOrigin("app.example.com", "https")).toBe("https://app.example.com");
  });

  it("defaults to http for a localhost host with no forwarded protocol", () => {
    expect(resolveOrigin("localhost:3000", null)).toBe("http://localhost:3000");
  });

  it("defaults to https for a non-local host with no forwarded protocol", () => {
    expect(resolveOrigin("app.example.com", null)).toBe("https://app.example.com");
  });

  it("falls back to localhost:3000 entirely when there is no host header", () => {
    expect(resolveOrigin(null, null)).toBe("http://localhost:3000");
  });

  it("never embeds a real token - only the placeholder - in any snippet", () => {
    const snippets = [localAddCommand(), localDesktopConfig(), deployedAddCommand("https://x.test"), deployedDesktopConfig("https://x.test")];
    for (const s of snippets) {
      expect(s).toContain(TOKEN_PLACEHOLDER);
    }
  });
});
