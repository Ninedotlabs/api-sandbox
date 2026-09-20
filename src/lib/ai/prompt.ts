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
    .map((r) => {
      const fieldsStr = r.fields.map((f) => `${f.name} (${f.type}${f.required ? ", required" : ""}${f.unique ? ", unique" : ""}${f.linkTo ? `, links to ${f.linkTo}` : ""})`).join(", ") || "no fields yet";
      const ids = r.recordIds ?? [];
      const idsStr = ids.length ? ` [ids: ${ids.slice(0, 20).join(", ")}${ids.length > 20 ? ", …" : ""}]` : "";
      return `- ${r.name}: ${fieldsStr}${idsStr}`;
    })
    .join("\n");
  return [
    "You edit an existing mock REST API. From the instruction, return only what's added or changed — never repeat what you're leaving untouched.",
    `Field types: ${types}. Field names are camelCase and start with a letter. Never include an id field.`,
    opts.existing.length
      ? `These resources already exist:\n${resourceList}`
      : "No resources exist yet; anything you return is new.",
    "For a resource you are adding, use its full field list and up to 8 realistic sample records, as if starting fresh.",
    "For a resource you're changing, use its existing exact name and list in \"fields\" only what's added or changed — never repeat a field you're leaving alone. If you also change its data, \"records\" must be the complete new sample set, including a value for every field it has, both ones you listed and ones it already had; otherwise leave \"records\" empty.",
    "Use choice with an options list for fixed sets, and link with linkTo set to another resource's exact name. A link's value is a 1-based index (\"1\", \"2\", ...) into the target's new records if you're adding or changing it, or one of its existing ids (listed above) if you're not.",
    "Every record must include all required fields, respect unique fields, use realistic varied values, and give every value as a string (numbers like \"12.5\", booleans \"true\"/\"false\", dates \"2026-01-31\").",
    "For an endpoint beyond list/get/create/update/delete, add it to customEndpoints with a method, a path starting with /, its resource (or null), and a one-sentence description; standard endpoints are automatic — never list them in customEndpoints.",
    "Never propose removing a resource, field or endpoint. If part of the instruction asks for a removal, ignore that part and do the rest.",
  ].filter(Boolean).join("\n");
}
