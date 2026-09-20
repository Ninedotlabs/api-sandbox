// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as request from "@/lib/ai/request";
import * as applyPlanModule from "@/lib/services/pg/apply-plan";
import { pgProjectService } from "@/lib/services/pg/project-service";
import type { Project } from "@/lib/types";
import { POST } from "./route";

vi.mock("@/lib/ai/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/request")>();
  return { ...actual, callResponses: vi.fn() };
});
vi.mock("@/lib/services/pg/apply-plan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/pg/apply-plan")>();
  return { ...actual, applyPlanPg: vi.fn() };
});

const sameOrigin = { "Sec-Fetch-Site": "same-origin" };

const project: Project = {
  id: "prj_1",
  name: "Bookshop",
  slug: "bookshop",
  description: "",
  models: [],
  routes: [],
  createdAt: "t",
  updatedAt: "t",
};

const validPlanJson = JSON.stringify({
  resources: [{ name: "Book", description: "", fields: [{ name: "title", type: "text", required: true, unique: false, options: null, linkTo: null }], records: [] }],
});

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function post(id: string, body: unknown) {
  return POST(
    new Request(`http://t/api/v1/projects/${id}/ai/generate`, {
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

describe("POST /api/v1/projects/:id/ai/generate", () => {
  it("returns 401 without a credential", async () => {
    const res = await POST(
      new Request("http://t/api/v1/projects/prj_1/ai/generate", { method: "POST", body: JSON.stringify({ description: "A shop" }) }),
      ctx("prj_1"),
    );
    expect(res.status).toBe(401);
  });

  it("rejects an empty description with 400", async () => {
    const res = await post("prj_1", { description: "  " });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the project no longer exists", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValue(null);
    const res = await post("missing", { description: "A bookshop" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This API no longer exists." });
  });

  it("returns 503 when AI isn't configured", async () => {
    delete process.env.AZURE_AI_API_KEY;
    vi.spyOn(pgProjectService, "get").mockResolvedValue(project);
    const res = await post("prj_1", { description: "A bookshop" });
    expect(res.status).toBe(503);
  });

  it("generates a plan, persists it, and returns the refreshed project", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValueOnce(project).mockResolvedValueOnce({ ...project, models: [{ id: "mdl_1", name: "Book", fields: [] }] });
    vi.mocked(request.callResponses).mockResolvedValue({ status: 200, text: validPlanJson });
    vi.mocked(applyPlanModule.applyPlanPg).mockResolvedValue({ modelIds: ["mdl_1"], routeCount: 5 });

    const res = await post("prj_1", { description: "A bookshop" });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { data: { project: Project; modelIds: string[]; routeCount: number } };
    expect(body.data.modelIds).toEqual(["mdl_1"]);
    expect(body.data.routeCount).toBe(5);
    expect(body.data.project.models).toHaveLength(1);
    expect(applyPlanModule.applyPlanPg).toHaveBeenCalledWith("prj_1", expect.objectContaining({ resources: expect.any(Array) }));
  });

  it("returns 502 when the AI request itself fails", async () => {
    vi.spyOn(pgProjectService, "get").mockResolvedValue(project);
    vi.mocked(request.callResponses).mockResolvedValue({ status: 500, text: null });
    const res = await post("prj_1", { description: "A bookshop" });
    expect(res.status).toBe(502);
  });
});
