// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as request from "@/lib/ai/request";
import * as applyPlanModule from "@/lib/services/pg/apply-plan";
import { pgProjectService } from "@/lib/services/pg/project-service";
import { pgRecordService } from "@/lib/services/pg/record-service";
import type { Project } from "@/lib/types";
import { POST } from "./route";

vi.mock("@/lib/ai/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/request")>();
  return { ...actual, callEditResponses: vi.fn() };
});
vi.mock("@/lib/services/pg/apply-plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/pg/apply-plan")>();
  return { ...actual, applyEditPlanPg: vi.fn() };
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

const project: Project = {
  id: "prj_1",
  name: "Bookshop",
  slug: "bookshop",
  description: "",
  models: [{ id: "mdl_1", name: "Book", fields: [{ id: "fld_1", name: "title", type: "text", required: true, unique: false }] }],
  routes: [],
  createdAt: "t",
  updatedAt: "t",
};

const validEditPlanJson = JSON.stringify({
  resources: [{ name: "Book", description: "", fields: [{ name: "genre", type: "text", required: false, unique: false, options: null, linkTo: null }], records: [] }],
  customEndpoints: [],
  removals: { resources: [], fields: [], endpoints: [] },
});

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function post(id: string, body: unknown) {
  return POST(
    new Request(`http://t/api/v1/projects/${id}/ai/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...sameOrigin },
      body: JSON.stringify(body),
    }),
    ctx(id),
  );
}

beforeEach(() => {
  process.env.AZURE_AI_ENDPOINT = "https://x/openai/v1/responses";
  process.env.AZURE_AI_API_KEY = "k";
  process.env.AZURE_AI_MODEL = "Luna";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.AZURE_AI_ENDPOINT;
  delete process.env.AZURE_AI_API_KEY;
  delete process.env.AZURE_AI_MODEL;
});

describe("POST /api/v1/projects/:id/ai/edit", () => {
  it("returns 401 without a credential", async () => {
    const res = await POST(
      new Request("http://t/api/v1/projects/prj_1/ai/edit", { method: "POST", body: JSON.stringify({ instruction: "add a genre field" }) }),
      ctx("prj_1"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects an empty instruction with 400", async () => {
    const res = await post("prj_1", { instruction: "  " });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the project no longer exists", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValue(null);
    const res = await post("missing", { instruction: "add a genre field" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This API no longer exists." });
  });

  it("returns 503 when AI isn't configured", async () => {
    delete process.env.AZURE_AI_API_KEY;
    vi.spyOn(pgProjectService, "get").mockResolvedValue(project);
    const res = await post("prj_1", { instruction: "add a genre field" });
    expect(res.status).toBe(503);
  });

  it("edits the project and returns the refreshed project", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValueOnce(project).mockResolvedValueOnce({
      ...project,
      models: [{ ...project.models[0], fields: [...project.models[0].fields, { id: "fld_2", name: "genre", type: "text", required: false, unique: false }] }],
    });
    vi.spyOn(pgRecordService, "sampleData").mockResolvedValue([]);
    vi.mocked(request.callEditResponses).mockResolvedValue({ status: 200, text: validEditPlanJson });
    vi.mocked(applyPlanModule.applyEditPlanPg).mockResolvedValue({
      modelIds: ["mdl_1"],
      newResourceCount: 0,
      changedResourceCount: 1,
      endpointCount: 0,
      replacedRecords: [],
    });

    const res = await post("prj_1", { instruction: "add a genre field to Book" });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { project: Project; changedResourceCount: number } };
    expect(body.data.changedResourceCount).toBe(1);
    expect(body.data.project.models[0].fields.map((f) => f.name)).toEqual(["title", "genre"]);
    expect(applyPlanModule.applyEditPlanPg).toHaveBeenCalledWith("prj_1", expect.objectContaining({ resources: expect.any(Array) }));
  });

  it("returns 502 when the AI request itself fails", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValue(project);
    vi.spyOn(pgRecordService, "sampleData").mockResolvedValue([]);
    vi.mocked(request.callEditResponses).mockResolvedValue({ status: 500, text: null });
    const res = await post("prj_1", { instruction: "add a genre field" });
    expect(res.status).toBe(502);
  });
});
