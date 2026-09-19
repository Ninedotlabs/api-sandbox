export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type FieldType = "text" | "number" | "boolean" | "date" | "email" | "url" | "choice" | "link" | "json";
export type RouteAction = "list" | "get" | "create" | "update" | "delete" | "custom";
export type TemplateId = "blog" | "store" | "todo";

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
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
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
