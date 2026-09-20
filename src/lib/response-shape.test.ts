import { describe, expect, it } from "vitest";
import { buildCrudRoutes } from "./crud";
import type { DataRecord, EngineResult } from "./mock-engine";
import { executeRoute, seedDataset } from "./mock-engine";
import { applyResponseShape, runResponseQuery } from "./response-shape";
import { buildTemplateModels } from "./templates";
import type { Model, Project, Route } from "./types";

function storeProject(): Project {
  const models = buildTemplateModels("store");
  const routes = models.flatMap((m) => buildCrudRoutes(m, ["list", "get", "create", "update", "delete"], []));
  return { id: "p1", name: "Store", slug: "store", description: "", models, routes, createdAt: "", updatedAt: "" };
}

const modelNamed = (p: Project, name: string) => p.models.find((m) => m.name === name)!;
const routeFor = (p: Project, model: string, action: Route["action"]) =>
  p.routes.find((r) => r.modelId === modelNamed(p, model).id && r.action === action)!;

const emptyContext = { params: {}, query: {}, body: undefined };

describe("applyResponseShape — auto mode (regression: must match today's output)", () => {
  const project = storeProject();
  const ds = seedDataset(project);

  it("is byte-identical to the engine's own result when there is no response field, for every CRUD action", () => {
    for (const action of ["list", "get", "create", "update", "delete"] as const) {
      const route = routeFor(project, "Product", action);
      const body = action === "create" ? { name: "Lamp", price: 10 } : action === "update" ? { price: 12 } : undefined;
      const params: Record<string, string> = action === "get" || action === "update" || action === "delete" ? { id: "1" } : {};
      const engineResult = executeRoute(project, route, { params, query: {}, body }, ds);
      const shaped = applyResponseShape(route, engineResult, { params, query: {}, body });
      expect(shaped.status).toBe(engineResult.status);
      expect(JSON.stringify(shaped.body)).toBe(JSON.stringify(engineResult.body));
    }
  });

  it("is identical for a list route with query-filter results applied", () => {
    const route = { ...routeFor(project, "Product", "list"), filters: ["category"] };
    const category = String(ds[modelNamed(project, "Product").id][0].category);
    const engineResult = executeRoute(project, route, { params: {}, query: { category }, body: undefined }, ds);
    const shaped = applyResponseShape(route, engineResult, { params: {}, query: { category }, body: undefined });
    expect(shaped.status).toBe(engineResult.status);
    expect(JSON.stringify(shaped.body)).toBe(JSON.stringify(engineResult.body));
  });

  it("keeps the engine's body but overrides status/headers when auto mode sets them explicitly", () => {
    const route: Route = { ...routeFor(project, "Product", "list"), response: { mode: "auto", status: 503, headers: { "Retry-After": "30" } } };
    const engineResult = executeRoute(project, route, { params: {}, query: {}, body: undefined }, ds);
    const shaped = applyResponseShape(route, engineResult, emptyContext);
    expect(shaped.status).toBe(503);
    expect(shaped.headers).toEqual({ "Retry-After": "30" });
    expect(JSON.stringify(shaped.body)).toBe(JSON.stringify(engineResult.body));
  });
});

describe("applyResponseShape — custom routes", () => {
  it("returns a 501 with a plain-language body when a custom route has no response", () => {
    const route: Route = { id: "c", method: "GET", path: "/ping", modelId: null, action: "custom", description: "", filters: [] };
    const engineResult: EngineResult = { status: 200, body: { message: "This route has no model action yet. Link it to a model to return data." } };
    const shaped = applyResponseShape(route, engineResult, emptyContext);
    expect(shaped.status).toBe(501);
    expect(typeof (shaped.body as { error: string }).error).toBe("string");
    expect((shaped.body as { error: string }).error.toLowerCase()).not.toContain("link it to a model");
  });

  it("uses the static response body/status for a custom route", () => {
    const route: Route = {
      id: "c",
      method: "GET",
      path: "/ping",
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
      response: { mode: "static", status: 202, body: { pong: true } },
    };
    const engineResult: EngineResult = { status: 200, body: { message: "irrelevant" } };
    const shaped = applyResponseShape(route, engineResult, emptyContext);
    expect(shaped.status).toBe(202);
    expect(shaped.body).toEqual({ pong: true });
  });
});

