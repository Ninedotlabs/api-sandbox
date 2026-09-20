// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgProjectService } from "@/lib/services/pg/project-service";
import type { Project } from "@/lib/types";
import { POST } from "./route";

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

function post(id: string, body: unknown) {
  return POST(
    new Request(`http://t/api/v1/projects/${id}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

describe("POST /api/v1/projects/:id/restore", () => {
  it("restores the project and returns it", async () => {
    const restore = vi.spyOn(pgProjectService, "restore").mockResolvedValue(undefined);
    vi.spyOn(pgProjectService, "get").mockResolvedValue(project);
    const res = await post("prj_1", { project, records: [] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: project });
    expect(restore).toHaveBeenCalledWith({ project, records: [] });
  });

  it("uses the id in the URL even if the body's project id differs", async () => {
    const restore = vi.spyOn(pgProjectService, "restore").mockResolvedValue(undefined);
    vi.spyOn(pgProjectService, "get").mockResolvedValue(project);
    await post("prj_1", { project: { ...project, id: "prj_other" }, records: [] });
    expect(restore).toHaveBeenCalledWith({ project: { ...project, id: "prj_1" }, records: [] });
  });

  it("rejects a body missing the project with 400", async () => {
    const res = await post("prj_1", {});
    expect(res.status).toBe(400);
  });

  it("returns 401 without a credential", async () => {
    const res = await POST(
      new Request("http://t/api/v1/projects/prj_1/restore", {
        method: "POST",
        body: JSON.stringify({ project, records: [] }),
      }),
      ctx("prj_1"),
    );
    expect(res.status).toBe(401);
  });
});
