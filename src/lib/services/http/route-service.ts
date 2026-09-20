import type { RouteService } from "../types";
import { apiFetch } from "./client";

/** Mirrors `mock/route-service.ts` method for method, each one a `fetch` against the
 * matching `/api/v1/projects/:id/routes` endpoint. */
export const httpRouteService: RouteService = {
  createMany(projectId, routes) {
    return apiFetch(`/api/v1/projects/${projectId}/routes`, { method: "POST", body: JSON.stringify({ routes }) });
  },

  update(projectId, route) {
    return apiFetch(`/api/v1/projects/${projectId}/routes/${route.id}`, { method: "PATCH", body: JSON.stringify(route) });
  },

  remove(projectId, routeId) {
    return apiFetch(`/api/v1/projects/${projectId}/routes/${routeId}`, { method: "DELETE" });
  },

  restore(projectId, removed) {
    return apiFetch(`/api/v1/projects/${projectId}/routes/${removed.route.id}/restore`, {
      method: "POST",
      body: JSON.stringify(removed),
    });
  },
};
