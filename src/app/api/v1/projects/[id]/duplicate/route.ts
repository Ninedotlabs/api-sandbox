import { requireProjectAccess } from "@/lib/api/auth";
import { handle, ok } from "@/lib/api/respond";
import { pgProjectService } from "@/lib/services/pg/project-service";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;
    const copy = access.userId ? await pgProjectService.duplicate(id, access.userId) : await pgProjectService.duplicate(id);
    return ok(copy, 201);
  });
}
