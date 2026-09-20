import { randomUUID } from "node:crypto";
import type { DataRecord, EngineResult } from "./mock-engine";
import type { Model, ResponseQuery, ResponseQueryFilter, Route } from "./types";

/**
 * What `applyResponseShape` needs beyond the engine's own result: the request's params,
 * query string and body (for the `{{params.*}}` / `{{query.*}}` / `{{body.*}}` placeholders),
 * plus the records resolved for a custom endpoint's `response.query`, when there is one.
 * `records` is left undefined for ordinary CRUD routes so template mode falls back to
 * whatever the engine itself produced (see `deriveRecordContext` below).
 */
export interface ResponseContext {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  records?: DataRecord[];
}

export interface ShapedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  /** Human-readable notes - e.g. an unknown placeholder - surfaced in the editor's preview. */
  warnings: string[];
}

const NO_RESPONSE_MESSAGE =
  "This endpoint has no response defined yet. Open its Response tab and choose a template or " +
  "static response - or set one through the API's `response` field - to control what it returns.";

/** A string is a whole-value placeholder only when nothing else shares the string with it. */
const WHOLE_PLACEHOLDER_RE = /^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/;
const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

interface Placeholders {
  records: unknown;
  record: unknown;
  count: number;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  now: string;
  uuid: string;
}

function resolvePlaceholder(name: string, ctx: Placeholders): { value: unknown; found: boolean } {
  switch (name) {
    case "records":
      return { value: ctx.records, found: true };
    case "record":
      return { value: ctx.record, found: true };
    case "count":
      return { value: ctx.count, found: true };
    case "now":
      return { value: ctx.now, found: true };
    case "uuid":
      return { value: ctx.uuid, found: true };
  }
  const paramsMatch = /^params\.(.+)$/.exec(name);
  if (paramsMatch) {
    const key = paramsMatch[1];
    const found = Object.prototype.hasOwnProperty.call(ctx.params, key);
    return { value: found ? ctx.params[key] : null, found };
  }
  const queryMatch = /^query\.(.+)$/.exec(name);
  if (queryMatch) {
    const key = queryMatch[1];
    const found = Object.prototype.hasOwnProperty.call(ctx.query, key);
    return { value: found ? ctx.query[key] : null, found };
  }
  const bodyMatch = /^body\.(.+)$/.exec(name);
  if (bodyMatch) {
    const key = bodyMatch[1];
    const bodyObj = ctx.body;
    const found = typeof bodyObj === "object" && bodyObj !== null && !Array.isArray(bodyObj) && key in (bodyObj as Record<string, unknown>);
    return { value: found ? (bodyObj as Record<string, unknown>)[key] : null, found };
  }
  return { value: null, found: false };
}

function stringifyForInterpolation(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Literal placeholder substitution over a JSON tree. Never evaluates anything: a string
 * that isn't exactly one recognised `{{placeholder}}` (whole-value) or doesn't contain one
 * (in-string) passes through completely untouched, whatever it looks like.
 */
function substitute(node: unknown, ctx: Placeholders, warnings: Set<string>): unknown {
  if (typeof node === "string") {
    const whole = WHOLE_PLACEHOLDER_RE.exec(node);
    if (whole) {
      const { value, found } = resolvePlaceholder(whole[1], ctx);
      if (!found) warnings.add(whole[1]);
      return found ? value : null;
    }
    if (!PLACEHOLDER_RE.test(node)) return node;
    PLACEHOLDER_RE.lastIndex = 0;
    return node.replace(PLACEHOLDER_RE, (_match, name: string) => {
      const { value, found } = resolvePlaceholder(name, ctx);
      if (!found) warnings.add(name);
      return stringifyForInterpolation(found ? value : null);
    });
  }
  if (Array.isArray(node)) return node.map((n) => substitute(n, ctx, warnings));
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) out[key] = substitute(value, ctx, warnings);
    return out;
  }
  return node;
}

/** Derives {{records}}/{{record}}/{{count}} either from an explicit response query's
 * results, or - when there isn't one - from the shape the engine itself already produced. */
