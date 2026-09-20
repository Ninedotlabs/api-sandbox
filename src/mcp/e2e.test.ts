// @vitest-environment node
/**
 * Drives the real MCP tool handlers (`TOOLS`, `src/mcp/tools.ts`) against a live dev server
 * and a real Postgres database - the same path an actual MCP client takes, with no shortcut
 * through the in-process route handlers or a mocked `ApiClient`.
 *
 * Three things must all be true for this to run, and it skips cleanly (not red) when any is
 * missing, exactly like the `pg` suites (`vitest.setup.pg.ts`'s `PG_TESTS_ENABLED` pattern):
 *
 *   1. `PG_TESTS_ENABLED` - set by `vitest.setup.pg.ts` when `PG_TEST_DATABASE_URL` names a
 *      reachable Postgres. Never `DATABASE_URL` - see that file's own warning.
 *   2. `UNIVERSAL_API_TOKEN` - the token the *server process* was started with. There is no
 *      same-origin exemption for a request from this test process, so without a matching
 *      token every `/api/v1` call would 401 before touching anything.
 *   3. A server actually answering at `UNIVERSAL_API_URL` (default `http://localhost:3100` -
 *      deliberately not :3000, which `AGENTS.md`/this repo's workflow reserves for a person's
 *      own `next dev`). Probed once, up front, with a plain `fetch` - a closed port throws
 *      before this ever resolves.
 *
 * Run it locally with something like:
 *
 *   PG_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/universal_api_test \
 *   DATABASE_URL=postgres://postgres:postgres@localhost:5433/universal_api_test \
 *   UNIVERSAL_API_TOKEN=ua_e2e_test_token \
 *   npm run dev -- -p 3100 &
 *
 *   PG_TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/universal_api_test \
 *   UNIVERSAL_API_TOKEN=ua_e2e_test_token \
 *   UNIVERSAL_API_URL=http://localhost:3100 \
 *   npx vitest run src/mcp/e2e.test.ts
 */
import { afterAll, describe, expect, it } from "vitest";
import type { Model, Project } from "@/lib/types";
import { createApiClient, type RawEndpointResponse } from "./client";
import { TOOLS, type McpTool } from "./tools";

const SERVER_URL = (process.env.UNIVERSAL_API_URL ?? "http://localhost:3100").replace(/\/+$/, "");
const TOKEN = process.env.UNIVERSAL_API_TOKEN;
const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

async function serverIsUp(): Promise<boolean> {
  if (!hasDb || !TOKEN) return false;
  try {
    await fetch(SERVER_URL);
    return true;
  } catch {
    return false;
  }
}

const hasServer = await serverIsUp();

function findTool(name: string): McpTool {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`No tool registered as "${name}"`);
  return tool;
}

describe.skipIf(!hasDb || !TOKEN || !hasServer)("MCP end-to-end", () => {
  const client = createApiClient(SERVER_URL, TOKEN ?? "");
  const cleanup: string[] = [];

  afterAll(async () => {
    const deleteProject = findTool("delete_project");
    for (const projectId of cleanup) {
      await deleteProject.handler({ projectId }, client).catch(() => {});
    }
  });

  it(
    // The exact journey a person actually asks for: "Create a mock API for widgets. Give it
    // a title and a price, add a couple of sample rows, create the standard endpoints, and
    // make the list endpoint return {ok, data: {widgets, count}, note}. Then show me it
    // working." Every id used below (modelId, routeId, slug) comes from a previous tool's
    // result, never invented, and the CRUD routes come from generate_crud_endpoints - no
    // hand-built route objects.
    "walks the widgets-API request end to end: create, seed, generate standard endpoints, shape the list response, call it, then clean up",
    async () => {
      const createProject = findTool("create_project");
      const createResource = findTool("create_resource");
      const updateResource = findTool("update_resource");
      const generateCrudEndpoints = findTool("generate_crud_endpoints");
      const replaceRecords = findTool("replace_records");
      const setEndpointResponse = findTool("set_endpoint_response");
      const callMockEndpoint = findTool("call_mock_endpoint");
      const getProject = findTool("get_project");
      const deleteProject = findTool("delete_project");

      const project = (await createProject.handler({ name: `MCP E2E ${Date.now()}` }, client)) as Project;
      cleanup.push(project.id);

      const model = (await createResource.handler({ projectId: project.id, name: "Widget" }, client)) as Model;

      // No `id` on either field, `required`/`unique` omitted entirely - exactly the shape a
      // plain-English "give it a title and a price" request produces, and exactly what
      // `update_resource`'s schema used to reject with "fields[].id is required" before that
      // fix (see commit history for the failure this reproduces).
      const parsedUpdateArgs = updateResource.schema.parse({
        projectId: project.id,
        modelId: model.id,
        name: "Widget",
        fields: [{ name: "title", type: "text", required: true }, { name: "price", type: "number" }],
      });
      const updatedModel = (await updateResource.handler(parsedUpdateArgs, client)) as Model;
      expect(updatedModel.fields).toHaveLength(2);
      for (const field of updatedModel.fields) {
        expect(field.id).toMatch(/^fld_/);
      }
      expect(updatedModel.fields.find((f) => f.name === "price")?.required).toBe(false);
      expect(updatedModel.fields.find((f) => f.name === "price")?.unique).toBe(false);

      await replaceRecords.handler(
        {
          projectId: project.id,
          modelId: model.id,
          records: [
            { id: "1", title: "Widget", price: 10 },
            { id: "2", title: "Gadget", price: 20 },
          ],
        },
        client,
      );

      // "Create the standard endpoints" - one call, no hand-built route objects, no invented
      // paths or ids. This is the wall the workflow used to hit: create_endpoints demanded a
      // full array of route objects a model has no way to construct correctly.
      const createdRoutes = (await generateCrudEndpoints.handler({ projectId: project.id, modelId: model.id }, client)) as Array<{
        id: string;
        action: string;
        path: string;
      }>;
      expect(createdRoutes).toHaveLength(5);
      expect(createdRoutes.map((r) => r.action).sort()).toEqual(["create", "delete", "get", "list", "update"]);
      const listRoute = createdRoutes.find((r) => r.action === "list" && r.path === "/widgets")!;
      expect(listRoute).toBeDefined();

      // Reshape the list endpoint into the envelope the user asked for - a status and header
      // the engine's own "auto" behaviour would never produce, so the assertions below can
      // only pass if the shape actually took effect.
      await setEndpointResponse.handler(
        {
          projectId: project.id,
          routeId: listRoute.id,
          mode: "template",
          status: 206,
          headers: { "X-Shaped-Response": "e2e" },
          template: { ok: true, data: { widgets: "{{records}}", count: "{{count}}" }, note: "served by the mock API" },
        },
        client,
      );

      // "Then show me it working" - call the real mock endpoint the way a real client would.
      const response = (await callMockEndpoint.handler(
        { slug: project.slug, method: "GET", path: "/widgets" },
        client,
      )) as RawEndpointResponse;

      expect(response.status).toBe(206);
      expect(response.headers["x-shaped-response"]).toBe("e2e");
      expect(response.body).toEqual({
        ok: true,
        data: {
          widgets: [
            { id: "1", title: "Widget", price: 10 },
            { id: "2", title: "Gadget", price: 20 },
          ],
          count: 2,
        },
        note: "served by the mock API",
      });

      await deleteProject.handler({ projectId: project.id }, client);
      cleanup.length = 0;
      await expect(getProject.handler({ projectId: project.id }, client)).rejects.toThrow();
    },
    30_000,
  );
});
