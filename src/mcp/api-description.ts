import { exampleRequest, previewResponseShape } from "../lib/examples";
import { fillPath, routeParams } from "../lib/paths";
import { buildSnippets } from "../lib/snippets";
import type { Field, Model, Project, Route } from "../lib/types";

type JsonSchema = Record<string, unknown>;

function fieldSchema(field: Field): JsonSchema {
  const description = field.linkTo ? `References records in resource ${field.linkTo}.` : undefined;
  switch (field.type) {
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date" };
    case "email":
      return { type: "string", format: "email" };
    case "url":
      return { type: "string", format: "uri" };
    case "choice":
      return { type: "string", enum: field.options ?? [] };
    case "link":
      return { type: "string", ...(description ? { description } : {}) };
    case "json":
      return {};
    case "text":
      return { type: "string" };
  }
}

function requestBodySchema(route: Route, model: Model | null): JsonSchema | null {
  if (!model || (route.action !== "create" && route.action !== "update")) return null;
  const required = route.action === "create" ? model.fields.filter((field) => field.required).map((field) => field.name) : [];
  return {
    type: "object",
    properties: Object.fromEntries(model.fields.map((field) => [field.name, fieldSchema(field)])),
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

function schemaForValue(value: unknown): JsonSchema {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) return { type: "array", items: value.length > 0 ? schemaForValue(value[0]) : {} };
  switch (typeof value) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "boolean":
      return { type: "boolean" };
    case "object": {
      const entries = Object.entries(value as Record<string, unknown>);
      return {
        type: "object",
        properties: Object.fromEntries(entries.map(([key, child]) => [key, schemaForValue(child)])),
        required: entries.map(([key]) => key),
      };
    }
    default:
      return {};
  }
}

export function buildApiDescription(project: Project, deploymentUrl: string) {
  const deployment = deploymentUrl.replace(/\/+$/, "");
  const baseUrl = `${deployment}/api/${project.slug}`;

  return {
    deploymentUrl: deployment,
    baseUrl,
    project: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    resources: project.models,
    endpoints: project.routes.map((route) => {
      const model = project.models.find((candidate) => candidate.id === route.modelId) ?? null;
      const params = routeParams(route.path);
      const exampleParams = Object.fromEntries(params.map((name) => [name, "1"]));
      const urlTemplate = `${baseUrl}${route.path}`;
      const exampleUrl = `${baseUrl}${fillPath(route.path, exampleParams)}`;
      const bodyExample = exampleRequest(route, project);
      const responseExample = previewResponseShape(route, route.response, project);

      return {
        id: route.id,
        method: route.method,
        path: route.path,
        urlTemplate,
        exampleUrl,
        description: route.description,
        action: route.action,
        resource: model,
        pathParameters: params.map((name) => ({ name, type: "string", required: true })),
        queryParameters: route.filters.map((name) => ({
          name,
          type: "string",
          required: false,
          description: `Filter results where ${name} equals this value.`,
        })),
        request: {
          contentType: bodyExample === null ? null : "application/json",
          bodySchema: requestBodySchema(route, model),
          example: bodyExample,
        },
        response: {
          configuration: route.response ?? { mode: "auto" },
          status: responseExample.status,
          headers: responseExample.headers,
          bodySchema: schemaForValue(responseExample.body),
          example: responseExample.body,
          warnings: responseExample.warnings,
        },
        snippets: buildSnippets(project, route, bodyExample ?? undefined, deployment),
      };
    }),
  };
}
