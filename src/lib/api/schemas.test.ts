// @vitest-environment node
import { describe, expect, it } from "vitest";
import { modelSchema, newRouteSchema, routeSchema } from "./schemas";

describe("routeSchema", () => {
  const base = {
    id: "rte_1",
    method: "GET",
    path: "/things",
    modelId: "mdl_1",
    action: "list",
    description: "",
    filters: [],
  };

  it("accepts a well-formed route", () => {
    expect(routeSchema.safeParse(base).success).toBe(true);
  });

  it("requires method", () => {
    const result = routeSchema.safeParse({ ...base, method: undefined });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("method is required");
  });

  it("requires path", () => {
    const result = routeSchema.safeParse({ ...base, path: "" });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("path is required");
  });

  it("passes an unrecognised field through untouched, for forward-compatibility with a future `response` field", () => {
    const result = routeSchema.safeParse({ ...base, response: { status: 200, body: { ok: true } } });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).response).toEqual({ status: 200, body: { ok: true } });
  });
});

describe("newRouteSchema", () => {
  it("allows id to be omitted for a route not yet created", () => {
    const result = newRouteSchema.safeParse({
      method: "GET",
      path: "/things",
      modelId: null,
      action: "list",
      description: "",
      filters: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("modelSchema", () => {
  it("requires name", () => {
    const result = modelSchema.safeParse({ id: "mdl_1", name: "", fields: [] });
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe("name is required");
  });

  it("defaults fields to an empty array", () => {
    const result = modelSchema.safeParse({ id: "mdl_1", name: "Task" });
    expect(result.success).toBe(true);
    expect(result.data!.fields).toEqual([]);
  });
});
