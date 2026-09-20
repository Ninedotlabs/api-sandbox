// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { getPool } from "@/lib/db/client";
import { pgModelService } from "./model-service";
import { pgProjectService } from "./project-service";
import { pgRouteService } from "./route-service";

const hasDb = Boolean(process.env.PG_TESTS_ENABLED);

describe.skipIf(!hasDb)("pgModelService", () => {
  afterAll(async () => {
    await getPool().end();
  });

  async function freshProject(name: string) {
    return pgProjectService.create({ name, description: "", templateId: null });
  }

  it("creates a model appended to the end, and rejects a duplicate name", async () => {
    const p = await freshProject("Model Create Api");
    try {
      const a = await pgModelService.create(p.id, "Widget");
      const b = await pgModelService.create(p.id, "Gadget");
      const reloaded = await pgProjectService.get(p.id);
      expect(reloaded!.models.map((m) => m.id)).toEqual([a.id, b.id]);
      await expect(pgModelService.create(p.id, "widget")).rejects.toThrow(
        "A model with this name already exists.",
      );
    } finally {
      await pgProjectService.remove(p.id);
    }
  });

  it("upserts and deletes fields on update", async () => {
    const p = await freshProject("Model Field Update Api");
    try {
      const m = await pgModelService.create(p.id, "Item");
      const withFields = await pgModelService.update(p.id, {
        ...m,
        fields: [
          { id: "fld_1", name: "title", type: "text", required: true, unique: false },
          { id: "fld_2", name: "qty", type: "number", required: false, unique: false },
        ],
      });
      expect(withFields.fields.map((f) => f.name)).toEqual(["title", "qty"]);

      const reordered = await pgModelService.update(p.id, {
        ...m,
        fields: [
          { id: "fld_2", name: "qty", type: "number", required: false, unique: false },
          { id: "fld_3", name: "sku", type: "text", required: false, unique: true },
        ],
      });
      expect(reordered.fields.map((f) => f.id)).toEqual(["fld_2", "fld_3"]);

      const reloaded = await pgProjectService.get(p.id);
      const reloadedModel = reloaded!.models.find((mm) => mm.id === m.id)!;
      expect(reloadedModel.fields.map((f) => f.id)).toEqual(["fld_2", "fld_3"]);
      expect(reloadedModel.fields.find((f) => f.id === "fld_3")!.unique).toBe(true);
    } finally {
      await pgProjectService.remove(p.id);
    }
  });

  it("removes a model, nulling links to it, and restores it with its routes and links", async () => {
    const p = await freshProject("Model Remove Restore Api");
    try {
      const customer = await pgModelService.create(p.id, "Customer");
      const order = await pgModelService.create(p.id, "Order");
      await pgModelService.update(p.id, {
        ...order,
        fields: [{ id: "fld_link", name: "customer", type: "link", required: false, unique: false, linkTo: customer.id }],
      });
      const routes = await pgRouteService.createMany(p.id, [
        {
          id: "rte_cust_list",
          method: "GET",
          path: "/customers",
          modelId: customer.id,
          action: "list",
          description: "",
          filters: [],
        },
      ]);

      const removed = await pgModelService.remove(p.id, customer.id);
      expect(removed.model.id).toBe(customer.id);
      expect(removed.beforeId).toBe(order.id);
      expect(removed.routes.map((r) => r.route.id)).toEqual(routes.map((r) => r.id));
      expect(removed.links).toEqual([{ modelId: order.id, fieldId: "fld_link" }]);

      const afterRemove = await pgProjectService.get(p.id);
      expect(afterRemove!.models.map((m) => m.id)).toEqual([order.id]);
      expect(afterRemove!.routes).toEqual([]);
      const orderAfterRemove = afterRemove!.models.find((m) => m.id === order.id)!;
      expect(orderAfterRemove.fields.find((f) => f.id === "fld_link")!.linkTo).toBeUndefined();

      const restored = await pgModelService.restore(p.id, removed);
      expect(restored.id).toBe(customer.id);
      const afterRestore = await pgProjectService.get(p.id);
      expect(afterRestore!.models.map((m) => m.id)).toEqual([customer.id, order.id]);
      expect(afterRestore!.routes.map((r) => r.id)).toEqual(routes.map((r) => r.id));
      const orderAfterRestore = afterRestore!.models.find((m) => m.id === order.id)!;
      expect(orderAfterRestore.fields.find((f) => f.id === "fld_link")!.linkTo).toBe(customer.id);
    } finally {
      await pgProjectService.remove(p.id);
    }
  });

  it("rejects removing a model that no longer exists", async () => {
    const p = await freshProject("Model Remove Missing Api");
    try {
      await expect(pgModelService.remove(p.id, "missing")).rejects.toThrow("This model no longer exists.");
    } finally {
      await pgProjectService.remove(p.id);
    }
  });
});
