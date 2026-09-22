// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLIENT_HEADER, channelForRequest } from "./record";

describe("channelForRequest", () => {
  function req(headers: Record<string, string> = {}): Request {
    return new Request("http://localhost/api/v1/projects", { headers });
  }

  it("is ui for a browser session", () => {
    expect(channelForRequest(req({ [CLIENT_HEADER]: "mcp" }), false)).toBe("ui");
  });

  it("is api for a bearer token", () => {
    expect(channelForRequest(req(), true)).toBe("api");
  });

  it("is mcp when the MCP client identifies itself", () => {
    expect(channelForRequest(req({ "X-Universal-Api-Client": "MCP" }), true)).toBe("mcp");
  });
});

describe("recordActivity", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/db/client");
    vi.resetModules();
  });

  it("swallows a failed insert so the request it describes still succeeds", async () => {
    vi.doMock("@/lib/db/client", () => ({
      query: vi.fn().mockRejectedValue(new Error('relation "activity_events" does not exist')),
    }));
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
    const { recordActivity } = await import("./record");

    await expect(recordActivity({ actorUserId: "usr_1", action: "project.create", channel: "ui" })).resolves.toBeUndefined();
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Could not record project.create"));
    stderr.mockRestore();
  });
});
