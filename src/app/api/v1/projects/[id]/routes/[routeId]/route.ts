import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { routeSchema } from "@/lib/api/schemas";
import { pgRouteService } from "@/lib/services/pg/route-service";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string; routeId: string }>;
}

export async function PATCH(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, routeId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = routeSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    const route = await pgRouteService.update(id, { ...parsed.data, id: routeId });
    return ok(route);
  });
}

export async function DELETE(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, routeId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;
    const removed = await pgRouteService.remove(id, routeId);
    return ok(removed);
  });
}
