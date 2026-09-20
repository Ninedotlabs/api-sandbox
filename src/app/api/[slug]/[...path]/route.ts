import { executeRoute, type DataRecord, type Dataset } from "@/lib/mock-engine";
import { matchRoute } from "@/lib/routes";
import { pgProjectService } from "@/lib/services/pg/project-service";
import { pgRecordService } from "@/lib/services/pg/record-service";

export const runtime = "nodejs";

/**
 * Addresses the app itself owns - kept in sync with the reserved-slug set enforced
 * at project-creation time in `pgProjectService` (that set isn't exported, and this
 * one is a short, rarely-changed constant, so it's duplicated deliberately rather
 * than adding a shared-module dependency for it).
 */
const RESERVED_SLUGS = new Set(["v1", "ai", "mcp", "auth", "api"]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function ok(status: number, body: unknown): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

const MUTATING_ACTIONS = new Set(["create", "update", "delete"]);

interface RouteContext {
  params: Promise<{ slug: string; path: string[] }>;
}

async function handle(req: Request, context: RouteContext): Promise<Response> {
  const { slug, path } = await context.params;

  if (RESERVED_SLUGS.has(slug)) {
    return ok(404, { error: `"${slug}" is reserved for the app itself and has no project.` });
  }

  // There is no `pgProjectService.getBySlug` - listing every project and finding the
  // slug here is less efficient than a targeted query, but another agent is mid-edit
  // on project-service.ts right now. This should become `where slug = $1` later.
  const projects = await pgProjectService.list();
  const project = projects.find((p) => p.slug === slug);
  if (!project) {
    return ok(404, { error: `No API found at "/${slug}". Check the address and try again.` });
  }

  const match = matchRoute(project.routes, req.method, path);
  if (!match) {
    return ok(404, { error: `No ${req.method} route matches "/${path.join("/")}" on this API.` });
  }
  const { route, params } = match;
  const model = route.modelId ? (project.models.find((m) => m.id === route.modelId) ?? null) : null;

  const existing = model ? ((await pgRecordService.sampleData(project.id, model.id)) as DataRecord[]) : [];
  const dataset: Dataset = model ? { [model.id]: existing } : {};

  let body: unknown;
  if (req.method !== "GET" && req.method !== "DELETE") {
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
  }

  const query = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = executeRoute(project, route, { params, query, body }, dataset);

  if (model && result.status < 400 && MUTATING_ACTIONS.has(route.action)) {
    await pgRecordService.seedRecords(project.id, model.id, dataset[model.id] ?? []);
  }

  if (result.status === 204) return noContent();
  return ok(result.status, result.body);
}

export async function GET(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function POST(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function PUT(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function PATCH(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function DELETE(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
