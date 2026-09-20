/**
 * The one implementation of `applyPlan`/`applyEditPlan` - applying an AI-generated or
 * AI-edited plan to a project's models, routes and records. Both `src/store/project-store.ts`
 * (the client-side Zustand store, backed by the mock services) and
 * `src/lib/services/pg/apply-plan.ts` (the `/api/v1/projects/:id/ai/*` HTTP endpoints, backed
 * by the `pg` services) call this module rather than keeping their own copy of the algorithm.
 *
 * This module is parameterised over the service interfaces it needs (`ModelService`,
 * `RouteService`, a `get`-only slice of `ProjectService`, and a minimal records port), so it
 * has no idea whether it's talking to `localStorage` or Postgres. Each caller supplies its own
 * concerns on top: the store wraps every call in a `finally { refresh(projectId) }` to keep
 * Zustand state in sync; the HTTP route just returns what this module gives it.
 *
 * This logic took four rounds of fixes to harden - field merges that must never drop a field,
 * record snapshots for undo, custom-endpoint dedupe, exact-case link resolution, and
 * additions-before-removals ordering - so it must not be forked again. Fix it here, once, for
 * both callers.
 */
import type { ApiPlan, EditPlan, PlanField } from "@/lib/ai/plan";
import { buildCrudRoutes, type CrudAction } from "@/lib/crud";
import { createId } from "@/lib/ids";
import type { Field, Model } from "@/lib/types";
import type { ModelService, ProjectService, RemovedModel, RemovedRoute, RouteService } from "./types";

const ALL_CRUD: CrudAction[] = ["list", "get", "create", "update", "delete"];

/** The slice of record storage `applyPlan`/`applyEditPlan` need - satisfied structurally by
 * both the mock `ConsoleService` and the pg `RecordService`, without depending on either. */
export interface ApplyPlanRecords {
  sampleData(projectId: string, modelId: string): Promise<Record<string, unknown>[]>;
  /** Replace this model's records; a record with no `id` gets "1", "2" … by position. */
  seedRecords(projectId: string, modelId: string, records: Record<string, unknown>[]): Promise<void>;
}

/** Everything `applyPlan`/`applyEditPlan` need from the surrounding service layer. */
export interface ApplyPlanServices {
  projectService: Pick<ProjectService, "get">;
  modelService: ModelService;
  routeService: RouteService;
  records: ApplyPlanRecords;
}

/** A model's records as they stood right before an edit plan replaced them, so Undo can seed
 * them back. */
export interface RecordSnapshot {
  modelId: string;
  records: Record<string, unknown>[];
}

/** A removed field plus the resource's records at the moment it was removed, so Undo can
 * restore the values, not just the column. One entry per removed field, even when several
 * fields were removed from the same resource in the same plan — each carries the same
 * records, snapshotted once before any of that resource's fields were touched. */
export interface RemovedFieldSnapshot {
  modelId: string;
  field: Field;
  records: Record<string, unknown>[];
}

/** Everything undoing an applied edit plan needs to put its destructive effects back:
 * replaced record sets, removed resources, removed endpoints and removed fields. */
export interface EditUndo {
  replacedRecords: RecordSnapshot[];
  removedModels: RemovedModel[];
  removedRoutes: RemovedRoute[];
  removedFields: RemovedFieldSnapshot[];
}

/** `overrides` win by name (case-insensitive): an existing field keeps its id and gets the
 * plan's values, a new name is appended with a fresh id. Nothing is ever removed. */
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

/** Create every resource in an AI plan with its fields, CRUD routes and sample records.
 * Resumable on purpose: a failed step leaves whatever was already created in place, and
 * running the same plan again picks up where it stopped. Every step is therefore idempotent -
 * a resource with the plan's name is reused rather than created, `buildCrudRoutes` skips
 * endpoints that already exist, and `seedRecords` replaces a model's records. */
export async function applyPlan(
  services: ApplyPlanServices,
  projectId: string,
  plan: ApiPlan,
): Promise<{ modelIds: string[]; routeCount: number }> {
  const { projectService, modelService, routeService, records } = services;
  // Two passes: every resource exists before fields are saved, so a link field can resolve
  // its target's real id even when it points at a later resource.
  const before = await projectService.get(projectId);
  const ids = new Map<string, string>();
  const modelIds: string[] = [];
  let routeCount = 0;
  for (const resource of plan.resources) {
    const existing = before?.models.find((m) => m.name.toLowerCase() === resource.name.toLowerCase());
    const model = existing ?? (await modelService.create(projectId, resource.name));
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
    await modelService.update(projectId, model);
    const current = await projectService.get(projectId);
    const routes = buildCrudRoutes(model, ALL_CRUD, current?.routes ?? []);
    await routeService.createMany(projectId, routes);
    // Count what the resource ends up with, not just what this attempt created, so a resumed
    // run still reports the whole plan.
    routeCount += ALL_CRUD.length;
    await records.seedRecords(projectId, id, resource.records);
  }
  return { modelIds, routeCount };
}

