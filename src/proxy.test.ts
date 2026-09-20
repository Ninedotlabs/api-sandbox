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
import proxy, { config, isAuthRequired } from "./proxy";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: (...args: unknown[]) => auth(...args) }));

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost:3000"));
}

describe("proxy", () => {
  const authEnvKeys = ["AUTH_REQUIRED", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "AUTH_SECRET"] as const;
  const originalEnv = Object.fromEntries(authEnvKeys.map((key) => [key, process.env[key]]));

  function clearAuthEnv() {
    for (const key of authEnvKeys) delete process.env[key];
  }

  function configureOAuth() {
    process.env.AUTH_GOOGLE_ID = "google-client-id";
    process.env.AUTH_GOOGLE_SECRET = "google-client-secret";
    process.env.AUTH_SECRET = "auth-secret";
  }

  afterEach(() => {
    auth.mockReset();
    for (const key of authEnvKeys) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("does nothing when OAuth is not configured and AUTH_REQUIRED is unset", async () => {
    clearAuthEnv();

    const response = await proxy(request("/projects"));

    expect(response.headers.get("location")).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });

  it("requires authentication automatically when Google OAuth is fully configured", async () => {
    clearAuthEnv();
    configureOAuth();
    auth.mockResolvedValue(null);

    const response = await proxy(request("/projects"));

    expect(isAuthRequired()).toBe(true);
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("callbackUrl")).toBe("/projects");
  });

  it("keeps AUTH_REQUIRED=false as an explicit break-glass bypass", async () => {
    clearAuthEnv();
    configureOAuth();
    process.env.AUTH_REQUIRED = "false";

    const response = await proxy(request("/projects"));

    expect(isAuthRequired()).toBe(false);
    expect(response.headers.get("location")).toBeNull();
    expect(auth).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated app page to /sign-in when AUTH_REQUIRED is on", async () => {
    clearAuthEnv();
    process.env.AUTH_REQUIRED = "true";
    auth.mockResolvedValue(null);

    const response = await proxy(request("/projects"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("callbackUrl")).toBe("/projects");
  });

  it("lets an authenticated request through when AUTH_REQUIRED is on", async () => {
    clearAuthEnv();
    process.env.AUTH_REQUIRED = "true";
    auth.mockResolvedValue({ user: { id: "usr_1" } });

    const response = await proxy(request("/projects"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("fails toward the sign-in page, never an error page, if auth() throws", async () => {
    clearAuthEnv();
    process.env.AUTH_REQUIRED = "true";
    auth.mockImplementation(async () => {
      throw new Error("database unreachable");
    });

    const response = await proxy(request("/projects"));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/sign-in");
  });

  it("preserves a deep link so sign-in can return the user to the requested page", async () => {
    clearAuthEnv();
    process.env.AUTH_REQUIRED = "true";
    auth.mockResolvedValue(null);

    const response = await proxy(request("/mcp?tab=deployed"));
    const location = new URL(response.headers.get("location")!);

    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("callbackUrl")).toBe("/mcp?tab=deployed");
  });

  it("never redirects the sign-in page itself, even unauthenticated", async () => {
    clearAuthEnv();
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
