import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { removedRouteSchema } from "@/lib/api/schemas";
import { pgRouteService } from "@/lib/services/pg/route-service";
import { recordRequestActivity } from "@/lib/activity/record";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string; routeId: string }>;
}

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, routeId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = removedRouteSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    const removed = { ...parsed.data, route: { ...parsed.data.route, id: routeId } };
    const route = await pgRouteService.restore(id, removed);
    await recordRequestActivity(access, { action: "route.restore", targetType: "route", targetId: routeId, projectId: id });
    return ok(route);
  });
}
