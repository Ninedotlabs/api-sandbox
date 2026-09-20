import type { Project } from "@/lib/types";
import { httpConsoleService } from "./console-service";
import { httpModelService } from "./model-service";
import { httpProjectService } from "./project-service";
import { httpRouteService } from "./route-service";

function ok<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ data }), { status });
}

function fail(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), { status });
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "prj_1",
    name: "Blog",
    slug: "blog",
    description: "",
    models: [],
    routes: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("httpProjectService", () => {
  it("list() fetches GET /api/v1/projects", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok([project()]));
    expect(await httpProjectService.list()).toEqual([project()]);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects");
  });

  it("get() returns the project on 200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(project()));
    expect(await httpProjectService.get("prj_1")).toEqual(project());
  });

  it("get() returns null on 404, without throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(fail("This API no longer exists.", 404));
    expect(await httpProjectService.get("missing")).toBeNull();
  });

  it("create() posts the input and returns the created project", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(project(), 201));
    const input: Parameters<typeof httpProjectService.create>[0] = { name: "Blog", description: "", templateId: null };
    const created = await httpProjectService.create(input);
    expect(created).toEqual(project());
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/v1/projects");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual(input);
  });

  it("update() PATCHes the patch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(project({ name: "Renamed" })));
    const updated = await httpProjectService.update("prj_1", { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("PATCH");
  });

  it("remove() DELETEs and returns the removed payload", async () => {
    const removed = { project: project(), records: [] };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(removed));
    expect(await httpProjectService.remove("prj_1")).toEqual(removed);
  });

  it("restore() posts to .../restore and resolves void, discarding the response body", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(project()));
    const removed = { project: project(), records: [] };
    const result = await httpProjectService.restore(removed);
    expect(result).toBeUndefined();
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects/prj_1/restore");
  });

  it("duplicate() posts to .../duplicate", async () => {
    const copy = project({ id: "prj_2", name: "Blog copy" });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(copy, 201));
    expect(await httpProjectService.duplicate("prj_1")).toEqual(copy);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects/prj_1/duplicate");
  });

  it("surfaces the server's plain-language error string, not a generic one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(fail("Something with this name or address already exists.", 409));
    await expect(httpProjectService.create({ name: "Blog", description: "", templateId: null })).rejects.toThrow(
      "Something with this name or address already exists.",
    );
  });

  it("falls back to a generic message when the error body can't be read", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not json", { status: 500 }));
    await expect(httpProjectService.list()).rejects.toThrow("Something went wrong. Please try again.");
  });
});

describe("httpModelService", () => {
  const model = { id: "mdl_1", name: "Product", fields: [] };

  it("create() posts the name", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(model, 201));
    expect(await httpModelService.create("prj_1", "Product")).toEqual(model);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects/prj_1/models");
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toEqual({ name: "Product" });
  });

  it("update() PATCHes the whole model", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(model));
    await httpModelService.update("prj_1", model);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects/prj_1/models/mdl_1");
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("PATCH");
  });

  it("remove() DELETEs and returns the removed payload", async () => {
    const removed = { model, beforeId: null, routes: [], links: [], records: [] };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(removed));
    expect(await httpModelService.remove("prj_1", "mdl_1")).toEqual(removed);
  });

  it("restore() posts to .../restore and returns the restored model", async () => {
    const removed = { model, beforeId: null, routes: [], links: [], records: [] };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(model));
    expect(await httpModelService.restore("prj_1", removed)).toEqual(model);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects/prj_1/models/mdl_1/restore");
  });
});

describe("httpRouteService", () => {
  const route = { id: "rt_1", method: "GET" as const, path: "/products", modelId: "mdl_1", action: "list" as const, description: "", filters: [] };

  it("createMany() posts the routes array", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok([route], 201));
    expect(await httpRouteService.createMany("prj_1", [route])).toEqual([route]);
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toEqual({ routes: [route] });
  });

  it("update() PATCHes the route", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(route));
    await httpRouteService.update("prj_1", route);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects/prj_1/routes/rt_1");
  });

  it("remove() DELETEs and returns the removed payload", async () => {
    const removed = { route, beforeId: null };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(removed));
    expect(await httpRouteService.remove("prj_1", "rt_1")).toEqual(removed);
  });

  it("restore() posts to .../restore", async () => {
    const removed = { route, beforeId: null };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(route));
    await httpRouteService.restore("prj_1", removed);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects/prj_1/routes/rt_1/restore");
  });
});

describe("httpConsoleService", () => {
  it("sampleData() GETs the records endpoint", async () => {
    const records = [{ id: "1", name: "Lamp" }];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(records));
    expect(await httpConsoleService.sampleData("prj_1", "mdl_1")).toEqual(records);
    expect(fetchSpy.mock.calls[0][0]).toBe("/api/v1/projects/prj_1/models/mdl_1/records");
  });

  it("seedRecords() PUTs the given records", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok([]));
    await httpConsoleService.seedRecords("prj_1", "mdl_1", [{ name: "Lamp" }]);
    expect(fetchSpy.mock.calls[0][1]?.method).toBe("PUT");
    expect(JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)).toEqual({ records: [{ name: "Lamp" }] });
  });

  it("reset() regenerates and PUTs sample data for every model", async () => {
    const model = { id: "mdl_1", name: "Product", fields: [{ id: "f1", name: "title", type: "text" as const, required: true, unique: false }] };
    const p = project({ models: [model] });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/api/v1/projects/prj_1") return ok(p);
      return ok([]);
    });
    await httpConsoleService.reset("prj_1");
    const putCall = fetchSpy.mock.calls.find((c) => c[1]?.method === "PUT");
    expect(putCall?.[0]).toBe("/api/v1/projects/prj_1/models/mdl_1/records");
    const body = JSON.parse(putCall![1]!.body as string) as { records: unknown[] };
    expect(body.records).toHaveLength(5);
  });

  it("reset() is a no-op when the project no longer exists", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(fail("This API no longer exists.", 404));
    await httpConsoleService.reset("missing");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("send() calls the real mock endpoint for the route and logs the exchange", async () => {
    const route = { id: "rt_1", method: "GET" as const, path: "/products/:id", modelId: "mdl_1", action: "get" as const, description: "", filters: [] };
    const p = project({ slug: "shop", routes: [route] });
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input) === "/api/v1/projects/prj_1") return ok(p);
      if (String(input) === "/api/shop/products/42") return new Response(JSON.stringify({ id: "42", name: "Lamp" }), { status: 200 });
      throw new Error(`unexpected fetch ${String(input)}`);
    });

    const response = await httpConsoleService.send("prj_1", { routeId: "rt_1", params: { id: "42" }, query: {}, body: undefined });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "42", name: "Lamp" });
    expect(response.durationMs).toBeGreaterThan(0);

    const log = await httpConsoleService.log("prj_1");
    expect(log).toHaveLength(1);
    expect(log[0].routeId).toBe("rt_1");
    expect(log[0].response).toEqual(response);

    await httpConsoleService.clearLog("prj_1");
    expect(await httpConsoleService.log("prj_1")).toEqual([]);
  });

  it("send() reports 404 without throwing when the route no longer exists", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(ok(project()));
    const response = await httpConsoleService.send("prj_1", { routeId: "gone", params: {}, query: {}, body: undefined });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "This route no longer exists." });
  });
});
