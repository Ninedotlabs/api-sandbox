// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiPlan, EditPlan } from "@/lib/ai/plan";
import type { Model, Project } from "@/lib/types";
import { applyEditPlanPg, applyPlanPg } from "./apply-plan";
import { pgModelService } from "./model-service";
import { pgProjectService } from "./project-service";
import { pgRecordService } from "./record-service";
import { pgRouteService } from "./route-service";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A minimal in-memory project that the mocked services read and write, so
 * `pgProjectService.get` reflects whatever the model/route/record mocks just did -
 * exactly what applyPlan/applyEditPlan rely on the real services doing. */
function harness(initial: Project) {
  const project: Project = structuredClone(initial);
  const records: Record<string, Record<string, unknown>[]> = {};

  vi.spyOn(pgProjectService, "get").mockImplementation(async (id) => (id === project.id ? structuredClone(project) : null));
  vi.spyOn(pgModelService, "create").mockImplementation(async (_id, name) => {
    const model: Model = { id: `mdl_${project.models.length + 1}`, name, fields: [] };
    project.models.push(model);
    return model;
  });
  vi.spyOn(pgModelService, "update").mockImplementation(async (_id, model) => {
    project.models = project.models.map((m) => (m.id === model.id ? model : m));
    return model;
  });
  vi.spyOn(pgRouteService, "createMany").mockImplementation(async (_id, routes) => {
    project.routes.push(...routes);
    return routes;
  });
  vi.spyOn(pgRouteService, "remove").mockImplementation(async (_id, routeId) => {
    const index = project.routes.findIndex((r) => r.id === routeId);
    const route = project.routes[index];
    const beforeId = project.routes[index + 1]?.id ?? null;
    project.routes.splice(index, 1);
    return { route, beforeId };
  });
  vi.spyOn(pgModelService, "remove").mockImplementation(async (_id, modelId) => {
    const index = project.models.findIndex((m) => m.id === modelId);
    const model = project.models[index];
    const beforeId = project.models[index + 1]?.id ?? null;
    const removedRoutes = project.routes.filter((r) => r.modelId === modelId);
    project.routes = project.routes.filter((r) => r.modelId !== modelId);
    const links = project.models.flatMap((m) => m.fields.filter((f) => f.linkTo === modelId).map((f) => ({ modelId: m.id, fieldId: f.id })));
    project.models.splice(index, 1);
    const modelRecords = records[modelId] ?? [];
    delete records[modelId];
    return {
      model,
      beforeId,
      routes: removedRoutes.map((route) => ({ route, beforeId: null })),
      links,
      records: modelRecords,
    };
  });
  vi.spyOn(pgRecordService, "seedRecords").mockImplementation(async (_id, modelId, recs) => {
    records[modelId] = recs.map((r, i) => ({ id: String(i + 1), ...r }));
  });
  vi.spyOn(pgRecordService, "sampleData").mockImplementation(async (_id, modelId) => records[modelId] ?? []);

  return { project, records };
}

function emptyProject(id = "prj_1"): Project {
  return { id, name: "Bookshop", slug: "bookshop", description: "", models: [], routes: [], createdAt: "t", updatedAt: "t" };
}

