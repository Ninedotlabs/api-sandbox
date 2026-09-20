/**
 * Thin `pg` adapter over the shared `applyPlan`/`applyEditPlan` in
 * `src/lib/services/apply-plan.ts`, for the `/api/v1/projects/:id/ai/generate` and `/ai/edit`
 * endpoints - "the existing AI generate/edit, now persisting" per the design spec.
 *
 * This used to be a hand-ported duplicate of `project-store.ts`'s algorithm, kept in sync by
 * hand. It drifted: this copy had no removals support at all, so "remove the email field from
 * Author" silently did nothing through this endpoint while working fine through the store.
 * Both now call the one shared implementation, parameterised over the `pg*Service`
 * dependencies here - see `apply-plan.ts` for the algorithm itself and why it must not be
 * forked again.
 */
import type { ApiPlan, EditPlan } from "@/lib/ai/plan";
import { applyEditPlan, applyPlan, type EditUndo } from "@/lib/services/apply-plan";
import { pgModelService } from "./model-service";
import { pgProjectService } from "./project-service";
import { pgRecordService } from "./record-service";
import { pgRouteService } from "./route-service";

export type { EditUndo, RecordSnapshot, RemovedFieldSnapshot } from "@/lib/services/apply-plan";

const deps = {
  projectService: pgProjectService,
  modelService: pgModelService,
  routeService: pgRouteService,
  records: pgRecordService,
};

/** Create every resource in an AI-generated plan, with its fields, CRUD routes and sample
 * records. Resumable: a resource whose name already exists is reused rather than recreated,
 * and `routeService.createMany` only ever adds endpoints that are missing. */
export async function applyPlanPg(projectId: string, plan: ApiPlan): Promise<{ modelIds: string[]; routeCount: number }> {
  return applyPlan(deps, projectId, plan);
}

/** Merge an AI edit plan into an existing project: new resources are created, existing ones
 * have their fields merged (never overwritten), endpoints/records are added, and removals
 * (fields, resources, endpoints) are performed - identically to `project-store.ts`'s
 * `applyEditPlan`. `undo` carries everything a caller needs to reverse it. */
export async function applyEditPlanPg(
  projectId: string,
  plan: EditPlan,
): Promise<{
  modelIds: string[];
  newResourceCount: number;
  changedResourceCount: number;
  endpointCount: number;
  undo: EditUndo;
}> {
  return applyEditPlan(deps, projectId, plan);
}
