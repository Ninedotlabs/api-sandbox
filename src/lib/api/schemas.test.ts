// @vitest-environment node
import { describe, expect, it } from "vitest";
import { modelSchema, newRouteSchema, routeSchema } from "./schemas";

const JSON_SIZE_CAP_BYTES = 100_000;

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

  it("passes an unrecognised field through untouched", () => {
    const result = routeSchema.safeParse({ ...base, somethingElse: "kept" });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).somethingElse).toBe("kept");
  });

  it("accepts a route with no response field at all (today's behaviour)", () => {
    const result = routeSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.data!.response).toBeUndefined();
  });

  describe("response", () => {
    it("accepts a well-formed auto response with a status override", () => {
      const result = routeSchema.safeParse({ ...base, response: { mode: "auto", status: 503, headers: { "Retry-After": "30" } } });
      expect(result.success).toBe(true);
      expect(result.data!.response).toEqual({ mode: "auto", status: 503, headers: { "Retry-After": "30" } });
    });

    it("accepts a static response with a body", () => {
      const result = routeSchema.safeParse({ ...base, response: { mode: "static", status: 202, body: { pong: true } } });
      expect(result.success).toBe(true);
      expect(result.data!.response).toMatchObject({ mode: "static", status: 202, body: { pong: true } });
    });

    it("accepts a template response with a query", () => {
      const result = routeSchema.safeParse({
        ...base,
        response: {
          mode: "template",
          template: { items: "{{records}}" },
          query: { modelId: "mdl_2", filter: [{ field: "genre", op: "eq", value: "sci-fi" }], sort: { field: "rating", dir: "desc" }, limit: 5 },
        },
      });
      expect(result.success).toBe(true);
    });

    it("rejects a missing mode", () => {
      const result = routeSchema.safeParse({ ...base, response: { status: 200 } });
      expect(result.success).toBe(false);
    });

    it("rejects an invalid mode with a plain-language error", () => {
      const result = routeSchema.safeParse({ ...base, response: { mode: "wat" } });
      expect(result.success).toBe(false);
      expect(typeof result.error!.issues[0].message).toBe("string");
    });

    it("rejects a template over the 100KB cap, at write time, with a plain-language error", () => {
      const huge = { blob: "x".repeat(JSON_SIZE_CAP_BYTES + 1) };
      const result = routeSchema.safeParse({ ...base, response: { mode: "template", template: huge } });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message.toLowerCase()).toContain("100kb");
    });

    it("rejects a body over the 100KB cap", () => {
      const huge = { blob: "x".repeat(JSON_SIZE_CAP_BYTES + 1) };
      const result = routeSchema.safeParse({ ...base, response: { mode: "static", body: huge } });
      expect(result.success).toBe(false);
    });

    it("accepts a template right at the cap", () => {
      // Account for the JSON wrapper `{"blob":"..."}` so the serialized size lands under the cap.
      const blob = "x".repeat(JSON_SIZE_CAP_BYTES - 20);
      const result = routeSchema.safeParse({ ...base, response: { mode: "template", template: { blob } } });
      expect(result.success).toBe(true);
    });

    it("rejects a template supplied as malformed JSON text, with a plain-language error", () => {
      const result = routeSchema.safeParse({ ...base, response: { mode: "template", template: '{"a": ' } });
      expect(result.success).toBe(false);
      expect(result.error!.issues[0].message.toLowerCase()).toContain("json");
    });

    it("parses a template supplied as valid JSON text into its real value", () => {
      const result = routeSchema.safeParse({ ...base, response: { mode: "template", template: '{"a": 1}' } });
      expect(result.success).toBe(true);
      expect((result.data!.response as { template: unknown }).template).toEqual({ a: 1 });
    });

    it("treats a template that smuggles an expression as inert literal text, not evaluated", () => {
      const result = routeSchema.safeParse({ ...base, response: { mode: "template", template: { danger: "{{ process.env }}" } } });
      expect(result.success).toBe(true);
      expect((result.data!.response as { template: { danger: string } }).template.danger).toBe("{{ process.env }}");
    });
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
