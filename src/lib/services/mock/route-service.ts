import { validateRoute } from "@/lib/validation";
import type { RouteService } from "../types";
import { updateProject } from "./db";
import { delay } from "./latency";

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
    updateProject(projectId, (p) => ({ ...p, routes: p.routes.filter((r) => r.id !== routeId) }));
    return delay(undefined);
  },
};
