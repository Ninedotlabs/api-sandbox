import { createId } from "@/lib/ids";
import type { Model } from "@/lib/types";
import { validateFields, validateModelName } from "@/lib/validation";
import type { ModelService } from "../types";
import { updateProject } from "./db";
import { delay } from "./latency";

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
    updateProject(projectId, (p) => {
      const err = validateModelName(model.name, p.models, model.id) ?? validateFields(model.fields);
      if (err) throw new Error(err);
      return { ...p, models: p.models.map((m) => (m.id === model.id ? model : m)) };
    });
    return delay(model);
  },

  async remove(projectId, modelId) {
    updateProject(projectId, (p) => ({
      ...p,
      models: p.models
        .filter((m) => m.id !== modelId)
        .map((m) => ({ ...m, fields: m.fields.map((f) => (f.linkTo === modelId ? { ...f, linkTo: undefined } : f)) })),
      routes: p.routes.filter((r) => r.modelId !== modelId),
    }));
    return delay(undefined);
  },
};
