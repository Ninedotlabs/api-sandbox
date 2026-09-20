import { z } from "zod";
import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { newRouteSchema } from "@/lib/api/schemas";
import { createId } from "@/lib/ids";
import { pgRouteService } from "@/lib/services/pg/route-service";
import type { Route } from "@/lib/types";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  routes: z.array(newRouteSchema, { message: "routes is required" }),
});

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    // A route the caller hasn't minted an id for yet (the common case for an external
    // caller like MCP, which has no reason to invent one) gets one here.
    const routes = parsed.data.routes.map((r) => ({ ...r, id: r.id ?? createId("rte") })) as Route[];
    const created = await pgRouteService.createMany(id, routes);
    return ok(created, 201);
  });
}
