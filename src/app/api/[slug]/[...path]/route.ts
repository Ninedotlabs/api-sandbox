import { executeRoute, type DataRecord, type Dataset } from "@/lib/mock-engine";
import { applyResponseShape, runResponseQuery } from "@/lib/response-shape";
import { matchRoute } from "@/lib/routes";
import { pgProjectService, RESERVED_SLUGS } from "@/lib/services/pg/project-service";
import { pgRecordService } from "@/lib/services/pg/record-service";

export const runtime = "nodejs";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function ok(status: number, body: unknown, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, ...extraHeaders } });
}

function noContent(extraHeaders: Record<string, string> = {}): Response {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS, ...extraHeaders } });
}

const MUTATING_ACTIONS = new Set(["create", "update", "delete"]);

interface RouteContext {
  params: Promise<{ slug: string; path: string[] }>;
}

async function handle(req: Request, context: RouteContext): Promise<Response> {
  try {
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
    // Snapshot which ids existed before the engine runs. The engine mutates `existing` in
    // place (see below), so this is the only way to tell, after the fact, which record(s)
    // a "create" actually added.
    const existingIds = new Set(existing.map((r) => String(r.id)));
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

    // A custom endpoint's `response.query` names its own model (independent of the route's
    // own `modelId`, which is typically null for a custom route) - resolve it here, before
    // shaping, so `{{records}}`/`{{count}}` in a template reflect real, current data.
    let queriedRecords: DataRecord[] | undefined;
    const responseQuery = route.action === "custom" ? route.response?.query : undefined;
    if (responseQuery) {
      const queriedModel = project.models.find((m) => m.id === responseQuery.modelId);
      queriedRecords = queriedModel
        ? runResponseQuery(queriedModel, (await pgRecordService.sampleData(project.id, queriedModel.id)) as DataRecord[], responseQuery)
        : [];
    }

    if (model && result.status < 400 && MUTATING_ACTIONS.has(route.action)) {
      const records = dataset[model.id] ?? [];
      if (route.action === "create") {
        // Persistence is otherwise read-modify-write: read the whole set, let the engine
        // mutate it in memory, then write the whole set back - two round trips with
        // nothing spanning them. Two concurrent creates that both read the same starting
        // set would both compute the same next id and the second's full-set write would
        // silently erase the first's new record. Inserting just the new row (keyed on
        // (model_id, id), the table's primary key) avoids that: a second request racing
        // on the same id now fails loudly (a unique-violation, surfaced as a 500 below)
        // instead of silently discarding a record. A full fix (e.g. a `create` that
        // assigns its id inside the same statement, or optimistic locking) would also
        // close the same race for `update`/`delete`, which still replace the whole set.
        const created = records.filter((r) => !existingIds.has(String(r.id)));
        for (const record of created) {
          await pgRecordService.insertRecord(project.id, model.id, record);
        }
      } else {
        await pgRecordService.seedRecords(project.id, model.id, records);
      }
    }

    const shaped = applyResponseShape(route, result, { params, query, body, records: queriedRecords });
    if (shaped.status === 204) return noContent(shaped.headers);
    return ok(shaped.status, shaped.body, shaped.headers);
  } catch {
    // Never echo the real error: a raw driver error can carry connection details, and an
    // uncaught throw here would skip `ok`/`noContent` entirely, answering without CORS
    // headers right when a browser client most needs a readable response.
    return ok(500, { error: "Something went wrong handling this request. Please try again." });
  }
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
