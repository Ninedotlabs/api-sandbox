/**
 * Zod shapes for the `/api/v1` request bodies that carry a domain object (a `Model`, a
 * `Route`, a `Project`, or an undo payload wrapping one of those). Every object schema is
 * `.passthrough()`: a caller's extra field survives validation and is forwarded to the `pg`
 * service untouched, rather than being silently dropped by a schema that only knows today's
 * fields. That matters because `Route` is about to gain a `response` definition - routes
 * created or updated through here must carry a field like that through faithfully, without
 * this file (or the route handler that uses it) needing to change first.
 */
import { z } from "zod";
import { FIELD_TYPES } from "@/lib/field-types";
import type { FieldType } from "@/lib/types";

const FIELD_TYPE_VALUES = FIELD_TYPES.map((t) => t.type) as [FieldType, ...FieldType[]];
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const ROUTE_ACTIONS = ["list", "get", "create", "update", "delete", "custom"] as const;

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
