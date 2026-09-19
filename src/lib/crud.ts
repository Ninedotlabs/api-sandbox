import { createId } from "./ids";
import { article, pluralize, resourcePath } from "./slug";
import type { HttpMethod, Model, Project, Route, RouteAction } from "./types";

export type CrudAction = Exclude<RouteAction, "custom">;

export interface CrudOption {
  action: CrudAction;
  method: HttpMethod;
  path: string;
  label: string;
}

export function crudOptions(model: Model): CrudOption[] {
  const base = resourcePath(model.name);
  const plural = pluralize(model.name);
  const one = model.name.toLowerCase();
  const a = article(one);
  return [
    { action: "list", method: "GET", path: base, label: `List all ${plural}` },
    { action: "get", method: "GET", path: `${base}/:id`, label: `Get one ${one}` },
    { action: "create", method: "POST", path: base, label: `Add ${a} ${one}` },
    { action: "update", method: "PUT", path: `${base}/:id`, label: `Update ${a} ${one}` },
    { action: "delete", method: "DELETE", path: `${base}/:id`, label: `Delete ${a} ${one}` },
  ];
}

export function buildCrudRoutes(model: Model, actions: CrudAction[], existing: Route[]): Route[] {
  return crudOptions(model)
    .filter((o) => actions.includes(o.action))
    .filter((o) => !existing.some((r) => r.method === o.method && r.path === o.path))
    .map((o) => ({
      id: createId("rt"),
      method: o.method,
      path: o.path,
      modelId: model.id,
      action: o.action,
      description: o.label,
      filters: [],
    }));
}

const ALL_ACTIONS: CrudAction[] = ["list", "get", "create", "update", "delete"];

/** Every standard endpoint that any model in the project is still missing, model by model in canonical order. */
export function generateAllCrud(project: Project): Route[] {
  const existing = [...project.routes];
  const out: Route[] = [];
  for (const model of project.models) {
    const routes = buildCrudRoutes(model, ALL_ACTIONS, existing);
    existing.push(...routes);
    out.push(...routes);
  }
  return out;
}
