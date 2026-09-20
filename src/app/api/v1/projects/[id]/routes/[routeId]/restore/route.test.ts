// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgRouteService } from "@/lib/services/pg/route-service";
import type { Route } from "@/lib/types";
import { POST } from "./route";

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
  description: "",
  filters: [],
};
const removed = { route, beforeId: null };

function ctx(id: string, routeId: string) {
  return { params: Promise.resolve({ id, routeId }) };
}

function post(id: string, routeId: string, body: unknown) {
  return POST(
    new Request(`http://t/api/v1/projects/${id}/routes/${routeId}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id, routeId),
  );
}

describe("POST /api/v1/projects/:id/routes/:routeId/restore", () => {
  it("returns 401 without a credential", async () => {
    const res = await POST(
      new Request("http://t/api/v1/projects/prj_1/routes/rte_1/restore", { method: "POST", body: JSON.stringify(removed) }),
      ctx("prj_1", "rte_1"),
    );
    expect(res.status).toBe(401);
  });

  it("restores the route", async () => {
    const restore = vi.spyOn(pgRouteService, "restore").mockResolvedValue(route);
    const res = await post("prj_1", "rte_1", removed);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: route });
    expect(restore).toHaveBeenCalledWith("prj_1", removed);
  });

  it("uses the URL's routeId over the body's", async () => {
    const restore = vi.spyOn(pgRouteService, "restore").mockResolvedValue(route);
    await post("prj_1", "rte_1", { ...removed, route: { ...route, id: "wrong-id" } });
    expect(restore).toHaveBeenCalledWith("prj_1", { ...removed, route: { ...route, id: "rte_1" } });
  });

  it("rejects a body missing route with 400", async () => {
    const res = await post("prj_1", "rte_1", {});
    expect(res.status).toBe(400);
  });
});
