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
  it("allows a same-origin request in isolated route tests", async () => {
    expect(await requireAccess(req({ "Sec-Fetch-Site": "same-origin" }))).toEqual({ userId: null });
  });

  it("allows a same-site request in isolated route tests", async () => {
    expect(await requireAccess(req({ "Sec-Fetch-Site": "same-site" }))).toEqual({ userId: null });
  });

  it("allows the legacy credential only inside isolated tests", async () => {
    process.env.UNIVERSAL_API_TOKEN = "s3cret-token";
    const res = await requireAccess(req({ "Sec-Fetch-Site": "cross-site", Authorization: "Bearer s3cret-token" }));
    expect(res).toEqual({ userId: null });
  });

  it("rejects a request with no Sec-Fetch-Site and no token", async () => {
    delete process.env.UNIVERSAL_API_TOKEN;
    const res = await requireAccess(req());
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
    expect(await (res as Response).json()).toEqual({ error: "This endpoint needs an API token." });
  });

  it("rejects a cross-site request with a wrong token", async () => {
    process.env.UNIVERSAL_API_TOKEN = "s3cret-token";
    const res = await requireAccess(req({ "Sec-Fetch-Site": "cross-site", Authorization: "Bearer wrong-token" }));
    expect((res as Response).status).toBe(401);
  });

  it("rejects a cross-site request with no Authorization header", async () => {
    process.env.UNIVERSAL_API_TOKEN = "s3cret-token";
    const res = await requireAccess(req({ "Sec-Fetch-Site": "cross-site" }));
    expect((res as Response).status).toBe(401);
  });

  it("rejects an unknown bearer token", async () => {
    delete process.env.UNIVERSAL_API_TOKEN;
    const res = await requireAccess(req({ "Sec-Fetch-Site": "cross-site", Authorization: "Bearer anything" }));
    expect((res as Response).status).toBe(401);
  });

  it("does not throw when the provided token is a different length than the legacy test token", async () => {
    process.env.UNIVERSAL_API_TOKEN = "a-long-secret-token";
    await expect(requireAccess(req({ "Sec-Fetch-Site": "cross-site", Authorization: "Bearer short" }))).resolves.toBeInstanceOf(Response);
  });
});
