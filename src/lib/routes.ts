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

/**
 * Matches an incoming method and path (already split into segments, e.g. from a
 * catch-all route's `path` param) against a project's routes, extracting any
 * `:param` segment values along the way. Segments starting with `:` are the same
 * convention `routeParams`/`fillPath` (`./paths.ts`) use for the other direction
 * (filling a pattern with concrete values); this is the reverse - matching a
 * concrete path back to its pattern.
 *
 * Multiple routes can match the same segments (`/books/:id` and `/books/best-selling`
 * both match `["books", "best-selling"]`). Rather than taking whichever comes first in
 * `routes` - which makes a route's reachability depend on array order, and silently
 * shadows more specific routes added later, such as an AI-generated custom endpoint -
 * every match is ranked by specificity (more literal segments wins) and the most
 * specific one is returned. Ties fall back to `routes` order, which callers pass in
 * `position` order, so the result stays deterministic.
 */
export function matchRoute(
  routes: Route[],
  method: string,
  segments: string[],
): { route: Route; params: Record<string, string> } | null {
  let best: { route: Route; params: Record<string, string>; literalCount: number } | null = null;

  for (const route of routes) {
    if (route.method !== method) continue;
    const routeSegments = route.path.split("/").filter(Boolean);
    if (routeSegments.length !== segments.length) continue;
    const params: Record<string, string> = {};
    let literalCount = 0;
    const matched = routeSegments.every((seg, i) => {
      if (seg.startsWith(":")) {
        params[seg.slice(1)] = segments[i];
        return true;
      }
      if (seg !== segments[i]) return false;
      literalCount++;
      return true;
    });
    if (matched && (!best || literalCount > best.literalCount)) {
      best = { route, params, literalCount };
    }
  }

  return best ? { route: best.route, params: best.params } : null;
}
