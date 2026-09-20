import { KEY as DB_STORAGE_KEY } from "@/lib/services/mock/db";
import { mockConsoleService } from "@/lib/services/mock/console-service";
import type { Project } from "@/lib/types";
import {
  MIGRATED_FLAG_KEY,
  hasMigrated,
  importLocalProjects,
  markMigrated,
  projectsToOffer,
  readLocalProjects,
} from "./migrate-local";

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "prj_1",
    name: "Bookshop",
    slug: "bookshop",
    description: "",
    models: [],
    routes: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function writeLocalDb(projects: Project[]) {
  localStorage.setItem(DB_STORAGE_KEY, JSON.stringify({ projects }));
}

describe("readLocalProjects", () => {
  it("returns [] when nothing is stored", () => {
    expect(readLocalProjects()).toEqual([]);
  });

  it("returns the persisted projects", () => {
    const p = project();
    writeLocalDb([p]);
    expect(readLocalProjects()).toEqual([p]);
  });

  it("returns [] for malformed JSON rather than throwing", () => {
    localStorage.setItem(DB_STORAGE_KEY, "{not json");
    expect(() => readLocalProjects()).not.toThrow();
    expect(readLocalProjects()).toEqual([]);
  });

  it("returns [] when the shape is missing its projects array", () => {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify({ oops: true }));
    expect(readLocalProjects()).toEqual([]);
  });

  it("returns [] when projects is present but not an array", () => {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify({ projects: "nope" }));
    expect(readLocalProjects()).toEqual([]);
  });
});

describe("hasMigrated / markMigrated", () => {
  it("is false until marked", () => {
    expect(hasMigrated()).toBe(false);
    markMigrated();
    expect(hasMigrated()).toBe(true);
    expect(localStorage.getItem(MIGRATED_FLAG_KEY)).toBeTruthy();
  });
});

describe("projectsToOffer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers the local projects when the server has none", async () => {
    writeLocalDb([project()]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const offered = await projectsToOffer();
    expect(offered).toHaveLength(1);
    expect(offered[0].name).toBe("Bookshop");
  });

  it("offers nothing when the server already has projects", async () => {
    writeLocalDb([project()]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [project({ id: "prj_2" })] }), { status: 200 }),
    );
    expect(await projectsToOffer()).toEqual([]);
  });

  it("offers nothing when localStorage holds no projects", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await projectsToOffer()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("offers nothing once migration is flagged done, even if the server is empty", async () => {
    writeLocalDb([project()]);
    markMigrated();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await projectsToOffer()).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("offers nothing when the server can't be reached, rather than risking a duplicate import", async () => {
    writeLocalDb([project()]);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(await projectsToOffer()).toEqual([]);
  });
});

describe("importLocalProjects", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("posts a project, its models, fields, routes and records", async () => {
    const p = project({
      models: [
        {
          id: "mdl_local_1",
          name: "Book",
          fields: [{ id: "f1", name: "title", type: "text", required: true, unique: false }],
        },
      ],
      routes: [
        { id: "rt_local_1", method: "GET", path: "/books", modelId: "mdl_local_1", action: "list", description: "", filters: [] },
      ],
    });
    // `mockConsoleService` looks the project up in the mock db before it will write records
    // for it (see `mock/console-service.ts`'s `findProject`), so the project has to be
    // "in the browser" for the seed below to actually land.
    writeLocalDb([p]);
    await mockConsoleService.seedRecords(p.id, "mdl_local_1", [{ title: "Dune" }]);

    const calls: { url: string; method: string; body: unknown }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(init.body as string) : undefined;
      calls.push({ url, method, body });
      if (url === "/api/v1/projects" && method === "POST") {
        return new Response(JSON.stringify({ data: { ...p, id: "prj_server_1" } }), { status: 201 });
      }
      if (url === "/api/v1/projects/prj_server_1/models" && method === "POST") {
        return new Response(JSON.stringify({ data: { id: "mdl_server_1", name: "Book", fields: [] } }), { status: 201 });
      }
      if (url === "/api/v1/projects/prj_server_1/models/mdl_server_1" && method === "PATCH") {
        return new Response(JSON.stringify({ data: body }), { status: 200 });
      }
      if (url === "/api/v1/projects/prj_server_1/routes" && method === "POST") {
        return new Response(JSON.stringify({ data: [] }), { status: 201 });
      }
      if (url === "/api/v1/projects/prj_server_1/models/mdl_server_1/records" && method === "PUT") {
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }
      throw new Error(`unexpected request ${method} ${url}`);
    });

    const results = await importLocalProjects([p]);
    expect(results).toEqual([{ id: p.id, name: p.name, ok: true }]);

    const routesCall = calls.find((c) => c.url.endsWith("/routes"));
    expect((routesCall!.body as { routes: { modelId: string }[] }).routes[0].modelId).toBe("mdl_server_1");
    const recordsCall = calls.find((c) => c.url.endsWith("/records"));
    expect(recordsCall!.body).toEqual({ records: [{ id: "1", title: "Dune" }] });
  });

  it("reports a per-project failure with the server's reason, leaving other projects unaffected", async () => {
    const ok = project({ id: "prj_ok", name: "Ok Project" });
    const bad = project({ id: "prj_bad", name: "Bad Project" });

    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const body = init?.body ? (JSON.parse(init.body as string) as { name: string }) : undefined;
      if (String(input) === "/api/v1/projects" && body?.name === "Bad Project") {
        return new Response(JSON.stringify({ error: "Something with this name or address already exists." }), { status: 409 });
      }
      if (String(input) === "/api/v1/projects") {
        return new Response(JSON.stringify({ data: { ...ok, id: "prj_ok_server" } }), { status: 201 });
      }
      throw new Error(`unexpected request ${String(input)}`);
    });

    const results = await importLocalProjects([ok, bad]);
    expect(results).toEqual([
      { id: "prj_ok", name: "Ok Project", ok: true },
      { id: "prj_bad", name: "Bad Project", ok: false, error: "Something with this name or address already exists." },
    ]);
  });
});
