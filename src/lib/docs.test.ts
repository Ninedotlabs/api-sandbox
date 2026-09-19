import { buildCrudRoutes } from "./crud";
import { buildDocs } from "./docs";
import { buildTemplateModels } from "./templates";
import type { Project } from "./types";

it("documents each model's routes with examples", () => {
  const models = buildTemplateModels("store");
  const product = models[0];
  const routes = [
    ...buildCrudRoutes(product, ["list", "get", "create", "update", "delete"], []),
    { id: "x", method: "GET" as const, path: "/ping", modelId: null, action: "custom" as const, description: "Ping", filters: [] },
  ];
  const project: Project = { id: "p", name: "Store", slug: "store", description: "", models, routes, createdAt: "", updatedAt: "" };

  const sections = buildDocs(project);
  expect(sections.map((s) => [s.title, s.endpoints.length])).toEqual([["Product", 5], ["Other routes", 1]]);
  const create = sections[0].endpoints.find((e) => e.route.action === "create")!;
  expect(create.request).toHaveProperty("name");
  expect(create.response.status).toBe(201);
  expect(sections[0].endpoints.find((e) => e.route.action === "list")!.request).toBeNull();
});
