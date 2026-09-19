import { insertBefore } from "@/lib/arrays";
import { createId } from "@/lib/ids";
import type { Model } from "@/lib/types";
import { validateFields, validateModelName } from "@/lib/validation";
import type { ModelService, RemovedModel } from "../types";
import { updateProject } from "./db";
import { delay } from "./latency";
import { restoreRoutes } from "./route-service";

export const mockModelService: ModelService = {
  async create(projectId, name) {
    let created: Model | undefined;
    updateProject(projectId, (p) => {
      const err = validateModelName(name, p.models);
      if (err) throw new Error(err);
      created = { id: createId("mdl"), name: name.trim(), fields: [] };
      return { ...p, models: [...p.models, created] };
    });
    return delay(created as Model);
  },

  async update(projectId, model) {
    const saved = { ...model, name: model.name.trim() };
    updateProject(projectId, (p) => {
      const err = validateModelName(saved.name, p.models, saved.id) ?? validateFields(saved.fields);
      if (err) throw new Error(err);
      return { ...p, models: p.models.map((m) => (m.id === saved.id ? saved : m)) };
    });
    return delay(saved);
  },

  async remove(projectId, modelId) {
    let removed: RemovedModel | undefined;
    updateProject(projectId, (p) => {
      const index = p.models.findIndex((m) => m.id === modelId);
      if (index < 0) throw new Error("This model no longer exists.");
      removed = {
        model: p.models[index],
        beforeId: p.models[index + 1]?.id ?? null,
        routes: p.routes.flatMap((r, i) =>
          r.modelId === modelId ? [{ route: r, beforeId: p.routes[i + 1]?.id ?? null }] : [],
        ),
        links: p.models.flatMap((m) =>
          m.fields.filter((f) => f.linkTo === modelId).map((f) => ({ modelId: m.id, fieldId: f.id })),
        ),
      };
      return {
        ...p,
        models: p.models
          .filter((m) => m.id !== modelId)
          .map((m) => ({ ...m, fields: m.fields.map((f) => (f.linkTo === modelId ? { ...f, linkTo: undefined } : f)) })),
        routes: p.routes.filter((r) => r.modelId !== modelId),
      };
    });
    return delay(removed as RemovedModel);
  },

  async restore(projectId, { model, beforeId, routes, links }) {
    let restored = model;
    updateProject(projectId, (p) => {
      const err = validateModelName(model.name, p.models, model.id);
      if (err) throw new Error(`Could not bring back ${model.name}. ${err}`);
      const relinked = p.models.map((m) => ({
        ...m,
        fields: m.fields.map((f) =>
          f.type === "link" && !f.linkTo && links.some((l) => l.modelId === m.id && l.fieldId === f.id)
            ? { ...f, linkTo: model.id }
            : f,
        ),
      }));
      // Links from the restored model to models deleted since are cleared, as a delete would have done.
      const exists = (id: string) => id === model.id || p.models.some((m) => m.id === id);
      restored = {
        ...model,
        fields: model.fields.map((f) => (f.linkTo && !exists(f.linkTo) ? { ...f, linkTo: undefined } : f)),
      };
      return { ...p, models: insertBefore(relinked, restored, beforeId), routes: restoreRoutes(p.routes, routes) };
    });
    return delay(restored);
  },
};