describe("applyPlanPg", () => {
  it("creates a model per resource with its fields, CRUD routes and records", async () => {
    const { project, records } = harness(emptyProject());
    const plan: ApiPlan = {
      resources: [
        {
          name: "Book",
          description: "",
          fields: [{ name: "title", type: "text", required: true, unique: false }],
          records: [{ title: "Dune" }],
        },
      ],
    };

    const result = await applyPlanPg("prj_1", plan);

    expect(project.models).toHaveLength(1);
    expect(project.models[0].name).toBe("Book");
    expect(project.models[0].fields.map((f) => f.name)).toEqual(["title"]);
    expect(project.routes).toHaveLength(5);
    expect(records[project.models[0].id]).toEqual([{ id: "1", title: "Dune" }]);
    expect(result).toEqual({ modelIds: [project.models[0].id], routeCount: 5 });
  });

  it("reuses an existing model with a matching name instead of creating a duplicate", async () => {
    const existing: Project = { ...emptyProject(), models: [{ id: "mdl_existing", name: "Book", fields: [] }] };
    const { project } = harness(existing);
    const plan: ApiPlan = { resources: [{ name: "book", description: "", fields: [], records: [] }] };

    const result = await applyPlanPg("prj_1", plan);

    expect(project.models).toHaveLength(1);
    expect(result.modelIds).toEqual(["mdl_existing"]);
  });

  it("resolves a link field to the id of another resource in the same plan", async () => {
    const { project } = harness(emptyProject());
    const plan: ApiPlan = {
      resources: [
        { name: "Author", description: "", fields: [], records: [] },
        { name: "Book", description: "", fields: [{ name: "author", type: "link", required: false, unique: false, linkTo: "Author" }], records: [] },
      ],
    };

    await applyPlanPg("prj_1", plan);

    const author = project.models.find((m) => m.name === "Author")!;
    const book = project.models.find((m) => m.name === "Book")!;
    expect(book.fields[0].linkTo).toBe(author.id);
  });
});

