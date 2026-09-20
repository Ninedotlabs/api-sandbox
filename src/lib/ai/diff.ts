import { crudOptions } from "@/lib/crud";
import type { Field, HttpMethod, Model, Project } from "@/lib/types";
import type { EditPlan, PlanField } from "./plan";

export interface FieldChange { name: string; kind: "added" | "changed"; before?: PlanField; after: PlanField }
/** Another model whose link field will dangle once this resource's records are replaced
 * (ids are reassigned 1..N, so nothing that pointed at the old ids still resolves). */
export interface InboundLink { modelName: string; fieldName: string; recordCount: number }
export interface ResourceDiff { name: string; isNew: boolean; fields: FieldChange[]; recordCount: number; inboundLinks: InboundLink[] }
export interface EndpointDiff { method: HttpMethod; path: string; description: string }
/** A field removal's consequence: how many of the resource's records currently hold a value for it. */
export interface FieldRemovalDiff { resource: string; field: string; recordCount: number }
/** A resource removal's consequences: its own records and endpoints, plus every other
 * resource's link field that points at it (which will be cleared, not deleted). */
export interface ResourceRemovalDiff { name: string; recordCount: number; endpointCount: number; inboundLinks: InboundLink[] }
export interface EndpointRemovalDiff { method: HttpMethod; path: string }
export interface RemovalsDiff { resources: ResourceRemovalDiff[]; fields: FieldRemovalDiff[]; endpoints: EndpointRemovalDiff[] }
export interface EditDiff { newResources: ResourceDiff[]; changedResources: ResourceDiff[]; newEndpoints: EndpointDiff[]; removals: RemovalsDiff }

function toPlanField(f: Field, project: Project): PlanField {
  const linkTo = f.linkTo ? project.models.find((m) => m.id === f.linkTo)?.name : undefined;
  return { name: f.name, type: f.type, required: f.required, unique: f.unique, ...(f.options ? { options: f.options } : {}), ...(linkTo ? { linkTo } : {}) };
}

function sameOptions(a: string[] | undefined, b: string[] | undefined): boolean {
  const ax = a ?? [];
  const bx = b ?? [];
  return ax.length === bx.length && ax.every((v, i) => v === bx[i]);
}

function typeLabel(f: PlanField): string {
  return f.type === "choice" && f.options?.length ? `choice (${f.options.join(", ")})` : f.type;
}

/**
 * Every human-readable line describing how `after` differs from `before`. An empty result
 * means there's no visible difference — the single source of truth for both "is this field
 * actually changed" (computeEditDiff) and "what changed" (the preview).
 */
export function fieldChangeDetails(before: PlanField, after: PlanField): string[] {
  const lines: string[] = [];
  if (before.type !== after.type || !sameOptions(before.options, after.options)) lines.push(`was ${typeLabel(before)}`);
  if (before.required !== after.required) lines.push(after.required ? "now required" : "no longer required");
  if (before.unique !== after.unique) lines.push(after.unique ? "now unique" : "no longer unique");
  if ((before.linkTo ?? null) !== (after.linkTo ?? null)) lines.push(`was linked to ${before.linkTo ?? "nothing"}`);
  return lines;
}

const asStandIn = (name: string): Model => ({ id: name, name, fields: [] });

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "";
}

/**
 * `recordCounts` is each model's known record count, keyed by name (best-effort: the panel
 * supplies what it already fetched to build the AI request, capped the same way). It's only
 * used to disclose inbound links that are about to dangle and a removed resource's own record
 * count; omitting it just suppresses those disclosures, it never affects anything else in the
 * diff.
 *
 * `recordsByName` is each model's actual sample records, keyed by name, used only to disclose
 * how many of a resource's records hold a value for a field about to be removed — a count
 * `recordCounts` alone can't answer. Omitting it just reports 0 for that disclosure.
 */
