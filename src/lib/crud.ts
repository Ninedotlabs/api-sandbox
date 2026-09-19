import { createId } from "./ids";
import { article, pluralize, resourcePath } from "./slug";
import type { HttpMethod, Model, Route, RouteAction } from "./types";

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
