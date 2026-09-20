import { create } from "zustand";
import type { ApiPlan } from "@/lib/ai/plan";
import { buildCrudRoutes, type CrudAction } from "@/lib/crud";
import { createId } from "@/lib/ids";
import {
  consoleService,
  modelService,
  projectService,
  routeService,
  type CreateProjectInput,
  type RemovedModel,
  type RemovedRoute,
} from "@/lib/services";
import type { Model, Project, Route } from "@/lib/types";

const ALL_CRUD: CrudAction[] = ["list", "get", "create", "update", "delete"];

interface ProjectState {
  projects: Project[];
  loaded: boolean;
  loadProjects(): Promise<void>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "slug">>): Promise<void>;
  deleteProject(id: string): Promise<Project>;
  restoreProject(project: Project): Promise<void>;
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
}

export const useProjectStore = create<ProjectState>()((set, get) => {
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
  const snapshot = (id: string): Project => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) throw new Error("Project is not loaded");
    return project;
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
      const previous = snapshot(id);
      await projectService.remove(id);
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      return previous;
    },
    async restoreProject(project) {
      await projectService.restore(project);
      replace(project);
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
  };
});
