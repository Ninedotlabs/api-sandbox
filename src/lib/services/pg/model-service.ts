import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db/client";
import { friendlyDbError } from "@/lib/db/errors";
import { planInsert, type PositionedRow } from "@/lib/db/positions";
import { createId } from "@/lib/ids";
import type { Field, Model } from "@/lib/types";
import { validateFields, validateModelName } from "@/lib/validation";
import type { ModelService, RemovedModel, RemovedRoute } from "../types";
import { fieldFromRow, type FieldRow, type ModelRow, type RouteRow } from "./rows";

async function fetchModelsForValidation(client: PoolClient, projectId: string): Promise<Model[]> {
  const { rows } = await client.query<ModelRow>("select id, name, position from models where project_id = $1", [
    projectId,
  ]);
  return rows.map((r) => ({ id: r.id, name: r.name, fields: [] }));
}

async function fetchOrderedModels(client: PoolClient, projectId: string): Promise<PositionedRow[]> {
  const { rows } = await client.query<{ id: string; position: number }>(
    "select id, position from models where project_id = $1 order by position, id",
    [projectId],
  );
  return rows;
}

async function fetchFields(client: PoolClient, modelId: string): Promise<Field[]> {
  const { rows } = await client.query<FieldRow>(
    "select id, name, type, required, is_unique, options, link_to, position from fields where model_id = $1 order by position, id",
    [modelId],
  );
  return rows.map(fieldFromRow);
}

async function writeFields(client: PoolClient, modelId: string, fields: Field[]): Promise<void> {
  const existing = await client.query<{ id: string }>("select id from fields where model_id = $1", [modelId]);
  const keep = new Set(fields.map((f) => f.id));
  const toDelete = existing.rows.map((r) => r.id).filter((id) => !keep.has(id));
  if (toDelete.length) {
    await client.query("delete from fields where id = any($1::text[])", [toDelete]);
  }
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    await client.query(
      `insert into fields (id, model_id, name, type, required, is_unique, options, link_to, position)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       on conflict (id) do update set
         name = excluded.name, type = excluded.type, required = excluded.required,
         is_unique = excluded.is_unique, options = excluded.options, link_to = excluded.link_to,
         position = excluded.position`,
      [f.id, modelId, f.name, f.type, f.required, f.unique, f.options ? JSON.stringify(f.options) : null, f.linkTo ?? null, i],
    );
  }
}

