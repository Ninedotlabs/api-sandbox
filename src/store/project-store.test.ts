import { toast } from "sonner";
import { computeEditDiff } from "@/lib/ai/diff";
import type { EditPlan } from "@/lib/ai/plan";
import { buildCrudRoutes } from "@/lib/crud";
import { consoleService, modelService, projectService, routeService } from "@/lib/services";
import { setMockLatency } from "@/lib/services/mock/latency";
import { useProjectStore } from "./project-store";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

beforeEach(() => {
  setMockLatency(0);
  useProjectStore.setState({ projects: [], loaded: false });
  vi.mocked(toast.error).mockClear();
});

it("records loadError on a failed load without setting loaded, then clears it on a successful retry", async () => {
  vi.spyOn(projectService, "list").mockRejectedValueOnce(new Error("Could not reach your account. Please try again."));

  await useProjectStore.getState().loadProjects();
  expect(useProjectStore.getState().loaded).toBe(false);
  expect(useProjectStore.getState().loadError).toBe("Could not reach your account. Please try again.");

  await useProjectStore.getState().loadProjects();
  expect(useProjectStore.getState().loaded).toBe(true);
  expect(useProjectStore.getState().loadError).toBeNull();
});

it("loads, creates, deletes and restores projects", async () => {
  await useProjectStore.getState().loadProjects();
  expect(useProjectStore.getState().loaded).toBe(true);
  const p = await useProjectStore.getState().createProject({ name: "Blog", description: "", templateId: "blog" });
  expect(useProjectStore.getState().projects).toHaveLength(1);
  const removed = await useProjectStore.getState().deleteProject(p.id);
  expect(useProjectStore.getState().projects).toHaveLength(0);
  await useProjectStore.getState().restoreProject(removed);
  expect(useProjectStore.getState().projects[0].name).toBe("Blog");
});

it("brings a deleted project's records back on Undo", async () => {
  const p = await useProjectStore.getState().createProject({ name: "Diary", description: "", templateId: null });
  const model = await useProjectStore.getState().createModel(p.id, "Entry");
  await useProjectStore.getState().saveModel(p.id, {
    ...model,
    fields: [{ id: "f-text", name: "text", type: "text", required: true, unique: false }],
  });
  await consoleService.seedRecords(p.id, model.id, [{ text: "Day one" }]);
  const seeded = await consoleService.sampleData(p.id, model.id);

  const removed = await useProjectStore.getState().deleteProject(p.id);
  expect(await consoleService.sampleData(p.id, model.id)).toEqual([]);

  await useProjectStore.getState().restoreProject(removed);
  expect(useProjectStore.getState().projects.find((x) => x.id === p.id)).toBeTruthy();
  expect(await consoleService.sampleData(p.id, model.id)).toEqual(seeded);
});

it("duplicates a project and adds the copy alongside it", async () => {
  const p = await useProjectStore.getState().createProject({ name: "Blog", description: "", templateId: "blog" });
  const copy = await useProjectStore.getState().duplicateProject(p.id);
  expect(copy.name).toBe("Blog copy");
  const { projects } = useProjectStore.getState();
  expect(projects.map((x) => x.id)).toEqual(expect.arrayContaining([p.id, copy.id]));
  expect(projects).toHaveLength(2);
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
  expect(result).toEqual({ modelIds: [bookAfter.id, after.models[1].id], newResourceCount: 1, changedResourceCount: 1, endpointCount: 10, undo: { replacedRecords: [], removedModels: [], removedRoutes: [], removedFields: [] } });
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

it("edit: replacing an existing resource's records snapshots what was lost, for Undo", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  const book = await useProjectStore.getState().createModel(project.id, "Book");
  await useProjectStore.getState().saveModel(project.id, { ...book, fields: [{ id: "f-title", name: "title", type: "text", required: true, unique: false }] });
  await consoleService.seedRecords(project.id, book.id, [{ title: "A" }, { title: "B" }, { title: "C" }]);

  const plan: EditPlan = {
    resources: [{ name: "Book", description: "", fields: [], records: [{ title: "X" }, { title: "Y" }] }],
    customEndpoints: [],
  };
  const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
  expect(await consoleService.sampleData(project.id, book.id)).toEqual([
    { title: "X", id: "1" },
    { title: "Y", id: "2" },
  ]);
  expect(result.undo.replacedRecords).toEqual([
    { modelId: book.id, records: [{ title: "A", id: "1" }, { title: "B", id: "2" }, { title: "C", id: "3" }] },
  ]);

  await useProjectStore.getState().undoEdit(project.id, result.undo);
  expect(await consoleService.sampleData(project.id, book.id)).toEqual([
    { title: "A", id: "1" },
    { title: "B", id: "2" },
    { title: "C", id: "3" },
  ]);
});

it("edit: a records-empty plan (schema-only edit) never touches or snapshots existing records", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  const book = await useProjectStore.getState().createModel(project.id, "Book");
  await useProjectStore.getState().saveModel(project.id, { ...book, fields: [{ id: "f-title", name: "title", type: "text", required: true, unique: false }] });
  await consoleService.seedRecords(project.id, book.id, [{ title: "A" }]);

  const plan: EditPlan = {
    resources: [{ name: "Book", description: "", fields: [{ name: "genre", type: "text", required: false, unique: false }], records: [] }],
    customEndpoints: [],
  };
  const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
  // Untouched by the *replace* step: the original record survives with its id and title
  // intact. (A newly added field is separately backfilled with a sample value on existing
  // records by the mock engine's `ensureDataset` — unrelated to record replacement, and not
  // what this assertion is checking.)
  const records = await consoleService.sampleData(project.id, book.id);
  expect(records).toHaveLength(1);
  expect(records[0]).toMatchObject({ id: "1", title: "A" });
  expect(result.undo.replacedRecords).toEqual([]);
});

