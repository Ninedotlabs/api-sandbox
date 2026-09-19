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
