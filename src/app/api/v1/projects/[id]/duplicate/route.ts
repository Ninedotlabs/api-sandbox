import { requireAccess } from "@/lib/api/auth";
import { handle, ok } from "@/lib/api/respond";
import { pgProjectService } from "@/lib/services/pg/project-service";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const denied = requireAccess(req);
    if (denied) return denied;
    const { id } = await context.params;
    const copy = await pgProjectService.duplicate(id);
    return ok(copy, 201);
  });
}
