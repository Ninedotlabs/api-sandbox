// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "@/lib/db/client";
import { pgModelService } from "./model-service";
import { pgProjectService } from "./project-service";
import { pgRouteService } from "./route-service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("pgRouteService", () => {
  afterAll(async () => {
    await getPool().end();
  });

  async function freshProject(name: string) {
    const p = await pgProjectService.create({ name, description: "", templateId: null });
    const model = await pgModelService.create(p.id, "Item");
    return { project: p, model };
  }

  it("creates routes appended in order", async () => {
    const { project, model } = await freshProject("Route Create Api");
    try {
      const routes = await pgRouteService.createMany(project.id, [
        { id: "rte_a", method: "GET", path: "/items", modelId: model.id, action: "list", description: "", filters: [] },
        { id: "rte_b", method: "POST", path: "/items", modelId: model.id, action: "create", description: "", filters: [] },
      ]);
      expect(routes.map((r) => r.id)).toEqual(["rte_a", "rte_b"]);
      const reloaded = await pgProjectService.get(project.id);
      expect(reloaded!.routes.map((r) => r.id)).toEqual(["rte_a", "rte_b"]);
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  // The task description says duplicate (method, path) routes should be
  // skipped, but the mock implementation - which is the actual spec per the
  // task instructions - throws instead (see services.test.ts's "rejects
  // conflicting routes"). This test follows the mock.
  it("rejects a route that collides on method and path with an existing one", async () => {
    const { project, model } = await freshProject("Route Conflict Api");
    try {
      await pgRouteService.createMany(project.id, [
        { id: "rte_1", method: "GET", path: "/items", modelId: model.id, action: "list", description: "", filters: [] },
      ]);
      await expect(
        pgRouteService.createMany(project.id, [
          { id: "rte_2", method: "GET", path: "/items", modelId: model.id, action: "list", description: "", filters: [] },
        ]),
      ).rejects.toThrow("Two routes can't share the same method and path.");
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("removes and restores a single route at its original slot", async () => {
    const { project, model } = await freshProject("Route Remove Restore Api");
    try {
      const routes = await pgRouteService.createMany(project.id, [
        { id: "rte_x", method: "GET", path: "/items", modelId: model.id, action: "list", description: "", filters: [] },
        { id: "rte_y", method: "GET", path: "/items/:id", modelId: model.id, action: "get", description: "", filters: [] },
        { id: "rte_z", method: "POST", path: "/items", modelId: model.id, action: "create", description: "", filters: [] },
      ]);
      const removed = await pgRouteService.remove(project.id, "rte_y");
      expect(removed).toEqual({ route: routes[1], beforeId: "rte_z" });

      let reloaded = await pgProjectService.get(project.id);
      expect(reloaded!.routes.map((r) => r.id)).toEqual(["rte_x", "rte_z"]);

      const restored = await pgRouteService.restore(project.id, removed);
      expect(restored).toEqual(routes[1]);

      reloaded = await pgProjectService.get(project.id);
      expect(reloaded!.routes.map((r) => r.id)).toEqual(["rte_x", "rte_y", "rte_z"]);
    } finally {
      await pgProjectService.remove(project.id);
    }
  });

  it("rejects removing a route that no longer exists", async () => {
    const { project } = await freshProject("Route Remove Missing Api");
    try {
      await expect(pgRouteService.remove(project.id, "missing")).rejects.toThrow("This route no longer exists.");
    } finally {
      await pgProjectService.remove(project.id);
    }
  });
});
