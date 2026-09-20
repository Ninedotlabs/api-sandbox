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
  if (parsed.data.resources.length > 6) warnings.push("Trimmed to 6 resources.");
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
    if (r.fields.length > 12) warnings.push(`${r.name}: trimmed to 12 fields.`);
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

  // 3. Records, validated with the mock engine against a dataset built from the plan itself.
  // Two passes, because link values are 1-based indices into a resource that may be
  // validated later (or may itself drop records, shifting who ends up at which index):
  //   A. Validate and assign ids per resource, without link fields (so a *required* link
  //      never fails validation, and so we don't need the target's ids yet). Record, per
  //      resource, a map from each surviving record's original 1-based index to its
  //      assigned id.
  //   B. Once every resource has that map, resolve each link's raw index against the
  //      *target* resource's map. An index with no match becomes null, with one warning
  //      per resource+field summarizing how many records were affected.
  const models: Model[] = plan.resources.map((r, i) => ({
    id: `plan-${i}`, name: r.name,
    fields: r.fields.map((f, j) => ({ id: `plan-${i}-${j}`, name: f.name, type: f.type, required: f.required, unique: f.unique, options: f.options, linkTo: f.linkTo ? `plan-${plan.resources.findIndex((x) => x.name === f.linkTo)}` : undefined })),
  }));
  const dataset: Dataset = Object.fromEntries(models.map((m) => [m.id, []]));

  interface PendingRecord { body: Record<string, unknown>; linkRaw: { field: string; raw: string }[] }
  const pendingByResource: PendingRecord[][] = plan.resources.map(() => []);
  const originalToIdByResource: Map<number, string>[] = plan.resources.map(() => new Map());

  // Pass A
  resources.forEach((r, i) => {
    const model = models[i];
    // Link fields are validated in pass B against ids that may not exist yet; treat them
    // as optional here so a *required* link doesn't fail every record.
    const validationModel: Model = { ...model, fields: model.fields.map((f) => (f.type === "link" ? { ...f, required: false } : f)) };
    const byName = new Map(plan.resources[i].fields.map((f) => [f.name, f]));
    if (r.records.length > 12) warnings.push(`${r.name}: trimmed to 12 sample records.`);
    let dropped = 0;
    r.records.slice(0, 12).forEach((rec, idx) => {
      const originalIndex = idx + 1;
      const body: Record<string, unknown> = {};
      const linkRaw: { field: string; raw: string }[] = [];
      for (const e of rec.entries) {
        const f = byName.get(e.field);
        if (!f) continue;
        if (f.type === "link") { linkRaw.push({ field: f.name, raw: e.value }); continue; }
        body[f.name] = coerce(f, e.value);
      }
      const errors = validateBody(validationModel, body, "create", dataset);
      if (errors.length) { dropped++; return; }
      const id = String(dataset[model.id].length + 1);
      dataset[model.id].push({ ...body, id });
      pendingByResource[i].push({ body, linkRaw });
      originalToIdByResource[i].set(originalIndex, id);
    });
    if (dropped) warnings.push(`${r.name}: dropped ${dropped} sample record${dropped === 1 ? "" : "s"} that did not match the schema.`);
  });

  // Pass B
  resources.forEach((r, i) => {
    const fieldsByName = new Map(plan.resources[i].fields.map((f) => [f.name, f]));
    const unresolvedCounts = new Map<string, number>();
    for (const pending of pendingByResource[i]) {
      for (const { field, raw } of pending.linkRaw) {
        const f = fieldsByName.get(field);
        if (!f || f.type !== "link" || !f.linkTo) continue;
        const targetIndex = plan.resources.findIndex((x) => x.name === f.linkTo);
        const parsedIndex = Number(raw.trim());
        const resolved =
          targetIndex >= 0 && Number.isInteger(parsedIndex) && parsedIndex > 0
            ? originalToIdByResource[targetIndex].get(parsedIndex)
            : undefined;
        pending.body[field] = resolved ?? null;
        if (resolved === undefined) unresolvedCounts.set(field, (unresolvedCounts.get(field) ?? 0) + 1);
      }
    }
    for (const [field, count] of unresolvedCounts) {
      warnings.push(
        `${r.name}: ${count} sample record${count === 1 ? "" : "s"} had an unknown ${field} link and ${count === 1 ? "was" : "were"} left empty.`,
      );
    }
    plan.resources[i].records = pendingByResource[i].map((p) => p.body);
  });

  return { plan, warnings };
}
