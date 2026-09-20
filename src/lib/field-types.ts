import type { FieldType } from "./types";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  description: string;
  badge: string;
  advanced?: boolean;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: "text", label: "Text", description: "Names, titles, any words", badge: "string" },
  { type: "number", label: "Number", description: "Prices, counts, ages", badge: "number" },
  { type: "boolean", label: "Yes/No", description: "On or off, true or false", badge: "boolean" },
  { type: "date", label: "Date", description: "A calendar day", badge: "date" },
  { type: "email", label: "Email", description: "An email address, checked for format", badge: "email" },
  { type: "url", label: "URL", description: "A web link", badge: "url" },
  { type: "choice", label: "Choice list", description: "One option from a list you define", badge: "enum" },
  { type: "link", label: "Link to model", description: "Connect to a record in another model", badge: "ref" },
  { type: "json", label: "JSON", description: "Free-form structured data", badge: "json", advanced: true },
];

export function fieldTypeMeta(type: FieldType): FieldTypeMeta {
  const meta = FIELD_TYPES.find((f) => f.type === type);
  if (!meta) throw new Error(`Unknown field type: ${type}`);
  return meta;
}
