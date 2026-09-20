import { buildCrudRoutes } from "@/lib/crud";
import { mockConsoleService, resetMockDatasets } from "./console-service";
import { setMockLatency } from "./latency";
import { mockModelService } from "./model-service";
import { mockProjectService } from "./project-service";
import { mockRouteService } from "./route-service";

beforeEach(() => {
  setMockLatency(0);
  resetMockDatasets();
});

const newStore = () => mockProjectService.create({ name: "My Store", description: "", templateId: "store" });

it("creates a project from a template with models but no routes", async () => {
  const p = await newStore();
  expect(p.slug).toBe("my-store");
  expect(p.models.map((m) => m.name)).toEqual(["Product", "Customer", "Order"]);
  expect(p.routes).toEqual([]);
  expect(await mockProjectService.list()).toHaveLength(1);
  expect(localStorage.getItem("universal-api:db:v1")).toContain("My Store");
});

it("rejects a duplicate project name", async () => {
  await newStore();
  await expect(newStore()).rejects.toThrow("You already have an API with this name.");
});

it("removes a model with its routes and clears links to it", async () => {
  const p = await newStore();
  const customer = p.models.find((m) => m.name === "Customer")!;
  await mockRouteService.createMany(p.id, buildCrudRoutes(customer, ["list"], []));
  await mockModelService.remove(p.id, customer.id);
  const after = (await mockProjectService.get(p.id))!;
  expect(after.routes).toEqual([]);
  const order = after.models.find((m) => m.name === "Order")!;
  expect(order.fields.find((f) => f.name === "customer")!.linkTo).toBeUndefined();
});

it("rejects conflicting routes", async () => {
  const p = await newStore();
  const product = p.models[0];
  await mockRouteService.createMany(p.id, buildCrudRoutes(product, ["list"], []));
  const dup = buildCrudRoutes(product, ["list"], []);
  await expect(mockRouteService.createMany(p.id, dup)).rejects.toThrow("Two routes can't share the same method and path.");
});

it("runs requests against sample data", async () => {
  const p = await newStore();
  const product = p.models[0];
  const routes = buildCrudRoutes(product, ["list", "create"], []);
  await mockRouteService.createMany(p.id, routes);
  const [list, create] = routes;
  const bad = await mockConsoleService.send(p.id, { routeId: create.id, params: {}, query: {}, body: { price: 5 } });
  expect(bad.status).toBe(400);
  const ok = await mockConsoleService.send(p.id, { routeId: create.id, params: {}, query: {}, body: { name: "Lamp", price: 25 } });
  expect(ok.status).toBe(201);
  const all = await mockConsoleService.send(p.id, { routeId: list.id, params: {}, query: {}, body: undefined });
  expect((all.body as { data: { name: string }[] }).data.some((r) => r.name === "Lamp")).toBe(true);
  expect(all.durationMs).toBeGreaterThan(0);
  expect(await mockConsoleService.sampleData(p.id, product.id)).toHaveLength(6);
});

it("keeps sample data in line with model edits", async () => {
  const p = await newStore();
  const product = p.models[0];
  expect(Object.keys((await mockConsoleService.sampleData(p.id, product.id))[0])).toContain("inStock");
  await mockModelService.update(p.id, {
    ...product,
    fields: [
      ...product.fields.filter((f) => f.name !== "inStock"),
      { id: "f_sku", name: "sku", type: "text", required: false, unique: false },
    ],
  });
  const [record] = await mockConsoleService.sampleData(p.id, product.id);
  expect(record).not.toHaveProperty("inStock");
  expect(typeof record.sku).toBe("string");
});

it("removes and restores routes and models with Undo", async () => {
  const p = await newStore();
  const customer = p.models.find((m) => m.name === "Customer")!;
  const routes = buildCrudRoutes(customer, ["list", "get"], []);
  await mockRouteService.createMany(p.id, routes);
  const removedRoute = await mockRouteService.remove(p.id, routes[0].id);
  expect(removedRoute).toEqual({ route: routes[0], beforeId: routes[1].id });
  await mockRouteService.restore(p.id, removedRoute);
  const removedModel = await mockModelService.remove(p.id, customer.id);
  expect(removedModel.routes.map((r) => r.route.id)).toEqual(routes.map((r) => r.id));
  await mockModelService.restore(p.id, removedModel);
  const after = (await mockProjectService.get(p.id))!;
  expect(after.models.map((m) => m.name)).toEqual(["Product", "Customer", "Order"]);
  expect(after.routes.map((r) => r.id)).toEqual(routes.map((r) => r.id));
  await expect(mockRouteService.remove(p.id, "missing")).rejects.toThrow("This route no longer exists.");
});

it("keeps a session log of sent requests, newest first, capped at 50", async () => {
  const p = await newStore();
  const [list] = buildCrudRoutes(p.models[0], ["list"], []);
  await mockRouteService.createMany(p.id, [list]);
  for (let i = 0; i < 52; i++) {
    await mockConsoleService.send(p.id, { routeId: list.id, params: {}, query: {}, body: undefined });
  }
  const log = await mockConsoleService.log(p.id);
  expect(log).toHaveLength(50);
  expect(log[0]).toMatchObject({ method: "GET", path: "/products", response: { status: 200 } });
  expect(new Date(log[0].at).getTime()).toBeGreaterThanOrEqual(new Date(log[49].at).getTime());
  await mockConsoleService.clearLog(p.id);
  expect(await mockConsoleService.log(p.id)).toEqual([]);
});

it("seeds records for a model and serves them", async () => {
  const p = await newStore();
  const product = p.models[0];
  await mockConsoleService.seedRecords(p.id, product.id, [
    { name: "Lamp", price: 25 },
    { name: "Desk", price: 120 },
  ]);
  const rows = await mockConsoleService.sampleData(p.id, product.id);
  expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
  expect(rows[0]).toMatchObject({ name: "Lamp", price: 25 });
});
