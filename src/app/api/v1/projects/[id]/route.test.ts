// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgProjectService } from "@/lib/services/pg/project-service";
import type { Project } from "@/lib/types";
import { DELETE, GET, PATCH } from "./route";

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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function get(id: string) {
  return GET(new Request(`http://t/api/v1/projects/${id}`, { headers: sameOrigin }), ctx(id));
}

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://t/api/v1/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

function del(id: string) {
  return DELETE(new Request(`http://t/api/v1/projects/${id}`, { method: "DELETE", headers: sameOrigin }), ctx(id));
}

describe("GET /api/v1/projects/:id", () => {
  it("returns 401 without a credential", async () => {
    const res = await GET(new Request("http://t/api/v1/projects/prj_1"), ctx("prj_1"));
    expect(res.status).toBe(401);
  });

  it("returns the project", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValue(project);
    const res = await get("prj_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: project });
  });

  it("returns 404 for an unknown id", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValue(null);
    const res = await get("missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This API no longer exists." });
  });
});

describe("PATCH /api/v1/projects/:id", () => {
  it("updates the project", async () => {
    const update = vi.spyOn(pgProjectService, "update").mockResolvedValue(project);
    const res = await patch("prj_1", { name: "New name" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: project });
    expect(update).toHaveBeenCalledWith("prj_1", { name: "New name" });
  });

  it("rejects an empty name with 400", async () => {
    const res = await patch("prj_1", { name: "  " });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "name is required" });
  });

  it("returns 404 when the project no longer exists", async () => {
    vi.spyOn(pgProjectService, "update").mockRejectedValue(new Error("This API no longer exists."));
    const res = await patch("missing", { name: "New name" });
    expect(res.status).toBe(404);
  });

  it("returns 409 when the requested slug is taken", async () => {
    vi.spyOn(pgProjectService, "update").mockRejectedValue(new Error("Another API already uses this address."));
    const res = await patch("prj_1", { slug: "taken" });
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/v1/projects/:id", () => {
  it("deletes the project and returns the undo payload", async () => {
    const removed = { project, records: [] };
    vi.spyOn(pgProjectService, "remove").mockResolvedValue(removed);
    const res = await del("prj_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: removed });
  });

  it("returns 404 when the project no longer exists", async () => {
    vi.spyOn(pgProjectService, "remove").mockRejectedValue(new Error("This API no longer exists."));
    const res = await del("missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This API no longer exists." });
  });
});
