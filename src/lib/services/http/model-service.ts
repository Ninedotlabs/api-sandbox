import type { ModelService } from "../types";
import { apiFetch } from "./client";

/** Mirrors `mock/model-service.ts` method for method, each one a `fetch` against the
 * matching `/api/v1/projects/:id/models` endpoint. */
export const httpModelService: ModelService = {
  create(projectId, name) {
    return apiFetch(`/api/v1/projects/${projectId}/models`, { method: "POST", body: JSON.stringify({ name }) });
  },

  update(projectId, model) {
    return apiFetch(`/api/v1/projects/${projectId}/models/${model.id}`, { method: "PATCH", body: JSON.stringify(model) });
  },

  remove(projectId, modelId) {
    return apiFetch(`/api/v1/projects/${projectId}/models/${modelId}`, { method: "DELETE" });
  },

  restore(projectId, removed) {
    return apiFetch(`/api/v1/projects/${projectId}/models/${removed.model.id}/restore`, {
      method: "POST",
      body: JSON.stringify(removed),
    });
  },
};
