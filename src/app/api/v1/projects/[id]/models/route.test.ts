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

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function post(id: string, body: unknown) {
  return POST(
    new Request(`http://t/api/v1/projects/${id}/models`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

describe("POST /api/v1/projects/:id/models", () => {
  it("returns 401 without a credential", async () => {
    const res = await POST(
      new Request("http://t/api/v1/projects/prj_1/models", { method: "POST", body: JSON.stringify({ name: "Book" }) }),
      ctx("prj_1"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects a missing name with 400", async () => {
    const res = await post("prj_1", {});
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "name is required" });
  });

  it("creates the model and returns 201", async () => {
    const create = vi.spyOn(pgModelService, "create").mockResolvedValue(model);
    const res = await post("prj_1", { name: "Book" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: model });
    expect(create).toHaveBeenCalledWith("prj_1", "Book");
  });

  it("returns 404 when the project no longer exists", async () => {
    vi.spyOn(pgModelService, "create").mockRejectedValue(new Error("This API no longer exists."));
    const res = await post("missing", { name: "Book" });
    expect(res.status).toBe(404);
  });

  it("returns 409 when a model with this name already exists", async () => {
    vi.spyOn(pgModelService, "create").mockRejectedValue(new Error("A model with this name already exists."));
    const res = await post("prj_1", { name: "Book" });
    expect(res.status).toBe(409);
  });
});
