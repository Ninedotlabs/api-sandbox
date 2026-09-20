// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgRouteService } from "@/lib/services/pg/route-service";
import type { Route } from "@/lib/types";
import { DELETE, PATCH } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

const route: Route = {
  id: "rte_1",
  method: "GET",
  path: "/books",
  modelId: "mdl_1",
  action: "list",
  description: "List all books",
  filters: [],
};

function ctx(id: string, routeId: string) {
  return { params: Promise.resolve({ id, routeId }) };
}

function patch(id: string, routeId: string, body: unknown) {
  return PATCH(
    new Request(`http://t/api/v1/projects/${id}/routes/${routeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id, routeId),
  );
}

function del(id: string, routeId: string) {
  return DELETE(
    new Request(`http://t/api/v1/projects/${id}/routes/${routeId}`, { method: "DELETE", headers: sameOrigin }),
    ctx(id, routeId),
  );
}

describe("PATCH /api/v1/projects/:id/routes/:routeId", () => {
  it("returns 401 without a credential", async () => {
    const res = await PATCH(
      new Request("http://t/api/v1/projects/prj_1/routes/rte_1", { method: "PATCH", body: JSON.stringify(route) }),
      ctx("prj_1", "rte_1"),
    );
    expect(res.status).toBe(401);
  });

  it("updates the route, forcing the URL's id", async () => {
    const update = vi.spyOn(pgRouteService, "update").mockResolvedValue(route);
    const res = await patch("prj_1", "rte_1", { ...route, id: "wrong-id" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: route });
    expect(update).toHaveBeenCalledWith("prj_1", { ...route, id: "rte_1" });
  });

  it("rejects a missing path with 400", async () => {
    const res = await patch("prj_1", "rte_1", { ...route, path: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "path is required" });
  });

  it("returns 404 when the route no longer exists", async () => {
    vi.spyOn(pgRouteService, "update").mockRejectedValue(new Error("This route no longer exists."));
    const res = await patch("prj_1", "missing", route);
    expect(res.status).toBe(404);
  });

  it("returns 409 for a duplicate method+path", async () => {
    vi.spyOn(pgRouteService, "update").mockRejectedValue(new Error("Two routes can't share the same method and path."));
    const res = await patch("prj_1", "rte_1", route);
    expect(res.status).toBe(409);
  });
});

describe("DELETE /api/v1/projects/:id/routes/:routeId", () => {
  it("removes the route and returns the undo payload", async () => {
    const removed = { route, beforeId: null };
    vi.spyOn(pgRouteService, "remove").mockResolvedValue(removed);
    const res = await del("prj_1", "rte_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: removed });
  });

  it("returns 404 when the route no longer exists", async () => {
    vi.spyOn(pgRouteService, "remove").mockRejectedValue(new Error("This route no longer exists."));
    const res = await del("prj_1", "missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This route no longer exists." });
  });
});
