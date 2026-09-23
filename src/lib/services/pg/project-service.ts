import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import { getPool, query, withTransaction } from "@/lib/db/client";
import { friendlyDbError } from "@/lib/db/errors";
import { createId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import { buildTemplateModels } from "@/lib/templates";
import type { Field, Model, Project, Route } from "@/lib/types";
import type { ProjectService, RemovedProject } from "../types";
import {
  fieldFromRow,
  routeFromRow,
  type FieldRowWithModel,
  type ModelRow,
  type ProjectRow,
  type RouteRow,
} from "./rows";

/** Addresses the app itself uses (`/v1`, `/ai`, `/mcp`, `/auth`, `/api`); a project can't take one as its slug. */
export const RESERVED_SLUGS = new Set(["v1", "ai", "mcp", "auth", "api"]);
const SLUG_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;

interface Queryable {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

async function assembleProject(runner: Queryable, row: ProjectRow): Promise<Project> {
  const { rows: modelRows } = await runner.query<ModelRow>(
    "select id, name, position from models where project_id = $1 order by position, id",
    [row.id],
  );
  const modelIds = modelRows.map((m) => m.id);

  const fieldRows = modelIds.length
    ? (
        await runner.query<FieldRowWithModel>(
          "select id, model_id, name, type, required, is_unique, options, link_to, position from fields where model_id = any($1::text[]) order by model_id, position, id",
          [modelIds],
        )
      ).rows
    : [];
  const fieldsByModel = new Map<string, Field[]>();
  for (const fr of fieldRows) {
    const list = fieldsByModel.get(fr.model_id) ?? [];
    list.push(fieldFromRow(fr));
    fieldsByModel.set(fr.model_id, list);
  }
  const models: Model[] = modelRows.map((m) => ({ id: m.id, name: m.name, fields: fieldsByModel.get(m.id) ?? [] }));

  const { rows: routeRows } = await runner.query<RouteRow>(
    "select id, model_id, method, path, action, description, filters, position, response from routes where project_id = $1 order by position, id",
    [row.id],
  );
  const routes: Route[] = routeRows.map(routeFromRow);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    icon: row.icon,
    models,
    routes,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

async function loadProject(runner: Queryable, id: string, ownerId?: string): Promise<Project | null> {
  const { rows } = await runner.query<ProjectRow>(
    `select id, name, slug, description, icon, created_at, updated_at from projects
     where id = $1${ownerId ? " and owner_id = $2" : ""}`,
    ownerId ? [id, ownerId] : [id],
  );
  if (rows.length === 0) return null;
  return assembleProject(runner, rows[0]);
}

/** Finds a slug that isn't reserved and isn't already used by another project, suffixing on collision. */
async function uniqueSlug(runner: Queryable, base: string): Promise<string> {
  if (RESERVED_SLUGS.has(base)) {
    throw new Error(`"${base}" is reserved for the app itself. Choose a different name.`);
  }
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const { rows } = await runner.query<{ id: string }>("select id from projects where slug = $1", [candidate]);
    if (rows.length === 0) return candidate;
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}

/** Validates a slug a caller is explicitly setting via `update` - rejects rather than silently changing it. */
async function validateSlugForUpdate(runner: Queryable, slug: string, projectId: string): Promise<string | null> {
  if (!SLUG_FORMAT.test(slug)) return "Use lowercase letters, numbers and dashes, like my-store.";
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is reserved for the app itself. Choose a different one.`;
  const { rows } = await runner.query<{ id: string }>("select id from projects where slug = $1 and id != $2", [
    slug,
    projectId,
  ]);
  if (rows.length > 0) return "Another API already uses this address.";
  return null;
}

async function insertModelsAndFields(client: PoolClient, projectId: string, models: Model[]): Promise<void> {
  for (let i = 0; i < models.length; i++) {
    const m = models[i];
    await client.query("insert into models (id, project_id, name, position) values ($1, $2, $3, $4)", [
      m.id,
      projectId,
      m.name,
      i,
    ]);
  }
  for (const m of models) {
    for (let j = 0; j < m.fields.length; j++) {
      const f = m.fields[j];
      await client.query(
        `insert into fields (id, model_id, name, type, required, is_unique, options, link_to, position)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
        [f.id, m.id, f.name, f.type, f.required, f.unique, f.options ? JSON.stringify(f.options) : null, f.linkTo ?? null, j],
      );
    }
  }
}