it("edit: a brand-new resource's seeded records are not snapshotted (nothing existed to lose)", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  const plan: EditPlan = {
    resources: [{ name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false }], records: [{ name: "Ann" }] }],
    customEndpoints: [],
  };
  const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
  expect(result.undo.replacedRecords).toEqual([]);
});

// I2: applyEditPlan must dedupe customEndpoints defensively (same method+path within the
// plan itself), so a duplicate — however it got there — can never make routeService.createMany
// throw mid-apply and abort a partly-applied run.
it("edit: applies custom endpoints — resolves modelId, filters ones that already exist, and a duplicate doesn't throw mid-apply", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  const book = await useProjectStore.getState().createModel(project.id, "Book");
  await useProjectStore.getState().addRoutes(project.id, [{ id: "rt-existing", method: "GET", path: "/ping", modelId: null, action: "custom", description: "", filters: [] }]);

  const plan: EditPlan = {
    resources: [],
    customEndpoints: [
      { method: "GET", path: "/books/bestsellers", resourceName: "Book", description: "Top sellers" },
      { method: "GET", path: "/books/bestsellers", resourceName: "Book", description: "Duplicate" },
      { method: "GET", path: "/ping", resourceName: null, description: "Already exists" },
      { method: "GET", path: "/health", resourceName: null, description: "Health check" },
    ],
  };
  const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
  const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
  expect(after.routes.filter((r) => r.path === "/books/bestsellers")).toHaveLength(1);
  expect(after.routes.find((r) => r.path === "/books/bestsellers")!.modelId).toBe(book.id);
  expect(after.routes.filter((r) => r.path === "/ping")).toHaveLength(1);
  expect(after.routes.some((r) => r.path === "/health")).toBe(true);
  expect(result.endpointCount).toBe(2);
});

it("preview/apply equivalence: computeEditDiff's endpoint count and field changes match what applyEditPlan does, even with a duplicate custom endpoint", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  const book = await useProjectStore.getState().createModel(project.id, "Book");
  await useProjectStore.getState().saveModel(project.id, { ...book, fields: [{ id: "f-title", name: "title", type: "text", required: true, unique: false }] });

  const plan: EditPlan = {
    resources: [
      { name: "Book", description: "", fields: [{ name: "genre", type: "text", required: false, unique: false }], records: [] },
      { name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false }], records: [] },
    ],
    customEndpoints: [
      { method: "GET", path: "/books/bestsellers", resourceName: "Book", description: "Top sellers" },
      { method: "GET", path: "/books/bestsellers", resourceName: "Book", description: "Top sellers (dup)" },
    ],
  };
  const before = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
  const diff = computeEditDiff(before, plan);

  const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
  expect(result.endpointCount).toBe(diff.newEndpoints.length);

  const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
  const bookAfter = after.models.find((m) => m.name === "Book")!;
  const authorAfter = after.models.find((m) => m.name === "Author")!;
  const bookDiff = diff.changedResources.find((r) => r.name === "Book")!;
  const authorDiff = diff.newResources.find((r) => r.name === "Author")!;
  for (const change of bookDiff.fields) {
    const field = bookAfter.fields.find((f) => f.name === change.name)!;
    expect(field.type).toBe(change.after.type);
    expect(field.required).toBe(change.after.required);
  }
  for (const change of authorDiff.fields) {
    const field = authorAfter.fields.find((f) => f.name === change.name)!;
    expect(field.type).toBe(change.after.type);
  }
  // The duplicate custom endpoint must not have thrown mid-apply, and must not double-create.
  expect(after.routes.filter((r) => r.path === "/books/bestsellers")).toHaveLength(1);
});

