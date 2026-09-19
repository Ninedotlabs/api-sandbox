import type { Model } from "./types";

export type FormValues = Record<string, string | boolean | undefined>;

export function buildBody(model: Model, values: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of model.fields) {
    const value = values[field.name];
    if (value === undefined || value === "") continue;
    switch (field.type) {
      case "number": {
        const n = Number(value);
        body[field.name] = Number.isNaN(n) ? value : n;
        break;
      }
      case "boolean":
        body[field.name] = value === true || value === "true";
        break;
      case "json":
        try {
          body[field.name] = JSON.parse(String(value));
        } catch {
          body[field.name] = value;
        }
        break;
      default:
        body[field.name] = value;
    }
  }
  return body;
}

export function valuesFromBody(model: Model, body: unknown): FormValues {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return {};
  const input = body as Record<string, unknown>;
  const values: FormValues = {};
  for (const field of model.fields) {
    const value = input[field.name];
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") values[field.name] = value;
    else if (typeof value === "object") values[field.name] = JSON.stringify(value);
    else values[field.name] = String(value);
  }
  return values;
}
