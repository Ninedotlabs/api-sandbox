/**
 * Server-side equivalents of `applyPlan`/`applyEditPlan` in `src/store/project-store.ts`,
 * for the `/api/v1/projects/:id/ai/generate` and `/ai/edit` endpoints - "the existing AI
 * generate/edit, now persisting" per the design spec. The store's versions apply a plan by
 * calling the injected service interfaces (`ProjectService`/`ModelService`/`RouteService`/
 * `ConsoleService`) in sequence; those interfaces are exactly what the `pg` services already
 * implement, so the same algorithm runs here unchanged, just against `pg*Service` directly
 * instead of a client-side store.
 *
 * `project-store.ts` is out of scope for this task (Task A is the HTTP surface only), so
 * `mergeFields`/`ALL_CRUD` - private helpers inside that file - are duplicated here rather
 * than imported. If the store's algorithm changes, this file needs the same change made by
 * hand; there is no single source of truth for it right now. A natural follow-up is to lift
 * both into a shared, service-interface-generic module that the store and this file both
 * import.
 *
 * Not handled here: `EditPlan.removals` (resource/field/endpoint removal), which is newer
 * than this file and which `project-store.ts`'s own `applyEditPlan` does not act on either
 * as of this writing. Ignoring it here matches today's store behaviour exactly; wiring it up
 * is out of scope for this task.
 */
import type { ApiPlan, EditPlan, PlanField } from "@/lib/ai/plan";
import { buildCrudRoutes, type CrudAction } from "@/lib/crud";
import { createId } from "@/lib/ids";
import type { Field, Model } from "@/lib/types";
import { pgModelService } from "./model-service";
import { pgProjectService } from "./project-service";
import { pgRecordService } from "./record-service";
import { pgRouteService } from "./route-service";

const ALL_CRUD: CrudAction[] = ["list", "get", "create", "update", "delete"];

/** A model's records as they stood right before an edit plan replaced them, so an Undo
 * caller can put them back with `PUT .../records`. */
export interface RecordSnapshot {
  modelId: string;
  records: Record<string, unknown>[];
}

/** `overrides` win by name (case-insensitive): an existing field keeps its id and gets the
 * plan's values, a new name is appended with a fresh id. Nothing is ever removed. Mirrors
 * `mergeFields` in `project-store.ts` - see the file comment above. */
function mergeFields(current: Field[], overrides: PlanField[], resourceIds: Map<string, string>): Field[] {
  const merged = current.map((f) => (f.options ? { ...f, options: [...f.options] } : { ...f }));
  for (const o of overrides) {
    const index = merged.findIndex((f) => f.name.toLowerCase() === o.name.toLowerCase());
    const linkTo = o.linkTo ? resourceIds.get(o.linkTo) : undefined;
    const next: Field = {
      id: index >= 0 ? merged[index].id : createId("fld"),
      name: o.name,
      type: o.type,
      required: o.required,
      unique: o.unique,
      ...(o.options ? { options: o.options } : {}),
      ...(linkTo ? { linkTo } : {}),
    };
    if (index >= 0) merged[index] = next;
    else merged.push(next);
  }
  return merged;
}

/** Create every resource in an AI-generated plan, with its fields, CRUD routes and sample
 * records. Resumable: a resource whose name already exists is reused rather than
 * recreated, and `routeService.createMany` only ever adds endpoints that are missing. */
export async function applyPlanPg(projectId: string, plan: ApiPlan): Promise<{ modelIds: string[]; routeCount: number }> {
  // Two passes: every resource exists before fields are saved, so a link field can resolve
  // its target's real id even when it points at a later resource.
  const before = await pgProjectService.get(projectId);
  const ids = new Map<string, string>();
  const modelIds: string[] = [];
  let routeCount = 0;
  for (const resource of plan.resources) {
    const existing = before?.models.find((m) => m.name.toLowerCase() === resource.name.toLowerCase());
    const model = existing ?? (await pgModelService.create(projectId, resource.name));
    ids.set(resource.name, model.id);
    modelIds.push(model.id);
  }
  for (const resource of plan.resources) {
    const id = ids.get(resource.name)!;
    const model: Model = {
      id,
      name: resource.name,
      fields: resource.fields.map((f) => ({
        id: createId("fld"),
        name: f.name,
        type: f.type,
        required: f.required,
        unique: f.unique,
        ...(f.options ? { options: f.options } : {}),
        ...(f.linkTo ? { linkTo: ids.get(f.linkTo) } : {}),
      })),
    };
    await pgModelService.update(projectId, model);
    const current = await pgProjectService.get(projectId);
    const routes = buildCrudRoutes(model, ALL_CRUD, current?.routes ?? []);
    await pgRouteService.createMany(projectId, routes);
    routeCount += ALL_CRUD.length;
    await pgRecordService.seedRecords(projectId, id, resource.records);
  }
  return { modelIds, routeCount };
}

