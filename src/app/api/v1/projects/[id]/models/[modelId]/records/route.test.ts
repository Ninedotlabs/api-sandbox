// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { pgRecordService } from "@/lib/services/pg/record-service";
import { GET, POST, PUT } from "./route";

afterEach(() => {
  vi.restoreAllMocks();
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

function ctx(id: string, modelId: string) {
  return { params: Promise.resolve({ id, modelId }) };
}

function get(id: string, modelId: string) {
  return GET(new Request(`http://t/api/v1/projects/${id}/models/${modelId}/records`, { headers: sameOrigin }), ctx(id, modelId));
}

function put(id: string, modelId: string, body: unknown) {
  return PUT(
    new Request(`http://t/api/v1/projects/${id}/models/${modelId}/records`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id, modelId),
  );
}

function post(id: string, modelId: string, body: unknown) {
  return POST(
    new Request(`http://t/api/v1/projects/${id}/models/${modelId}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id, modelId),
  );
}

describe("GET /api/v1/projects/:id/models/:modelId/records", () => {
  it("returns 401 without a credential", async () => {
    const res = await GET(new Request("http://t/api/v1/projects/prj_1/models/mdl_1/records"), ctx("prj_1", "mdl_1"));
    expect(res.status).toBe(401);
  });

  it("returns the model's records", async () => {
    vi.spyOn(pgRecordService, "sampleData").mockResolvedValue([{ id: "1", title: "Dune" }]);
    const res = await get("prj_1", "mdl_1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "1", title: "Dune" }] });
  });
});

describe("PUT /api/v1/projects/:id/models/:modelId/records", () => {
  it("rejects a body missing records with 400", async () => {
    const res = await put("prj_1", "mdl_1", {});
    expect(res.status).toBe(400);
  });

  it("replaces the whole set and returns it", async () => {
    const seed = vi.spyOn(pgRecordService, "seedRecords").mockResolvedValue(undefined);
    vi.spyOn(pgRecordService, "sampleData").mockResolvedValue([{ id: "1", title: "Dune" }]);
    const res = await put("prj_1", "mdl_1", { records: [{ title: "Dune" }] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: "1", title: "Dune" }] });
    expect(seed).toHaveBeenCalledWith("prj_1", "mdl_1", [{ title: "Dune" }]);
  });
});

describe("POST /api/v1/projects/:id/models/:modelId/records", () => {
  it("appends one record with a generated id and returns 201", async () => {
    const insert = vi.spyOn(pgRecordService, "insertRecord").mockResolvedValue(undefined);
    const res = await post("prj_1", "mdl_1", { title: "Dune" });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { id: string; title: string } };
    expect(body.data.title).toBe("Dune");
    expect(body.data.id).toBeTruthy();
    expect(insert).toHaveBeenCalledWith("prj_1", "mdl_1", { id: body.data.id, title: "Dune" });
  });

  it("keeps the caller's id when it supplies one", async () => {
    const insert = vi.spyOn(pgRecordService, "insertRecord").mockResolvedValue(undefined);
    const res = await post("prj_1", "mdl_1", { id: "custom", title: "Dune" });
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith("prj_1", "mdl_1", { id: "custom", title: "Dune" });
  });

  it("returns 409 when the record's id already exists", async () => {
    vi.spyOn(pgRecordService, "insertRecord").mockRejectedValue(new Error("Something with this name or address already exists."));
    const res = await post("prj_1", "mdl_1", { id: "dup", title: "Dune" });
    expect(res.status).toBe(409);
  });
});
