import { create } from "zustand";
import type { ApiPlan, EditPlan, PlanField } from "@/lib/ai/plan";
import { buildCrudRoutes, type CrudAction } from "@/lib/crud";
import { createId } from "@/lib/ids";
import {
  consoleService,
  modelService,
  projectService,
  routeService,
  type CreateProjectInput,
  type RemovedModel,
  type RemovedProject,
  type RemovedRoute,
} from "@/lib/services";
import type { Field, Model, Project, Route } from "@/lib/types";

const ALL_CRUD: CrudAction[] = ["list", "get", "create", "update", "delete"];

/** A model's records as they stood right before an edit plan replaced them, so an Undo
 * toast can seed them back with `undoEdit`. */
export interface RecordSnapshot {
  modelId: string;
  records: Record<string, unknown>[];
}

/** A removed field plus the resource's records at the moment it was removed, so `undoEdit`
 * can restore the values, not just the column. One entry per removed field, even when
 * several fields were removed from the same resource in the same plan — each carries the
 * same records, snapshotted once before any of that resource's fields were touched. */
export interface RemovedFieldSnapshot {
  modelId: string;
  field: Field;
  records: Record<string, unknown>[];
}

/** Everything `undoEdit` needs to put an applied edit plan's destructive effects back:
 * replaced record sets, removed resources, removed endpoints and removed fields. */
export interface EditUndo {
  replacedRecords: RecordSnapshot[];
  removedModels: RemovedModel[];
  removedRoutes: RemovedRoute[];
  removedFields: RemovedFieldSnapshot[];
}

/** `overrides` win by name (case-insensitive): an existing field keeps its id and gets the
 * plan's values, a new name is appended with a fresh id. Nothing is ever removed. */
function mergeFields(current: Field[], overrides: PlanField[], resourceIds: Map<string, string>): Field[] {
  const merged = current.map((f) => (f.options ? { ...f, options: [...f.options] } : { ...f }));
  for (const o of overrides) {
    const index = merged.findIndex((f) => f.name.toLowerCase() === o.name.toLowerCase());
    const linkTo = o.linkTo ? resourceIds.get(o.linkTo) : undefined;
    const next: Field = { id: index >= 0 ? merged[index].id : createId("fld"), name: o.name, type: o.type, required: o.required, unique: o.unique, ...(o.options ? { options: o.options } : {}), ...(linkTo ? { linkTo } : {}) };
    if (index >= 0) merged[index] = next;
    else merged.push(next);
  }
  return merged;
}

interface ProjectState {
  projects: Project[];
  loaded: boolean;
  loadProjects(): Promise<void>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "slug">>): Promise<void>;
  /** Returns what Undo needs to put back the whole project, including every model's records. */
  deleteProject(id: string): Promise<RemovedProject>;
  restoreProject(removed: RemovedProject): Promise<void>;
  duplicateProject(id: string): Promise<Project>;
  createModel(projectId: string, name: string): Promise<Model>;
  saveModel(projectId: string, model: Model): Promise<void>;
  /** Returns what Undo needs to put back just this model. */
  deleteModel(projectId: string, modelId: string): Promise<RemovedModel>;
  restoreModel(projectId: string, removed: RemovedModel): Promise<void>;
  addRoutes(projectId: string, routes: Route[]): Promise<void>;
  saveRoute(projectId: string, route: Route): Promise<void>;
  /** Returns what Undo needs to put back just this route. */
  deleteRoute(projectId: string, routeId: string): Promise<RemovedRoute>;
  restoreRoute(projectId: string, removed: RemovedRoute): Promise<void>;
  /** Create every resource in an AI plan with its fields, CRUD routes and sample records. */
  applyPlan(projectId: string, plan: ApiPlan): Promise<{ modelIds: string[]; routeCount: number }>;
  /** Merge an AI edit plan into an existing project: new resources are created, existing
   * ones have their fields merged (never overwritten) and endpoints/records added. Replacing
   * an existing resource's records is destructive, so every replaced set is returned in
   * `replacedRecords` for the caller to offer as an Undo toast via `restoreRecords`. */
  applyEditPlan(
    projectId: string,
    plan: EditPlan,
  ): Promise<{
    modelIds: string[];
    newResourceCount: number;
    changedResourceCount: number;
    endpointCount: number;
    undo: EditUndo;
  }>;
  /** Put back everything `applyEditPlan` returned in `undo`, in reverse order (used by Undo). */
  undoEdit(projectId: string, undo: EditUndo): Promise<void>;
}