describe("edit: removals", () => {
  async function seededShop() {
    const project = await useProjectStore.getState().createProject({ name: `Shop ${Math.random()}`, description: "", templateId: null });
    const book = await useProjectStore.getState().createModel(project.id, "Book");
    await useProjectStore.getState().saveModel(project.id, {
      ...book,
      fields: [
        { id: "f-title", name: "title", type: "text", required: true, unique: false },
        { id: "f-genre", name: "genre", type: "text", required: false, unique: false },
      ],
    });
    await consoleService.seedRecords(project.id, book.id, [
      { title: "Dune", genre: "Sci-fi" },
      { title: "Emma", genre: "" },
    ]);
    await useProjectStore.getState().addRoutes(project.id, buildCrudRoutes({ ...book, fields: [] }, ["list", "get"], []));
    const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    return { project: after, book: after.models.find((m) => m.name === "Book")! };
  }

  it("removes a field, snapshotting the resource's records so Undo can restore the values, not just the column", async () => {
    const { project, book } = await seededShop();
    const plan: EditPlan = { resources: [], customEndpoints: [], removals: { resources: [], fields: [{ resource: "Book", field: "genre" }], endpoints: [] } };
    const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
    const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    const bookAfter = after.models.find((m) => m.id === book.id)!;
    expect(bookAfter.fields.map((f) => f.name)).toEqual(["title"]);
    expect(result.undo.removedFields).toEqual([{ modelId: book.id, field: { id: "f-genre", name: "genre", type: "text", required: false, unique: false }, records: [{ id: "1", title: "Dune", genre: "Sci-fi" }, { id: "2", title: "Emma", genre: "" }] }]);

    await useProjectStore.getState().undoEdit(project.id, result.undo);
    const restored = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    const bookRestored = restored.models.find((m) => m.id === book.id)!;
    expect(bookRestored.fields.map((f) => f.name)).toEqual(["title", "genre"]);
    expect(await consoleService.sampleData(project.id, book.id)).toEqual([
      { id: "1", title: "Dune", genre: "Sci-fi" },
      { id: "2", title: "Emma", genre: "" },
    ]);
  });

  it("removes a resource, and Undo brings the resource, its routes and its records back", async () => {
    const { project, book } = await seededShop();
    const plan: EditPlan = { resources: [], customEndpoints: [], removals: { resources: ["Book"], fields: [], endpoints: [] } };
    const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
    const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    expect(after.models.some((m) => m.id === book.id)).toBe(false);
    expect(after.routes.some((r) => r.modelId === book.id)).toBe(false);
    expect(result.undo.removedModels).toHaveLength(1);

    await useProjectStore.getState().undoEdit(project.id, result.undo);
    const restored = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    expect(restored.models.some((m) => m.id === book.id)).toBe(true);
    expect(restored.routes.filter((r) => r.modelId === book.id)).toHaveLength(2);
    expect(await consoleService.sampleData(project.id, book.id)).toEqual([
      { id: "1", title: "Dune", genre: "Sci-fi" },
      { id: "2", title: "Emma", genre: "" },
    ]);
  });

  it("removes an endpoint, and Undo puts it back", async () => {
    const { project, book } = await seededShop();
    const target = project.routes.find((r) => r.modelId === book.id && r.action === "get")!;
    const plan: EditPlan = { resources: [], customEndpoints: [], removals: { resources: [], fields: [], endpoints: [{ method: target.method, path: target.path }] } };
    const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
    const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    expect(after.routes.some((r) => r.id === target.id)).toBe(false);
    expect(result.undo.removedRoutes).toEqual([{ route: target, beforeId: null }]);

    await useProjectStore.getState().undoEdit(project.id, result.undo);
    const restored = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    expect(restored.routes.some((r) => r.id === target.id)).toBe(true);
  });

  it("performs additions and changes before removals, so a plan replacing one field with another never leaves the resource empty", async () => {
    const { project, book } = await seededShop();
    const plan: EditPlan = {
      resources: [{ name: "Book", description: "", fields: [{ name: "subtitle", type: "text", required: false, unique: false }], records: [] }],
      customEndpoints: [],
      removals: { resources: [], fields: [{ resource: "Book", field: "genre" }], endpoints: [] },
    };
    const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
    const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    const bookAfter = after.models.find((m) => m.id === book.id)!;
    expect(bookAfter.fields.map((f) => f.name)).toEqual(["title", "subtitle"]);
    expect(result.undo.removedFields).toHaveLength(1);
  });

  it("a plan with both an addition and a removal applies both", async () => {
    const { project, book } = await seededShop();
    const plan: EditPlan = {
      resources: [{ name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false }], records: [{ name: "Ann" }] }],
      customEndpoints: [],
      removals: { resources: [], fields: [{ resource: "Book", field: "genre" }], endpoints: [] },
    };
    const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
    const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
    expect(after.models.some((m) => m.name === "Author")).toBe(true);
    const bookAfter = after.models.find((m) => m.id === book.id)!;
    expect(bookAfter.fields.map((f) => f.name)).toEqual(["title"]);
    expect(result.newResourceCount).toBe(1);
    expect(result.undo.removedFields).toHaveLength(1);
  });
});

