import { requireProjectAccess } from "@/lib/api/auth";
import { fail, handle, ok } from "@/lib/api/respond";
import { pgRecordService } from "@/lib/services/pg/record-service";
import { recordRequestActivity } from "@/lib/activity/record";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string; modelId: string; recordId: string }>;
}

export async function DELETE(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, modelId, recordId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;
    const deleted = await pgRecordService.deleteRecord(id, modelId, recordId);
    if (!deleted) return fail(404, "This record no longer exists.");
    await recordRequestActivity(access, { action: "record.delete", targetType: "record", targetId: recordId, projectId: id, metadata: { modelId } });
    return ok({ id: recordId });
  });
}
