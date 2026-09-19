import { create } from "zustand";
import {
  modelService,
  projectService,
  routeService,
  type CreateProjectInput,
  type RemovedModel,
  type RemovedRoute,
} from "@/lib/services";
import type { Model, Project, Route } from "@/lib/types";

interface ProjectState {
  projects: Project[];
  loaded: boolean;
  loadProjects(): Promise<void>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "slug">>): Promise<void>;
  deleteProject(id: string): Promise<Project>;
  restoreProject(project: Project): Promise<void>;
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
  };
});
