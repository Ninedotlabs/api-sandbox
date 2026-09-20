// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgModelService } from "@/lib/services/pg/model-service";
import type { Model } from "@/lib/types";
import { DELETE, PATCH } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

const model: Model = { id: "mdl_1", name: "Book", fields: [] };

function ctx(id: string, modelId: string) {
  return { params: Promise.resolve({ id, modelId }) };
}

function patch(id: string, modelId: string, body: unknown) {
  return PATCH(
    new Request(`http://t/api/v1/projects/${id}/models/${modelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id, modelId),
  );
}

function del(id: string, modelId: string) {
  return DELETE(
    new Request(`http://t/api/v1/projects/${id}/models/${modelId}`, { method: "DELETE", headers: sameOrigin }),
    ctx(id, modelId),
  );
}

describe("PATCH /api/v1/projects/:id/models/:modelId", () => {
  it("returns 401 without a credential", async () => {
    const res = await PATCH(
      new Request("http://t/api/v1/projects/prj_1/models/mdl_1", { method: "PATCH", body: JSON.stringify(model) }),
      ctx("prj_1", "mdl_1"),
    );
    expect(res.status).toBe(401);
  });

  it("updates the model, forwarding the body but forcing the URL's id", async () => {
    const update = vi.spyOn(pgModelService, "update").mockResolvedValue(model);
    const res = await patch("prj_1", "mdl_1", { ...model, id: "wrong-id" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: model });
    expect(update).toHaveBeenCalledWith("prj_1", { ...model, id: "mdl_1" });
  });

  it("rejects a missing name with 400", async () => {
    const res = await patch("prj_1", "mdl_1", { ...model, name: "" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "name is required" });
  });

  it("returns 404 when the model no longer exists", async () => {
    vi.spyOn(pgModelService, "update").mockRejectedValue(new Error("This model no longer exists."));
    const res = await patch("prj_1", "missing", model);
    expect(res.status).toBe(404);
  });

  it("forwards an unrecognised field on a field, so a future field type doesn't get dropped", async () => {
    const update = vi.spyOn(pgModelService, "update").mockResolvedValue(model);
    const withExtra = { ...model, fields: [{ id: "fld_1", name: "Title", type: "text", required: true, unique: false, futureProp: "x" }] };
    await patch("prj_1", "mdl_1", withExtra);
    expect(update).toHaveBeenCalledWith("prj_1", withExtra);
  });
});

describe("DELETE /api/v1/projects/:id/models/:modelId", () => {
  it("removes the model and returns the undo payload", async () => {
    const removed = { model, beforeId: null, routes: [], links: [], records: [] };
    vi.spyOn(pgModelService, "remove").mockResolvedValue(removed);
    const res = await del("prj_1", "mdl_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: removed });
  });

  it("returns 404 when the model no longer exists", async () => {
    vi.spyOn(pgModelService, "remove").mockRejectedValue(new Error("This model no longer exists."));
    const res = await del("prj_1", "missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This model no longer exists." });
  });
});
