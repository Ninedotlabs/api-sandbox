// @vitest-environment node
//
// Only what can be verified without a browser: the provider list Auth.js exposes at
// `/api/auth/providers`. The OAuth handshake itself - clicking "Continue with Google"
// through to a real Google consent screen and back - has no automated test here; see the
// task report for what was checked by hand instead.
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/auth/providers", () => {
  it("lists google", async () => {
    const request = new NextRequest("http://localhost:3000/api/auth/providers");
    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("google");
    expect(body.google).toMatchObject({ id: "google", type: "oidc", name: "Google" });
  });
});