describe("applyResponseShape — static mode", () => {
  it("returns the body verbatim with status 200 by default", () => {
    const route: Route = {
      id: "r",
      method: "GET",
      path: "/x",
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
      response: { mode: "static", body: { hello: "world" } },
    };
    const shaped = applyResponseShape(route, { status: 200, body: null }, emptyContext);
    expect(shaped.status).toBe(200);
    expect(shaped.body).toEqual({ hello: "world" });
  });

  it("honours a custom status and headers", () => {
    const route: Route = {
      id: "r",
      method: "GET",
      path: "/x",
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
      response: { mode: "static", status: 503, headers: { "Retry-After": "5" }, body: { down: true } },
    };
    const shaped = applyResponseShape(route, { status: 200, body: null }, emptyContext);
    expect(shaped.status).toBe(503);
    expect(shaped.headers).toEqual({ "Retry-After": "5" });
  });
});

describe("applyResponseShape — template mode substitution", () => {
  const project = storeProject();
  const ds = seedDataset(project);
  const listRoute = routeFor(project, "Product", "list");

  it("substitutes a whole-value placeholder with the typed value, not a stringified one", () => {
    const route: Route = { ...listRoute, response: { mode: "template", template: { items: "{{records}}", total: "{{count}}" } } };
    const engineResult = executeRoute(project, route, { params: {}, query: {}, body: undefined }, ds);
    const shaped = applyResponseShape(route, engineResult, { params: {}, query: {}, body: undefined });
    const body = shaped.body as { items: unknown; total: unknown };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBe((engineResult.body as { count: number }).count);
  });

  it("interpolates a placeholder inside a longer string as text", () => {
    const route: Route = { ...listRoute, response: { mode: "template", template: { message: "Found {{count}} products" } } };
    const engineResult = executeRoute(project, route, { params: {}, query: {}, body: undefined }, ds);
    const shaped = applyResponseShape(route, engineResult, { params: {}, query: {}, body: undefined });
    const count = (engineResult.body as { count: number }).count;
    expect((shaped.body as { message: string }).message).toBe(`Found ${count} products`);
  });

  it("resolves {{record}} to the single record for a get route", () => {
    const getRoute = routeFor(project, "Product", "get");
    const route: Route = { ...getRoute, response: { mode: "template", template: { item: "{{record}}" } } };
    const engineResult = executeRoute(project, route, { params: { id: "1" }, query: {}, body: undefined }, ds);
    const shaped = applyResponseShape(route, engineResult, { params: { id: "1" }, query: {}, body: undefined });
    expect((shaped.body as { item: unknown }).item).toEqual(engineResult.body);
  });

  it("substitutes {{params.<name>}}, {{query.<name>}} and {{body.<name>}}", () => {
    const route: Route = {
      id: "r",
      method: "POST",
      path: "/x/:id",
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
      response: { mode: "template", template: { id: "{{params.id}}", q: "{{query.q}}", name: "{{body.name}}" } },
    };
    const shaped = applyResponseShape(
      route,
      { status: 200, body: null },
      { params: { id: "42" }, query: { q: "hi" }, body: { name: "Ada" } },
    );
    expect(shaped.body).toEqual({ id: "42", q: "hi", name: "Ada" });
  });

  it("substitutes {{now}} and {{uuid}}", () => {
    const route: Route = {
      id: "r",
      method: "GET",
      path: "/x",
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
      response: { mode: "template", template: { servedAt: "{{now}}", requestId: "{{uuid}}" } },
    };
    const shaped = applyResponseShape(route, { status: 200, body: null }, emptyContext);
    const body = shaped.body as { servedAt: string; requestId: string };
    expect(() => new Date(body.servedAt).toISOString()).not.toThrow();
    expect(body.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("resolves an unknown placeholder to null and adds a warning, without failing the request", () => {
    const route: Route = {
      id: "r",
      method: "GET",
      path: "/x",
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
      response: { mode: "template", template: { oops: "{{totallyMadeUp}}" } },
    };
    const shaped = applyResponseShape(route, { status: 200, body: null }, emptyContext);
    expect(shaped.status).toBe(200);
    expect((shaped.body as { oops: unknown }).oops).toBeNull();
    expect(shaped.warnings.length).toBeGreaterThan(0);
    expect(shaped.warnings[0]).toContain("totallyMadeUp");
  });

  it("uses context.records (from a response query) rather than re-deriving from the engine result", () => {
    const route: Route = {
      id: "r",
      method: "GET",
      path: "/best",
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
      response: { mode: "template", template: { items: "{{records}}", n: "{{count}}" } },
    };
    const records: DataRecord[] = [{ id: "1", name: "A" }, { id: "2", name: "B" }];
    const shaped = applyResponseShape(route, { status: 200, body: null }, { params: {}, query: {}, body: undefined, records });
    expect(shaped.body).toEqual({ items: records, n: 2 });
  });

  it("honours a custom status on a templated response", () => {
    const route: Route = { ...listRoute, response: { mode: "template", status: 207, template: { ok: true } } };
    const engineResult = executeRoute(project, route, { params: {}, query: {}, body: undefined }, ds);
    const shaped = applyResponseShape(route, engineResult, { params: {}, query: {}, body: undefined });
    expect(shaped.status).toBe(207);
  });
});

describe("applyResponseShape — template is data, never code", () => {
  it("treats a smuggled expression as literal text, not evaluated", () => {
    const route: Route = {
      id: "r",
      method: "GET",
      path: "/x",
      modelId: null,
      action: "custom",
      description: "",
      filters: [],
      response: { mode: "template", template: { danger: "{{ 1 + 1 }}", also: "${1+1}", proc: "{{process.env.SECRET}}" } },
    };
    const shaped = applyResponseShape(route, { status: 200, body: null }, emptyContext);
    const body = shaped.body as Record<string, unknown>;
    // None of these are recognised placeholders, so they resolve to null (with warnings),
    // or - for the ones that aren't even `{{...}}` shaped - pass through untouched. Nothing
    // is ever evaluated as an expression.
    expect(body.also).toBe("${1+1}");
    expect(body.proc).toBeNull();
    expect(shaped.warnings.length).toBeGreaterThan(0);
  });
});

describe("runResponseQuery", () => {
  const model: Model = { id: "m1", name: "Book", fields: [] };
  const records: DataRecord[] = [
    { id: "1", title: "Dune", rating: 5, genre: "sci-fi" },
    { id: "2", title: "Emma", rating: 3, genre: "romance" },
    { id: "3", title: "Foundation", rating: 4, genre: "sci-fi" },
    { id: "4", title: "Dune Messiah", rating: 4, genre: "sci-fi" },
  ];

  it("filters with eq", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, filter: [{ field: "genre", op: "eq", value: "sci-fi" }] });
    expect(out.map((r) => r.id)).toEqual(["1", "3", "4"]);
  });

  it("filters with neq", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, filter: [{ field: "genre", op: "neq", value: "sci-fi" }] });
    expect(out.map((r) => r.id)).toEqual(["2"]);
  });

  it("filters with gt", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, filter: [{ field: "rating", op: "gt", value: "3" }] });
    expect(out.map((r) => r.id)).toEqual(["1", "3", "4"]);
  });

  it("filters with lt", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, filter: [{ field: "rating", op: "lt", value: "4" }] });
    expect(out.map((r) => r.id)).toEqual(["2"]);
  });

  it("filters with contains", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, filter: [{ field: "title", op: "contains", value: "Dune" }] });
    expect(out.map((r) => r.id)).toEqual(["1", "4"]);
  });

  it("sorts ascending", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, sort: { field: "rating", dir: "asc" } });
    expect(out.map((r) => r.id)).toEqual(["2", "3", "4", "1"]);
  });

  it("sorts descending", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, sort: { field: "rating", dir: "desc" } });
    expect(out.map((r) => r.id)).toEqual(["1", "3", "4", "2"]);
  });

  it("limits the result", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, sort: { field: "rating", dir: "desc" }, limit: 2 });
    expect(out.map((r) => r.id)).toEqual(["1", "3"]);
  });

  it("does not crash filtering on a field that does not exist, and matches nothing for eq", () => {
    const out = runResponseQuery(model, records, { modelId: model.id, filter: [{ field: "nope", op: "eq", value: "x" }] });
    expect(out).toEqual([]);
  });
});
