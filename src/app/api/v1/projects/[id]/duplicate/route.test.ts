// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgProjectService } from "@/lib/services/pg/project-service";
import type { Project } from "@/lib/types";
import { POST } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

const copy: Project = {
  id: "prj_2",
  name: "Bookshop copy",
  slug: "bookshop-copy",
  description: "",
  models: [],
  routes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function post(id: string) {
  return POST(new Request(`http://t/api/v1/projects/${id}/duplicate`, { method: "POST", headers: sameOrigin }), ctx(id));
}

describe("POST /api/v1/projects/:id/duplicate", () => {
  it("returns 401 without a credential", async () => {
    const res = await POST(new Request("http://t/api/v1/projects/prj_1/duplicate", { method: "POST" }), ctx("prj_1"));
    expect(res.status).toBe(401);
  });

  it("returns the duplicated project with 201", async () => {
    vi.spyOn(pgProjectService, "duplicate").mockResolvedValue(copy);
    const res = await post("prj_1");
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: copy });
  });

  it("returns 404 when the source project no longer exists", async () => {
    vi.spyOn(pgProjectService, "duplicate").mockRejectedValue(new Error("This API no longer exists."));
    const res = await post("missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This API no longer exists." });
  });
});
