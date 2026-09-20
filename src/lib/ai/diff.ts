import { crudOptions } from "@/lib/crud";
import type { Field, HttpMethod, Model, Project } from "@/lib/types";
import type { EditPlan, PlanField } from "./plan";

export interface FieldChange { name: string; kind: "added" | "changed"; before?: PlanField; after: PlanField }
/** Another model whose link field will dangle once this resource's records are replaced
 * (ids are reassigned 1..N, so nothing that pointed at the old ids still resolves). */
export interface InboundLink { modelName: string; fieldName: string; recordCount: number }
export interface ResourceDiff { name: string; isNew: boolean; fields: FieldChange[]; recordCount: number; inboundLinks: InboundLink[] }
export interface EndpointDiff { method: HttpMethod; path: string; description: string }
export interface EditDiff { newResources: ResourceDiff[]; changedResources: ResourceDiff[]; newEndpoints: EndpointDiff[] }

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

/**
 * `recordCounts` is each model's known record count, keyed by name (best-effort: the panel
 * supplies what it already fetched to build the AI request, capped the same way). It's only
 * used to disclose inbound links that are about to dangle; omitting it just suppresses that
 * disclosure, it never affects anything else in the diff.
 */
export function computeEditDiff(project: Project, plan: EditPlan, recordCounts: Record<string, number> = {}): EditDiff {
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

  return { newResources, changedResources, newEndpoints };
}
