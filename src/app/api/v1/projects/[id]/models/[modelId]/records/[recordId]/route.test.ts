// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgRecordService } from "@/lib/services/pg/record-service";
import { DELETE } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

function ctx(id: string, modelId: string, recordId: string) {
  return { params: Promise.resolve({ id, modelId, recordId }) };
}

function del(id: string, modelId: string, recordId: string) {
  return DELETE(
    new Request(`http://t/api/v1/projects/${id}/models/${modelId}/records/${recordId}`, { method: "DELETE", headers: sameOrigin }),
    ctx(id, modelId, recordId),
  );
}

describe("DELETE /api/v1/projects/:id/models/:modelId/records/:recordId", () => {
  it("returns 401 without a credential", async () => {
    const res = await DELETE(
      new Request("http://t/api/v1/projects/prj_1/models/mdl_1/records/1", { method: "DELETE" }),
      ctx("prj_1", "mdl_1", "1"),
    );
    expect(res.status).toBe(401);
  });

  it("deletes the record", async () => {
    const deleteRecord = vi.spyOn(pgRecordService, "deleteRecord").mockResolvedValue(true);
    const res = await del("prj_1", "mdl_1", "1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "1" } });
    expect(deleteRecord).toHaveBeenCalledWith("prj_1", "mdl_1", "1");
  });

  it("returns 404 when the record doesn't exist", async () => {
    vi.spyOn(pgRecordService, "deleteRecord").mockResolvedValue(false);
    const res = await del("prj_1", "mdl_1", "missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This record no longer exists." });
  });
});
