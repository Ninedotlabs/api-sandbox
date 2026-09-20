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
    "creates a project, builds and seeds a resource, shapes an endpoint's response, calls it through call_mock_endpoint, then deletes the project",
    async () => {
      const createProject = findTool("create_project");
      const createResource = findTool("create_resource");
      const updateResource = findTool("update_resource");
      const createEndpoints = findTool("create_endpoints");
      const replaceRecords = findTool("replace_records");
      const setEndpointResponse = findTool("set_endpoint_response");
      const callMockEndpoint = findTool("call_mock_endpoint");
      const getProject = findTool("get_project");
      const deleteProject = findTool("delete_project");

      const project = (await createProject.handler({ name: `MCP E2E ${Date.now()}` }, client)) as Project;
      cleanup.push(project.id);

      const model = (await createResource.handler({ projectId: project.id, name: "Product" }, client)) as Model;

      await updateResource.handler(
        {
          projectId: project.id,
          modelId: model.id,
          name: "Product",
          fields: [
            { id: "fld_name", name: "name", type: "text", required: true, unique: false },
            { id: "fld_price", name: "price", type: "number", required: false, unique: false },
          ],
        },
        client,
      );

      const createdRoutes = (await createEndpoints.handler(
        {
          projectId: project.id,
          routes: [
            { method: "GET", path: "/products", modelId: model.id, action: "list", description: "", filters: [] },
            { method: "GET", path: "/products/:id", modelId: model.id, action: "get", description: "", filters: [] },
            { method: "POST", path: "/products", modelId: model.id, action: "create", description: "", filters: [] },
            { method: "PATCH", path: "/products/:id", modelId: model.id, action: "update", description: "", filters: [] },
            { method: "DELETE", path: "/products/:id", modelId: model.id, action: "delete", description: "", filters: [] },
          ],
        },
        client,
      )) as Array<{ id: string; action: string; path: string }>;
      const listRoute = createdRoutes.find((r) => r.action === "list" && r.path === "/products")!;
      expect(listRoute).toBeDefined();

      await replaceRecords.handler(
        {
          projectId: project.id,
          modelId: model.id,
          records: [
            { id: "1", name: "Widget", price: 10 },
            { id: "2", name: "Gadget", price: 20 },
          ],
        },
        client,
      );

      // Reshape the list endpoint into a custom envelope with a status and header the
      // engine's own "auto" behaviour would never produce, so the assertions below can
      // only pass if the shape actually took effect.
      await setEndpointResponse.handler(
        {
          projectId: project.id,
          routeId: listRoute.id,
          mode: "template",
          status: 206,
          headers: { "X-Shaped-Response": "e2e" },
          template: { success: true, result: { items: "{{records}}", total: "{{count}}" } },
        },
        client,
      );

      const response = (await callMockEndpoint.handler(
        { slug: project.slug, method: "GET", path: "/products" },
        client,
      )) as RawEndpointResponse;

      expect(response.status).toBe(206);
      expect(response.headers["x-shaped-response"]).toBe("e2e");
      expect(response.body).toEqual({
        success: true,
        result: {
          items: [
            { id: "1", name: "Widget", price: 10 },
            { id: "2", name: "Gadget", price: 20 },
          ],
          total: 2,
        },
      });

      await deleteProject.handler({ projectId: project.id }, client);
      cleanup.length = 0;
      await expect(getProject.handler({ projectId: project.id }, client)).rejects.toThrow();
    },
    30_000,
  );
});
