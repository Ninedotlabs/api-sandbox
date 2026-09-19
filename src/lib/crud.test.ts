import { buildCrudRoutes, crudOptions, generateAllCrud } from "./crud";
import { groupRoutes, missingCrud, uniquePath } from "./routes";
import { buildTemplateModels } from "./templates";
import type { Model, Project } from "./types";

const order: Model = { id: "m1", name: "Order", fields: [] };

it("offers five plain-language CRUD options", () => {
  expect(crudOptions(order).map((o) => `${o.method} ${o.path} ${o.label}`)).toEqual([
    "GET /orders List all orders",
    "GET /orders/:id Get one order",
    "POST /orders Add an order",
    "PUT /orders/:id Update an order",
    "DELETE /orders/:id Delete an order",
  ]);
});

it("builds only selected, non-existing routes", () => {
  const first = buildCrudRoutes(order, ["list", "create"], []);
  expect(first.map((r) => r.action)).toEqual(["list", "create"]);
  expect(first[0]).toMatchObject({ modelId: "m1", description: "List all orders", filters: [] });
  const second = buildCrudRoutes(order, ["list", "get"], first);
  expect(second.map((r) => r.action)).toEqual(["get"]);
});

it("groups routes by model with an 'Other routes' bucket", () => {
  const routes = buildCrudRoutes(order, ["list"], []);
  const project = {
    models: [order, { id: "m2", name: "Item", fields: [] }],
    routes: [...routes, { ...routes[0], id: "x", modelId: null, path: "/ping" }],
  } as Project;
  const groups = groupRoutes(project);
  expect(groups.map((g) => [g.title, g.routes.length])).toEqual([["Order", 1], ["Item", 0], ["Other routes", 1]]);
  expect(missingCrud(order, project.routes)).toBe(true);
  expect(missingCrud(order, buildCrudRoutes(order, ["list", "get", "create", "update", "delete"], []))).toBe(false);
});

it("finds an unused path", () => {
  const r = buildCrudRoutes(order, ["list"], [])[0];
  expect(uniquePath([])).toBe("/new-route");
  expect(uniquePath([{ ...r, path: "/new-route" }, { ...r, path: "/new-route-2" }])).toBe("/new-route-3");
});

it("generates every missing standard endpoint across models, in canonical order", () => {
  const models = buildTemplateModels("store");
  const product = models[0];
  const existing = buildCrudRoutes(product, ["list"], []);
  const project = { models, routes: existing } as Project;
  const routes = generateAllCrud(project);
  expect(routes).toHaveLength(14);
  expect(routes.slice(0, 4).map((r) => r.action)).toEqual(["get", "create", "update", "delete"]);
  expect(routes.every((r) => models.some((m) => m.id === r.modelId))).toBe(true);
  expect(generateAllCrud({ models, routes: [...existing, ...routes] } as Project)).toEqual([]);
});
