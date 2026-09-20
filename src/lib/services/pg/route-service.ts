import type { PoolClient } from "pg";
import { withTransaction } from "@/lib/db/client";
import { friendlyDbError } from "@/lib/db/errors";
import { planInsert, type PositionedRow } from "@/lib/db/positions";
import type { Route } from "@/lib/types";
import { validateRoute } from "@/lib/validation";
import type { RouteService } from "../types";
import { routeFromRow, type RouteRow } from "./rows";

async function fetchOrderedRoutes(client: PoolClient, projectId: string): Promise<RouteRow[]> {
  const { rows } = await client.query<RouteRow>(
    "select id, model_id, method, path, action, description, filters, position, response from routes where project_id = $1 order by position, id",
    [projectId],
  );
  return rows;
}

/** Exported so `model-service.ts` can insert a captured route (on undo of a model delete)
 * through the same statement `createMany`/`restore` use here, rather than hand-writing a
 * second column list that silently drifts from this one - which is exactly how `response`
 * went missing from that path once already. */
export async function insertRoute(client: PoolClient, projectId: string, route: Route, position: number): Promise<void> {
  await client.query(
    `insert into routes (id, project_id, model_id, method, path, action, description, filters, position, response)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::jsonb)`,
    [
      route.id,
      projectId,
      route.modelId,
      route.method,
      route.path,
      route.action,
      route.description,
      JSON.stringify(route.filters),
      position,
      route.response ? JSON.stringify(route.response) : null,
    ],
  );
}

export const pgRouteService: RouteService = {
  async createMany(projectId, routes) {
    try {
      return await withTransaction(async (client) => {
        const existingRows = await fetchOrderedRoutes(client, projectId);
        const forValidation: Route[] = existingRows.map(routeFromRow);
        const positions: PositionedRow[] = existingRows.map((r) => ({ id: r.id, position: r.position }));

        for (const route of routes) {
          const err = validateRoute(route, forValidation);
          if (err) throw new Error(err);
          const { position } = planInsert(positions, null);
          await insertRoute(client, projectId, route, position);
          forValidation.push(route);
          positions.push({ id: route.id, position });
        }
        return routes;
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not create the routes.");
    }
  },

  async update(projectId, route) {
    try {
      return await withTransaction(async (client) => {
        const existing = (await fetchOrderedRoutes(client, projectId)).map(routeFromRow);
        const err = validateRoute(route, existing);
        if (err) throw new Error(err);
        await client.query(
          `update routes set model_id = $1, method = $2, path = $3, action = $4, description = $5, filters = $6::jsonb, response = $7::jsonb
           where id = $8 and project_id = $9`,
          [
            route.modelId,
            route.method,
            route.path,
            route.action,
            route.description,
            JSON.stringify(route.filters),
            route.response ? JSON.stringify(route.response) : null,
            route.id,
            projectId,
          ],
        );
        return route;
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not update the route.");
    }
  },

  async remove(projectId, routeId) {
    try {
      return await withTransaction(async (client) => {
        const ordered = await fetchOrderedRoutes(client, projectId);
        const index = ordered.findIndex((r) => r.id === routeId);
        if (index < 0) throw new Error("This route no longer exists.");
        const beforeId = ordered[index + 1]?.id ?? null;
        const route = routeFromRow(ordered[index]);
        await client.query("delete from routes where id = $1", [routeId]);
        return { route, beforeId };
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not remove the route.");
    }
  },

  async restore(projectId, removed) {
    try {
      return await withTransaction(async (client) => {
        const existing = (await fetchOrderedRoutes(client, projectId)).map(routeFromRow);
        const err = validateRoute(removed.route, existing);
        if (err) throw new Error(`Could not bring back ${removed.route.method} ${removed.route.path}. ${err}`);

        const ordered = await fetchOrderedRoutes(client, projectId);
        const positions: PositionedRow[] = ordered.map((r) => ({ id: r.id, position: r.position }));
        const { position, shifts } = planInsert(positions, removed.beforeId);
        for (const shift of shifts) {
          await client.query("update routes set position = $1 where id = $2", [shift.position, shift.id]);
        }
        await insertRoute(client, projectId, removed.route, position);
        return removed.route;
      });
    } catch (error) {
      throw friendlyDbError(error, "Could not bring back the route.");
    }
  },
};
