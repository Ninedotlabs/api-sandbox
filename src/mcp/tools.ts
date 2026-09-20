/**
 * Every operation Universal API exposes to a model, in one place. Both transports
 * (`src/mcp/stdio.ts` and `src/app/api/mcp/route.ts`) register exactly this list, so a tool
 * that exists in one and not the other is impossible by construction rather than merely
 * tested against - see `tools.test.ts`'s identical-list assertion (paired with the transports'
 * own tests) for the property that matters most here.
 *
 * Every handler is a thin wrapper over `/api/v1` (see `src/app/api/v1/**`), so the MCP server
 * has exactly the capabilities the management API has - no second data path, no privileged
 * backdoor. `call_mock_endpoint` is the one exception: it deliberately does not go through
 * `/api/v1`, since its whole purpose is to exercise a mock API the way a real client would.
 */
import { z } from "zod";
import type { ApiClient } from "./client";

const TEMPLATE_IDS = ["blog", "store", "todo"] as const;
const FIELD_TYPES = ["text", "number", "boolean", "date", "email", "url", "choice", "link", "json"] as const;
const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const ROUTE_ACTIONS = ["list", "get", "create", "update", "delete", "custom"] as const;
const RESPONSE_MODES = ["auto", "template", "static"] as const;
const RESPONSE_QUERY_OPS = ["eq", "neq", "gt", "lt", "contains"] as const;

function requiredString(message: string) {
  return z.string({ message }).trim().min(1, message);
}

export interface McpTool<A extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: A;
  handler(args: z.infer<A>, client: ApiClient): Promise<unknown>;
  /** True when the change takes effect immediately, no confirmation step in between. */
  destructive?: boolean;
}

const fieldSchema = z
  .object({
    id: requiredString("fields[].id is required"),
    name: requiredString("fields[].name is required"),
    type: z.enum(FIELD_TYPES, { message: "fields[].type is invalid" }),
    required: z.boolean(),
    unique: z.boolean(),
    options: z.array(z.string()).optional(),
    linkTo: z.string().optional(),
  })
  .passthrough();

const responseQuerySchema = z.object({
  modelId: requiredString("response.query.modelId is required"),
  filter: z
    .array(
      z.object({
        field: requiredString("response.query.filter[].field is required"),
        op: z.enum(RESPONSE_QUERY_OPS, { message: "response.query.filter[].op is invalid" }),
        value: z.string(),
      }),
    )
    .optional(),
  sort: z.object({ field: requiredString("response.query.sort.field is required"), dir: z.enum(["asc", "desc"]) }).optional(),
  limit: z.number().int().positive().optional(),
});

const routeInputSchema = z.object({
  id: z.string().optional(),
  method: z.enum(HTTP_METHODS, { message: "method is required" }),
  path: requiredString("path is required"),
  modelId: z.string().nullable(),
  action: z.enum(ROUTE_ACTIONS, { message: "action is required" }),
  description: z.string().default(""),
  filters: z.array(z.string()).default([]),
  response: z.unknown().optional(),
});

function projectPath(projectId: string): string {
  return `/api/v1/projects/${projectId}`;
}

function modelPath(projectId: string, modelId: string): string {
  return `${projectPath(projectId)}/models/${modelId}`;
}

function routePath(projectId: string, routeId: string): string {
  return `${projectPath(projectId)}/routes/${routeId}`;
}

function recordsPath(projectId: string, modelId: string): string {
  return `${modelPath(projectId, modelId)}/records`;
}

/**
 * Type-checks each tool literal against its own schema (so `handler`'s `args` is inferred
 * from that literal's `schema`, not widened to `unknown`), then erases the type parameter so
 * heterogeneous tools can live together in one `McpTool[]`.
 */
function defineTool<A extends z.ZodTypeAny>(tool: McpTool<A>): McpTool {
  return tool as McpTool;
}

