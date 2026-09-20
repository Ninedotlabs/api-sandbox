// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };
const ORIGINAL_TOKEN = process.env.UNIVERSAL_API_TOKEN;

function get(headers: Record<string, string> = sameOrigin) {
  return GET(new Request("http://t/api/mcp/token", { headers }));
}

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.UNIVERSAL_API_TOKEN;
  else process.env.UNIVERSAL_API_TOKEN = ORIGINAL_TOKEN;
});

describe("GET /api/mcp/token", () => {
  it("returns 401 without a credential or same-origin header, exactly like /api/v1", async () => {
    process.env.UNIVERSAL_API_TOKEN = "ua_realtoken1234";
    const res = await get({});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "This endpoint needs an API token." });
  });

  it("returns the full token to a same-origin request", async () => {
    process.env.UNIVERSAL_API_TOKEN = "ua_realtoken1234";
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { token: "ua_realtoken1234" } });
  });

  it("returns a 404 with a plain message when no token is configured", async () => {
    delete process.env.UNIVERSAL_API_TOKEN;
    const res = await get();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No token is configured for this deployment." });
  });
});
