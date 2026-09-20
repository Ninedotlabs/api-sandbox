/**
 * C2: `applyEditPlan` used to be forked - a hand-ported copy in `pg/apply-plan.ts` had no
 * removals support at all, so "remove the email field from Author" worked through the store
 * but silently did nothing through `/api/v1/projects/:id/ai/edit`. Both now call the one
 * shared `applyEditPlan` in `apply-plan.ts`. This test is the point of that unification: it
 * applies the *same* `EditPlan` - a field removal, a resource removal and an endpoint removal
 * together - through both the store (backed by the mock services) and `applyEditPlanPg`
 * (backed by mocked `pg` services), and asserts they land on the same resulting project shape
 * and the same undo payload. Without this test, the two call sites could still drift again
 * without anything noticing.
 *
 * Model/field/route ids are assigned independently by each backend, so the comparison is
 * normalised to names and structure rather than raw ids - that's the only thing that's
 * legitimately backend-specific here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditPlan } from "@/lib/ai/plan";
import { buildCrudRoutes } from "@/lib/crud";
import { consoleService } from "@/lib/services";
import { setMockLatency } from "@/lib/services/mock/latency";
import { applyEditPlanPg } from "@/lib/services/pg/apply-plan";
import { pgModelService } from "@/lib/services/pg/model-service";
import { pgProjectService } from "@/lib/services/pg/project-service";
import { pgRecordService } from "@/lib/services/pg/record-service";
import { pgRouteService } from "@/lib/services/pg/route-service";
import type { Field, HttpMethod, Model, Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

afterEach(() => {
  vi.restoreAllMocks();
});

function planRemoving(endpoint: { method: HttpMethod; path: string }): EditPlan {
  return {
    resources: [],
    customEndpoints: [],
    removals: {
      resources: ["Order"],
      fields: [{ resource: "Book", field: "genre" }],
      endpoints: [{ method: endpoint.method, path: endpoint.path }],
    },
  };
}

function normalizeFields(fields: Field[]) {
  return fields
    .map((f) => ({ name: f.name, type: f.type, required: f.required, unique: f.unique }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeProject(project: Project) {
  return {
    models: [...project.models]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((m) => ({ name: m.name, fields: normalizeFields(m.fields) })),
    routes: [...project.routes]
      .map((r) => ({ method: r.method, path: r.path, action: r.action, modelName: r.modelId ? project.models.find((m) => m.id === r.modelId)?.name ?? null : null }))
      .sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`)),
  };
}

function normalizeUndo(undo: {
  replacedRecords: { modelId: string; records: Record<string, unknown>[] }[];
  removedModels: { model: Model; records: Record<string, unknown>[] }[];
  removedRoutes: { route: Route }[];
  removedFields: { field: Field; records: Record<string, unknown>[] }[];
}) {
  return {
    replacedRecords: undo.replacedRecords,
    removedModels: undo.removedModels
      .map((rm) => ({ name: rm.model.name, fields: normalizeFields(rm.model.fields), records: rm.records }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    removedRoutes: undo.removedRoutes.map((rr) => ({ method: rr.route.method, path: rr.route.path, action: rr.route.action })),
    removedFields: undo.removedFields
      .map((rf) => ({ field: rf.field.name, type: rf.field.type, records: rf.records }))
      .sort((a, b) => a.field.localeCompare(b.field)),
  };
}

describe("applyEditPlan unification", () => {
  it("applying the same removal-only edit plan through the store and through applyEditPlanPg produces the same project and the same undo", async () => {
    // --- store side: real mock services via the Zustand store ---
    setMockLatency(0);
    useProjectStore.setState({ projects: [], loaded: false });
    const storeProject = await useProjectStore.getState().createProject({ name: `Shop ${Math.random()}`, description: "", templateId: null });
    const storeBook = await useProjectStore.getState().createModel(storeProject.id, "Book");
    await useProjectStore.getState().saveModel(storeProject.id, {
      ...storeBook,
      fields: [
        { id: "f-title", name: "title", type: "text", required: true, unique: false },
        { id: "f-genre", name: "genre", type: "text", required: false, unique: false },
      ],
    });
    await consoleService.seedRecords(storeProject.id, storeBook.id, [{ title: "Dune", genre: "Sci-fi" }]);
    await useProjectStore.getState().addRoutes(storeProject.id, buildCrudRoutes({ ...storeBook, fields: [] }, ["list", "get"], []));
    const storeOrder = await useProjectStore.getState().createModel(storeProject.id, "Order");
    await useProjectStore.getState().saveModel(storeProject.id, {
      ...storeOrder,
      fields: [{ id: "f-book", name: "book", type: "link", required: true, unique: false, linkTo: storeBook.id }],
    });
    await consoleService.seedRecords(storeProject.id, storeOrder.id, [{ book: "1" }]);
    const storeBefore = useProjectStore.getState().projects.find((p) => p.id === storeProject.id)!;
    const storeTarget = storeBefore.routes.find((r) => r.modelId === storeBook.id && r.action === "get")!;

    const storeResult = await useProjectStore.getState().applyEditPlan(storeProject.id, planRemoving(storeTarget));
    const storeAfter = useProjectStore.getState().projects.find((p) => p.id === storeProject.id)!;

    // --- pg side: same shape, built directly against mocked pg services ---
    let pgProject: Project = {
      id: "prj_pg",
      name: "Shop",
      slug: "shop",
      description: "",
      models: [
        {
          id: "mdl_book",
          name: "Book",
          fields: [
            { id: "fld_title", name: "title", type: "text", required: true, unique: false },
            { id: "fld_genre", name: "genre", type: "text", required: false, unique: false },
          ],
        },
        {
          id: "mdl_order",
          name: "Order",
          fields: [{ id: "fld_book", name: "book", type: "link", required: true, unique: false, linkTo: "mdl_book" }],
        },
      ],
      routes: [],
      createdAt: "t",
      updatedAt: "t",
    };
    pgProject.routes = buildCrudRoutes({ ...pgProject.models[0], fields: [] }, ["list", "get"], []);
    const pgRecords: Record<string, Record<string, unknown>[]> = {
      mdl_book: [{ id: "1", title: "Dune", genre: "Sci-fi" }],
      mdl_order: [{ id: "1", book: "1" }],
    };
    const pgTarget = pgProject.routes.find((r) => r.modelId === "mdl_book" && r.action === "get")!;

    vi.spyOn(pgProjectService, "get").mockImplementation(async (id) => (id === "prj_pg" ? structuredClone(pgProject) : null));
    vi.spyOn(pgModelService, "update").mockImplementation(async (_id, model) => {
      pgProject = { ...pgProject, models: pgProject.models.map((m) => (m.id === model.id ? model : m)) };
      return model;
    });
    vi.spyOn(pgModelService, "remove").mockImplementation(async (_id, modelId) => {
      const model = pgProject.models.find((m) => m.id === modelId)!;
      const removedRoutes = pgProject.routes.filter((r) => r.modelId === modelId);
      pgProject = { ...pgProject, models: pgProject.models.filter((m) => m.id !== modelId), routes: pgProject.routes.filter((r) => r.modelId !== modelId) };
      const modelRecords = pgRecords[modelId] ?? [];
      delete pgRecords[modelId];
      return { model, beforeId: null, routes: removedRoutes.map((route) => ({ route, beforeId: null })), links: [], records: modelRecords };
    });
    vi.spyOn(pgRouteService, "createMany").mockImplementation(async (_id, routes) => {
      pgProject = { ...pgProject, routes: [...pgProject.routes, ...routes] };
      return routes;
    });
    vi.spyOn(pgRouteService, "remove").mockImplementation(async (_id, routeId) => {
      const route = pgProject.routes.find((r) => r.id === routeId)!;
      pgProject = { ...pgProject, routes: pgProject.routes.filter((r) => r.id !== routeId) };
      return { route, beforeId: null };
    });
    vi.spyOn(pgRecordService, "sampleData").mockImplementation(async (_id, modelId) => pgRecords[modelId] ?? []);
    vi.spyOn(pgRecordService, "seedRecords").mockImplementation(async (_id, modelId, recs) => {
      pgRecords[modelId] = recs.map((r, i) => ({ id: String(i + 1), ...r }));
    });

    const pgResult = await applyEditPlanPg("prj_pg", planRemoving(pgTarget));

    // --- same resulting project shape ---
    expect(normalizeProject(storeAfter)).toEqual(normalizeProject(pgProject));

    // --- same undo payload ---
    expect(normalizeUndo(storeResult.undo)).toEqual(normalizeUndo(pgResult.undo));

    // Sanity: this actually exercised all three kinds of removal on both sides.
    expect(normalizeProject(storeAfter).models.find((m) => m.name === "Book")!.fields.map((f) => f.name)).toEqual(["title"]);
    expect(storeAfter.models.some((m) => m.name === "Order")).toBe(false);
    expect(pgProject.models.some((m) => m.name === "Order")).toBe(false);
  });
});
