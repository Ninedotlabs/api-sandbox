// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "@/lib/db/client";
import { pgModelService } from "./model-service";
import { pgProjectService } from "./project-service";
import { pgRecordService } from "./record-service";

const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

describe.skipIf(!hasDb)("pgRecordService", () => {
  afterAll(async () => {
    await getPool().end();
  });

  async function freshProject(name: string, templateId: "store" | "blog" | "todo" | null = null) {
    return pgProjectService.create({ name, description: "", templateId });
  }

  it("reads no records for a model that has none yet", async () => {
    const p = await freshProject("Record Empty Api", "todo");
    try {
      const rows = await pgRecordService.sampleData(p.id, p.models[0].id);
      expect(rows).toEqual([]);
    } finally {
      await pgProjectService.remove(p.id);
    }
  });

  it("seeds records for a model, assigning ids by position when missing", async () => {
    const p = await freshProject("Record Seed Api", "todo");
    try {
      const task = p.models[0];
      await pgRecordService.seedRecords(p.id, task.id, [
        { title: "Buy milk", done: false },
        { id: "custom", title: "Walk dog", done: true },
      ]);
      const rows = await pgRecordService.sampleData(p.id, task.id);
      expect(rows.map((r) => r.id)).toEqual(["1", "custom"]);
      expect(rows[0]).toMatchObject({ title: "Buy milk", done: false });

      // A second seed call fully replaces the first set.
      await pgRecordService.seedRecords(p.id, task.id, [{ title: "Only this one" }]);
      const replaced = await pgRecordService.sampleData(p.id, task.id);
      expect(replaced).toHaveLength(1);
      expect(replaced[0]).toMatchObject({ id: "1", title: "Only this one" });
    } finally {
      await pgProjectService.remove(p.id);
    }
  });

  it("resets a project's records with freshly generated sample data matching every model's fields", async () => {
    const p = await freshProject("Record Reset Api", "store");
    try {
      const product = p.models.find((m) => m.name === "Product")!;
      await pgRecordService.reset(p.id);
      const rows = await pgRecordService.sampleData(p.id, product.id);
      expect(rows.length).toBeGreaterThan(0);
      expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(["id", "name", "price", "inStock", "category"]));
    } finally {
      await pgProjectService.remove(p.id);
    }
  });

  it("keeps sample data in line with model edits after a reset", async () => {
    const p = await freshProject("Record Edit Api", "store");
    try {
      const product = p.models.find((m) => m.name === "Product")!;
      await pgRecordService.reset(p.id);

      const updatedModel = await pgModelService.update(p.id, {
        ...product,
        fields: [
          ...product.fields.filter((f) => f.name !== "inStock"),
          { id: "fld_sku", name: "sku", type: "text", required: false, unique: false },
        ],
      });
      const reloaded = (await pgProjectService.get(p.id))!;
      const reloadedProduct = reloaded.models.find((m) => m.id === updatedModel.id)!;

      await pgRecordService.reset(p.id);
      const rows = await pgRecordService.sampleData(p.id, reloadedProduct.id);
      expect(rows[0]).not.toHaveProperty("inStock");
      expect(typeof rows[0].sku).toBe("string");
    } finally {
      await pgProjectService.remove(p.id);
    }
  });
});
