// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgModelService } from "@/lib/services/pg/model-service";
import type { Model } from "@/lib/types";
import { POST } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

const model: Model = { id: "mdl_1", name: "Book", fields: [] };
const removed = { model, beforeId: null, routes: [], links: [], records: [{ id: "1", title: "Dune" }] };

function ctx(id: string, modelId: string) {
  return { params: Promise.resolve({ id, modelId }) };
}

function post(id: string, modelId: string, body: unknown) {
  return POST(
    new Request(`http://t/api/v1/projects/${id}/models/${modelId}/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id, modelId),
  );
}

describe("POST /api/v1/projects/:id/models/:modelId/restore", () => {
  it("returns 401 without a credential", async () => {
    const res = await POST(
      new Request("http://t/api/v1/projects/prj_1/models/mdl_1/restore", { method: "POST", body: JSON.stringify(removed) }),
      ctx("prj_1", "mdl_1"),
    );
    expect(res.status).toBe(401);
  });

  it("restores the model, including its records", async () => {
    const restore = vi.spyOn(pgModelService, "restore").mockResolvedValue(model);
    const res = await post("prj_1", "mdl_1", removed);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: model });
    expect(restore).toHaveBeenCalledWith("prj_1", removed);
  });

  it("uses the URL's modelId over the body's", async () => {
    const restore = vi.spyOn(pgModelService, "restore").mockResolvedValue(model);
    await post("prj_1", "mdl_1", { ...removed, model: { ...model, id: "wrong-id" } });
    expect(restore).toHaveBeenCalledWith("prj_1", { ...removed, model: { ...model, id: "mdl_1" } });
  });

  it("rejects a body missing model with 400", async () => {
    const res = await post("prj_1", "mdl_1", {});
    expect(res.status).toBe(400);
  });
});
