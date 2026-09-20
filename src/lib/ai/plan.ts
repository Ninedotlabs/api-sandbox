import { z } from "zod";
import { FIELD_TYPES } from "@/lib/field-types";
import { validateBody, type Dataset } from "@/lib/mock-engine";
import type { Field, FieldType, Model } from "@/lib/types";
import { validateFieldName, validateModelName } from "@/lib/validation";

export class PlanError extends Error {}

const typeEnum = z.enum(FIELD_TYPES.map((t) => t.type) as [FieldType, ...FieldType[]]);

export const wireSchema = z.object({
  resources: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      fields: z.array(
        z.object({ name: z.string(), type: typeEnum, required: z.boolean(), unique: z.boolean(), options: z.array(z.string()).nullable(), linkTo: z.string().nullable() }),
      ),
      records: z.array(z.object({ entries: z.array(z.object({ field: z.string(), value: z.string() })) })),
    }),
  ),
});
type Wire = z.infer<typeof wireSchema>;

export interface PlanField { name: string; type: FieldType; required: boolean; unique: boolean; options?: string[]; linkTo?: string }
export interface PlanResource { name: string; description: string; fields: PlanField[]; records: Record<string, unknown>[] }
export interface ApiPlan { resources: PlanResource[] }

/** Closed objects + all keys required, as OpenAI-style strict structured outputs demand. */
export function strictJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(wireSchema) as Record<string, unknown>;
  delete schema.$schema;
  const close = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object" && n.properties && typeof n.properties === "object") {
      n.additionalProperties = false;
      n.required = Object.keys(n.properties as object);
      Object.values(n.properties as object).forEach(close);
    }
    if (n.items) close(n.items);
    if (Array.isArray(n.anyOf)) n.anyOf.forEach(close);
  };
  close(schema);
  return schema;
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  let n = 2;
  while (taken.has(`${name}${n}`.toLowerCase())) n++;
  return `${name}${n}`;
}

function coerce(field: PlanField, value: string): unknown {
  switch (field.type) {
    case "number": { const n = Number(value); return value.trim() === "" || Number.isNaN(n) ? value : n; }
    case "boolean": return value.toLowerCase() === "true" ? true : value.toLowerCase() === "false" ? false : value;
    case "json": { try { return JSON.parse(value); } catch { return value; } }
    default: return value;
  }
}

export function parsePlan(raw: unknown, existingNames: string[]): { plan: ApiPlan; warnings: string[] } {
  const parsed = wireSchema.safeParse(raw);
  if (!parsed.success) throw new PlanError("The model's answer did not match the expected shape.");
  const warnings: string[] = [];
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const renames = new Map<string, string>();

  // 1. Resource names
  const resources = parsed.data.resources.slice(0, 6).flatMap((r): Wire["resources"] => {
    const cleaned = r.name.trim().replace(/[^A-Za-z0-9 ]/g, "");
    if (validateModelName(cleaned, [])) { warnings.push(`Skipped a resource with an unusable name (${JSON.stringify(r.name)}).`); return []; }
    const name = uniqueName(cleaned, taken);
    if (name !== cleaned) warnings.push(`Renamed ${cleaned} to ${name} because a resource with that name already exists.`);
    taken.add(name.toLowerCase());
    renames.set(r.name, name);
    return [{ ...r, name }];
  });
  if (resources.length === 0) throw new PlanError("The description didn't produce any resources.");
  const planNames = new Set(resources.map((r) => r.name));

  // 2. Fields and records
  const plan: ApiPlan = { resources: [] };
  for (const r of resources) {
    const fields: PlanField[] = [];
    for (const f of r.fields.slice(0, 12)) {
      const fname = f.name.trim();
      if (fname.toLowerCase() === "id") { warnings.push(`${r.name}: dropped the id field; ids are added automatically.`); continue; }
      const asFields = fields.map((x, i) => ({ id: String(i), name: x.name, type: x.type, required: x.required, unique: x.unique }) as Field);
      if (validateFieldName(fname, asFields)) { warnings.push(`${r.name}: dropped field ${JSON.stringify(f.name)} (invalid or duplicate name).`); continue; }
      let field: PlanField = { name: fname, type: f.type, required: f.required, unique: f.unique };
      if (f.type === "choice") {
        const options = (f.options ?? []).map((o) => o.trim()).filter(Boolean);
        if (options.length === 0) { warnings.push(`${r.name}: ${fname} had no choices, changed to text.`); field = { ...field, type: "text" }; }
        else field.options = options;
      }
      if (f.type === "link") {
        const target = f.linkTo ? (renames.get(f.linkTo) ?? f.linkTo) : null;
        if (!target || !planNames.has(target)) { warnings.push(`${r.name}: ${fname} linked to an unknown resource, changed to text.`); field = { ...field, type: "text" }; }
        else field.linkTo = target;
      }
      fields.push(field);
    }
    plan.resources.push({ name: r.name, description: r.description.trim(), fields, records: [] });
  }

  // 3. Records, validated with the mock engine against a dataset built from the plan itself
  const models: Model[] = plan.resources.map((r, i) => ({
    id: `plan-${i}`, name: r.name,
    fields: r.fields.map((f, j) => ({ id: `plan-${i}-${j}`, name: f.name, type: f.type, required: f.required, unique: f.unique, options: f.options, linkTo: f.linkTo ? `plan-${plan.resources.findIndex((x) => x.name === f.linkTo)}` : undefined })),
  }));
  const dataset: Dataset = Object.fromEntries(models.map((m) => [m.id, []]));
  resources.forEach((r, i) => {
    const model = models[i];
    const byName = new Map(plan.resources[i].fields.map((f) => [f.name, f]));
    let dropped = 0;
    for (const rec of r.records.slice(0, 12)) {
      const body: Record<string, unknown> = {};
      for (const e of rec.entries) { const f = byName.get(e.field); if (f) body[f.name] = coerce(f, e.value); }
      // Links point at records that may come later; validate them after all records exist.
      const linkFree = { ...body }; for (const f of model.fields) if (f.type === "link") delete linkFree[f.name];
      const errors = validateBody(model, linkFree, "create", dataset);
      if (errors.length) { dropped++; continue; }
      const id = String(dataset[model.id].length + 1);
      dataset[model.id].push({ ...body, id });
      plan.resources[i].records.push(body);
    }
    if (dropped) warnings.push(`${r.name}: dropped ${dropped} sample record${dropped === 1 ? "" : "s"} that did not match the schema.`);
  });
  return { plan, warnings };
}
