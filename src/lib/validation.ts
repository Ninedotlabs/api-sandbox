import { z } from "zod";
import { routeParams } from "./paths";
import { slugify } from "./slug";
import type { Field, Model, Project, Route } from "./types";

const projectNameSchema = z.string().trim().min(1, "Give your API a name.").max(50, "Keep the name under 50 characters.");
const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes, like my-store.");
const modelNameSchema = z
  .string()
  .trim()
  .min(1, "Give the model a name.")
  .max(40, "Keep the name under 40 characters.")
  .regex(/^[A-Za-z][A-Za-z0-9 ]*$/, "Start with a letter, and use only letters, numbers and spaces.");
const fieldNameSchema = z
  .string()
  .trim()
  .min(1, "Give the field a name.")
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Start with a letter, and use only letters, numbers and underscores (no spaces).");
const SEGMENT = "(?:[a-z0-9-]+|:[A-Za-z][A-Za-z0-9]*)";
const pathSchema = z
  .string()
  .regex(new RegExp(`^(?:/${SEGMENT})+$`), "Paths start with / and use lowercase words, like /customers or /customers/:id.");

function firstIssue(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "This value isn't valid.");
}

export function validateProjectName(name: string, projects: Project[], selfId?: string): string | null {
  const err = firstIssue(projectNameSchema, name);
  if (err) return err;
  const slug = slugify(name);
  if (!slug) return "Use at least one letter or number.";
  if (projects.some((p) => p.id !== selfId && p.slug === slug)) return "You already have an API with this name.";
  return null;
}

export function validateSlug(slug: string, projects: Project[], selfId?: string): string | null {
  const err = firstIssue(slugSchema, slug);
  if (err) return err;
  if (projects.some((p) => p.id !== selfId && p.slug === slug)) return "Another API already uses this address.";
  return null;
}

export function validateModelName(name: string, models: Model[], selfId?: string): string | null {
  const err = firstIssue(modelNameSchema, name);
  if (err) return err;
  const key = name.trim().toLowerCase();
  if (models.some((m) => m.id !== selfId && m.name.trim().toLowerCase() === key)) return "A model with this name already exists.";
  return null;
}

export function validateFieldName(name: string, fields: Field[], selfId?: string): string | null {
  const err = firstIssue(fieldNameSchema, name);
  if (err) return err;
  const key = name.trim().toLowerCase();
  if (key === "id") return "'id' is added automatically. Pick another name.";
  if (fields.some((f) => f.id !== selfId && f.name.trim().toLowerCase() === key)) {
    return "This model already has a field with that name.";
  }
  return null;
}

export function fieldErrors(fields: Field[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const err =
      validateFieldName(field.name, fields, field.id) ??
      (field.type === "choice" && !field.options?.length ? "Add at least one choice." : null) ??
      (field.type === "link" && !field.linkTo ? "Pick which model this links to." : null);
    if (err) errors[field.id] = err;
  }
  return errors;
}

export function validateFields(fields: Field[]): string | null {
  return Object.values(fieldErrors(fields))[0] ?? null;
}

const NEEDS_ID: Route["action"][] = ["get", "update", "delete"];

export function validateRoute(route: Pick<Route, "id" | "method" | "path" | "action">, routes: Route[]): string | null {
  const err = firstIssue(pathSchema, route.path);
  if (err) return err;
  if (NEEDS_ID.includes(route.action) && !routeParams(route.path).includes("id")) {
    return "This action needs :id in the path, like /customers/:id.";
  }
  if (routes.some((r) => r.id !== route.id && r.method === route.method && r.path === route.path)) {
    return "Two routes can't share the same method and path.";
  }
  return null;
}
