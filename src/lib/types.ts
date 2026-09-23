export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type FieldType = "text" | "number" | "boolean" | "date" | "email" | "url" | "choice" | "link" | "json";
export type RouteAction = "list" | "get" | "create" | "update" | "delete" | "custom";
export type TemplateId = "blog" | "store" | "todo";

export type ResponseMode = "auto" | "template" | "static";
export type ResponseQueryOp = "eq" | "neq" | "gt" | "lt" | "contains";

export interface ResponseQueryFilter {
  field: string;
  op: ResponseQueryOp;
  value: string;
}

/** Lets a custom endpoint read real stored data instead of inventing it. */
export interface ResponseQuery {
  modelId: string;
  filter?: ResponseQueryFilter[];
  sort?: { field: string; dir: "asc" | "desc" };
  limit?: number;
}

/**
 * How a route's response is shaped. Absent on a `Route` means today's behaviour
 * (the engine's own status/body, untouched) - see `applyResponseShape` in
 * `src/lib/response-shape.ts`, the only place this is interpreted.
 */
export interface RouteResponse {
  mode: ResponseMode;
  /** Overrides the engine's status. Auto mode keeps the engine's status when absent. */
  status?: number;
  /** Extra response headers, e.g. X-RateLimit-Remaining. */
  headers?: Record<string, string>;
  /** template mode: JSON containing {{placeholders}}. */
  template?: unknown;
  /** static mode: returned verbatim. */
  body?: unknown;
  /** Lets a custom endpoint read real data. Ignored in the CRUD actions. */
  query?: ResponseQuery;
}

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  unique: boolean;
  options?: string[];
  linkTo?: string;
}

export interface Model {
  id: string;
  name: string;
  fields: Field[];
}

export interface Route {
  id: string;
  method: HttpMethod;
  path: string;
  modelId: string | null;
  action: RouteAction;
  description: string;
  filters: string[];
  /** Absent means the engine's own CRUD behaviour, untouched. */
  response?: RouteResponse;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  /** The chosen icon's id. Null means "never chosen" — one is derived from the slug then,
   * so every project has a face without needing a row written for it. */
  icon?: string | null;
  models: Model[];
  routes: Route[];
  createdAt: string;
  updatedAt: string;
}

export interface TestRequest {
  routeId: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

export interface TestResponse {
  status: number;
  durationMs: number;
  body: unknown;
}
