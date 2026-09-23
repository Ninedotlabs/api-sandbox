import type { Field, Route } from "@/lib/types";

/** Shapes returned by `pg` for the raw table rows, and the mappers to the app's domain types. */

export interface FieldRow {
  id: string;
  name: string;
  type: Field["type"];
  required: boolean;
  is_unique: boolean;
  options: string[] | null;
  link_to: string | null;
  position: number;
}

export interface ModelRow {
  id: string;
  name: string;
  position: number;
}

export interface RouteRow {
  id: string;
  model_id: string | null;
  method: string;
  path: string;
  action: string;
  description: string;
  filters: string[];
  position: number;
  response?: Route["response"] | null;
}

export interface FieldRowWithModel extends FieldRow {
  model_id: string;
}

export interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string | null;
  created_at: Date;
  updated_at: Date;
}

export function fieldFromRow(row: FieldRow): Field {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    required: row.required,
    unique: row.is_unique,
    options: row.options ?? undefined,
    linkTo: row.link_to ?? undefined,
  };
}

export function routeFromRow(row: RouteRow): Route {
  return {
    id: row.id,
    method: row.method as Route["method"],
    path: row.path,
    modelId: row.model_id,
    action: row.action as Route["action"],
    description: row.description,
    filters: row.filters,
    ...(row.response != null ? { response: row.response } : {}),
  };
}
