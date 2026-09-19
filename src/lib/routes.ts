import { crudOptions } from "./crud";
import type { Model, Project, Route } from "./types";

export interface RouteGroup {
  key: string;
  title: string;
  model: Model | null;
  routes: Route[];
}

export function groupRoutes(project: Project): RouteGroup[] {
  const groups: RouteGroup[] = project.models.map((m) => ({
    key: `model-${m.id}`,
    title: m.name,
    model: m,
    routes: project.routes.filter((r) => r.modelId === m.id),
  }));
  const other = project.routes.filter((r) => !r.modelId || !project.models.some((m) => m.id === r.modelId));
  if (other.length) groups.push({ key: "other", title: "Other routes", model: null, routes: other });
  return groups;
}

export function uniquePath(routes: Route[], base = "/new-route"): string {
  if (!routes.some((r) => r.path === base)) return base;
  let n = 2;
  while (routes.some((r) => r.path === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function missingCrud(model: Model, routes: Route[]): boolean {
  return crudOptions(model).some((o) => !routes.some((r) => r.method === o.method && r.path === o.path));
}