function deriveRecordContext(
  route: Route,
  engineResult: EngineResult,
  context: ResponseContext,
): { records: unknown; record: unknown; count: number } {
  if (context.records) {
    return { records: context.records, record: context.records[0] ?? null, count: context.records.length };
  }
  const body = engineResult.body;
  if (route.action === "list" && body && typeof body === "object" && "data" in body) {
    const data = (body as { data: unknown }).data;
    const records = Array.isArray(data) ? data : [];
    const count = "count" in body && typeof (body as { count: unknown }).count === "number" ? (body as { count: number }).count : records.length;
    return { records, record: records[0] ?? null, count };
  }
  if ((route.action === "get" || route.action === "create" || route.action === "update") && body && typeof body === "object") {
    return { records: [body], record: body, count: 1 };
  }
  return { records: [], record: null, count: 0 };
}

/**
 * Applies a route's `response` definition to the engine's raw result. With no `response`
 * (or `mode: "auto"` and nothing else set) this is byte-identical to the engine's own
 * output - every existing route must keep working untouched.
 */
export function applyResponseShape(route: Route, engineResult: EngineResult, context: ResponseContext): ShapedResponse {
  if (route.action === "custom" && !route.response) {
    return { status: 501, headers: {}, body: { error: NO_RESPONSE_MESSAGE }, warnings: [] };
  }

  const response = route.response;
  const mode = response?.mode ?? "auto";

  if (mode === "auto") {
    return {
      status: response?.status ?? engineResult.status,
      headers: response?.headers ?? {},
      body: engineResult.body,
      warnings: [],
    };
  }

  if (mode === "static") {
    return {
      status: response?.status ?? 200,
      headers: response?.headers ?? {},
      body: response?.body ?? null,
      warnings: [],
    };
  }

  // mode === "template"
  const { records, record, count } = deriveRecordContext(route, engineResult, context);
  const placeholders: Placeholders = {
    records,
    record,
    count,
    params: context.params,
    query: context.query,
    body: context.body,
    now: new Date().toISOString(),
    uuid: randomUUID(),
  };
  const warnings = new Set<string>();
  const body = substitute(response?.template ?? null, placeholders, warnings);
  return {
    status: response?.status ?? engineResult.status,
    headers: response?.headers ?? {},
    body,
    warnings: [...warnings].map((name) => `Unknown placeholder: {{${name}}}`),
  };
}

function toComparable(value: unknown): number | string {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value === null || value === undefined) return "";
  const n = Number(value);
  if (!Number.isNaN(n) && String(value).trim() !== "") return n;
  return String(value);
}

function matchesFilter(record: DataRecord, filter: ResponseQueryFilter): boolean {
  const raw = record[filter.field];
  switch (filter.op) {
    case "eq":
      return String(raw) === filter.value;
    case "neq":
      return String(raw) !== filter.value;
    case "gt": {
      const a = toComparable(raw);
      const b = toComparable(filter.value);
      return typeof a === "number" && typeof b === "number" ? a > b : String(a) > String(b);
    }
    case "lt": {
      const a = toComparable(raw);
      const b = toComparable(filter.value);
      return typeof a === "number" && typeof b === "number" ? a < b : String(a) < String(b);
    }
    case "contains":
      return raw !== undefined && raw !== null && String(raw).includes(filter.value);
    default:
      return false;
  }
}

/** Filters, sorts and limits records for a custom endpoint's `response.query`. Never
 * throws - a filter naming a field that doesn't exist on the record just matches nothing. */
export function runResponseQuery(_model: Model, records: DataRecord[], query: ResponseQuery): DataRecord[] {
  let result = records;
  if (query.filter?.length) {
    const filters = query.filter;
    result = result.filter((r) => filters.every((f) => matchesFilter(r, f)));
  }
  if (query.sort) {
    const { field, dir } = query.sort;
    const sign = dir === "desc" ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = toComparable(a[field]);
      const bv = toComparable(b[field]);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av).localeCompare(String(bv)) * sign;
    });
  }
  if (typeof query.limit === "number") {
    result = result.slice(0, query.limit);
  }
  return result;
}
