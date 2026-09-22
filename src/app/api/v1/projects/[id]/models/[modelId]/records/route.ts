import { z } from "zod";
import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { createId } from "@/lib/ids";
import { pgRecordService } from "@/lib/services/pg/record-service";
import { recordRequestActivity } from "@/lib/activity/record";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string; modelId: string }>;
}

const recordShape = z.record(z.string(), z.unknown());

const replaceSchema = z.object({
  records: z.array(recordShape, { message: "records is required" }),
});

export async function GET(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, modelId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;
    const records = await pgRecordService.sampleData(id, modelId);
    return ok(records);
  });
}

export async function PUT(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, modelId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = replaceSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    await pgRecordService.seedRecords(id, modelId, parsed.data.records);
    const records = await pgRecordService.sampleData(id, modelId);
    await recordRequestActivity(access, { action: "records.replace", targetType: "model", targetId: modelId, projectId: id, metadata: { count: parsed.data.records.length } });
    return ok(records);
  });
}

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, modelId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = recordShape.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    const providedId = parsed.data.id;
    const record = { ...parsed.data, id: typeof providedId === "string" && providedId ? providedId : createId("rec") };
    await pgRecordService.insertRecord(id, modelId, record);
    await recordRequestActivity(access, { action: "record.create", targetType: "record", targetId: record.id, projectId: id, metadata: { modelId } });
    return ok(record, 201);
  });
}
