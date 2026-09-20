import type { EditPlan } from "@/lib/ai/plan";
import { buildCrudRoutes } from "@/lib/crud";
import { consoleService, routeService } from "@/lib/services";
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

it("applies an AI plan: models with fields, five routes each, seeded records", async () => {
  const p = await useProjectStore.getState().createProject({ name: "Books", description: "", templateId: null });
  const result = await useProjectStore.getState().applyPlan(p.id, {
    resources: [
      {
        name: "Author",
        description: "",
        fields: [{ name: "name", type: "text", required: true, unique: false }],
        records: [{ name: "Ann" }],
      },
      {
        name: "Book",
        description: "",
        fields: [
          { name: "title", type: "text", required: true, unique: false },
          { name: "author", type: "link", required: false, unique: false, linkTo: "Author" },
        ],
        records: [{ title: "Dune", author: "1" }],
      },
    ],
  });
  const project = useProjectStore.getState().projects.find((x) => x.id === p.id)!;
  expect(project.models.map((m) => m.name)).toEqual(["Author", "Book"]);
  const book = project.models[1];
  expect(book.fields.find((f) => f.name === "author")!.linkTo).toBe(project.models[0].id);
  expect(project.routes.filter((r) => r.modelId === book.id).map((r) => r.action)).toEqual([
    "list",
    "get",
    "create",
    "update",
    "delete",
  ]);
  expect(result).toEqual({ modelIds: project.models.map((m) => m.id), routeCount: 10 });
  expect(await consoleService.sampleData(p.id, book.id)).toEqual([{ title: "Dune", author: "1", id: "1" }]);
});

it("resumes an AI plan after a failed step, without duplicating models", async () => {
  const p = await useProjectStore.getState().createProject({ name: "Library", description: "", templateId: null });
  const plan = {
    resources: [
      {
        name: "Author",
        description: "",
        fields: [{ name: "name", type: "text" as const, required: true, unique: false }],
        records: [{ name: "Ann" }],
      },
      {
        name: "Book",
        description: "",
        fields: [{ name: "title", type: "text" as const, required: true, unique: false }],
        records: [{ title: "Dune" }],
      },
    ],
  };
  const failOnce = vi.spyOn(routeService, "createMany").mockRejectedValueOnce(new Error("Network dropped."));
  await expect(useProjectStore.getState().applyPlan(p.id, plan)).rejects.toThrow("Network dropped.");
  // The refresh runs even on failure, so what did land is visible.
  const partial = useProjectStore.getState().projects.find((x) => x.id === p.id)!;
  expect(partial.models.map((m) => m.name)).toEqual(["Author", "Book"]);
  expect(partial.routes).toEqual([]);

  failOnce.mockRestore();
  const result = await useProjectStore.getState().applyPlan(p.id, plan);
  const project = useProjectStore.getState().projects.find((x) => x.id === p.id)!;
  expect(project.models.map((m) => m.name)).toEqual(["Author", "Book"]);
  expect(project.routes).toHaveLength(10);
  expect(result).toEqual({ modelIds: project.models.map((m) => m.id), routeCount: 10 });
});

it("edit: adds a new resource and changes an existing one, preserving untouched fields and ids", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  const book = await useProjectStore.getState().createModel(project.id, "Book");
  await useProjectStore.getState().saveModel(project.id, { ...book, fields: [{ id: "f-title", name: "title", type: "text", required: true, unique: false }] });

  const plan: EditPlan = {
    resources: [
      { name: "Book", description: "", fields: [{ name: "genre", type: "text", required: false, unique: false }], records: [] },
      { name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false }], records: [{ name: "Ann" }] },
    ],
    customEndpoints: [],
  };
  const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
  const after = useProjectStore.getState().projects.find((x) => x.id === project.id)!;
  const bookAfter = after.models.find((m) => m.name === "Book")!;
  expect(bookAfter.fields.find((f) => f.name === "title")!.id).toBe("f-title"); // untouched field kept its id
  expect(bookAfter.fields.map((f) => f.name)).toEqual(["title", "genre"]);
  expect(after.models.map((m) => m.name)).toEqual(["Book", "Author"]);
  expect(result).toEqual({ modelIds: [bookAfter.id, after.models[1].id], newResourceCount: 1, changedResourceCount: 1, endpointCount: 10 });
  expect(after.routes.filter((r) => r.modelId === bookAfter.id)).toHaveLength(5);
});

it("edit: a link on a new resource can target an existing resource that isn't itself in the plan", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  await useProjectStore.getState().createModel(project.id, "Book");
  const plan: EditPlan = {
    resources: [{ name: "Review", description: "", fields: [{ name: "rating", type: "number", required: true, unique: false }, { name: "book", type: "link", required: true, unique: false, linkTo: "Book" }], records: [{ rating: 5, book: "1" }] }],
    customEndpoints: [],
  };
  await useProjectStore.getState().applyEditPlan(project.id, plan);
  const after = useProjectStore.getState().projects.find((x) => x.id === project.id)!;
  const book = after.models.find((m) => m.name === "Book")!;
  const review = after.models.find((m) => m.name === "Review")!;
  expect(review.fields.find((f) => f.name === "book")!.linkTo).toBe(book.id);
});