describe("applyEditPlanPg", () => {
  it("throws a plain-language error when the project no longer exists", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValue(null);
    const plan: EditPlan = { resources: [], customEndpoints: [] };
    await expect(applyEditPlanPg("missing", plan)).rejects.toThrow("This API no longer exists.");
  });

  it("creates a new resource and reports it as created, not changed", async () => {
    const { project } = harness(emptyProject());
    const plan: EditPlan = {
      resources: [{ name: "Book", description: "", fields: [{ name: "title", type: "text", required: true, unique: false }], records: [] }],
      customEndpoints: [],
    };

    const result = await applyEditPlanPg("prj_1", plan);

    expect(project.models).toHaveLength(1);
    expect(result.newResourceCount).toBe(1);
    expect(result.changedResourceCount).toBe(0);
  });

  it("merges fields into an existing resource without dropping fields the plan doesn't mention", async () => {
    const existing: Project = {
      ...emptyProject(),
      models: [{ id: "mdl_book", name: "Book", fields: [{ id: "fld_isbn", name: "isbn", type: "text", required: false, unique: false }] }],
    };
    const { project } = harness(existing);
    const plan: EditPlan = {
      resources: [{ name: "Book", description: "", fields: [{ name: "genre", type: "text", required: false, unique: false }], records: [] }],
      customEndpoints: [],
    };

    const result = await applyEditPlanPg("prj_1", plan);

    const book = project.models.find((m) => m.id === "mdl_book")!;
    expect(book.fields.map((f) => f.name).sort()).toEqual(["genre", "isbn"]);
    expect(result.newResourceCount).toBe(0);
    expect(result.changedResourceCount).toBe(1);
  });

  it("snapshots an existing resource's records before replacing them, for undo", async () => {
    const existing: Project = { ...emptyProject(), models: [{ id: "mdl_book", name: "Book", fields: [] }] };
    const { records } = harness(existing);
    records["mdl_book"] = [{ id: "1", title: "Old" }];
    const plan: EditPlan = {
      resources: [{ name: "Book", description: "", fields: [], records: [{ title: "New" }] }],
      customEndpoints: [],
    };

    const result = await applyEditPlanPg("prj_1", plan);

    expect(result.undo.replacedRecords).toEqual([{ modelId: "mdl_book", records: [{ id: "1", title: "Old" }] }]);
    expect(records["mdl_book"]).toEqual([{ id: "1", title: "New" }]);
  });

  it("adds a custom endpoint, skipping one that collides with an existing route", async () => {
    const existing: Project = {
      ...emptyProject(),
      routes: [{ id: "rte_existing", method: "GET", path: "/ping", modelId: null, action: "custom", description: "", filters: [] }],
    };
    const { project } = harness(existing);
    const plan: EditPlan = {
      resources: [],
      customEndpoints: [
        { method: "GET", path: "/ping", resourceName: null, description: "dup" },
        { method: "GET", path: "/status", resourceName: null, description: "new" },
      ],
    };

    const result = await applyEditPlanPg("prj_1", plan);

    const paths = project.routes.map((r) => `${r.method} ${r.path}`);
    expect(paths).toEqual(["GET /ping", "GET /status"]);
    expect(result.endpointCount).toBe(1);
  });

  // C2: this endpoint used to silently ignore `plan.removals`. These mirror the store's
  // "edit: removals" tests one for one, so the two paths are exercised the same way.
  describe("removals", () => {
    function seededShop(): Project {
      return {
        ...emptyProject(),
        models: [
          {
            id: "mdl_book",
            name: "Book",
            fields: [
              { id: "fld_title", name: "title", type: "text", required: true, unique: false },
              { id: "fld_genre", name: "genre", type: "text", required: false, unique: false },
            ],
          },
        ],
        routes: [
          { id: "rt_list", method: "GET", path: "/books", modelId: "mdl_book", action: "list", description: "", filters: [] },
          { id: "rt_get", method: "GET", path: "/books/:id", modelId: "mdl_book", action: "get", description: "", filters: [] },
        ],
      };
    }

    it("removes a field, snapshotting the resource's records for undo", async () => {
      const { project, records } = harness(seededShop());
      records["mdl_book"] = [{ id: "1", title: "Dune", genre: "Sci-fi" }];
      const plan: EditPlan = { resources: [], customEndpoints: [], removals: { resources: [], fields: [{ resource: "Book", field: "genre" }], endpoints: [] } };

      const result = await applyEditPlanPg("prj_1", plan);

      const book = project.models.find((m) => m.id === "mdl_book")!;
      expect(book.fields.map((f) => f.name)).toEqual(["title"]);
      expect(result.undo.removedFields).toEqual([
        { modelId: "mdl_book", field: { id: "fld_genre", name: "genre", type: "text", required: false, unique: false }, records: [{ id: "1", title: "Dune", genre: "Sci-fi" }] },
      ]);
    });

    it("removes a resource, returning it (with its routes, links and records) in undo", async () => {
      const { project, records } = harness(seededShop());
      records["mdl_book"] = [{ id: "1", title: "Dune" }];
      const plan: EditPlan = { resources: [], customEndpoints: [], removals: { resources: ["Book"], fields: [], endpoints: [] } };

      const result = await applyEditPlanPg("prj_1", plan);

      expect(project.models.some((m) => m.id === "mdl_book")).toBe(false);
      expect(project.routes.some((r) => r.modelId === "mdl_book")).toBe(false);
      expect(result.undo.removedModels).toHaveLength(1);
      expect(result.undo.removedModels[0].model.id).toBe("mdl_book");
      expect(result.undo.removedModels[0].records).toEqual([{ id: "1", title: "Dune" }]);
    });

    it("removes an endpoint, returning it in undo", async () => {
      const { project } = harness(seededShop());
      const plan: EditPlan = { resources: [], customEndpoints: [], removals: { resources: [], fields: [], endpoints: [{ method: "GET", path: "/books/:id" }] } };

      const result = await applyEditPlanPg("prj_1", plan);

      expect(project.routes.some((r) => r.id === "rt_get")).toBe(false);
      expect(result.undo.removedRoutes).toEqual([{ route: { id: "rt_get", method: "GET", path: "/books/:id", modelId: "mdl_book", action: "get", description: "", filters: [] }, beforeId: null }]);
    });

    it("performs additions and changes before removals, so a plan replacing one field with another never leaves the resource empty", async () => {
      const { project } = harness(seededShop());
      const plan: EditPlan = {
        resources: [{ name: "Book", description: "", fields: [{ name: "subtitle", type: "text", required: false, unique: false }], records: [] }],
        customEndpoints: [],
        removals: { resources: [], fields: [{ resource: "Book", field: "genre" }], endpoints: [] },
      };

      const result = await applyEditPlanPg("prj_1", plan);

      const book = project.models.find((m) => m.id === "mdl_book")!;
      expect(book.fields.map((f) => f.name)).toEqual(["title", "subtitle"]);
      expect(result.undo.removedFields).toHaveLength(1);
    });
  });
});
