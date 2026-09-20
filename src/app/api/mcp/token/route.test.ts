// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), create: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/api-token", () => ({ listApiTokens: mocks.list, createApiToken: mocks.create }));

import { GET, POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "usr_1" } });
});

describe("GET /api/mcp/token", () => {
  it("returns 401 without an authenticated session", async () => {
    mocks.auth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in to manage MCP tokens." });
  });

  it("lists only the signed-in user's safe token metadata", async () => {
    mocks.list.mockResolvedValue([{ id: "tok_1", name: "Claude", createdAt: "2026-01-01", lastUsedAt: null }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).data[0]).not.toHaveProperty("token");
    expect(mocks.list).toHaveBeenCalledWith("usr_1");
  });

  it("creates a unique token for the signed-in user", async () => {
    mocks.create.mockResolvedValue({ token: "ua_secret", summary: { id: "tok_1" } });
    const res = await POST(new Request("http://t/api/mcp/token", { method: "POST", body: JSON.stringify({ name: "Claude" }) }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { token: "ua_secret", summary: { id: "tok_1" } } });
    expect(mocks.create).toHaveBeenCalledWith("usr_1", "Claude");
  });
});
