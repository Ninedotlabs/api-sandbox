import { buildCrudRoutes } from "@/lib/crud";
import { setMockLatency } from "@/lib/services/mock/latency";
import { useProjectStore } from "./project-store";

beforeEach(() => {
  setMockLatency(0);
  useProjectStore.setState({ projects: [], loaded: false });
});

it("loads, creates, deletes and restores projects", async () => {
  await useProjectStore.getState().loadProjects();
  expect(useProjectStore.getState().loaded).toBe(true);
  const p = await useProjectStore.getState().createProject({ name: "Blog", description: "", templateId: "blog" });
  expect(useProjectStore.getState().projects).toHaveLength(1);
  const snapshot = await useProjectStore.getState().deleteProject(p.id);
  expect(useProjectStore.getState().projects).toHaveLength(0);
  await useProjectStore.getState().restoreProject(snapshot);
  expect(useProjectStore.getState().projects[0].name).toBe("Blog");
});

it("refreshes the cached project after model changes", async () => {
  const p = await useProjectStore.getState().createProject({ name: "Todo", description: "", templateId: null });
  const model = await useProjectStore.getState().createModel(p.id, "Task");
  expect(useProjectStore.getState().projects[0].models).toEqual([model]);
  await useProjectStore.getState().saveModel(p.id, {
    ...model,
    fields: [{ id: "f1", name: "title", type: "text", required: true, unique: false }],
  });
  expect(useProjectStore.getState().projects[0].models[0].fields).toHaveLength(1);
});

describe("undo restores only the deleted entity", () => {
  async function storeWithRoutes() {
    const store = useProjectStore.getState();
    const p = await store.createProject({ name: `Shop ${Math.random()}`, description: "", templateId: "store" });
    const [product, customer] = p.models;
    const routes = [
      ...buildCrudRoutes(product, ["list", "get", "create"], []),
      ...buildCrudRoutes(customer, ["list"], []),
    ];
    await store.addRoutes(p.id, routes);
    return { p, routes, product, customer };
  }
  const current = (id: string) => useProjectStore.getState().projects.find((p) => p.id === id)!;

  it("puts back two deleted routes in either undo order", async () => {
    const { p, routes } = await storeWithRoutes();
    const store = useProjectStore.getState();
    const first = await store.deleteRoute(p.id, routes[1].id);
    const second = await store.deleteRoute(p.id, routes[2].id);
    expect(current(p.id).routes.map((r) => r.id)).toEqual([routes[0].id, routes[3].id]);
    await store.restoreRoute(p.id, second);
    expect(current(p.id).routes.map((r) => r.id)).toEqual([routes[0].id, routes[2].id, routes[3].id]);
    await store.restoreRoute(p.id, first);
    expect(current(p.id).routes.map((r) => r.id)).toEqual(routes.map((r) => r.id));
  });

  it("keeps edits made after the delete", async () => {
    const { p, routes, product } = await storeWithRoutes();
    const store = useProjectStore.getState();
    const removed = await store.deleteRoute(p.id, routes[0].id);
    await store.saveRoute(p.id, { ...routes[3], description: "Edited later" });
    await store.saveModel(p.id, { ...product, name: "Item" });
    await store.restoreRoute(p.id, removed);
    const after = current(p.id);
    expect(after.routes.map((r) => r.id)).toEqual(routes.map((r) => r.id));
    expect(after.routes[3].description).toBe("Edited later");
    expect(after.models[0].name).toBe("Item");
  });

  it("puts back a deleted model with its routes and links, keeping later edits", async () => {
    const { p, routes, customer } = await storeWithRoutes();
    const store = useProjectStore.getState();
    const order = p.models.find((m) => m.name === "Order")!;
    const removed = await store.deleteModel(p.id, customer.id);
    expect(current(p.id).models.map((m) => m.name)).toEqual(["Product", "Order"]);
    await store.saveRoute(p.id, { ...routes[0], description: "Edited later" });
    await store.restoreModel(p.id, removed);
    const after = current(p.id);
    expect(after.models.map((m) => m.name)).toEqual(["Product", "Customer", "Order"]);
    expect(after.routes.map((r) => r.id)).toEqual(routes.map((r) => r.id));
    expect(after.routes[0].description).toBe("Edited later");
    const link = after.models.find((m) => m.id === order.id)!.fields.find((f) => f.name === "customer")!;
    expect(link.linkTo).toBe(customer.id);
  });

  it("explains when a route can't come back because its address is taken", async () => {
    const { p, routes } = await storeWithRoutes();
    const store = useProjectStore.getState();
    const removed = await store.deleteRoute(p.id, routes[0].id);
    await store.addRoutes(p.id, [{ ...routes[0], id: "rt_new" }]);
    await expect(store.restoreRoute(p.id, removed)).rejects.toThrow("Two routes can't share the same method and path.");
  });
});
