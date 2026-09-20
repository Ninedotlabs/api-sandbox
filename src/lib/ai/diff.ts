import { crudOptions } from "@/lib/crud";
import type { HttpMethod, Model, Project } from "@/lib/types";
import type { EditPlan, PlanField } from "./plan";

export interface FieldChange { name: string; kind: "added" | "changed"; before?: PlanField; after: PlanField }
export interface ResourceDiff { name: string; isNew: boolean; fields: FieldChange[]; recordCount: number }
export interface EndpointDiff { method: HttpMethod; path: string; description: string }
export interface EditDiff { newResources: ResourceDiff[]; changedResources: ResourceDiff[]; newEndpoints: EndpointDiff[] }

function toPlanField(f: { name: string; type: PlanField["type"]; required: boolean; unique: boolean; options?: string[]; linkTo?: string }): PlanField {
  return { name: f.name, type: f.type, required: f.required, unique: f.unique, ...(f.options ? { options: f.options } : {}), ...(f.linkTo ? { linkTo: f.linkTo } : {}) };
}

const asStandIn = (name: string): Model => ({ id: name, name, fields: [] });

export function computeEditDiff(project: Project, plan: EditPlan): EditDiff {
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

  for (const resource of plan.resources) {
    const current = project.models.find((m) => m.name.toLowerCase() === resource.name.toLowerCase());
    if (!current) {
      newResources.push({
        name: resource.name,
        isNew: true,
        fields: resource.fields.map((f) => ({ name: f.name, kind: "added", after: f })),
        recordCount: resource.records.length,
      });
      addStandardEndpoints(asStandIn(resource.name));
      continue;
    }
    const currentByName = new Map(current.fields.map((f) => [f.name.toLowerCase(), toPlanField(f)]));
    const fields: FieldChange[] = resource.fields.map((f) => {
      const before = currentByName.get(f.name.toLowerCase());
      return before ? { name: f.name, kind: "changed", before, after: f } : { name: f.name, kind: "added", after: f };
    });
    changedResources.push({ name: current.name, isNew: false, fields, recordCount: resource.records.length });
    addStandardEndpoints(current);
  }

  for (const c of plan.customEndpoints) {
    if (!project.routes.some((r) => r.method === c.method && r.path === c.path) && !newEndpoints.some((e) => e.method === c.method && e.path === c.path)) {
      newEndpoints.push({ method: c.method, path: c.path, description: c.description });
    }
  }

  return { newResources, changedResources, newEndpoints };
}
