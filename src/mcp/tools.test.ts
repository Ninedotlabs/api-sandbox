import type { ApiClient } from "./client";
import { TOOLS, type McpTool } from "./tools";

function findTool(name: string): McpTool {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`No tool registered as "${name}"`);
  return tool;
}

function mockClient(overrides: Partial<ApiClient> = {}): ApiClient {
  const unimplemented = (method: string) => async () => {
    throw new Error(`unexpected call to ApiClient.${method}`);
  };
  return {
    get: unimplemented("get"),
    post: unimplemented("post"),
    patch: unimplemented("patch"),
    put: unimplemented("put"),
    del: unimplemented("del"),
    callEndpoint: unimplemented("callEndpoint"),
    ...overrides,
  };
}

describe("TOOLS", () => {
  it("has a unique name for every tool", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers the whole product surface", () => {
    const names = TOOLS.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "list_projects",
        "get_project",
        "create_project",
        "update_project",
        "delete_project",
        "duplicate_project",
        "create_resource",
        "update_resource",
        "delete_resource",
        "create_endpoints",
        "generate_crud_endpoints",
        "update_endpoint",
        "delete_endpoint",
        "set_endpoint_response",
        "list_records",
        "replace_records",
        "add_record",
        "delete_record",
        "generate_api",
        "edit_api",
        "call_mock_endpoint",
      ].sort(),
    );
  });

  it("gives every tool a one-sentence, non-empty description", () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("marks the destructive tools as destructive, and only those", () => {
    const destructive = TOOLS.filter((t) => t.destructive).map((t) => t.name).sort();
    expect(destructive).toEqual(
      ["delete_endpoint", "delete_project", "delete_record", "delete_resource", "replace_records", "update_resource"].sort(),
    );
  });

  describe("schema validation", () => {
    const requiredArgsByTool: Record<string, Record<string, unknown>> = {
      list_projects: {},
      get_project: { projectId: "prj_1" },
      create_project: { name: "Blog" },
      update_project: { projectId: "prj_1" },
      delete_project: { projectId: "prj_1" },
      duplicate_project: { projectId: "prj_1" },
      create_resource: { projectId: "prj_1", name: "Posts" },
      update_resource: { projectId: "prj_1", modelId: "mdl_1", name: "Posts", fields: [] },
      delete_resource: { projectId: "prj_1", modelId: "mdl_1" },
      create_endpoints: {
        projectId: "prj_1",
        routes: [{ method: "GET", path: "/posts", modelId: null, action: "list" }],
      },
      generate_crud_endpoints: { projectId: "prj_1", modelId: "mdl_1" },
      update_endpoint: { projectId: "prj_1", routeId: "rte_1" },
      delete_endpoint: { projectId: "prj_1", routeId: "rte_1" },
      set_endpoint_response: { projectId: "prj_1", routeId: "rte_1", mode: "static", body: { ok: true } },
      list_records: { projectId: "prj_1", modelId: "mdl_1" },
      replace_records: { projectId: "prj_1", modelId: "mdl_1", records: [] },
      add_record: { projectId: "prj_1", modelId: "mdl_1", record: { title: "Hello" } },
      delete_record: { projectId: "prj_1", modelId: "mdl_1", recordId: "rec_1" },
      generate_api: { projectId: "prj_1", description: "A blog with posts and comments" },
      edit_api: { projectId: "prj_1", instruction: "Add a rating field to posts" },
      call_mock_endpoint: { slug: "blog", method: "GET", path: "/posts" },
    };

    // The subset of each tool's minimal-args keys that are genuinely required (as opposed to
    // present in the fixture merely to make a realistic example, like `body` on
    // set_endpoint_response, which is optional even though most real calls will send one).
    const requiredKeysByTool: Record<string, string[]> = {
      list_projects: [],
      get_project: ["projectId"],
      create_project: ["name"],
      update_project: ["projectId"],
      delete_project: ["projectId"],
      duplicate_project: ["projectId"],
      create_resource: ["projectId", "name"],
      update_resource: ["projectId", "modelId", "name"],
      delete_resource: ["projectId", "modelId"],
      create_endpoints: ["projectId", "routes"],
      generate_crud_endpoints: ["projectId", "modelId"],
      update_endpoint: ["projectId", "routeId"],
      delete_endpoint: ["projectId", "routeId"],
      set_endpoint_response: ["projectId", "routeId", "mode"],
      list_records: ["projectId", "modelId"],
      replace_records: ["projectId", "modelId", "records"],
      add_record: ["projectId", "modelId", "record"],
      delete_record: ["projectId", "modelId", "recordId"],
      generate_api: ["projectId", "description"],
      edit_api: ["projectId", "instruction"],
      call_mock_endpoint: ["slug", "method", "path"],
    };

    describe("update_resource's field schema", () => {
      function parseFields(fields: unknown[]) {
        const parsed = findTool("update_resource").schema.parse({
          projectId: "prj_1",
          modelId: "mdl_1",
          name: "Posts",
          fields,
        }) as { fields: Array<{ id: string; name: string; required: boolean; unique: boolean }> };
        return parsed.fields;
      }

      it("generates an id for a field that doesn't have one", () => {
        const [field] = parseFields([{ name: "title", type: "text" }]);
        expect(field.id).toMatch(/^fld_[a-z0-9]{10}$/);
      });

      it("keeps a supplied id instead of generating one", () => {
        const [field] = parseFields([{ id: "fld_existing", name: "title", type: "text" }]);
        expect(field.id).toBe("fld_existing");
      });

      it("generates distinct ids for multiple id-less fields", () => {
        const [a, b] = parseFields([
          { name: "title", type: "text" },
          { name: "price", type: "number" },
        ]);
        expect(a.id).not.toBe(b.id);
      });

      it("defaults required and unique to false when omitted", () => {
        const [field] = parseFields([{ name: "title", type: "text" }]);
        expect(field.required).toBe(false);
        expect(field.unique).toBe(false);
      });

      it("still honors an explicit required/unique value", () => {
        const [field] = parseFields([{ name: "title", type: "text", required: true, unique: true }]);
        expect(field.required).toBe(true);
        expect(field.unique).toBe(true);
      });

      it("still rejects a field with no name or an invalid type", () => {
        expect(() => parseFields([{ type: "text" }])).toThrow();
        expect(() => parseFields([{ name: "title", type: "not-a-type" }])).toThrow();
      });
    });

    it("accepts the minimal valid arguments for every tool", () => {
      for (const tool of TOOLS) {
        const args = requiredArgsByTool[tool.name];
        expect(args, `no fixture args for ${tool.name}`).toBeDefined();
        const result = tool.schema.safeParse(args);
        expect(result.success, `${tool.name} rejected its own minimal args: ${JSON.stringify(!result.success && result.error.issues)}`).toBe(true);
      }
    });

    it("rejects a missing required argument for every tool", () => {
      for (const tool of TOOLS) {
        const args = requiredArgsByTool[tool.name];
        const keys = requiredKeysByTool[tool.name];
        expect(keys, `no required-keys fixture for ${tool.name}`).toBeDefined();
        for (const key of keys) {
          const rest = { ...args };
          delete rest[key];
          const result = tool.schema.safeParse(rest);
          expect(result.success, `${tool.name} should reject missing "${key}"`).toBe(false);
        }
      }
    });
  });

  describe("handlers", () => {
    it("list_projects calls GET /api/v1/projects and returns the data", async () => {
      const client = mockClient({ get: vi.fn(async () => [{ id: "prj_1" }]) });
      const result = await findTool("list_projects").handler({}, client);
      expect(result).toEqual([{ id: "prj_1" }]);
      expect(client.get).toHaveBeenCalledWith("/api/v1/projects");
    });

    it("get_project calls GET /api/v1/projects/:id", async () => {
      const client = mockClient({ get: vi.fn(async () => ({ id: "prj_1" })) });
      await findTool("get_project").handler({ projectId: "prj_1" }, client);
      expect(client.get).toHaveBeenCalledWith("/api/v1/projects/prj_1");
    });

    it("create_project posts to /api/v1/projects with the given fields", async () => {
      const client = mockClient({ post: vi.fn(async () => ({ id: "prj_1" })) });
      await findTool("create_project").handler({ name: "Blog", description: "A blog" }, client);
      expect(client.post).toHaveBeenCalledWith("/api/v1/projects", { name: "Blog", description: "A blog", templateId: undefined });
    });

    it("update_project patches /api/v1/projects/:id", async () => {
      const client = mockClient({ patch: vi.fn(async () => ({ id: "prj_1" })) });
      await findTool("update_project").handler({ projectId: "prj_1", name: "New name" }, client);
      expect(client.patch).toHaveBeenCalledWith("/api/v1/projects/prj_1", { name: "New name" });
    });

    it("delete_project deletes /api/v1/projects/:id and returns the undo payload", async () => {
      const client = mockClient({ del: vi.fn(async () => ({ project: { id: "prj_1" }, records: [] })) });
      const result = await findTool("delete_project").handler({ projectId: "prj_1" }, client);
      expect(client.del).toHaveBeenCalledWith("/api/v1/projects/prj_1");
      expect(result).toEqual({ project: { id: "prj_1" }, records: [] });
    });

    it("duplicate_project posts /api/v1/projects/:id/duplicate", async () => {
      const client = mockClient({ post: vi.fn(async () => ({ id: "prj_2" })) });
      await findTool("duplicate_project").handler({ projectId: "prj_1" }, client);
      expect(client.post).toHaveBeenCalledWith("/api/v1/projects/prj_1/duplicate");
    });

    it("create_resource posts /api/v1/projects/:id/models with the name", async () => {
      const client = mockClient({ post: vi.fn(async () => ({ id: "mdl_1" })) });
      await findTool("create_resource").handler({ projectId: "prj_1", name: "Posts" }, client);
      expect(client.post).toHaveBeenCalledWith("/api/v1/projects/prj_1/models", { name: "Posts" });
    });

    it("update_resource patches /api/v1/projects/:id/models/:modelId with the full model", async () => {
      const client = mockClient({ patch: vi.fn(async () => ({ id: "mdl_1" })) });
      const fields = [{ id: "fld_1", name: "title", type: "text", required: true, unique: false }];
      await findTool("update_resource").handler({ projectId: "prj_1", modelId: "mdl_1", name: "Posts", fields }, client);
      expect(client.patch).toHaveBeenCalledWith("/api/v1/projects/prj_1/models/mdl_1", { id: "mdl_1", name: "Posts", fields });
    });

    it("delete_resource deletes /api/v1/projects/:id/models/:modelId", async () => {
      const client = mockClient({ del: vi.fn(async () => ({ model: { id: "mdl_1" } })) });
      await findTool("delete_resource").handler({ projectId: "prj_1", modelId: "mdl_1" }, client);
      expect(client.del).toHaveBeenCalledWith("/api/v1/projects/prj_1/models/mdl_1");
    });

    it("create_endpoints posts /api/v1/projects/:id/routes with the routes array", async () => {
      const client = mockClient({ post: vi.fn(async () => [{ id: "rte_1" }]) });
      const routes = [{ method: "GET", path: "/posts", modelId: null, action: "list" }];
      await findTool("create_endpoints").handler({ projectId: "prj_1", routes }, client);
      expect(client.post).toHaveBeenCalledWith("/api/v1/projects/prj_1/routes", { routes });
    });

    describe("generate_crud_endpoints", () => {
      const model = {
        id: "mdl_1",
        name: "Widget",
        fields: [{ id: "fld_1", name: "title", type: "text", required: false, unique: false }],
      };
      const project = { id: "prj_1", models: [model], routes: [] };

      it("fetches the project, builds the five standard routes for the resource via buildCrudRoutes, and posts them", async () => {
        const client = mockClient({
          get: vi.fn(async () => project),
          post: vi.fn(async (_path: string, body: unknown) => (body as { routes: unknown[] }).routes),
        });

        const result = (await findTool("generate_crud_endpoints").handler({ projectId: "prj_1", modelId: "mdl_1" }, client)) as Array<{
          method: string;
          path: string;
          action: string;
        }>;

        expect(client.get).toHaveBeenCalledWith("/api/v1/projects/prj_1");
        expect(client.post).toHaveBeenCalledWith(
          "/api/v1/projects/prj_1/routes",
          expect.objectContaining({
            routes: expect.arrayContaining([
              expect.objectContaining({ method: "GET", path: "/widgets", action: "list", modelId: "mdl_1" }),
              expect.objectContaining({ method: "GET", path: "/widgets/:id", action: "get", modelId: "mdl_1" }),
              expect.objectContaining({ method: "POST", path: "/widgets", action: "create", modelId: "mdl_1" }),
              expect.objectContaining({ method: "PUT", path: "/widgets/:id", action: "update", modelId: "mdl_1" }),
              expect.objectContaining({ method: "DELETE", path: "/widgets/:id", action: "delete", modelId: "mdl_1" }),
            ]),
          }),
        );
        expect(result).toHaveLength(5);
      });

      it("only builds the requested actions when actions is given", async () => {
        const client = mockClient({
          get: vi.fn(async () => project),
          post: vi.fn(async (_path: string, body: unknown) => (body as { routes: unknown[] }).routes),
        });

        await findTool("generate_crud_endpoints").handler({ projectId: "prj_1", modelId: "mdl_1", actions: ["list"] }, client);

        expect(client.post).toHaveBeenCalledWith("/api/v1/projects/prj_1/routes", {
          routes: [expect.objectContaining({ method: "GET", path: "/widgets", action: "list" })],
        });
      });

      it("skips routes that already exist and, when everything already exists, does not call post at all", async () => {
        const existing = {
          id: "prj_1",
          models: [model],
          routes: [
            { id: "rte_1", method: "GET", path: "/widgets", modelId: "mdl_1", action: "list", description: "", filters: [] },
            { id: "rte_2", method: "GET", path: "/widgets/:id", modelId: "mdl_1", action: "get", description: "", filters: [] },
            { id: "rte_3", method: "POST", path: "/widgets", modelId: "mdl_1", action: "create", description: "", filters: [] },
            { id: "rte_4", method: "PUT", path: "/widgets/:id", modelId: "mdl_1", action: "update", description: "", filters: [] },
            { id: "rte_5", method: "DELETE", path: "/widgets/:id", modelId: "mdl_1", action: "delete", description: "", filters: [] },
          ],
        };
        const client = mockClient({ get: vi.fn(async () => existing), post: vi.fn() });

        const result = await findTool("generate_crud_endpoints").handler({ projectId: "prj_1", modelId: "mdl_1" }, client);

        expect(client.post).not.toHaveBeenCalled();
        expect(result).toEqual([]);
      });

      it("throws a plain-language error when the resource no longer exists", async () => {
        const client = mockClient({ get: vi.fn(async () => ({ id: "prj_1", models: [], routes: [] })) });
        await expect(
          findTool("generate_crud_endpoints").handler({ projectId: "prj_1", modelId: "missing" }, client),
        ).rejects.toThrow("This resource no longer exists.");
      });
    });

    describe("update_endpoint", () => {
      const project = {
        id: "prj_1",
        routes: [
          {
            id: "rte_1",
            method: "GET",
            path: "/orders/:id",
            modelId: "mdl_1",
            action: "get",
            description: "Get one order",
            filters: ["status"],
            response: { mode: "static", status: 200, body: { ok: true } },
          },
        ],
      };

      it("fetches the current route and merges only the given fields, preserving the rest - including an existing custom response", async () => {
        const client = mockClient({
          get: vi.fn(async () => project),
          patch: vi.fn(async (_path: string, body: unknown) => body),
        });

        await findTool("update_endpoint").handler({ projectId: "prj_1", routeId: "rte_1", path: "/orders/:orderId" }, client);

        expect(client.get).toHaveBeenCalledWith("/api/v1/projects/prj_1");
        expect(client.patch).toHaveBeenCalledWith("/api/v1/projects/prj_1/routes/rte_1", {
          id: "rte_1",
          method: "GET",
          path: "/orders/:orderId",
          modelId: "mdl_1",
          action: "get",
          description: "Get one order",
          filters: ["status"],
          response: { mode: "static", status: 200, body: { ok: true } },
        });
      });

      it("overrides only the fields actually supplied", async () => {
        const client = mockClient({
          get: vi.fn(async () => project),
          patch: vi.fn(async (_path: string, body: unknown) => body),
        });

        await findTool("update_endpoint").handler(
          { projectId: "prj_1", routeId: "rte_1", description: "Fetch an order", filters: [] },
          client,
        );

        expect(client.patch).toHaveBeenCalledWith("/api/v1/projects/prj_1/routes/rte_1", {
          id: "rte_1",
          method: "GET",
          path: "/orders/:id",
          modelId: "mdl_1",
          action: "get",
          description: "Fetch an order",
          filters: [],
          response: { mode: "static", status: 200, body: { ok: true } },
        });
      });

      it("throws a plain-language error when the route no longer exists", async () => {
        const client = mockClient({ get: vi.fn(async () => ({ id: "prj_1", routes: [] })) });
        await expect(
          findTool("update_endpoint").handler({ projectId: "prj_1", routeId: "missing", path: "/x" }, client),
        ).rejects.toThrow("This route no longer exists.");
      });
    });

    it("delete_endpoint deletes /api/v1/projects/:id/routes/:routeId", async () => {
      const client = mockClient({ del: vi.fn(async () => ({ route: { id: "rte_1" }, beforeId: null })) });
      await findTool("delete_endpoint").handler({ projectId: "prj_1", routeId: "rte_1" }, client);
      expect(client.del).toHaveBeenCalledWith("/api/v1/projects/prj_1/routes/rte_1");
    });

    it("list_records calls GET on the model's records endpoint", async () => {
      const client = mockClient({ get: vi.fn(async () => [{ id: "1" }]) });
      await findTool("list_records").handler({ projectId: "prj_1", modelId: "mdl_1" }, client);
      expect(client.get).toHaveBeenCalledWith("/api/v1/projects/prj_1/models/mdl_1/records");
    });

    it("replace_records puts the records array and returns the undo-free result", async () => {
      const client = mockClient({ put: vi.fn(async () => [{ id: "1", title: "Hi" }]) });
      const records = [{ id: "1", title: "Hi" }];
      await findTool("replace_records").handler({ projectId: "prj_1", modelId: "mdl_1", records }, client);
      expect(client.put).toHaveBeenCalledWith("/api/v1/projects/prj_1/models/mdl_1/records", { records });
    });

    it("add_record posts the record fields directly", async () => {
      const client = mockClient({ post: vi.fn(async () => ({ id: "rec_1", title: "Hi" })) });
      await findTool("add_record").handler({ projectId: "prj_1", modelId: "mdl_1", record: { title: "Hi" } }, client);
      expect(client.post).toHaveBeenCalledWith("/api/v1/projects/prj_1/models/mdl_1/records", { title: "Hi" });
    });

    it("delete_record deletes the record by id", async () => {
      const client = mockClient({ del: vi.fn(async () => ({ id: "rec_1" })) });
      await findTool("delete_record").handler({ projectId: "prj_1", modelId: "mdl_1", recordId: "rec_1" }, client);
      expect(client.del).toHaveBeenCalledWith("/api/v1/projects/prj_1/models/mdl_1/records/rec_1");
    });

    it("generate_api posts the description to the ai/generate endpoint", async () => {
      const client = mockClient({ post: vi.fn(async () => ({ project: {}, modelIds: [], routeCount: 0, warnings: [] })) });
      await findTool("generate_api").handler({ projectId: "prj_1", description: "A blog" }, client);
      expect(client.post).toHaveBeenCalledWith("/api/v1/projects/prj_1/ai/generate", { description: "A blog", maxResources: undefined, recordsPerResource: undefined });
    });

    it("edit_api posts the instruction to the ai/edit endpoint, letting removals flow through untouched", async () => {
      const client = mockClient({ post: vi.fn(async () => ({ project: {}, removals: { resources: ["Posts"] } })) });
      const result = await findTool("edit_api").handler({ projectId: "prj_1", instruction: "Remove the Posts resource" }, client);
      expect(client.post).toHaveBeenCalledWith("/api/v1/projects/prj_1/ai/edit", { instruction: "Remove the Posts resource" });
      expect(result).toEqual({ project: {}, removals: { resources: ["Posts"] } });
    });

    it("a handler whose API call fails surfaces the server's error string unchanged", async () => {
      const client = mockClient({ get: vi.fn(async () => { throw new Error("This API no longer exists."); }) });
      await expect(findTool("get_project").handler({ projectId: "missing" }, client)).rejects.toThrow("This API no longer exists.");
    });

    describe("set_endpoint_response", () => {
      const project = {
        id: "prj_1",
        routes: [
          { id: "rte_1", method: "GET", path: "/orders/:id", modelId: "mdl_1", action: "get", description: "", filters: [] },
        ],
      };

      it("fetches the project, merges the response shape into the route, and PATCHes the full route", async () => {
        const client = mockClient({
          get: vi.fn(async () => project),
          patch: vi.fn(async (path: string, body: unknown) => body),
        });

        const result = await findTool("set_endpoint_response").handler(
          {
            projectId: "prj_1",
            routeId: "rte_1",
            mode: "template",
            status: 503,
            headers: { "Retry-After": "30" },
            template: { success: false, retryAfter: "{{now}}" },
          },
          client,
        );

        expect(client.get).toHaveBeenCalledWith("/api/v1/projects/prj_1");
        expect(client.patch).toHaveBeenCalledWith("/api/v1/projects/prj_1/routes/rte_1", {
          id: "rte_1",
          method: "GET",
          path: "/orders/:id",
          modelId: "mdl_1",
          action: "get",
          description: "",
          filters: [],
          response: {
            mode: "template",
            status: 503,
            headers: { "Retry-After": "30" },
            template: { success: false, retryAfter: "{{now}}" },
          },
        });
        expect(result).toMatchObject({ response: { mode: "template", status: 503 } });
      });

      it("throws a plain-language error when the route no longer exists", async () => {
        const client = mockClient({ get: vi.fn(async () => project) });
        await expect(
          findTool("set_endpoint_response").handler({ projectId: "prj_1", routeId: "missing", mode: "static", body: {} }, client),
        ).rejects.toThrow("This route no longer exists.");
      });
    });

    describe("call_mock_endpoint", () => {
      it("issues a real request against /{slug}/{path}, not /api/v1", async () => {
        const client = mockClient({
          callEndpoint: vi.fn(async () => ({ status: 200, headers: { "content-type": "application/json" }, body: { data: [] } })),
        });
        const result = await findTool("call_mock_endpoint").handler({ slug: "bookshop", method: "GET", path: "/books" }, client);
        expect(client.callEndpoint).toHaveBeenCalledWith("GET", "/api/bookshop/books", { query: undefined, body: undefined });
        expect(result).toEqual({ status: 200, headers: { "content-type": "application/json" }, body: { data: [] } });
      });

      it("normalizes a path that doesn't start with a slash", async () => {
        const client = mockClient({ callEndpoint: vi.fn(async () => ({ status: 200, headers: {}, body: undefined })) });
        await findTool("call_mock_endpoint").handler({ slug: "bookshop", method: "GET", path: "books" }, client);
        expect(client.callEndpoint).toHaveBeenCalledWith("GET", "/api/bookshop/books", { query: undefined, body: undefined });
      });
    });
  });
});