/** Merge an AI edit plan into an existing project: new resources are created, existing ones
 * have their fields merged (never overwritten), and endpoints/records are added. Replacing
 * an existing resource's records is destructive, so every replaced set is returned in
 * `replacedRecords` for the caller to offer as an undo. */
export async function applyEditPlanPg(
  projectId: string,
  plan: EditPlan,
): Promise<{
  modelIds: string[];
  newResourceCount: number;
  changedResourceCount: number;
  endpointCount: number;
  replacedRecords: RecordSnapshot[];
}> {
  const before = await pgProjectService.get(projectId);
  if (!before) throw new Error("This API no longer exists.");
  // Names that existed before this call, so a resource created by this same plan (which has
  // nothing to lose) is never mistaken for one whose records are at risk.
  const existingNames = new Set(before.models.map((m) => m.name));
  const ids = new Map<string, string>(before.models.map((m) => [m.name, m.id]));
  let created = 0;
  for (const resource of plan.resources) {
    if (!ids.has(resource.name)) {
      ids.set(resource.name, (await pgModelService.create(projectId, resource.name)).id);
      created++;
    }
  }
  const modelIds: string[] = [];
  let endpointCount = 0;
  const replacedRecords: RecordSnapshot[] = [];
  for (const resource of plan.resources) {
    const id = ids.get(resource.name)!;
    modelIds.push(id);
    const current = (await pgProjectService.get(projectId))!.models.find((m) => m.id === id)!;
    const merged = mergeFields(current.fields, resource.fields, ids);
    const model: Model = { ...current, fields: merged };
    await pgModelService.update(projectId, model);
    if (resource.records.length) {
      if (existingNames.has(resource.name)) {
        const previous = await pgRecordService.sampleData(projectId, id);
        if (previous.length) replacedRecords.push({ modelId: id, records: previous });
      }
      await pgRecordService.seedRecords(projectId, id, resource.records);
    }
    const projectNow = (await pgProjectService.get(projectId))!;
    const routes = buildCrudRoutes(model, ALL_CRUD, projectNow.routes);
    await pgRouteService.createMany(projectId, routes);
    endpointCount += routes.length;
  }
  const projectNow = (await pgProjectService.get(projectId))!;
  // Defensive: parseEditPlan already dedupes same method+path within a single answer, but
  // this filter must never depend on that holding true - a second independent duplicate
  // here would otherwise make routeService.createMany throw mid-apply, after fields and
  // records for this same call have already been written.
  const seenCustom = new Set<string>();
  const customRoutes = plan.customEndpoints
    .filter((c) => {
      const key = `${c.method} ${c.path}`;
      if (seenCustom.has(key)) return false;
      seenCustom.add(key);
      return true;
    })
    .map((c) => ({ ...c, modelId: c.resourceName ? (ids.get(c.resourceName) ?? null) : null }))
    .filter((c) => !projectNow.routes.some((r) => r.method === c.method && r.path === c.path))
    .map((c) => ({
      id: createId("rte"),
      method: c.method,
      path: c.path,
      modelId: c.modelId,
      action: "custom" as const,
      description: c.description,
      filters: [],
    }));
  if (customRoutes.length) {
    await pgRouteService.createMany(projectId, customRoutes);
    endpointCount += customRoutes.length;
  }
  return { modelIds, newResourceCount: created, changedResourceCount: plan.resources.length - created, endpointCount, replacedRecords };
}
