// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { getPool, query } from "@/lib/db/client";
import type { Project } from "@/lib/types";
import { pgModelService } from "./model-service";
import { pgProjectService } from "./project-service";
import { pgRouteService } from "./route-service";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("pgProjectService", () => {
  afterAll(async () => {
    await getPool().end();
  });

  async function cleanup(id: string) {
    await pgProjectService.remove(id);
  }

  it("creates a project with no template", async () => {
    const p = await pgProjectService.create({ name: "My Plain Api", description: "hi", templateId: null });
    try {
      expect(p.slug).toBe("my-plain-api");
      expect(p.models).toEqual([]);
      expect(p.routes).toEqual([]);
      expect(p.description).toBe("hi");
      expect(typeof p.createdAt).toBe("string");
      expect(await pgProjectService.get(p.id)).toEqual(p);
    } finally {
      await cleanup(p.id);
    }
  });

  it("creates a project from a template with models but no routes", async () => {
    const p = await pgProjectService.create({ name: "My Store Api", description: "", templateId: "store" });
    try {
      expect(p.models.map((m) => m.name)).toEqual(["Product", "Customer", "Order"]);
      expect(p.routes).toEqual([]);
      const order = p.models.find((m) => m.name === "Order")!;
      const customer = p.models.find((m) => m.name === "Customer")!;
      expect(order.fields.find((f) => f.name === "customer")!.linkTo).toBe(customer.id);
    } finally {
      await cleanup(p.id);
    }
  });

  it("suffixes the slug when it's already taken", async () => {
    const a = await pgProjectService.create({ name: "Same Name Api", description: "", templateId: null });
    try {
      const b = await pgProjectService.create({ name: "Same Name Api", description: "", templateId: null });
      try {
        expect(a.slug).toBe("same-name-api");
        expect(b.slug).toBe("same-name-api-2");
      } finally {
        await cleanup(b.id);
      }
    } finally {
      await cleanup(a.id);
    }
  });

  it("rejects a reserved slug", async () => {
    await expect(pgProjectService.create({ name: "v1", description: "", templateId: null })).rejects.toThrow(
      /reserved/i,
    );
  });

  it("orders models, fields and routes by position then id", async () => {
    const p = await pgProjectService.create({ name: "Ordering Api", description: "", templateId: null });
    try {
      const a = await pgModelService.create(p.id, "Alpha");
      const b = await pgModelService.create(p.id, "Beta");
      // Give the two models the same position to exercise the id tiebreak.
      await query("update models set position = 0 where project_id = $1", [p.id]);
      const reloaded = await pgProjectService.get(p.id);
      const expectedOrder = [a, b].map((m) => m.id).sort();
      expect(reloaded!.models.map((m) => m.id)).toEqual(expectedOrder);
    } finally {
      await cleanup(p.id);
    }
  });

  it("updates name, description and slug", async () => {
    const p = await pgProjectService.create({ name: "Updatable Api", description: "", templateId: null });
    try {
      const updated = await pgProjectService.update(p.id, {
        name: "Renamed Api",
        description: "new desc",
        slug: "renamed-slug",
      });
      expect(updated.name).toBe("Renamed Api");
      expect(updated.description).toBe("new desc");
      expect(updated.slug).toBe("renamed-slug");
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(p.updatedAt).getTime());
    } finally {
      await cleanup(p.id);
    }
  });

  it("removes and restores a whole project with its models, fields and routes", async () => {
    const p = await pgProjectService.create({ name: "Removable Api", description: "", templateId: "todo" });
    try {
      const task = p.models[0];
      const routes = await pgRouteService.createMany(p.id, [
        {
          id: "rte_test1",
          method: "GET",
          path: "/tasks",
          modelId: task.id,
          action: "list",
          description: "",
          filters: [],
        },
      ]);
      const full = (await pgProjectService.get(p.id)) as Project;
      await pgProjectService.remove(p.id);
      expect(await pgProjectService.get(p.id)).toBeNull();

      await pgProjectService.restore(full);
      const restored = await pgProjectService.get(p.id);
      expect(restored).toEqual(full);
      expect(restored!.routes.map((r) => r.id)).toEqual(routes.map((r) => r.id));
    } finally {
      await cleanup(p.id);
    }
  });

  it("duplicates a project, remapping linkTo/modelId and copying records", async () => {
    const p = await pgProjectService.create({ name: "Dup Source Api", description: "", templateId: "blog" });
    let dup: Project | undefined;
    try {
      const post = p.models.find((m) => m.name === "Post")!;
      await query("insert into records (model_id, id, data) values ($1, $2, $3::jsonb)", [
        post.id,
        "1",
        JSON.stringify({ title: "Hello" }),
      ]);
      await pgRouteService.createMany(p.id, [
        {
          id: "rte_dup1",
          method: "GET",
          path: "/posts",
          modelId: post.id,
          action: "list",
          description: "",
          filters: [],
        },
      ]);

      dup = await pgProjectService.duplicate(p.id);
      expect(dup.id).not.toBe(p.id);
      expect(dup.name).toBe("Dup Source Api copy");
      expect(dup.models.map((m) => m.name)).toEqual(p.models.map((m) => m.name));

      const dupPost = dup.models.find((m) => m.name === "Post")!;
      const dupAuthor = dup.models.find((m) => m.name === "Author")!;
      const authorField = dupPost.fields.find((f) => f.name === "author")!;
      expect(authorField.linkTo).toBe(dupAuthor.id);
      expect(authorField.linkTo).not.toBe(p.models.find((m) => m.name === "Author")!.id);

      expect(dup.routes).toHaveLength(1);
      expect(dup.routes[0].modelId).toBe(dupPost.id);
      expect(dup.routes[0].id).not.toBe("rte_dup1");

      const dupRecords = await query<{ id: string; data: { title: string } }>(
        "select id, data from records where model_id = $1",
        [dupPost.id],
      );
      expect(dupRecords.rows).toHaveLength(1);
      expect(dupRecords.rows[0].data.title).toBe("Hello");

      const secondDup = await pgProjectService.duplicate(p.id);
      expect(secondDup.name).toBe("Dup Source Api copy 2");
      await cleanup(secondDup.id);
    } finally {
      if (dup) await cleanup(dup.id);
      await cleanup(p.id);
    }
  });
});
