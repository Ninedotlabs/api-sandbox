import { faker } from "@faker-js/faker";
import type { Field, Model, Project, Route } from "./types";

export type DataRecord = Record<string, unknown> & { id: string };
export type Dataset = Record<string, DataRecord[]>;
export interface EngineRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}
export interface EngineResult {
  status: number;
  body: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nextId(records: DataRecord[]): number {
  return records.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function generateValue(field: Field, dataset: Dataset): unknown {
  const name = field.name.toLowerCase();
  switch (field.type) {
    case "text":
      if (name.includes("name")) return faker.person.fullName();
      if (name.includes("title")) return faker.lorem.sentence(4);
      return faker.lorem.words(3);
    case "number":
      return faker.number.int({ min: 1, max: 500 });
    case "boolean":
      return faker.datatype.boolean();
    case "date":
      return faker.date.recent({ days: 30 }).toISOString().slice(0, 10);
    case "email":
      return faker.internet.email().toLowerCase();
    case "url":
      return faker.internet.url();
    case "choice":
      return field.options?.length ? faker.helpers.arrayElement(field.options) : null;
    case "link": {
      const targets = field.linkTo ? (dataset[field.linkTo] ?? []) : [];
      return targets.length ? faker.helpers.arrayElement(targets).id : null;
    }
    case "json":
      return { note: faker.lorem.word() };
  }
}

export function generateRecords(model: Model, count: number, dataset: Dataset): DataRecord[] {
  const start = nextId(dataset[model.id] ?? []);
  return Array.from({ length: count }, (_, i) => ({
    ...Object.fromEntries(model.fields.map((f) => [f.name, generateValue(f, dataset)])),
    id: String(start + i),
  }));
}

export function ensureDataset(project: Project, dataset: Dataset, count = 5): Dataset {
  for (const model of project.models) {
    if (!dataset[model.id]) dataset[model.id] = generateRecords(model, count, dataset);
  }
  // Fill links whose target model was generated after the linking model.
  for (const model of project.models) {
    for (const field of model.fields) {
      if (field.type !== "link") continue;
      for (const record of dataset[model.id]) {
        if (record[field.name] === null) record[field.name] = generateValue(field, dataset);
      }
    }
  }
  return dataset;
}

export function seedDataset(project: Project, count = 5, seed = 42): Dataset {
  faker.seed(seed);
  return ensureDataset(project, {}, count);
}

function typeError(field: Field, value: unknown, dataset: Dataset): string | null {
  const q = `'${field.name}'`;
  switch (field.type) {
    case "text":
      return typeof value === "string" ? null : `${q} should be text`;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? null : `${q} should be a number`;
    case "boolean":
      return typeof value === "boolean" ? null : `${q} should be true or false`;
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? null : `${q} should be a date, like 2026-01-31`;
    case "email":
      return typeof value === "string" && EMAIL_RE.test(value) ? null : `${q} should be an email address`;
    case "url":
      if (typeof value !== "string") return `${q} should be a web link`;
      try {
        new URL(value);
        return null;
      } catch {
        return `${q} should be a web link, like https://example.com`;
      }
    case "choice":
      return field.options?.includes(String(value)) ? null : `${q} should be one of: ${(field.options ?? []).join(", ")}`;
    case "link":
      if (!field.linkTo || !dataset[field.linkTo]) return null;
      return dataset[field.linkTo].some((r) => r.id === String(value)) ? null : `${q} points to a record that doesn't exist`;
    case "json":
      return null;
  }
  return null;
}

export function validateBody(
  model: Model,
  body: unknown,
  mode: "create" | "update",
  dataset: Dataset,
  selfId?: string,
): string[] {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return [`Send the data as an object, like { "name": "..." }`];
  }
  const input = body as Record<string, unknown>;
  const errors: string[] = [];
  const known = new Set(model.fields.map((f) => f.name));
  for (const key of Object.keys(input)) {
    if (key !== "id" && !known.has(key)) errors.push(`'${key}' is not a field on ${model.name}`);
  }
  for (const field of model.fields) {
    const present = field.name in input;
    const value = input[field.name];
    if (isEmpty(value)) {
      if (field.required && (mode === "create" || present)) errors.push(`'${field.name}' is required`);
      continue;
    }
    const err = typeError(field, value, dataset);
    if (err) {
      errors.push(err);
      continue;
    }
    if (field.unique && (dataset[model.id] ?? []).some((r) => r.id !== selfId && r[field.name] === value)) {
      errors.push(`'${field.name}' must be unique. Another record already uses this value`);
    }
  }
  return errors;
}

function pickFields(model: Model, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of model.fields) {
    if (f.name in input && !isEmpty(input[f.name])) {
      out[f.name] = f.type === "link" ? String(input[f.name]) : input[f.name];
    }
  }
  return out;
}

export function executeRoute(project: Project, route: Route, req: EngineRequest, dataset: Dataset): EngineResult {
  const model = project.models.find((m) => m.id === route.modelId);
  if (!model || route.action === "custom") {
    return { status: 200, body: { message: "This route has no model action yet. Link it to a model to return data." } };
  }
  const records = (dataset[model.id] ??= []);
  const id = req.params.id;
  const index = records.findIndex((r) => r.id === String(id));
  const notFound: EngineResult = { status: 404, body: { error: `No ${model.name.toLowerCase()} with id ${id}` } };
  const invalid = (details: string[]): EngineResult => ({ status: 400, body: { error: "Validation failed", details } });

  switch (route.action) {
    case "list": {
      const data = records.filter((r) =>
        route.filters.every((name) => !req.query[name] || String(r[name]) === req.query[name]),
      );
      return { status: 200, body: { data, count: data.length } };
    }
    case "get":
      return index < 0 ? notFound : { status: 200, body: records[index] };
    case "create": {
      const errors = validateBody(model, req.body, "create", dataset);
      if (errors.length) return invalid(errors);
      const record: DataRecord = {
        ...Object.fromEntries(model.fields.map((f) => [f.name, null])),
        ...pickFields(model, req.body as Record<string, unknown>),
        id: String(nextId(records)),
      };
      records.push(record);
      return { status: 201, body: record };
    }
    case "update": {
      if (index < 0) return notFound;
      const errors = validateBody(model, req.body, "update", dataset, records[index].id);
      if (errors.length) return invalid(errors);
      records[index] = { ...records[index], ...pickFields(model, req.body as Record<string, unknown>) };
      return { status: 200, body: records[index] };
    }
    case "delete":
      if (index < 0) return notFound;
      records.splice(index, 1);
      return { status: 204, body: null };
    default:
      return { status: 500, body: { error: "Unknown action" } };
  }
}
