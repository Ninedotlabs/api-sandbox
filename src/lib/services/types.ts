import type { HttpMethod, Model, Project, Route, TemplateId, TestRequest, TestResponse } from "@/lib/types";

export interface CreateProjectInput {
  name: string;
  description: string;
  templateId: TemplateId | null;
}

export interface ProjectService {
  list(ownerId?: string): Promise<Project[]>;
  get(id: string, ownerId?: string): Promise<Project | null>;
  create(input: CreateProjectInput, ownerId?: string): Promise<Project>;
  update(id: string, patch: Partial<Pick<Project, "name" | "description" | "slug">>): Promise<Project>;
  /** Deletes the project and everything under it (models, fields, routes, records — `records.model_id`
   * is `ON DELETE CASCADE`), returning what Undo needs to put it all back. */
  remove(id: string): Promise<RemovedProject>;
  /** Put back a previously deleted project and its records (used by Undo). */
  restore(removed: RemovedProject, ownerId?: string): Promise<void>;
  /**
   * Deep-copies a project: fresh ids for the project, every model, field and route
   * (`field.linkTo`/`route.modelId` remapped to the new ids), named `<name> copy` (`copy 2`,
   * `copy 3`… when taken), with its sample dataset copied and rekeyed to the new model ids.
   * The copy belongs to `ownerId`; `anyOwner` lets an admin copy a project they don't own.
   */
  duplicate(id: string, ownerId?: string, options?: { anyOwner?: boolean }): Promise<Project>;
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
  /** The model's records at the time it was removed (`records.model_id` is `ON DELETE
   * CASCADE`, so they'd otherwise be gone for good), so Undo can put them back with their
   * original ids. Empty when the model held no records. */
  records: Record<string, unknown>[];
}

/** A deleted project plus the records held by its models, so Undo can put the whole thing
 * back — a `Project` alone carries no record data, and `records.model_id` is `ON DELETE
 * CASCADE`. Models that held no records are left out rather than listed with an empty array. */
export interface RemovedProject {
  project: Project;
  records: { modelId: string; records: Record<string, unknown>[] }[];
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

/** A single sent request, kept for the session's console log. */
export interface LogEntry {
  id: string;
  at: string;
  routeId: string;
  method: HttpMethod;
  path: string;
  request: TestRequest;
  response: TestResponse;
}

export interface ConsoleService {
  send(projectId: string, request: TestRequest): Promise<TestResponse>;
  sampleData(projectId: string, modelId: string): Promise<Record<string, unknown>[]>;
  /** Replace this model's records in the mock dataset; missing ids become "1", "2" … */
  seedRecords(projectId: string, modelId: string, records: Record<string, unknown>[]): Promise<void>;
  reset(projectId: string): Promise<void>;
  /** The session's sent requests for this project, newest first (max 50). */
  log(projectId: string): Promise<LogEntry[]>;
  clearLog(projectId: string): Promise<void>;
}