export function computeEditDiff(
  project: Project,
  plan: EditPlan,
  recordCounts: Record<string, number> = {},
  recordsByName: Record<string, Record<string, unknown>[]> = {},
): EditDiff {
  const newResources: ResourceDiff[] = [];
  const changedResources: ResourceDiff[] = [];
  const newEndpoints: EndpointDiff[] = [];

  function addStandardEndpoints(model: Model) {
    for (const option of crudOptions(model)) {
      if (!project.routes.some((r) => r.method === option.method && r.path === option.path) && !newEndpoints.some((e) => e.method === option.method && e.path === option.path)) {
        newEndpoints.push({ method: option.method, path: option.path, description: option.label });
      }
    }
  }

  function inboundLinksFor(model: Model): InboundLink[] {
    const links: InboundLink[] = [];
    for (const other of project.models) {
      if (other.id === model.id) continue;
      for (const field of other.fields) {
        if (field.type !== "link" || field.linkTo !== model.id) continue;
        const recordCount = recordCounts[other.name] ?? 0;
        if (recordCount > 0) links.push({ modelName: other.name, fieldName: field.name, recordCount });
      }
    }
    return links;
  }

  for (const resource of plan.resources) {
    const current = project.models.find((m) => m.name.toLowerCase() === resource.name.toLowerCase());
    if (!current) {
      newResources.push({
        name: resource.name,
        isNew: true,
        fields: resource.fields.map((f) => ({ name: f.name, kind: "added", after: f })),
        recordCount: resource.records.length,
        // Nothing existed before this resource, so nothing can already be pointing at
        // records it's about to lose.
        inboundLinks: [],
      });
      addStandardEndpoints(asStandIn(resource.name));
      continue;
    }
    const currentByName = new Map(current.fields.map((f) => [f.name.toLowerCase(), toPlanField(f, project)]));
    const fields: FieldChange[] = resource.fields.flatMap((f): FieldChange[] => {
      const before = currentByName.get(f.name.toLowerCase());
      if (!before) return [{ name: f.name, kind: "added", after: f }];
      // The model is told to describe only what's added or changed, so it re-lists a field
      // even when nothing about it actually differs; only surface it as a real change.
      if (fieldChangeDetails(before, f).length === 0) return [];
      return [{ name: f.name, kind: "changed", before, after: f }];
    });
    changedResources.push({
      name: current.name,
      isNew: false,
      fields,
      recordCount: resource.records.length,
      inboundLinks: resource.records.length > 0 ? inboundLinksFor(current) : [],
    });
    addStandardEndpoints(current);
  }

  for (const c of plan.customEndpoints) {
    if (!project.routes.some((r) => r.method === c.method && r.path === c.path) && !newEndpoints.some((e) => e.method === c.method && e.path === c.path)) {
      newEndpoints.push({ method: c.method, path: c.path, description: c.description });
    }
  }

  // Removals: consequences, not just names — this preview is the user's only consent step.
  // Anything that resolves to nothing real (already gone, or never existed) is dropped
  // rather than shown as a no-op; `parseEditPlan` already validates against the project, so
  // this is defensive, not the primary guard.
  const removalFields: FieldRemovalDiff[] = [];
  for (const r of plan.removals?.fields ?? []) {
    const model = project.models.find((m) => m.name === r.resource);
    const field = model?.fields.find((f) => f.name.toLowerCase() === r.field.toLowerCase());
    if (!model || !field) continue;
    const recordCount = (recordsByName[model.name] ?? []).filter((rec) => hasValue(rec[field.name])).length;
    removalFields.push({ resource: model.name, field: field.name, recordCount });
  }

  const removalResources: ResourceRemovalDiff[] = [];
  for (const name of plan.removals?.resources ?? []) {
    const model = project.models.find((m) => m.name === name);
    if (!model) continue;
    const recordCount = recordCounts[model.name] ?? recordsByName[model.name]?.length ?? 0;
    const endpointCount = project.routes.filter((r) => r.modelId === model.id).length;
    removalResources.push({ name: model.name, recordCount, endpointCount, inboundLinks: inboundLinksFor(model) });
  }

  const removalEndpoints: EndpointRemovalDiff[] = [];
  for (const e of plan.removals?.endpoints ?? []) {
    if (!project.routes.some((r) => r.method === e.method && r.path === e.path)) continue;
    removalEndpoints.push({ method: e.method, path: e.path });
  }

  return { newResources, changedResources, newEndpoints, removals: { resources: removalResources, fields: removalFields, endpoints: removalEndpoints } };
}
