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
  /** Put back a previously deleted or changed project (used by Undo). */
  restore(project: Project): Promise<void>;
}

export interface ModelService {
  create(projectId: string, name: string): Promise<Model>;
  update(projectId: string, model: Model): Promise<Model>;
  remove(projectId: string, modelId: string): Promise<void>;
}

export interface RouteService {
  createMany(projectId: string, routes: Route[]): Promise<Route[]>;
  update(projectId: string, route: Route): Promise<Route>;
  remove(projectId: string, routeId: string): Promise<void>;
}

export interface ConsoleService {
  send(projectId: string, request: TestRequest): Promise<TestResponse>;
  sampleData(projectId: string, modelId: string): Promise<Record<string, unknown>[]>;
  reset(projectId: string): Promise<void>;
}
