import type { Model, Project, Route, TemplateId, TestRequest, TestResponse } from "@/lib/types";

export interface CreateProjectInput {
  name: string;
  description: string;
  templateId: TemplateId | null;
}

export interface ProjectService {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(id: string, patch: Partial<Pick<Project, "name" | "description" | "slug">>): Promise<Project>;
  remove(id: string): Promise<void>;
  /** Put back a previously deleted project (used by Undo). */
  restore(project: Project): Promise<void>;
}

/** A deleted route plus where it sat, so Undo can put just that route back. */
export interface RemovedRoute {
  route: Route;
  /** The route that followed it, or null if it was last. */
  beforeId: string | null;
}

/** A deleted model plus everything removed with it, so Undo can put just that back. */
export interface RemovedModel {
  model: Model;
  beforeId: string | null;
  routes: RemovedRoute[];
  /** Link fields on other models that pointed at this model. */
  links: { modelId: string; fieldId: string }[];
}

export interface ModelService {
  create(projectId: string, name: string): Promise<Model>;
  update(projectId: string, model: Model): Promise<Model>;
  remove(projectId: string, modelId: string): Promise<RemovedModel>;
  /** Put back a deleted model, its routes and links (used by Undo). */
  restore(projectId: string, removed: RemovedModel): Promise<Model>;
}

export interface RouteService {
  createMany(projectId: string, routes: Route[]): Promise<Route[]>;
  update(projectId: string, route: Route): Promise<Route>;
  remove(projectId: string, routeId: string): Promise<RemovedRoute>;
  /** Put back a deleted route (used by Undo). */
  restore(projectId: string, removed: RemovedRoute): Promise<Route>;
}

export interface ConsoleService {
  send(projectId: string, request: TestRequest): Promise<TestResponse>;
  sampleData(projectId: string, modelId: string): Promise<Record<string, unknown>[]>;
  reset(projectId: string): Promise<void>;
}
