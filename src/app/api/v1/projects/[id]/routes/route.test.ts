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
  description: "List all books",
  filters: [],
};

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function post(id: string, body: unknown) {
  return POST(
    new Request(`http://t/api/v1/projects/${id}/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

describe("POST /api/v1/projects/:id/routes", () => {
  it("returns 401 without a credential", async () => {
    const res = await POST(
      new Request("http://t/api/v1/projects/prj_1/routes", { method: "POST", body: JSON.stringify({ routes: [route] }) }),
      ctx("prj_1"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a body missing routes with 400", async () => {
    const res = await post("prj_1", {});
    expect(res.status).toBe(400);
  });

  it("creates the routes and returns 201", async () => {
    const createMany = vi.spyOn(pgRouteService, "createMany").mockResolvedValue([route]);
    const res = await post("prj_1", { routes: [route] });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: [route] });
    expect(createMany).toHaveBeenCalledWith("prj_1", [route]);
  });

  it("assigns an id to a route the caller didn't mint one for", async () => {
    const createMany = vi.spyOn(pgRouteService, "createMany").mockImplementation(async (_id, routes) => routes);
    const withoutId: Partial<Route> = { ...route };
    delete withoutId.id;
    const res = await post("prj_1", { routes: [withoutId] });
    expect(res.status).toBe(201);
    const [created] = createMany.mock.calls[0][1];
    expect(created.id).toBeTruthy();
  });

  it("returns 409 when two routes share a method and path", async () => {
    vi.spyOn(pgRouteService, "createMany").mockRejectedValue(new Error("Two routes can't share the same method and path."));
    const res = await post("prj_1", { routes: [route] });
    expect(res.status).toBe(409);
  });

  it("forwards a route's `response` definition to the service untouched", async () => {
    const createMany = vi.spyOn(pgRouteService, "createMany").mockResolvedValue([route]);
    const withResponse = { ...route, response: { mode: "static" as const, status: 200, body: { ok: true } } };
    await post("prj_1", { routes: [withResponse] });
    expect(createMany).toHaveBeenCalledWith("prj_1", [withResponse]);
  });
});
