import { createApiClient } from "./client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createApiClient", () => {
  it("exposes the normalized deployment URL without credentials", () => {
    const client = createApiClient("http://localhost:3000/", "secret-token");
    expect(client.baseUrl).toBe("http://localhost:3000");
  });

  it("get() sends the bearer token and unwraps { data }", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ data: { id: "prj_1" } }));
    const client = createApiClient("http://localhost:3000", "secret-token");

    const result = await client.get("/api/v1/projects/prj_1");

    expect(result).toEqual({ id: "prj_1" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("http://localhost:3000/api/v1/projects/prj_1");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-token");
  });

  it("post() sends the body as JSON and returns the unwrapped data", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ data: { id: "prj_1" } }, 201));
    const client = createApiClient("http://localhost:3000", "secret-token");

    const result = await client.post("/api/v1/projects", { name: "Blog" });

    expect(result).toEqual({ id: "prj_1" });
    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ name: "Blog" });
  });

  it("patch() and del() send the expected method", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ data: {} }));
    const client = createApiClient("http://localhost:3000", "secret-token");

    await client.patch("/api/v1/projects/prj_1", { name: "New" });
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("PATCH");

    await client.del("/api/v1/projects/prj_1");
    expect(fetchSpy.mock.calls[1][1]?.method).toBe("DELETE");
  });

  it("throws the server's plain-language error string on a non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "This API no longer exists." }, 404));
    const client = createApiClient("http://localhost:3000", "secret-token");

    await expect(client.get("/api/v1/projects/missing")).rejects.toThrow("This API no longer exists.");
  });

  it("falls back to a generic message when the error body isn't readable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 500 }));
    const client = createApiClient("http://localhost:3000", "secret-token");

    await expect(client.get("/api/v1/projects")).rejects.toThrow("Something went wrong. Please try again.");
  });

  it("callEndpoint() issues a real request against the given path, without a bearer token, and returns status/headers/body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ hello: "world" }), { status: 200, headers: { "X-Custom": "1", "Content-Type": "application/json" } }),
    );
    const client = createApiClient("http://localhost:3000", "secret-token");

    const result = await client.callEndpoint("GET", "/bookshop/books", { query: { limit: "5" } });

    expect(result).toEqual({ status: 200, headers: expect.objectContaining({ "x-custom": "1" }), body: { hello: "world" } });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("http://localhost:3000/bookshop/books?limit=5");
    expect((init?.headers as Record<string, string> | undefined)?.Authorization).toBeUndefined();
  });

  it("callEndpoint() returns a non-JSON body as text rather than throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("plain text", { status: 200 }));
    const client = createApiClient("http://localhost:3000", "secret-token");

    const result = await client.callEndpoint("GET", "/bookshop/health");
    expect(result.body).toBe("plain text");
  });
});