export const pgModelService: ModelService = {
  async create(projectId, name) {
    const trimmed = name.trim();
    try {
      return await withTransaction(async (client) => {
        const existing = await fetchModelsForValidation(client, projectId);
        const err = validateModelName(trimmed, existing);
        if (err) throw new Error(err);

        const ordered = await fetchOrderedModels(client, projectId);
        const { position } = planInsert(ordered, null);
        const id = createId("mdl");
        await client.query("insert into models (id, project_id, name, position) values ($1, $2, $3, $4)", [
          id,
          projectId,
          trimmed,
          position,
        ]);
        return { id, name: trimmed, fields: [] };
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not create the model.");
    }
  },

  async update(projectId, model) {
    const saved: Model = { ...model, name: model.name.trim() };
    try {
      return await withTransaction(async (client) => {
        const existing = await fetchModelsForValidation(client, projectId);
        const err = validateModelName(saved.name, existing, saved.id) ?? validateFields(saved.fields);
        if (err) throw new Error(err);

        const row = await client.query("select id from models where id = $1 and project_id = $2", [
          saved.id,
          projectId,
        ]);
        if (row.rowCount === 0) throw new Error("This model no longer exists.");

        await client.query("update models set name = $1 where id = $2", [saved.name, saved.id]);
        await writeFields(client, saved.id, saved.fields);
        return saved;
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not update the model.");
    }
  },

  async remove(projectId, modelId) {
    try {
      return await withTransaction(async (client) => {
        const ordered = await fetchOrderedModels(client, projectId);
        const index = ordered.findIndex((m) => m.id === modelId);
        if (index < 0) throw new Error("This model no longer exists.");
        const beforeId = ordered[index + 1]?.id ?? null;

        const name = (await client.query<{ name: string }>("select name from models where id = $1", [modelId]))
          .rows[0].name;
        const fields = await fetchFields(client, modelId);

        const routeRows = await client.query<RouteRow>(
          "select id, model_id, method, path, action, description, filters, position from routes where project_id = $1 and model_id = $2 order by position, id",
          [projectId, modelId],
        );
        const allRoutesOrdered = await client.query<{ id: string }>(
          "select id from routes where project_id = $1 order by position, id",
          [projectId],
        );
        const removedRoutes: RemovedRoute[] = routeRows.rows.map((r) => {
          const orderedIndex = allRoutesOrdered.rows.findIndex((row) => row.id === r.id);
          return {
            route: {
              id: r.id,
              method: r.method as RemovedRoute["route"]["method"],
              path: r.path,
              modelId: r.model_id,
              action: r.action as RemovedRoute["route"]["action"],
              description: r.description,
              filters: r.filters,
            },
            beforeId: allRoutesOrdered.rows[orderedIndex + 1]?.id ?? null,
          };
        });

        const linkRows = await client.query<{ model_id: string; id: string }>(
          "select model_id, id from fields where link_to = $1",
          [modelId],
        );
        const links = linkRows.rows.map((r) => ({ modelId: r.model_id, fieldId: r.id }));

        // Captured before the delete below cascades it away, so Undo has real records to put
        // back rather than data that's already gone for good.
        const recordRows = await client.query<{ id: string; data: Record<string, unknown> }>(
          "select id, data from records where model_id = $1 order by created_at, id",
          [modelId],
        );
        const records = recordRows.rows.map((r) => ({ ...r.data, id: r.id }));

        // Deleting the model cascades: its own fields and records, the routes
        // pointed at it, and (via `on delete set null`) the `link_to` on the
        // fields captured in `links` above.
        await client.query("delete from models where id = $1", [modelId]);

        const removed: RemovedModel = {
          model: { id: modelId, name, fields },
          beforeId,
          routes: removedRoutes,
          links,
          records,
        };
        return removed;
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not remove the model.");
    }
  },

  async restore(projectId, { model, beforeId, routes, links, records }) {
    try {
      return await withTransaction(async (client) => {
        const existing = await fetchModelsForValidation(client, projectId);
        const err = validateModelName(model.name, existing, model.id);
        if (err) throw new Error(`Could not bring back ${model.name}. ${err}`);

        const existingIds = new Set(existing.map((m) => m.id));
        const relinkedFields = model.fields.map((f) =>
          f.linkTo && f.linkTo !== model.id && !existingIds.has(f.linkTo) ? { ...f, linkTo: undefined } : f,
        );

        const ordered = await fetchOrderedModels(client, projectId);
        const { position, shifts } = planInsert(ordered, beforeId);
        for (const shift of shifts) {
          await client.query("update models set position = $1 where id = $2", [shift.position, shift.id]);
        }
        await client.query("insert into models (id, project_id, name, position) values ($1, $2, $3, $4)", [
          model.id,
          projectId,
          model.name,
          position,
        ]);
        await writeFields(client, model.id, relinkedFields);

        for (const removedRoute of routes.slice().reverse()) {
          const orderedRoutes = (
            await client.query<{ id: string; position: number }>(
              "select id, position from routes where project_id = $1 order by position, id",
              [projectId],
            )
          ).rows;
          const plan = planInsert(orderedRoutes, removedRoute.beforeId);
          for (const shift of plan.shifts) {
            await client.query("update routes set position = $1 where id = $2", [shift.position, shift.id]);
          }
          const r = removedRoute.route;
          await client.query(
            `insert into routes (id, project_id, model_id, method, path, action, description, filters, position)
             values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
            [r.id, projectId, r.modelId, r.method, r.path, r.action, r.description, JSON.stringify(r.filters), plan.position],
          );
        }

        for (const link of links) {
          await client.query(
            "update fields set link_to = $1 where id = $2 and model_id = $3 and type = 'link' and link_to is null",
            [model.id, link.fieldId, link.modelId],
          );
        }

        for (const record of records) {
          const { id, ...rest } = record;
          await client.query("insert into records (model_id, id, data) values ($1, $2, $3::jsonb)", [
            model.id,
            String(id),
            JSON.stringify(rest),
          ]);
        }

        return { ...model, fields: relinkedFields };
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not bring back the model.");
    }
  },
};
