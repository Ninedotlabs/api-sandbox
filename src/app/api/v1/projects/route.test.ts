// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgProjectService } from "@/lib/services/pg/project-service";
import type { Project } from "@/lib/types";
import { GET, POST } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

const project: Project = {
  id: "prj_1",
  name: "Bookshop",
  slug: "bookshop",
  description: "",
  models: [],
  routes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function get(headers: Record<string, string> = sameOrigin) {
  return GET(new Request("http://t/api/v1/projects", { headers }));
}

function post(body: unknown, headers: Record<string, string> = sameOrigin) {
  return POST(
    new Request("http://t/api/v1/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe("GET /api/v1/projects", () => {
  it("returns 401 without a credential or same-origin header", async () => {
    const res = await get({});
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "This endpoint needs an API token." });
  });

  it("returns every project", async () => {
    vi.spyOn(pgProjectService, "list").mockResolvedValue([project]);
    const res = await get();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [project] });
  });

  it("returns 500 with a generic message on an unexpected (non-Error) failure", async () => {
    vi.spyOn(pgProjectService, "list").mockRejectedValue("connection string leaked");
    const res = await get();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something went wrong. Please try again." });
  });
});

describe("POST /api/v1/projects", () => {
  it("rejects a missing name with 400", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "name is required" });
  });

  it("creates a project and returns 201", async () => {
    const create = vi.spyOn(pgProjectService, "create").mockResolvedValue(project);
    const res = await post({ name: "Bookshop", description: "A shop", templateId: "store" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: project });
    expect(create).toHaveBeenCalledWith({ name: "Bookshop", description: "A shop", templateId: "store" });
  });

  it("defaults description and templateId when omitted", async () => {
    const create = vi.spyOn(pgProjectService, "create").mockResolvedValue(project);
    await post({ name: "Bookshop" });
    expect(create).toHaveBeenCalledWith({ name: "Bookshop", description: "", templateId: null });
  });

  it("returns 409 when the slug collides", async () => {
    vi.spyOn(pgProjectService, "create").mockRejectedValue(new Error("Another API already uses this address."));
    const res = await post({ name: "Bookshop" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Another API already uses this address." });
  });
});
