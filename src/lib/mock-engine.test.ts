import { buildCrudRoutes } from "./crud";
import { exampleRequest, exampleResponse } from "./examples";
import { executeRoute, seedDataset, type Dataset } from "./mock-engine";
import { buildTemplateModels } from "./templates";
import type { Project, Route } from "./types";

function storeProject(): Project {
  const models = buildTemplateModels("store");
  const routes = models.flatMap((m) => buildCrudRoutes(m, ["list", "get", "create", "update", "delete"], []));
  return { id: "p1", name: "Store", slug: "store", description: "", models, routes, createdAt: "", updatedAt: "" };
}
const modelNamed = (p: Project, name: string) => p.models.find((m) => m.name === name)!;
const routeFor = (p: Project, model: string, action: Route["action"]) =>
  p.routes.find((r) => r.modelId === modelNamed(p, model).id && r.action === action)!;
const req = (body?: unknown, params: Record<string, string> = {}, query: Record<string, string> = {}) => ({ params, query, body });

let project: Project;
let ds: Dataset;
beforeEach(() => {
  project = storeProject();
  ds = seedDataset(project);
});

it("seeds five records per model with valid links", () => {
  const customers = ds[modelNamed(project, "Customer").id];
  const orders = ds[modelNamed(project, "Order").id];
  expect(customers.map((c) => c.id)).toEqual(["1", "2", "3", "4", "5"]);
  for (const o of orders) expect(customers.some((c) => c.id === o.customer)).toBe(true);
});

it("lists records and applies filters", () => {
  const list = routeFor(project, "Product", "list");
  expect(executeRoute(project, list, req(), ds)).toMatchObject({ status: 200, body: { count: 5 } });
  const category = String(ds[modelNamed(project, "Product").id][0].category);
  const res = executeRoute(project, { ...list, filters: ["category"] }, req(undefined, {}, { category }), ds);
  const data = (res.body as { data: { category: string }[] }).data;
  expect(data.length).toBeGreaterThan(0);
  expect(data.every((r) => r.category === category)).toBe(true);
});

it("returns 404 for a missing record", () => {
  const res = executeRoute(project, routeFor(project, "Product", "get"), req(undefined, { id: "999" }), ds);
  expect(res).toEqual({ status: 404, body: { error: "No product with id 999" } });
});

it("validates create requests", () => {
  const create = routeFor(project, "Product", "create");
  const missing = executeRoute(project, create, req({}), ds);
  expect(missing.status).toBe(400);
  expect(missing.body).toEqual({ error: "Validation failed", details: ["'name' is required", "'price' is required"] });
  const wrong = executeRoute(project, create, req({ name: "Lamp", price: "cheap", category: "Food", colour: "red" }), ds);
  expect((wrong.body as { details: string[] }).details).toEqual([
    "'colour' is not a field on Product",
    "'price' should be a number",
    "'category' should be one of: Clothing, Electronics, Home",
  ]);
});

it("creates, updates and deletes", () => {
  const create = routeFor(project, "Product", "create");
  const created = executeRoute(project, create, req({ name: "Lamp", price: 25 }), ds);
  expect(created).toMatchObject({ status: 201, body: { id: "6", name: "Lamp", price: 25, inStock: null } });

  const update = routeFor(project, "Product", "update");
  expect(executeRoute(project, update, req({ price: 30 }, { id: "6" }), ds)).toMatchObject({
    status: 200,
    body: { id: "6", name: "Lamp", price: 30 },
  });
  expect(executeRoute(project, update, req({ name: "" }, { id: "6" }), ds).status).toBe(400);

  expect(executeRoute(project, routeFor(project, "Product", "delete"), req(undefined, { id: "6" }), ds)).toEqual({
    status: 204,
    body: null,
  });
  expect(executeRoute(project, routeFor(project, "Product", "get"), req(undefined, { id: "6" }), ds).status).toBe(404);
});

it("enforces unique fields and links", () => {
  const taken = ds[modelNamed(project, "Customer").id][0].email;
  const dup = executeRoute(project, routeFor(project, "Customer", "create"), req({ name: "A", email: taken }), ds);
  expect((dup.body as { details: string[] }).details).toEqual([
    "'email' must be unique. Another record already uses this value",
  ]);
  const orphan = executeRoute(project, routeFor(project, "Order", "create"), req({ customer: "999", total: 5 }), ds);
  expect((orphan.body as { details: string[] }).details).toEqual(["'customer' points to a record that doesn't exist"]);
});

it("answers custom routes with a message", () => {
  const custom: Route = { id: "c", method: "GET", path: "/ping", modelId: null, action: "custom", description: "", filters: [] };
  expect(executeRoute(project, custom, req(), ds).status).toBe(200);
});

it("builds deterministic examples", () => {
  const create = routeFor(project, "Product", "create");
  const body = exampleRequest(create, project)!;
  expect(body).toEqual(exampleRequest(create, project));
  const response = exampleResponse(create, project);
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject(body);
  expect(exampleRequest(routeFor(project, "Product", "list"), project)).toBeNull();
});
