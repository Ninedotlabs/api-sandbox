import type { FieldType } from "./types";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: string;
  description: string;
  advanced?: boolean;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: "text", label: "Text", icon: "Aa", description: "Names, titles, any words" },
  { type: "number", label: "Number", icon: "#", description: "Prices, counts, ages" },
  { type: "boolean", label: "Yes/No", icon: "◐", description: "On or off, true or false" },
  { type: "date", label: "Date", icon: "📅", description: "A calendar day" },
  { type: "email", label: "Email", icon: "@", description: "An email address, checked for format" },
  { type: "url", label: "URL", icon: "🔗", description: "A web link" },
  { type: "choice", label: "Choice list", icon: "☰", description: "One option from a list you define" },
  { type: "link", label: "Link to model", icon: "↗", description: "Connect to a record in another model" },
  { type: "json", label: "JSON", icon: "{}", description: "Free-form structured data", advanced: true },
];

export function fieldTypeMeta(type: FieldType): FieldTypeMeta {
  const meta = FIELD_TYPES.find((f) => f.type === type);
  if (!meta) throw new Error(`Unknown field type: ${type}`);
  return meta;
}
