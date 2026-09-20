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

it("keeps a model's records for Undo and restores them with their original ids", async () => {
  const p = await mockProjectService.create({ name: "Contacts Api", description: "", templateId: null });
  const customer = await mockModelService.create(p.id, "Customer");
  await mockModelService.update(p.id, {
    ...customer,
    fields: [{ id: "f_name", name: "name", type: "text", required: true, unique: false }],
  });
  await mockConsoleService.seedRecords(p.id, customer.id, [{ name: "Ann" }, { name: "Bo" }]);
  const seeded = await mockConsoleService.sampleData(p.id, customer.id);
  expect(seeded).toEqual([
    { id: "1", name: "Ann" },
    { id: "2", name: "Bo" },
  ]);

  const removed = await mockModelService.remove(p.id, customer.id);
  expect(removed.records).toEqual(seeded);
  // records.model_id is ON DELETE CASCADE on Postgres — the mock mirrors that by clearing
  // them from its own dataset, so a bug here can't hide behind data that was never removed.
  expect(await mockConsoleService.sampleData(p.id, customer.id)).toEqual([]);

  await mockModelService.restore(p.id, removed);
  expect(await mockConsoleService.sampleData(p.id, customer.id)).toEqual(seeded);
});

it("restores a model that held no records cleanly", async () => {
  const p = await mockProjectService.create({ name: "Blank Api", description: "", templateId: null });
  const solo = await mockModelService.create(p.id, "Solo");

  const removed = await mockModelService.remove(p.id, solo.id);
  expect(removed.records).toEqual([]);

  await mockModelService.restore(p.id, removed);
  expect(await mockConsoleService.sampleData(p.id, solo.id)).toEqual([]);
});

it("keeps every model's records across a whole-project delete and restore, skipping a model with none", async () => {
  const p = await mockProjectService.create({ name: "Shop Contacts Api", description: "", templateId: null });
  const product = await mockModelService.create(p.id, "Product");
  const customer = await mockModelService.create(p.id, "Customer");
  await mockModelService.update(p.id, {
    ...product,
    fields: [{ id: "f_name", name: "name", type: "text", required: true, unique: false }],
  });
  await mockConsoleService.seedRecords(p.id, product.id, [{ name: "Lamp" }]);
  // Explicitly emptied (not merely unseeded — seeding Product above already lazily generated
  // placeholder records for every other model in the project too) so this model's zero-record
  // state is deterministic: it must not show up as a `{ modelId, records: [] }` entry below.
  await mockConsoleService.seedRecords(p.id, customer.id, []);
  const productRecords = await mockConsoleService.sampleData(p.id, product.id);

  const removed = await mockProjectService.remove(p.id);
  expect(removed.project.id).toBe(p.id);
  expect(removed.records).toEqual([{ modelId: product.id, records: productRecords }]);
  expect(removed.records.some((r) => r.modelId === customer.id)).toBe(false);
  expect(await mockProjectService.get(p.id)).toBeNull();

  await mockProjectService.restore(removed);
  expect(await mockProjectService.get(p.id)).not.toBeNull();
  expect(await mockConsoleService.sampleData(p.id, product.id)).toEqual(productRecords);
});

it("fails plainly when removing a project that no longer exists", async () => {
  await expect(mockProjectService.remove("missing")).rejects.toThrow("This API no longer exists.");
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

describe("duplicate", () => {
  it("copies a project with fresh ids, remapping field.linkTo and route.modelId to the new models", async () => {
    const p = await newStore();
    const customer = p.models.find((m) => m.name === "Customer")!;
    const order = p.models.find((m) => m.name === "Order")!;
    const orderRoutes = buildCrudRoutes(order, ["list", "get"], []);
    await mockRouteService.createMany(p.id, orderRoutes);
    const before = (await mockProjectService.get(p.id))!;

    const copy = await mockProjectService.duplicate(p.id);

    expect(copy.id).not.toBe(p.id);
    expect(copy.name).toBe("My Store copy");
    expect(copy.slug).toBe("my-store-copy");
    expect(copy.models.map((m) => m.name)).toEqual(before.models.map((m) => m.name));
    expect(copy.models.map((m) => m.id)).not.toEqual(before.models.map((m) => m.id));

    const copiedOrder = copy.models.find((m) => m.name === "Order")!;
    const copiedCustomer = copy.models.find((m) => m.name === "Customer")!;
    expect(copiedOrder.id).not.toBe(order.id);
    expect(copiedOrder.fields.find((f) => f.name === "customer")!.linkTo).toBe(copiedCustomer.id);
    expect(copiedCustomer.id).not.toBe(customer.id);

    expect(copy.routes).toHaveLength(orderRoutes.length);
    expect(copy.routes.map((r) => r.id)).not.toEqual(orderRoutes.map((r) => r.id));
    for (const route of copy.routes) expect(route.modelId).toBe(copiedOrder.id);

    // The source project is untouched.
    const original = (await mockProjectService.get(p.id))!;
    expect(original.models.map((m) => m.id)).toEqual(before.models.map((m) => m.id));
    expect(original.routes).toEqual(orderRoutes);
  });

  it("names successive copies 'copy 2', 'copy 3' once the plain name is taken", async () => {
    const p = await newStore();
    const first = await mockProjectService.duplicate(p.id);
    expect(first.name).toBe("My Store copy");
    const second = await mockProjectService.duplicate(p.id);
    expect(second.name).toBe("My Store copy 2");
    expect(second.slug).toBe("my-store-copy-2");
    const third = await mockProjectService.duplicate(p.id);
    expect(third.name).toBe("My Store copy 3");
    // Duplicating a copy names it from *its own* name, not the original's — "copy of a copy"
    // is a fresh source name like any other, so it gets its own " copy" suffix.
    const ofACopy = await mockProjectService.duplicate(first.id);
    expect(ofACopy.name).toBe("My Store copy copy");
  });

  it("copies the console dataset, rekeyed from the old model ids to the new ones", async () => {
    const p = await newStore();
    const product = p.models[0];
    const originalRecords = await mockConsoleService.sampleData(p.id, product.id);
    expect(originalRecords.length).toBeGreaterThan(0);

    const copy = await mockProjectService.duplicate(p.id);
    const copiedProduct = copy.models.find((m) => m.name === "Product")!;
    const copiedRecords = await mockConsoleService.sampleData(copy.id, copiedProduct.id);
    expect(copiedRecords).toEqual(originalRecords);

    // Each project's dataset stays independent afterwards.
    await mockConsoleService.seedRecords(copy.id, copiedProduct.id, [{ name: "Only in the copy", price: 1 }]);
    const stillOriginal = await mockConsoleService.sampleData(p.id, product.id);
    expect(stillOriginal).toEqual(originalRecords);
  });

  it("fails plainly when the source project no longer exists", async () => {
    await expect(mockProjectService.duplicate("missing")).rejects.toThrow("This API no longer exists.");
  });
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
