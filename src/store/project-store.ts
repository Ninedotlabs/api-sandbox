import { create } from "zustand";
import type { ApiPlan, EditPlan } from "@/lib/ai/plan";
import {
  applyEditPlan as applyEditPlanShared,
  applyPlan as applyPlanShared,
  type EditUndo,
  type RemovedFieldSnapshot,
} from "@/lib/services/apply-plan";
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
import type { Model, Project, Route } from "@/lib/types";

export type { EditUndo, RecordSnapshot, RemovedFieldSnapshot } from "@/lib/services/apply-plan";

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
      // The `finally` refresh means a partial run is still visible in the tree, so the user
      // can see what landed even if a step below throws. The algorithm itself - resumable,
      // idempotent steps - lives in the shared `applyPlan`; see its own comment.
      try {
        return await applyPlanShared({ projectService, modelService, routeService, records: consoleService }, projectId, plan);
      } finally {
        await refresh(projectId);
      }
    },
    async applyEditPlan(projectId, plan) {
      try {
        return await applyEditPlanShared({ projectService, modelService, routeService, records: consoleService }, projectId, plan);
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