/** Merge an AI edit plan into an existing project: new resources are created, existing ones
 * have their fields merged (never overwritten), and endpoints/records are added. Replacing an
 * existing resource's records is destructive, so every replaced set is returned in `undo` for
 * the caller to offer as an Undo. Removals - fields, then resources, then endpoints - always
 * run after every addition/change, so a plan that both adds and removes on the same resource
 * never leaves it momentarily empty. */
export async function applyEditPlan(
  services: ApplyPlanServices,
  projectId: string,
  plan: EditPlan,
): Promise<{
  modelIds: string[];
  newResourceCount: number;
  changedResourceCount: number;
  endpointCount: number;
  undo: EditUndo;
}> {
  const { projectService, modelService, routeService, records } = services;
  const before = await projectService.get(projectId);
  if (!before) throw new Error("This API no longer exists.");
  // Names that existed before this call, so a resource created by this same plan (which has
  // nothing to lose) is never mistaken for one whose records are at risk.
  const existingNames = new Set(before.models.map((m) => m.name));
  const ids = new Map<string, string>(before.models.map((m) => [m.name, m.id]));
  let created = 0;
  for (const resource of plan.resources) {
    if (!ids.has(resource.name)) {
      ids.set(resource.name, (await modelService.create(projectId, resource.name)).id);
      created++;
    }
  }
  const modelIds: string[] = [];
  let endpointCount = 0;
  const replacedRecords: RecordSnapshot[] = [];
  for (const resource of plan.resources) {
    const id = ids.get(resource.name)!;
    modelIds.push(id);
    const current = (await projectService.get(projectId))!.models.find((m) => m.id === id)!;
    const merged = mergeFields(current.fields, resource.fields, ids);
    const model: Model = { ...current, fields: merged };
    await modelService.update(projectId, model);
    if (resource.records.length) {
      // seedRecords replaces a model's whole record set. That's the right behaviour for a
      // resource the plan is actively re-describing ("change the statuses to
      // shipped/pending/cancelled"), but it's destructive for an existing resource, so
      // whatever it held is snapshotted first and handed back for an Undo toast.
      if (existingNames.has(resource.name)) {
        const previous = await records.sampleData(projectId, id);
        if (previous.length) replacedRecords.push({ modelId: id, records: previous });
      }
      await records.seedRecords(projectId, id, resource.records);
    }
    const projectNow = (await projectService.get(projectId))!;
    const routes = buildCrudRoutes(model, ALL_CRUD, projectNow.routes);
    await routeService.createMany(projectId, routes);
    endpointCount += routes.length;
  }
  const projectNow = (await projectService.get(projectId))!;
  // Defensive: parseEditPlan already dedupes same method+path within a single answer, but this
  // filter must never depend on that holding true - a second independent duplicate here would
  // otherwise make routeService.createMany throw mid-apply, after fields and records for this
  // same call have already been written.
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
    .map((c) => ({ id: createId("rt"), method: c.method, path: c.path, modelId: c.modelId, action: "custom" as const, description: c.description, filters: [] }));
  if (customRoutes.length) {
    await routeService.createMany(projectId, customRoutes);
    endpointCount += customRoutes.length;
  }

  // Removals — always after every addition/change above. Within removals: fields, then
  // resources, then endpoints — a field removal needs its resource to still exist, and a
  // resource removal already takes its own routes with it, so endpoint removals go last and
  // simply skip anything already gone.
  const removedFields: RemovedFieldSnapshot[] = [];
  const removedModels: RemovedModel[] = [];
  const removedRoutes: RemovedRoute[] = [];

  const fieldRemovalsByResource = new Map<string, string[]>();
  for (const f of plan.removals?.fields ?? []) {
    fieldRemovalsByResource.set(f.resource, [...(fieldRemovalsByResource.get(f.resource) ?? []), f.field]);
  }
  for (const [resourceName, fieldNames] of fieldRemovalsByResource) {
    const current = (await projectService.get(projectId))?.models.find((m) => m.name === resourceName);
    if (!current) continue;
    const toRemove = new Set(fieldNames.map((n) => n.toLowerCase()));
    const removedThisModel = current.fields.filter((f) => toRemove.has(f.name.toLowerCase()));
    if (!removedThisModel.length) continue;
    // Snapshotted once, before this resource's fields are touched, so every field removed
    // from it in this same plan shares the exact same "before" records.
    const before2 = await records.sampleData(projectId, current.id);
    for (const field of removedThisModel) removedFields.push({ modelId: current.id, field, records: before2 });
    await modelService.update(projectId, { ...current, fields: current.fields.filter((f) => !toRemove.has(f.name.toLowerCase())) });
  }

  for (const name of plan.removals?.resources ?? []) {
    const current = (await projectService.get(projectId))?.models.find((m) => m.name === name);
    if (!current) continue;
    removedModels.push(await modelService.remove(projectId, current.id));
  }

  for (const e of plan.removals?.endpoints ?? []) {
    const current = (await projectService.get(projectId))?.routes.find((r) => r.method === e.method && r.path === e.path);
    if (!current) continue;
    removedRoutes.push(await routeService.remove(projectId, current.id));
  }

  const undo: EditUndo = { replacedRecords, removedModels, removedRoutes, removedFields };
  return { modelIds, newResourceCount: created, changedResourceCount: plan.resources.length - created, endpointCount, undo };
}