async function insertRoutes(client: PoolClient, projectId: string, routes: Route[]): Promise<void> {
  for (let i = 0; i < routes.length; i++) {
    const r = routes[i];
    await client.query(
      `insert into routes (id, project_id, model_id, method, path, action, description, filters, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
      [r.id, projectId, r.modelId, r.method, r.path, r.action, r.description, JSON.stringify(r.filters), i],
    );
  }
}

export const pgProjectService: ProjectService = {
  async list(ownerId) {
    const { rows } = await query<ProjectRow>(
      `select id, name, slug, description, icon, created_at, updated_at from projects
       ${ownerId ? "where owner_id = $1" : ""} order by updated_at desc, id desc`,
      ownerId ? [ownerId] : [],
    );
    const pool = getPool();
    const projects: Project[] = [];
    for (const row of rows) projects.push(await assembleProject(pool, row));
    return projects;
  },

  async get(id, ownerId) {
    return loadProject(getPool(), id, ownerId);
  },

  async create({ name, description, templateId }, ownerId) {
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Give your API a name.");
    const trimmedDescription = description.trim();
    try {
      return await withTransaction(async (client) => {
        const base = slugify(trimmedName);
        if (!base) throw new Error("Use at least one letter or number.");
        const slug = await uniqueSlug(client, base);

        const id = createId("prj");
        // Let the database's own clock stamp `created_at`/`updated_at` (their
        // column defaults), rather than the application's, so a later
        // `update` - which also uses the database's `now()` - can never look
        // earlier than a row that was just created.
        const inserted = await client.query<{ created_at: Date; updated_at: Date }>(
          "insert into projects (id, owner_id, name, slug, description) values ($1, $2, $3, $4, $5) returning created_at, updated_at",
          [id, ownerId ?? null, trimmedName, slug, trimmedDescription],
        );

        const models = templateId ? buildTemplateModels(templateId) : [];
        await insertModelsAndFields(client, id, models);

        return {
          id,
          name: trimmedName,
          slug,
          description: trimmedDescription,
          models,
          routes: [],
          createdAt: inserted.rows[0].created_at.toISOString(),
          updatedAt: inserted.rows[0].updated_at.toISOString(),
        };
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not create the API.");
    }
  },

  async update(id, patch) {
    try {
      return await withTransaction(async (client) => {
        const existing = await client.query("select id from projects where id = $1", [id]);
        if (existing.rowCount === 0) throw new Error("This API no longer exists.");

        if (patch.name !== undefined && !patch.name.trim()) throw new Error("Give your API a name.");
        if (patch.slug !== undefined) {
          const err = await validateSlugForUpdate(client, patch.slug, id);
          if (err) throw new Error(err);
        }

        const sets: string[] = [];
        const values: unknown[] = [];
        if (patch.name !== undefined) {
          sets.push(`name = $${sets.length + 1}`);
          values.push(patch.name.trim());
        }
        if (patch.description !== undefined) {
          sets.push(`description = $${sets.length + 1}`);
          values.push(patch.description);
        }
        if (patch.icon !== undefined) {
          // null is a real value here: it clears the choice and hands the project back to
          // the slug-derived icon.
          sets.push(`icon = $${sets.length + 1}`);
          values.push(patch.icon);
        }
        if (patch.slug !== undefined) {
          sets.push(`slug = $${sets.length + 1}`);
          values.push(patch.slug);
        }
        sets.push("updated_at = now()");
        values.push(id);
        await client.query(`update projects set ${sets.join(", ")} where id = $${values.length}`, values);

        const row = (
          await client.query<ProjectRow>(
            "select id, name, slug, description, icon, created_at, updated_at from projects where id = $1",
            [id],
          )
        ).rows[0];
        return assembleProject(client, row);
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not update the API.");
    }
  },

  async remove(id) {
    try {
      return await withTransaction(async (client) => {
        const project = await loadProject(client, id);
        if (!project) throw new Error("This API no longer exists.");

        // Captured before the delete below cascades it away (`records.model_id` is `ON DELETE
        // CASCADE`), so Undo has real records to put back. A model with no records is left out
        // entirely rather than listed with an empty array.
        const records: RemovedProject["records"] = [];
        for (const model of project.models) {
          const { rows } = await client.query<{ id: string; data: Record<string, unknown> }>(
            "select id, data from records where model_id = $1 order by created_at, id",
            [model.id],
          );
          if (rows.length) records.push({ modelId: model.id, records: rows.map((r) => ({ ...r.data, id: r.id })) });
        }

        await client.query("delete from projects where id = $1", [id]);
        return { project, records };
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not delete this API.");
    }
  },

  async restore({ project, records }, ownerId) {
    try {
      await withTransaction(async (client) => {
        await client.query(
          "insert into projects (id, owner_id, name, slug, description, created_at, updated_at) values ($1, $2, $3, $4, $5, $6, $7)",
          [project.id, ownerId ?? null, project.name, project.slug, project.description, project.createdAt, project.updatedAt],
        );
        await insertModelsAndFields(client, project.id, project.models);
        await insertRoutes(client, project.id, project.routes);
        for (const { modelId, records: modelRecords } of records) {
          for (const record of modelRecords) {
            const { id, ...rest } = record;
            await client.query("insert into records (model_id, id, data) values ($1, $2, $3::jsonb)", [
              modelId,
              String(id),
              JSON.stringify(rest),
            ]);
          }
        }
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not bring back this API.");
    }
  },

  async duplicate(id, ownerId, options) {
    try {
      return await withTransaction(async (client) => {
        const source = await loadProject(client, id, options?.anyOwner ? undefined : ownerId);
        if (!source) throw new Error("This API no longer exists.");

        const baseName = `${source.name} copy`;
        let name = baseName;
        let suffix = 2;
        for (;;) {
          const { rows } = await client.query<{ id: string }>("select id from projects where name = $1", [name]);
          if (rows.length === 0) break;
          name = `${baseName} ${suffix}`;
          suffix++;
        }

        const slug = await uniqueSlug(client, slugify(name) || createId("prj"));

        const modelIdMap = new Map<string, string>();
        for (const m of source.models) modelIdMap.set(m.id, createId("mdl"));

        const newModels: Model[] = source.models.map((m) => ({
          id: modelIdMap.get(m.id) as string,
          name: m.name,
          fields: m.fields.map((f) => ({
            ...f,
            id: createId("fld"),
            linkTo: f.linkTo ? modelIdMap.get(f.linkTo) : undefined,
          })),
        }));

        const newRoutes: Route[] = source.routes.map((r) => ({
          ...r,
          id: createId("rte"),
          modelId: r.modelId ? (modelIdMap.get(r.modelId) ?? null) : null,
        }));

        const newProjectId = createId("prj");
        const inserted = await client.query<{ created_at: Date; updated_at: Date }>(
          "insert into projects (id, owner_id, name, slug, description) values ($1, $2, $3, $4, $5) returning created_at, updated_at",
          [newProjectId, ownerId ?? null, name, slug, source.description],
        );
        await insertModelsAndFields(client, newProjectId, newModels);
        await insertRoutes(client, newProjectId, newRoutes);

        for (const m of source.models) {
          const newModelId = modelIdMap.get(m.id) as string;
          await client.query("insert into records (model_id, id, data) select $1, id, data from records where model_id = $2", [
            newModelId,
            m.id,
          ]);
        }

        return {
          id: newProjectId,
          name,
          slug,
          description: source.description,
          models: newModels,
          routes: newRoutes,
          createdAt: inserted.rows[0].created_at.toISOString(),
          updatedAt: inserted.rows[0].updated_at.toISOString(),
        };
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not duplicate this API.");
    }
  },
};
