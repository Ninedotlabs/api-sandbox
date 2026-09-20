/**
 * Zod shapes for the `/api/v1` request bodies that carry a domain object (a `Model`, a
 * `Route`, a `Project`, or an undo payload wrapping one of those). Every object schema is
 * `.passthrough()`: a caller's extra field survives validation and is forwarded to the `pg`
 * service untouched, rather than being silently dropped by a schema that only knows today's
 * fields. `Route.response` (see `@/lib/types`) is validated explicitly rather than merely
 * passed through, since it is the one field whose contents become a served HTTP response
 * (or, for `template`/`body`, get parsed as JSON) - see `routeResponseSchema` below.
 */
import { z } from "zod";
import { FIELD_TYPES } from "@/lib/field-types";
import type { FieldType } from "@/lib/types";

const FIELD_TYPE_VALUES = FIELD_TYPES.map((t) => t.type) as [FieldType, ...FieldType[]];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const ROUTE_ACTIONS = ["list", "get", "create", "update", "delete", "custom"] as const;
const RESPONSE_MODES = ["auto", "template", "static"] as const;
const RESPONSE_QUERY_OPS = ["eq", "neq", "gt", "lt", "contains"] as const;

/** Enforced here, not only in the endpoint editor - see design §3: a template or static
 * body is data a public endpoint serves forever, so a caller that bypasses the UI (a raw
 * API call, an MCP tool) must not be able to write something oversized either. */
const RESPONSE_JSON_CAP_BYTES = 100_000;

/**
 * `template`/`body` accept either an already-parsed JSON value (an object, array, etc.) or
 * a raw JSON string - the shape the endpoint editor's text box naturally produces. A string
 * is parsed here, so malformed JSON is rejected at write time with a plain-language error
 * instead of silently becoming a literal string the engine can never substitute into.
 * Either way, the cap applies to the value's actual serialized size, in bytes.
 */
function jsonValueSchema(label: string) {
  return z
    .unknown()
    .transform((value, ctx) => {
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} must be valid JSON` });
        return z.NEVER;
      }
    })
    .superRefine((value, ctx) => {
      let serialized: string | undefined;
      try {
        serialized = JSON.stringify(value);
      } catch {
        serialized = undefined;
      }
      if (serialized === undefined) {
        ctx.addIssue({ code: "custom", message: `${label} must be valid JSON` });
        return;
      }
      if (Buffer.byteLength(serialized, "utf8") > RESPONSE_JSON_CAP_BYTES) {
        ctx.addIssue({ code: "custom", message: `${label} must be smaller than 100KB` });
      }
    });
}

const responseQueryFilterSchema = z
  .object({
    field: requiredString("response.query.filter[].field is required"),
    op: z.enum(RESPONSE_QUERY_OPS, { message: "response.query.filter[].op is invalid" }),
    value: z.string(),
  })
  .passthrough();

const responseQuerySchema = z
  .object({
    modelId: requiredString("response.query.modelId is required"),
    filter: z.array(responseQueryFilterSchema).optional(),
    sort: z
      .object({ field: requiredString("response.query.sort.field is required"), dir: z.enum(["asc", "desc"], { message: "response.query.sort.dir is invalid" }) })
      .passthrough()
      .optional(),
    limit: z.number().int().positive().optional(),
  })
  .passthrough();

/** See `RouteResponse` in `@/lib/types`. Absent means today's behaviour - the engine's own
 * status/body, untouched. */
export const routeResponseSchema = z
  .object({
    mode: z.enum(RESPONSE_MODES, { message: "response.mode is required" }),
    status: z.number().int().min(100).max(599).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    template: jsonValueSchema("response.template").optional(),
    body: jsonValueSchema("response.body").optional(),
    query: responseQuerySchema.optional(),
  })
  .passthrough();

/**
 * A non-empty, trimmed string, reporting `message` both when the field is missing/of the
 * wrong type and when it's present but blank - a caller shouldn't get two different error
 * strings for "you left this out" and "you left this empty".
 */
export function requiredString(message: string) {
  return z.string({ message }).trim().min(1, message);
}

export const fieldSchema = z
  .object({
    id: requiredString("fields[].id is required"),
    name: requiredString("fields[].name is required"),
    type: z.enum(FIELD_TYPE_VALUES, { message: "fields[].type is invalid" }),
    required: z.boolean(),
    unique: z.boolean(),
    options: z.array(z.string()).optional(),
    linkTo: z.string().optional(),
  })
  .passthrough();

export const modelSchema = z
  .object({
    id: requiredString("id is required"),
    name: requiredString("name is required"),
    fields: z.array(fieldSchema).default([]),
  })
  .passthrough();

export const routeSchema = z
  .object({
    id: requiredString("id is required"),
    method: z.enum(HTTP_METHODS, { message: "method is required" }),
    path: requiredString("path is required"),
    modelId: z.string().nullable(),
    action: z.enum(ROUTE_ACTIONS, { message: "action is required" }),
    description: z.string().default(""),
    filters: z.array(z.string()).default([]),
    response: routeResponseSchema.optional(),
  })
  .passthrough();

/** Same as `routeSchema`, but for `POST routes` where a caller may not have minted an id yet. */
export const newRouteSchema = routeSchema.extend({ id: requiredString("id is required").optional() });

export const projectSchema = z
  .object({
    id: requiredString("id is required"),
    name: requiredString("name is required"),
    slug: requiredString("slug is required"),
    description: z.string().default(""),
    models: z.array(modelSchema).default([]),
    routes: z.array(routeSchema).default([]),
    createdAt: requiredString("createdAt is required"),
    updatedAt: requiredString("updatedAt is required"),
  })
  .passthrough();

export const removedRouteSchema = z.object({
  route: routeSchema,
  beforeId: z.string().nullable(),
});

export const removedModelSchema = z.object({
  model: modelSchema,
  beforeId: z.string().nullable(),
  routes: z.array(removedRouteSchema).default([]),
  links: z.array(z.object({ modelId: z.string(), fieldId: z.string() })).default([]),
  records: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const removedProjectSchema = z.object({
  project: projectSchema,
  records: z.array(z.object({ modelId: z.string(), records: z.array(z.record(z.string(), z.unknown())) })).default([]),
});
