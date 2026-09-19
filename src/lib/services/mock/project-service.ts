import { createId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import { buildTemplateModels } from "@/lib/templates";
import type { Project } from "@/lib/types";
import { validateProjectName, validateSlug } from "@/lib/validation";
import type { ProjectService } from "../types";
import { readDb, updateProject, writeDb } from "./db";
import { delay } from "./latency";

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
};
