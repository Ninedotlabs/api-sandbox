// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { getPool } from "@/lib/db/client";
import { pgModelService } from "@/lib/services/pg/model-service";
import { pgProjectService } from "@/lib/services/pg/project-service";
import { pgRecordService } from "@/lib/services/pg/record-service";
import { pgRouteService } from "@/lib/services/pg/route-service";
import type { Project } from "@/lib/types";
import { DELETE, GET, OPTIONS, PATCH, POST } from "./route";

const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

describe.skipIf(!hasDb)("mock API over real HTTP", () => {
  afterAll(async () => {
    await getPool().end();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function ctx(slug: string, path: string[]) {
    return { params: Promise.resolve({ slug, path }) };
  }

  function req(url: string, init?: RequestInit) {
    return new Request(url, init);
  }

  /** A todo-template project with CRUD routes on Task and two seeded records. */
  async function seededProject(): Promise<{ project: Project; taskModelId: string }> {
    const project = await pgProjectService.create({ name: `Route Test Api ${Date.now()}`, description: "", templateId: "todo" });
    const task = project.models[0];
    await pgRouteService.createMany(project.id, [
      { id: "rte_list", method: "GET", path: "/tasks", modelId: task.id, action: "list", description: "", filters: [] },
      { id: "rte_get", method: "GET", path: "/tasks/:id", modelId: task.id, action: "get", description: "", filters: [] },
      { id: "rte_create", method: "POST", path: "/tasks", modelId: task.id, action: "create", description: "", filters: [] },
      { id: "rte_update", method: "PATCH", path: "/tasks/:id", modelId: task.id, action: "update", description: "", filters: [] },
      { id: "rte_delete", method: "DELETE", path: "/tasks/:id", modelId: task.id, action: "delete", description: "", filters: [] },
    ]);
    await pgRecordService.seedRecords(project.id, task.id, [
      { id: "1", title: "Buy milk", done: false },
      { id: "2", title: "Walk dog", done: true },
    ]);
    const reloaded = (await pgProjectService.get(project.id))!;
    return { project: reloaded, taskModelId: task.id };
  }

  it("lists records for a route with no :param", async () => {
    const { project } = await seededProject();
    try {
      const res = await GET(req(`http://t/api/${project.slug}/tasks`), ctx(project.slug, ["tasks"]));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBe(2);
      expect(body.data.map((r: { title: string }) => r.title).sort()).toEqual(["Buy milk", "Walk dog"]);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("gets a single record by :id", async () => {
    const { project } = await seededProject();
    try {
      const res = await GET(req(`http://t/api/${project.slug}/tasks/1`), ctx(project.slug, ["tasks", "1"]));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ id: "1", title: "Buy milk" });
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("returns 404 for an unknown id", async () => {
    const { project } = await seededProject();
    try {
      const res = await GET(req(`http://t/api/${project.slug}/tasks/999`), ctx(project.slug, ["tasks", "999"]));
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(typeof body.error).toBe("string");
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("returns 400 with the engine's validation message when a required field is missing", async () => {
    const { project } = await seededProject();
    try {
      const res = await POST(
        req(`http://t/api/${project.slug}/tasks`, {
          method: "POST",
          body: JSON.stringify({ done: false }),
          headers: { "Content-Type": "application/json" },
        }),
        ctx(project.slug, ["tasks"]),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Validation failed");
      expect(body.details).toEqual(["'title' is required"]);
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("creates a record and persists it", async () => {
    const { project, taskModelId } = await seededProject();
    try {
      const res = await POST(
        req(`http://t/api/${project.slug}/tasks`, {
          method: "POST",
          body: JSON.stringify({ title: "Feed cat", done: false }),
          headers: { "Content-Type": "application/json" },
        }),
        ctx(project.slug, ["tasks"]),
      );
      expect(res.status).toBe(201);
      const created = await res.json();
      expect(created.title).toBe("Feed cat");

      const persisted = await pgRecordService.sampleData(project.id, taskModelId);
      expect(persisted).toHaveLength(3);
      expect(persisted.find((r) => r.id === created.id)).toMatchObject({ title: "Feed cat" });
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("updates a record and persists the change", async () => {
    const { project, taskModelId } = await seededProject();
    try {
      const res = await PATCH(
        req(`http://t/api/${project.slug}/tasks/1`, {
          method: "PATCH",
          body: JSON.stringify({ title: "Buy oat milk" }),
          headers: { "Content-Type": "application/json" },
        }),
        ctx(project.slug, ["tasks", "1"]),
      );
      expect(res.status).toBe(200);
      expect((await res.json()).title).toBe("Buy oat milk");

      const persisted = await pgRecordService.sampleData(project.id, taskModelId);
      expect(persisted.find((r) => r.id === "1")).toMatchObject({ title: "Buy oat milk" });
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("deletes a record and persists the removal", async () => {
    const { project, taskModelId } = await seededProject();
    try {
      const res = await DELETE(req(`http://t/api/${project.slug}/tasks/2`, { method: "DELETE" }), ctx(project.slug, ["tasks", "2"]));
      expect(res.status).toBe(204);

      const persisted = await pgRecordService.sampleData(project.id, taskModelId);
      expect(persisted.map((r) => r.id)).toEqual(["1"]);
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("returns 404 for an unknown project slug", async () => {
    const res = await GET(req("http://t/api/no-such-project/tasks"), ctx("no-such-project", ["tasks"]));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("refuses a reserved slug even if a project happens to have it", async () => {
    const res = await GET(req("http://t/api/v1/tasks"), ctx("v1", ["tasks"]));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(typeof body.error).toBe("string");
  });

  it("answers OPTIONS with open CORS headers", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });

  it("reaches a custom endpoint even though a lower-position :id route also matches (C1)", async () => {
    // crudOptions creates `GET /books/:id` with a low position; a custom endpoint added
    // afterwards - exactly how the AI edit feature adds one - gets a higher position but
    // must still win against a literal segment like "best-selling".
    const project = await pgProjectService.create({ name: `Specificity Api ${Date.now()}`, description: "", templateId: null });
    try {
      const book = await pgModelService.create(project.id, "Book");
      await pgRouteService.createMany(project.id, [
        { id: "rte_book_get", method: "GET", path: "/books/:id", modelId: book.id, action: "get", description: "", filters: [] },
        {
          id: "rte_book_best",
          method: "GET",
          path: "/books/best-selling",
          modelId: null,
          action: "custom",
          description: "Best sellers",
          filters: [],
        },
      ]);
      await pgRecordService.seedRecords(project.id, book.id, [{ id: "1", title: "Dune" }]);
      const reloaded = (await pgProjectService.get(project.id))!;

      const customRes = await GET(req(`http://t/api/${reloaded.slug}/books/best-selling`), ctx(reloaded.slug, ["books", "best-selling"]));
      // The custom route has no model, so the engine's default (unknown action) response
      // for a "custom" action is what proves this route - not `get` - was reached: it must
      // not be treated as a lookup for a book with id "best-selling".
      expect(customRes.status).not.toBe(404);

      const idRes = await GET(req(`http://t/api/${reloaded.slug}/books/1`), ctx(reloaded.slug, ["books", "1"]));
      expect(idRes.status).toBe(200);
      expect(await idRes.json()).toMatchObject({ id: "1", title: "Dune" });
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("returns a generic 500 with CORS headers when a dependency fails unexpectedly (I1)", async () => {
    const raw = new Error("connection to server at postgres://user:secret@internal-host failed");
    vi.spyOn(pgProjectService, "list").mockRejectedValueOnce(raw);

    const res = await GET(req("http://t/api/anything/tasks"), ctx("anything", ["tasks"]));
    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const body = await res.json();
    expect(typeof body.error).toBe("string");
    expect(body.error.toLowerCase()).not.toContain("postgres");
    expect(body.error).not.toContain("secret");
    expect(body.error).not.toContain("internal-host");
  });

  it("does not silently drop a record from a concurrent create (I2)", async () => {
    const { project, taskModelId } = await seededProject();
    try {
      const create = () =>
        POST(
          req(`http://t/api/${project.slug}/tasks`, {
            method: "POST",
            body: JSON.stringify({ title: "Concurrent task", done: false }),
            headers: { "Content-Type": "application/json" },
          }),
          ctx(project.slug, ["tasks"]),
        );

      const [r1, r2] = await Promise.all([create(), create()]);
      const succeeded = [r1, r2].filter((r) => r.status === 201);
      // At least one concurrent create must succeed and actually persist - the old
      // read-modify-write-the-whole-set path could let the second write silently erase
      // the first one's new record.
      expect(succeeded.length).toBeGreaterThanOrEqual(1);

      const persisted = await pgRecordService.sampleData(project.id, taskModelId);
      for (const res of succeeded) {
        const created = await res.json();
        expect(persisted.some((r) => r.id === created.id)).toBe(true);
      }
    } finally {
      await pgProjectService.remove(project.id);
    }
  });
});
