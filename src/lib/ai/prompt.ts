import { FIELD_TYPES } from "@/lib/field-types";

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
