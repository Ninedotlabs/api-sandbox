import type { ProjectService } from "../types";
import { apiFetch, apiFetchNullable } from "./client";

/** Mirrors `mock/project-service.ts` method for method, each one a `fetch` against the
 * matching `/api/v1/projects` endpoint instead of `localStorage`. */
export const httpProjectService: ProjectService = {
  list() {
    return apiFetch("/api/v1/projects");
  },

  get(id) {
    return apiFetchNullable(`/api/v1/projects/${id}`);
  },

  create(input) {
    return apiFetch("/api/v1/projects", { method: "POST", body: JSON.stringify(input) });
  },

  update(id, patch) {
    return apiFetch(`/api/v1/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  },

  remove(id) {
    return apiFetch(`/api/v1/projects/${id}`, { method: "DELETE" });
  },

  async restore(removed) {
    // The interface returns `void` - the restored project comes back from the endpoint, but
    // callers (the store's `restoreProject`) already hold `removed.project` and use that.
    await apiFetch(`/api/v1/projects/${removed.project.id}/restore`, { method: "POST", body: JSON.stringify(removed) });
  },

  duplicate(id) {
    return apiFetch(`/api/v1/projects/${id}/duplicate`, { method: "POST" });
  },
};