// The failure mode this feature must not have: the preview said one thing and apply did
// another. What computeEditDiff lists must be exactly what applyEditPlan performs, removals
// included.
it("preview/apply equivalence: removals — what the diff lists is exactly what apply performs", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  const book = await useProjectStore.getState().createModel(project.id, "Book");
  await useProjectStore.getState().saveModel(project.id, {
    ...book,
    fields: [
      { id: "f-title", name: "title", type: "text", required: true, unique: false },
      { id: "f-genre", name: "genre", type: "text", required: false, unique: false },
    ],
  });
  await consoleService.seedRecords(project.id, book.id, [{ title: "Dune", genre: "Sci-fi" }]);
  await useProjectStore.getState().addRoutes(project.id, buildCrudRoutes({ ...book, fields: [] }, ["list", "get"], []));
  const order = await useProjectStore.getState().createModel(project.id, "Order");
  await useProjectStore.getState().saveModel(project.id, {
    ...order,
    fields: [{ id: "f-book", name: "book", type: "link", required: true, unique: false, linkTo: book.id }],
  });
  await consoleService.seedRecords(project.id, order.id, [{ book: "1" }]);

  const before = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
  const target = before.routes.find((r) => r.modelId === book.id && r.action === "get")!;
  const plan: EditPlan = {
    resources: [{ name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false }], records: [] }],
    customEndpoints: [],
    removals: { resources: ["Order"], fields: [{ resource: "Book", field: "genre" }], endpoints: [{ method: target.method, path: target.path }] },
  };
  const diff = computeEditDiff(before, plan, { Order: 1 }, { Book: [{ title: "Dune", genre: "Sci-fi" }] });
  expect(diff.removals.resources).toEqual([{ name: "Order", recordCount: 1, endpointCount: 0, inboundLinks: [] }]);
  expect(diff.removals.fields).toEqual([{ resource: "Book", field: "genre", recordCount: 1 }]);
  expect(diff.removals.endpoints).toEqual([{ method: target.method, path: target.path }]);

  const result = await useProjectStore.getState().applyEditPlan(project.id, plan);
  const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;

  // Exactly what the diff said would be removed, and nothing else.
  expect(after.models.some((m) => m.name === "Order")).toBe(false);
  expect(after.models.find((m) => m.id === book.id)!.fields.map((f) => f.name)).toEqual(["title"]);
  expect(after.routes.some((r) => r.id === target.id)).toBe(false);
  expect(result.undo.removedModels).toHaveLength(diff.removals.resources.length);
  expect(result.undo.removedFields).toHaveLength(diff.removals.fields.length);
  expect(result.undo.removedRoutes).toHaveLength(diff.removals.endpoints.length);
});

