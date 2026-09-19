import { insertBefore } from "@/lib/arrays";
import type { Route } from "@/lib/types";
import { validateRoute } from "@/lib/validation";
import type { RemovedRoute, RouteService } from "../types";
import { updateProject } from "./db";
import { delay } from "./latency";

/** Put removed routes back in place. Walks backwards so neighbours removed together keep their order. */
export function restoreRoutes(routes: Route[], removed: RemovedRoute[]): Route[] {
  let all = routes;
  for (const { route, beforeId } of removed.slice().reverse()) {
    const err = validateRoute(route, all);
    if (err) throw new Error(`Could not bring back ${route.method} ${route.path}. ${err}`);
    all = insertBefore(all, route, beforeId);
  }
  return all;
}

export const mockRouteService: RouteService = {
  async createMany(projectId, routes) {
    updateProject(projectId, (p) => {
      const all = [...p.routes];
      for (const route of routes) {
        const err = validateRoute(route, all);
        if (err) throw new Error(err);
        all.push(route);
      }
      return { ...p, routes: all };
    });
    return delay(routes);
  },

  async update(projectId, route) {
    updateProject(projectId, (p) => {
      const err = validateRoute(route, p.routes);
      if (err) throw new Error(err);
      return { ...p, routes: p.routes.map((r) => (r.id === route.id ? route : r)) };
    });
    return delay(route);
  },

  async remove(projectId, routeId) {
    let removed: RemovedRoute | undefined;
    updateProject(projectId, (p) => {
      const index = p.routes.findIndex((r) => r.id === routeId);
      if (index < 0) throw new Error("This route no longer exists.");
      removed = { route: p.routes[index], beforeId: p.routes[index + 1]?.id ?? null };
      return { ...p, routes: p.routes.filter((r) => r.id !== routeId) };
    });
    return delay(removed as RemovedRoute);
  },

  async restore(projectId, removed) {
    updateProject(projectId, (p) => ({ ...p, routes: restoreRoutes(p.routes, [removed]) }));
    return delay(removed.route);
  },
};