export const TOOLS: McpTool[] = [
  defineTool({
    name: "list_projects",
    description: "List every mock API project; use this to find a project's id before acting on it.",
    schema: z.object({}),
    handler: async (_args, client) => client.get("/api/v1/projects"),
  }),

  defineTool({
    name: "get_project",
    description: "Fetch one project's full definition - its resources, endpoints and metadata - by id.",
    schema: z.object({ projectId: requiredString("projectId is required") }),
    handler: async (args, client) => client.get(projectPath(args.projectId)),
  }),

  defineTool({
    name: "create_project",
    description: "Create a new mock API project, optionally seeded from a starter template (blog, store, or todo).",
    schema: z.object({
      name: requiredString("name is required"),
      description: z.string().optional(),
      templateId: z.enum(TEMPLATE_IDS).nullable().optional(),
    }),
    handler: async (args, client) =>
      client.post("/api/v1/projects", { name: args.name, description: args.description, templateId: args.templateId }),
  }),

  defineTool({
    name: "update_project",
    description: "Rename a project, edit its description, or change the address (slug) it's served at.",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      name: requiredString("name is required").optional(),
      description: z.string().optional(),
      slug: requiredString("slug is required").optional(),
    }),
    handler: async ({ projectId, ...patch }, client) => client.patch(projectPath(projectId), patch),
  }),

  defineTool({
    name: "delete_project",
    description:
      "Permanently remove a project and everything under it - resources, endpoints and records. The change is immediate; the result carries the undo payload needed to put it back.",
    schema: z.object({ projectId: requiredString("projectId is required") }),
    destructive: true,
    handler: async (args, client) => client.del(projectPath(args.projectId)),
  }),

  defineTool({
    name: "duplicate_project",
    description: "Deep-copy a project - its resources, endpoints and sample records - into a new project you can then rename.",
    schema: z.object({ projectId: requiredString("projectId is required") }),
    handler: async (args, client) => client.post(`${projectPath(args.projectId)}/duplicate`),
  }),

  defineTool({
    name: "create_resource",
    description: "Add a new resource (data model) to a project by name; add its fields afterward with update_resource.",
    schema: z.object({ projectId: requiredString("projectId is required"), name: requiredString("name is required") }),
    handler: async (args, client) => client.post(`${projectPath(args.projectId)}/models`, { name: args.name }),
  }),

  defineTool({
    name: "update_resource",
    description:
      "Replace a resource's name and its full field list - the definitive way to add, edit or remove fields, since the fields you send become the whole set.",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      modelId: requiredString("modelId is required"),
      name: requiredString("name is required"),
      fields: z.array(fieldSchema),
    }),
    handler: async ({ projectId, modelId, name, fields }, client) =>
      client.patch(modelPath(projectId, modelId), { id: modelId, name, fields }),
  }),

  defineTool({
    name: "delete_resource",
    description:
      "Permanently remove a resource, its fields, its records, and any endpoints or links built on it. The change is immediate; the result carries the undo payload needed to put it back.",
    schema: z.object({ projectId: requiredString("projectId is required"), modelId: requiredString("modelId is required") }),
    destructive: true,
    handler: async (args, client) => client.del(modelPath(args.projectId, args.modelId)),
  }),

  defineTool({
    name: "create_endpoints",
    description: "Add one or more endpoints (routes) to a project - a method, a path, and how it behaves (CRUD action or custom).",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      routes: z.array(routeInputSchema, { message: "routes is required" }),
    }),
    handler: async ({ projectId, routes }, client) => client.post(`${projectPath(projectId)}/routes`, { routes }),
  }),

  defineTool({
    name: "update_endpoint",
    description: "Change an endpoint's method, path, action, description or filters. Use set_endpoint_response to shape what it returns.",
    schema: z.object({ projectId: requiredString("projectId is required"), routeId: requiredString("routeId is required") }).extend(
      routeInputSchema.shape,
    ),
    handler: async ({ projectId, routeId, description, filters, ...rest }, client) =>
      client.patch(routePath(projectId, routeId), { ...rest, id: routeId, description: description ?? "", filters: filters ?? [] }),
  }),

  defineTool({
    name: "delete_endpoint",
    description:
      "Permanently remove an endpoint. The change is immediate; the result carries the undo payload needed to put it back.",
    schema: z.object({ projectId: requiredString("projectId is required"), routeId: requiredString("routeId is required") }),
    destructive: true,
    handler: async (args, client) => client.del(routePath(args.projectId, args.routeId)),
  }),

  defineTool({
    name: "set_endpoint_response",
    description:
      "Shape exactly what an endpoint returns - its status, headers, and body - instead of the engine's default CRUD behaviour. " +
      "Use mode \"static\" to return a fixed body verbatim (e.g. mocking a third-party API, or a 503 with a Retry-After header). " +
      "Use mode \"template\" to reshape the engine's normal result: the template JSON may contain placeholders " +
      "{{records}}, {{record}}, {{count}}, {{params.<name>}}, {{query.<name>}}, {{body.<name>}}, {{now}} and {{uuid}}, which are " +
      "replaced when the endpoint is called. The substitution rule that matters: a string whose entire value is a single " +
      "placeholder (e.g. \"items\": \"{{records}}\") is replaced by the real typed value (a JSON array/object/number), while a " +
      "placeholder inside a longer string (e.g. \"message\": \"Found {{count}} books\") is interpolated as text. Getting this " +
      "wrong - wrapping a whole-value placeholder in extra text - produces a quoted array instead of a real one. Use mode " +
      "\"auto\" to restore the engine's default behaviour. Optionally set query to have a custom endpoint read real, filtered " +
      "and sorted records instead of inventing data. Use mode \"auto\" with no other fields to reset an endpoint to default.",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      routeId: requiredString("routeId is required"),
      mode: z.enum(RESPONSE_MODES, { message: "mode is required" }),
      status: z.number().int().min(100).max(599).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      template: z.unknown().optional(),
      body: z.unknown().optional(),
      query: responseQuerySchema.optional(),
    }),
    handler: async ({ projectId, routeId, ...response }, client) => {
      const project = (await client.get(projectPath(projectId))) as { routes: Array<Record<string, unknown>> };
      const route = project.routes?.find((r) => r.id === routeId);
      if (!route) throw new Error("This route no longer exists.");
      const merged = { ...route, response };
      return client.patch(routePath(projectId, routeId), merged);
    },
  }),

  defineTool({
    name: "list_records",
    description: "List a resource's stored sample records.",
    schema: z.object({ projectId: requiredString("projectId is required"), modelId: requiredString("modelId is required") }),
    handler: async (args, client) => client.get(recordsPath(args.projectId, args.modelId)),
  }),

  defineTool({
    name: "replace_records",
    description:
      "Replace all of a resource's records with the given set - the fast way to (re)seed sample data. The change is immediate " +
      "and the previous records are not returned, so read them first with list_records if you might need them back.",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      modelId: requiredString("modelId is required"),
      records: z.array(z.record(z.string(), z.unknown()), { message: "records is required" }),
    }),
    destructive: true,
    handler: async ({ projectId, modelId, records }, client) => client.put(recordsPath(projectId, modelId), { records }),
  }),

  defineTool({
    name: "add_record",
    description: "Add a single record to a resource; an id is generated if you don't supply one.",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      modelId: requiredString("modelId is required"),
      record: z.record(z.string(), z.unknown(), { message: "record is required" }),
    }),
    handler: async ({ projectId, modelId, record }, client) => client.post(recordsPath(projectId, modelId), record),
  }),

  defineTool({
    name: "delete_record",
    description:
      "Permanently remove one record by id. The change is immediate; the result only echoes the deleted id, so keep a copy beforehand if you need to restore it.",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      modelId: requiredString("modelId is required"),
      recordId: requiredString("recordId is required"),
    }),
    destructive: true,
    handler: async ({ projectId, modelId, recordId }, client) => client.del(`${recordsPath(projectId, modelId)}/${recordId}`),
  }),

  defineTool({
    name: "generate_api",
    description:
      "Generate resources, endpoints and sample data for a project from a plain-language description of the API you want - the fastest way to scaffold something new.",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      description: requiredString("description is required").max(2000, "Keep the description under 2000 characters."),
      maxResources: z.number().int().min(1).max(6).optional(),
      recordsPerResource: z.number().int().min(0).max(12).optional(),
    }),
    handler: async ({ projectId, description, maxResources, recordsPerResource }, client) =>
      client.post(`${projectPath(projectId)}/ai/generate`, { description, maxResources, recordsPerResource }),
  }),

  defineTool({
    name: "edit_api",
    description:
      "Edit an existing project from a plain-language instruction - add, change, or remove resources, fields and endpoints in one step. Removal instructions (e.g. \"remove the rating field\") are supported and applied immediately.",
    schema: z.object({
      projectId: requiredString("projectId is required"),
      instruction: requiredString("instruction is required").max(2000, "Keep the instruction under 2000 characters."),
    }),
    handler: async ({ projectId, instruction }, client) => client.post(`${projectPath(projectId)}/ai/edit`, { instruction }),
  }),

  defineTool({
    name: "call_mock_endpoint",
    description:
      "Call a project's mock API the way a real client would - GET/POST/PUT/PATCH/DELETE against /{slug}/{path} - to see exactly what it serves, including any custom response shape.",
    schema: z.object({
      slug: requiredString("slug is required"),
      method: z.enum(HTTP_METHODS, { message: "method is required" }),
      path: requiredString("path is required"),
      query: z.record(z.string(), z.string()).optional(),
      body: z.unknown().optional(),
    }),
    handler: async ({ slug, method, path, query, body }, client) => {
      const normalized = path.startsWith("/") ? path : `/${path}`;
      return client.callEndpoint(method, `/${slug}${normalized}`, { query, body });
    },
  }),
];