// C1 / record-rewrite: changing a choice field's options invalidates any existing record
// value that isn't one of the new options; the mock engine's ensureDataset then silently
// regenerates it on the next read. This is the mechanism C1 exists to make visible in the
// preview — apply semantics themselves are unchanged.
it("edit: changing a choice field's options invalidates existing records, which are then regenerated on next read", async () => {
  const project = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
  const order = await useProjectStore.getState().createModel(project.id, "Order");
  await useProjectStore.getState().saveModel(project.id, {
    ...order,
    fields: [{ id: "f-status", name: "status", type: "choice", required: true, unique: false, options: ["Pending", "Shipped"] }],
  });
  await consoleService.seedRecords(project.id, order.id, [{ status: "Pending" }, { status: "Shipped" }]);

  const plan: EditPlan = {
    resources: [{ name: "Order", description: "", fields: [{ name: "status", type: "choice", required: true, unique: false, options: ["Refunded"] }], records: [] }],
    customEndpoints: [],
  };
  await useProjectStore.getState().applyEditPlan(project.id, plan);

  const after = useProjectStore.getState().projects.find((p) => p.id === project.id)!;
  const orderAfter = after.models.find((m) => m.id === order.id)!;
  expect(orderAfter.fields.find((f) => f.name === "status")!.options).toEqual(["Refunded"]);

  const records = await consoleService.sampleData(project.id, order.id);
  expect(records).toHaveLength(2);
  for (const r of records) {
    expect(["Pending", "Shipped"]).not.toContain(r.status);
    // "Refunded" is the only option left, so faker's arrayElement is deterministic here.
    expect(r.status).toBe("Refunded");
  }
});

describe("optimistic saves (saveModel, updateProject, saveRoute)", () => {
  it("saveModel: applies the edit to local state before the network call resolves", async () => {
    const p = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
    const model = await useProjectStore.getState().createModel(p.id, "Product");
    let resolveUpdate: ((m: typeof model) => void) | undefined;
    vi.spyOn(modelService, "update").mockImplementationOnce(
      () => new Promise((resolve) => { resolveUpdate = resolve; }),
    );

    const next = { ...model, name: "Renamed" };
    const promise = useProjectStore.getState().saveModel(p.id, next);
    // The network call above is deliberately still pending - state must already show the
    // edit, not the round trip's eventual result.
    expect(useProjectStore.getState().projects.find((x) => x.id === p.id)!.models[0].name).toBe("Renamed");

    // Settling the stubbed call (which never actually persisted anything) lets the pending
    // `saveModel` promise finish; nothing further is asserted about state past this point,
    // since the reconcile step's own refresh legitimately reflects the mock db this stub
    // bypassed.
    resolveUpdate!(next);
    await promise;
  });

  it("saveModel: a failing save rolls back to the pre-edit model and reports the error", async () => {
    const p = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
    const model = await useProjectStore.getState().createModel(p.id, "Product");
    vi.spyOn(modelService, "update").mockRejectedValueOnce(new Error("A model with this name already exists."));

    await useProjectStore.getState().saveModel(p.id, { ...model, name: "Taken" });

    const after = useProjectStore.getState().projects.find((x) => x.id === p.id)!.models[0];
    expect(after).toEqual(model);
    expect(toast.error).toHaveBeenCalledWith("A model with this name already exists.");
  });

  it("updateProject: a failing save rolls back to the pre-edit project and reports the error", async () => {
    const p = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
    vi.spyOn(projectService, "update").mockRejectedValueOnce(new Error("Another API already uses this address."));

    await useProjectStore.getState().updateProject(p.id, { name: "New Name" });

    const after = useProjectStore.getState().projects.find((x) => x.id === p.id)!;
    expect(after.name).toBe(p.name);
    expect(toast.error).toHaveBeenCalledWith("Another API already uses this address.");
  });

  it("updateProject: applies the edit optimistically and keeps it once the save succeeds", async () => {
    const p = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: null });
    await useProjectStore.getState().updateProject(p.id, { name: "Renamed Shop" });
    const after = useProjectStore.getState().projects.find((x) => x.id === p.id)!;
    expect(after.name).toBe("Renamed Shop");
  });

  it("saveRoute: a failing save rolls back to the pre-edit route and reports the error", async () => {
    const p = await useProjectStore.getState().createProject({ name: "Shop", description: "", templateId: "store" });
    const product = p.models[0];
    await useProjectStore.getState().addRoutes(p.id, buildCrudRoutes(product, ["list"], []));
    const current = useProjectStore.getState().projects.find((x) => x.id === p.id)!.routes[0];
    vi.spyOn(routeService, "update").mockRejectedValueOnce(new Error("Two routes can't share the same method and path."));

    await useProjectStore.getState().saveRoute(p.id, { ...current, description: "Changed" });

    const after = useProjectStore.getState().projects.find((x) => x.id === p.id)!.routes[0];
    expect(after).toEqual(current);
    expect(toast.error).toHaveBeenCalledWith("Two routes can't share the same method and path.");
  });
});
