import { buildCrudRoutes } from "@/lib/crud";
import { buildDocs } from "@/lib/docs";
import { consoleService } from "@/lib/services";
import { resetMockDatasets } from "@/lib/services/mock/console-service";
import { setMockLatency } from "@/lib/services/mock/latency";
import { useProjectStore } from "@/store/project-store";

beforeEach(() => {
  setMockLatency(0);
  resetMockDatasets();
  useProjectStore.setState({ projects: [], loaded: false });
});

it("store template → add field → CRUD → 400 → 201 → list → docs", async () => {
  const store = useProjectStore.getState();
  const project = await store.createProject({ name: "My Store", description: "", templateId: "store" });
  const product = project.models.find((m) => m.name === "Product")!;

  await store.saveModel(project.id, {
    ...product,
    fields: [...product.fields, { id: "f-color", name: "color", type: "text", required: false, unique: false }],
  });
  const updatedProduct = useProjectStore.getState().projects[0].models.find((m) => m.id === product.id)!;
  expect(updatedProduct.fields.map((f) => f.name)).toContain("color");

  await store.addRoutes(project.id, buildCrudRoutes(updatedProduct, ["list", "get", "create", "update", "delete"], []));
  const current = useProjectStore.getState().projects[0];
  const create = current.routes.find((r) => r.action === "create")!;
  const list = current.routes.find((r) => r.action === "list")!;

  const bad = await consoleService.send(project.id, { routeId: create.id, params: {}, query: {}, body: { price: 10 } });
  expect(bad.status).toBe(400);
  const ok = await consoleService.send(project.id, {
    routeId: create.id, params: {}, query: {}, body: { name: "Lamp", price: 10, color: "red" },
  });
  expect(ok.status).toBe(201);
  const all = await consoleService.send(project.id, { routeId: list.id, params: {}, query: {}, body: undefined });
  expect((all.body as { data: { name: string }[] }).data.some((r) => r.name === "Lamp")).toBe(true);

  const productDocs = buildDocs(current).find((s) => s.title === "Product")!;
  expect(productDocs.endpoints).toHaveLength(5);
});
