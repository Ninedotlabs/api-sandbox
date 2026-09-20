// @vitest-environment node
//
// `proxy.ts` (Next.js 16's renamed `middleware.ts` - see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md) is the
// sign-in gate for app pages. It is deliberately inert until `AUTH_REQUIRED=true`: per the
// design doc's lockout warning, a wrong proxy or misconfigured Google credentials would
// otherwise make the whole app unreachable with no way back in.
//
// Note: this installed Next.js still names the matcher-testing helper
// `unstable_doesMiddlewareMatch` even though the docs in this same install describe its
// renamed form (`unstable_doesProxyMatch`) - see `node_modules/next/dist/experimental/
// testing/server/middleware-testing-utils.js`. Using the export that actually exists.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import proxy, { config } from "./proxy";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => auth(...args) }));

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

describe("proxy", () => {
  const originalFlag = process.env.AUTH_REQUIRED;

  afterEach(() => {
    auth.mockReset();
    if (originalFlag === undefined) delete process.env.AUTH_REQUIRED;
    else process.env.AUTH_REQUIRED = originalFlag;
  });

  it("does nothing when AUTH_REQUIRED is off (the default): no redirect, auth() not even consulted", async () => {
    delete process.env.AUTH_REQUIRED;

    const response = await proxy(request("/projects"));

    expect(response.headers.get("location")).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated app page to /sign-in when AUTH_REQUIRED is on", async () => {
    process.env.AUTH_REQUIRED = "true";
    auth.mockResolvedValue(null);

    const response = await proxy(request("/projects"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/sign-in");
  });

  it("lets an authenticated request through when AUTH_REQUIRED is on", async () => {
    process.env.AUTH_REQUIRED = "true";
    auth.mockResolvedValue({ user: { id: "usr_1" } });

    const response = await proxy(request("/projects"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("fails toward the sign-in page, never an error page, if auth() throws", async () => {
    process.env.AUTH_REQUIRED = "true";
    auth.mockImplementation(async () => {
      throw new Error("database unreachable");
    });

    const response = await proxy(request("/projects"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/sign-in");
  });

  it("never redirects the sign-in page itself, even unauthenticated", async () => {
    process.env.AUTH_REQUIRED = "true";
    auth.mockResolvedValue(null);

    const response = await proxy(request("/sign-in"));

    expect(response.headers.get("location")).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });

  it("the matcher excludes every /api route, including mock APIs at /api/<slug>/*", () => {
    const nextConfig = {};

    for (const url of ["/api/my-project/widgets", "/api/auth/session", "/api/v1/projects", "/api/mcp", "/api/ai/generate"]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(false);
    }
  });

  it("the matcher covers ordinary app pages", () => {
    const nextConfig = {};

    for (const url of ["/", "/projects", "/projects/prj_1", "/sign-in", "/mcp"]) {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig, url })).toBe(true);
    }
  });
});
