import { createId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import { buildTemplateModels } from "@/lib/templates";
import type { Model, Project, Route } from "@/lib/types";
import { validateProjectName, validateSlug } from "@/lib/validation";
import type { ProjectService } from "../types";
import { mockConsoleService } from "./console-service";
import { readDb, updateProject, writeDb } from "./db";
import { delay } from "./latency";

/** `<name> copy`, then `<name> copy 2`, `<name> copy 3`… until the slug is free. */
function uniqueCopyName(name: string, projects: Project[]): string {
  const takenSlugs = new Set(projects.map((p) => p.slug));
  let candidate = `${name} copy`;
  for (let n = 2; takenSlugs.has(slugify(candidate)); n++) candidate = `${name} copy ${n}`;
  return candidate;
}

/** Fresh ids for every model and field, with `field.linkTo` remapped to the new model ids. */
function copyModels(models: Model[]): { models: Model[]; modelIdMap: Map<string, string> } {
  const modelIdMap = new Map(models.map((m) => [m.id, createId("mdl")]));
  const copies = models.map((m) => ({
    ...m,
    id: modelIdMap.get(m.id)!,
    fields: m.fields.map((f) => ({ ...f, id: createId("fld") })),
  }));
  for (const model of copies) {
    model.fields = model.fields.map((f) =>
      f.type === "link" && f.linkTo ? { ...f, linkTo: modelIdMap.get(f.linkTo) ?? f.linkTo } : f,
    );
  }
  return { models: copies, modelIdMap };
}

/** Fresh ids for every route, with `route.modelId` remapped to the new model ids. */
function copyRoutes(routes: Route[], modelIdMap: Map<string, string>): Route[] {
  return routes.map((r) => ({
    ...r,
    id: createId("rt"),
    modelId: r.modelId ? (modelIdMap.get(r.modelId) ?? r.modelId) : r.modelId,
  }));
}

export const mockProjectService: ProjectService = {
  async list() {
    const projects = readDb().projects.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return delay(projects);
  },

  async get(id) {
    return delay(readDb().projects.find((p) => p.id === id) ?? null);
  },

  async create({ name, description, templateId }) {
    const db = readDb();
    const err = validateProjectName(name, db.projects);
    if (err) throw new Error(err);
    const now = new Date().toISOString();
    const project: Project = {
      id: createId("prj"),
      name: name.trim(),
      slug: slugify(name),
      description: description.trim(),
      models: templateId ? buildTemplateModels(templateId) : [],
      routes: [],
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    writeDb(db);
    return delay(project);
  },

  async update(id, patch) {
    const others = readDb().projects;
    const err =
      (patch.name !== undefined ? validateProjectName(patch.name, others, id) : null) ??
      (patch.slug !== undefined ? validateSlug(patch.slug, others, id) : null);
    if (err) throw new Error(err);
    return delay(updateProject(id, (p) => ({ ...p, ...patch })));
  },

  async remove(id) {
    const db = readDb();
    db.projects = db.projects.filter((p) => p.id !== id);
    writeDb(db);
    return delay(undefined);
  },

  async restore(project) {
    const db = readDb();
    db.projects = [...db.projects.filter((p) => p.id !== project.id), project];
    writeDb(db);
    return delay(undefined);
  },

  async duplicate(id) {
    const db = readDb();
    const source = db.projects.find((p) => p.id === id);
    if (!source) throw new Error("This API no longer exists.");

    const { models, modelIdMap } = copyModels(source.models);
    const name = uniqueCopyName(source.name, db.projects);
    const now = new Date().toISOString();
    const project: Project = {
      id: createId("prj"),
      name,
      slug: slugify(name),
      description: source.description,
      models,
      routes: copyRoutes(source.routes, modelIdMap),
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    writeDb(db);

    // The mock dataset lives outside `db` (it's regenerated/cached per project id), so it's
    // copied through the console service's own API rather than reached into directly. Record
    // ids don't need remapping: a "link" field's value points at another record's id, which is
    // unaffected by the model or project it lives under gaining a new id.
    await Promise.all(
      source.models.map(async (model) => {
        const records = await mockConsoleService.sampleData(source.id, model.id);
        await mockConsoleService.seedRecords(project.id, modelIdMap.get(model.id)!, records);
      }),
    );

    return delay(project);
  },
};