export const useProjectStore = create<ProjectState>()((set) => {
  const replace = (project: Project) =>
    set((s) => ({
      projects: s.projects.some((p) => p.id === project.id)
        ? s.projects.map((p) => (p.id === project.id ? project : p))
        : [project, ...s.projects],
    }));
  const refresh = async (id: string) => {
    const project = await projectService.get(id);
    if (project) replace(project);
  };

  return {
    projects: [],
    loaded: false,
    async loadProjects() {
      set({ projects: await projectService.list(), loaded: true });
    },
    async createProject(input) {
      const project = await projectService.create(input);
      replace(project);
      return project;
    },
    async updateProject(id, patch) {
      replace(await projectService.update(id, patch));
    },
    async deleteProject(id) {
      const removed = await projectService.remove(id);
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      return removed;
    },
    async restoreProject(removed) {
      await projectService.restore(removed);
      replace(removed.project);
    },
    async duplicateProject(id) {
      const copy = await projectService.duplicate(id);
      replace(copy);
      return copy;
    },
    async createModel(projectId, name) {
      const model = await modelService.create(projectId, name);
      await refresh(projectId);
      return model;
    },
    async saveModel(projectId, model) {
      await modelService.update(projectId, model);
      await refresh(projectId);
    },
    async deleteModel(projectId, modelId) {
      const removed = await modelService.remove(projectId, modelId);
      await refresh(projectId);
      return removed;
    },
    async restoreModel(projectId, removed) {
      await modelService.restore(projectId, removed);
      await refresh(projectId);
    },
    async addRoutes(projectId, routes) {
      await routeService.createMany(projectId, routes);
      await refresh(projectId);
    },
    async saveRoute(projectId, route) {
      await routeService.update(projectId, route);
      await refresh(projectId);
    },
    async deleteRoute(projectId, routeId) {
      const removed = await routeService.remove(projectId, routeId);
      await refresh(projectId);
      return removed;
    },
    async restoreRoute(projectId, removed) {
      await routeService.restore(projectId, removed);
      await refresh(projectId);
    },
    async applyPlan(projectId, plan) {
      // Resumable on purpose: a failed step leaves whatever was already created in place,
      // and running the same plan again picks up where it stopped. Every step is therefore
      // written to be idempotent — a resource with the plan's name is reused rather than
      // created, `buildCrudRoutes` skips endpoints that already exist, and `seedRecords`
      // replaces a model's records. The `finally` refresh means a partial run is still
      // visible in the tree, so the user can see what landed.
      try {
        // Two passes: every resource exists before fields are saved, so a link field can
        // resolve its target's real id even when it points at a later resource.
        const before = await projectService.get(projectId);
        const ids = new Map<string, string>();
        const modelIds: string[] = [];
        let routeCount = 0;
        for (const resource of plan.resources) {
          const existing = before?.models.find((m) => m.name.toLowerCase() === resource.name.toLowerCase());
          const model = existing ?? (await modelService.create(projectId, resource.name));
          ids.set(resource.name, model.id);
          modelIds.push(model.id);
        }
        for (const resource of plan.resources) {
          const id = ids.get(resource.name)!;
          const model: Model = {
            id,
            name: resource.name,
            fields: resource.fields.map((f) => ({
              id: createId("fld"),
              name: f.name,
              type: f.type,
              required: f.required,
              unique: f.unique,
              ...(f.options ? { options: f.options } : {}),
              ...(f.linkTo ? { linkTo: ids.get(f.linkTo) } : {}),
            })),
          };
          await modelService.update(projectId, model);
          const current = await projectService.get(projectId);
          const routes = buildCrudRoutes(model, ALL_CRUD, current?.routes ?? []);
          await routeService.createMany(projectId, routes);
          // Count what the resource ends up with, not just what this attempt created, so a
          // resumed run still reports the whole plan.
          routeCount += ALL_CRUD.length;
          await consoleService.seedRecords(projectId, id, resource.records);
        }
        return { modelIds, routeCount };
      } finally {
        await refresh(projectId);
      }
    },
    async applyEditPlan(projectId, plan) {
      // Resumable and additive, same guarantee as applyPlan: `ids` starts from every
      // existing model (so a link can target one this edit never touches), fields are
      // merged rather than replaced, and standard endpoints/records are only ever added
      // to or replaced for a resource this plan actually names.
      try {
        const before = await projectService.get(projectId);
        if (!before) throw new Error("This API no longer exists.");
        // Names that existed before this call, so a resource created by this same plan
        // (which has nothing to lose) is never mistaken for one whose records are at risk.
        const existingNames = new Set(before.models.map((m) => m.name));
        const ids = new Map<string, string>(before.models.map((m) => [m.name, m.id]));
        let created = 0;
        for (const resource of plan.resources) {
          if (!ids.has(resource.name)) {
            ids.set(resource.name, (await modelService.create(projectId, resource.name)).id);
            created++;
          }
        }
        const modelIds: string[] = [];
        let endpointCount = 0;
        const replacedRecords: RecordSnapshot[] = [];
        for (const resource of plan.resources) {
          const id = ids.get(resource.name)!;
          modelIds.push(id);
          const current = (await projectService.get(projectId))!.models.find((m) => m.id === id)!;
          const merged = mergeFields(current.fields, resource.fields, ids);
          const model: Model = { ...current, fields: merged };
          await modelService.update(projectId, model);
          if (resource.records.length) {
            // seedRecords replaces a model's whole record set. That's the right behaviour for
            // a resource the plan is actively re-describing ("change the statuses to
            // shipped/pending/cancelled"), but it's destructive for an existing resource, so
            // whatever it held is snapshotted first and handed back for an Undo toast.
            if (existingNames.has(resource.name)) {
              const previous = await consoleService.sampleData(projectId, id);
              if (previous.length) replacedRecords.push({ modelId: id, records: previous });
            }
            await consoleService.seedRecords(projectId, id, resource.records);
          }
          const projectNow = (await projectService.get(projectId))!;
          const routes = buildCrudRoutes(model, ALL_CRUD, projectNow.routes);
          await routeService.createMany(projectId, routes);
          endpointCount += routes.length;
        }
        const projectNow = (await projectService.get(projectId))!;
        // Defensive: parseEditPlan already dedupes same method+path within a single answer,
        // but this filter must never depend on that holding true — a second independent
        // duplicate here would otherwise make routeService.createMany throw mid-apply, after
        // fields and records for this same call have already been written (see I2).
        const seenCustom = new Set<string>();
        const customRoutes = plan.customEndpoints
          .filter((c) => {
            const key = `${c.method} ${c.path}`;
            if (seenCustom.has(key)) return false;
            seenCustom.add(key);
            return true;
          })
          .map((c) => ({ ...c, modelId: c.resourceName ? (ids.get(c.resourceName) ?? null) : null }))
          .filter((c) => !projectNow.routes.some((r) => r.method === c.method && r.path === c.path))
          .map((c) => ({ id: createId("rt"), method: c.method, path: c.path, modelId: c.modelId, action: "custom" as const, description: c.description, filters: [] }));
        if (customRoutes.length) {
          await routeService.createMany(projectId, customRoutes);
          endpointCount += customRoutes.length;
        }

        // Removals — always after every addition/change above, so a plan that both adds and
        // removes on the same resource never leaves it momentarily empty. Within removals:
        // fields, then resources, then endpoints — a field removal needs its resource to
        // still exist, and a resource removal already takes its own routes with it, so
        // endpoint removals go last and simply skip anything already gone.
        const removedFields: RemovedFieldSnapshot[] = [];
        const removedModels: RemovedModel[] = [];
        const removedRoutes: RemovedRoute[] = [];

        const fieldRemovalsByResource = new Map<string, string[]>();
        for (const f of plan.removals?.fields ?? []) {
          fieldRemovalsByResource.set(f.resource, [...(fieldRemovalsByResource.get(f.resource) ?? []), f.field]);
        }
        for (const [resourceName, fieldNames] of fieldRemovalsByResource) {
          const current = (await projectService.get(projectId))?.models.find((m) => m.name === resourceName);
          if (!current) continue;
          const toRemove = new Set(fieldNames.map((n) => n.toLowerCase()));
          const removedThisModel = current.fields.filter((f) => toRemove.has(f.name.toLowerCase()));
          if (!removedThisModel.length) continue;
          // Snapshotted once, before this resource's fields are touched, so every field
          // removed from it in this same plan shares the exact same "before" records.
          const records = await consoleService.sampleData(projectId, current.id);
          for (const field of removedThisModel) removedFields.push({ modelId: current.id, field, records });
          await modelService.update(projectId, { ...current, fields: current.fields.filter((f) => !toRemove.has(f.name.toLowerCase())) });
        }

        for (const name of plan.removals?.resources ?? []) {
          const current = (await projectService.get(projectId))?.models.find((m) => m.name === name);
          if (!current) continue;
          removedModels.push(await modelService.remove(projectId, current.id));
        }

        for (const e of plan.removals?.endpoints ?? []) {
          const current = (await projectService.get(projectId))?.routes.find((r) => r.method === e.method && r.path === e.path);
          if (!current) continue;
          removedRoutes.push(await routeService.remove(projectId, current.id));
        }

        const undo: EditUndo = { replacedRecords, removedModels, removedRoutes, removedFields };
        return { modelIds, newResourceCount: created, changedResourceCount: plan.resources.length - created, endpointCount, undo };
      } finally {
        await refresh(projectId);
      }
    },
    async undoEdit(projectId, undo) {
      // Reverse of application order: removals were applied last (endpoints, then resources,
      // then fields), and the additions/changes phase — which is what replacedRecords comes
      // from — ran before any of that, so it's undone last of all.
      for (const removed of undo.removedRoutes) {
        await routeService.restore(projectId, removed);
      }
      for (const removed of undo.removedModels) {
        await modelService.restore(projectId, removed);
      }
      const fieldsByModel = new Map<string, RemovedFieldSnapshot[]>();
      for (const entry of undo.removedFields) {
        fieldsByModel.set(entry.modelId, [...(fieldsByModel.get(entry.modelId) ?? []), entry]);
      }
      for (const [modelId, entries] of fieldsByModel) {
        const current = (await projectService.get(projectId))?.models.find((m) => m.id === modelId);
        if (!current) continue; // the resource itself is gone (e.g. deleted separately since)
        const missing = entries.filter((e) => !current.fields.some((f) => f.id === e.field.id));
        if (missing.length) {
          await modelService.update(projectId, { ...current, fields: [...current.fields, ...missing.map((e) => e.field)] });
        }
        await consoleService.seedRecords(projectId, modelId, entries[0].records);
      }
      for (const { modelId, records } of undo.replacedRecords) {
        await consoleService.seedRecords(projectId, modelId, records);
      }
      await refresh(projectId);
    },
  };
});
