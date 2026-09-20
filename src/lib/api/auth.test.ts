// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { requireAccess } from "./auth";

const ORIGINAL_TOKEN = process.env.UNIVERSAL_API_TOKEN;

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.UNIVERSAL_API_TOKEN;
  else process.env.UNIVERSAL_API_TOKEN = ORIGINAL_TOKEN;
});

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/projects", { headers });
}

describe("requireAccess", () => {
  it("allows a same-origin request with no credential", () => {
    expect(requireAccess(req({ "Sec-Fetch-Site": "same-origin" }))).toBeNull();
  });

  it("allows a same-site request with no credential", () => {
    expect(requireAccess(req({ "Sec-Fetch-Site": "same-site" }))).toBeNull();
  });

  it("allows a cross-site request with a valid bearer token", () => {
    process.env.UNIVERSAL_API_TOKEN = "s3cret-token";
    const res = requireAccess(req({ "Sec-Fetch-Site": "cross-site", Authorization: "Bearer s3cret-token" }));
    expect(res).toBeNull();
  });

  it("rejects a request with no Sec-Fetch-Site and no token", async () => {
    delete process.env.UNIVERSAL_API_TOKEN;
    const res = requireAccess(req());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect(await res!.json()).toEqual({ error: "This endpoint needs an API token." });
  });

  it("rejects a cross-site request with a wrong token", async () => {
    process.env.UNIVERSAL_API_TOKEN = "s3cret-token";
    const res = requireAccess(req({ "Sec-Fetch-Site": "cross-site", Authorization: "Bearer wrong-token" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("rejects a cross-site request with no Authorization header", () => {
    process.env.UNIVERSAL_API_TOKEN = "s3cret-token";
    const res = requireAccess(req({ "Sec-Fetch-Site": "cross-site" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("rejects when no token is configured server-side, even with a bearer header", () => {
    delete process.env.UNIVERSAL_API_TOKEN;
    const res = requireAccess(req({ "Sec-Fetch-Site": "cross-site", Authorization: "Bearer anything" }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("does not throw when the provided token is a different length than the real one", () => {
    process.env.UNIVERSAL_API_TOKEN = "a-long-secret-token";
    expect(() => requireAccess(req({ "Sec-Fetch-Site": "cross-site", Authorization: "Bearer short" }))).not.toThrow();
  });
});
