import { FIELD_TYPES } from "@/lib/field-types";
import type { ExistingResourceSummary } from "./plan";

export function buildInstruction(opts: { maxResources: number; recordsPerResource: number; existingNames: string[] }): string {
  const types = FIELD_TYPES.map((t) => `${t.type} (${t.description.toLowerCase()})`).join(", ");
  return [
    "You design mock REST APIs. From the user's description, return a JSON document with the resources their API stores.",
    `Return at most ${opts.maxResources} resources. Each resource has a singular PascalCase name (e.g. Product), a one-sentence description, up to 12 fields and exactly ${opts.recordsPerResource} sample records.`,
    `Field types: ${types}. Field names are camelCase and start with a letter. Never include an id field; ids are added automatically.`,
    "Use type choice with an options list for small fixed sets, and type link with linkTo set to another resource's name for relationships; link values in records are the 1-based index of the target record (\"1\", \"2\", ...).",
    "Every record must include all required fields, respect unique fields, use realistic varied values, and give every value as a string (numbers like \"12.5\", booleans \"true\"/\"false\", dates \"2026-01-31\").",
    opts.existingNames.length ? `These resource names already exist and must not be reused: ${opts.existingNames.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
}

export function buildEditInstruction(opts: { existing: ExistingResourceSummary[] }): string {
  const types = FIELD_TYPES.map((t) => `${t.type} (${t.description.toLowerCase()})`).join(", ");
  const resourceList = opts.existing
    .map((r) => `- ${r.name}: ${r.fields.map((f) => `${f.name} (${f.type}${f.required ? ", required" : ""}${f.unique ? ", unique" : ""}${f.linkTo ? `, links to ${f.linkTo}` : ""})`).join(", ") || "no fields yet"}`)
    .join("\n");
  return [
    "You edit an existing mock REST API. From the user's instruction, return only what should be added or changed — never repeat something you are leaving untouched.",
    `Field types: ${types}. Field names are camelCase and start with a letter. Never include an id field.`,
    opts.existing.length
      ? `These resources already exist:\n${resourceList}`
      : "No resources exist yet; anything you return is new.",
    "For a resource you are adding, use its full field list and up to 8 realistic sample records, as if starting fresh.",
    "For a resource you are changing, put its existing exact name in \"name\", and in \"fields\" list only the fields you are adding or changing — never repeat a field you are leaving alone. If you are also changing its data, \"records\" must be that resource's complete new sample set, including a value for every field it has (both ones you listed and ones it already had); leave \"records\" empty if its data should stay as it is.",
    "Use type choice with an options list for small fixed sets, and type link with linkTo set to another resource's exact name (existing or one you are adding) for relationships; link values in records are the 1-based index of the target record (\"1\", \"2\", ...) within that resource's own new records.",
    "Every record must include all required fields, respect unique fields, use realistic varied values, and give every value as a string (numbers like \"12.5\", booleans \"true\"/\"false\", dates \"2026-01-31\").",
    "If a resource needs an endpoint beyond the standard list/get/create/update/delete, add it to customEndpoints with a method, a path starting with /, the resource it belongs to (or null), and a one-sentence description. The standard endpoints for anything you add or change are created automatically — do not list those in customEndpoints.",
    "Never propose removing a resource, field or endpoint. If part of the instruction asks for a removal, ignore that part and do the rest.",
  ].filter(Boolean).join("\n");
}
