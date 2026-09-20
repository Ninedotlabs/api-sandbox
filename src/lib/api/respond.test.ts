// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fail, handle, ok } from "./respond";

describe("ok", () => {
  it("wraps the payload in { data } with a 200 by default", async () => {
    const res = ok({ id: "1" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "1" } });
  });

  it("accepts a custom status", async () => {
    const res = ok({ id: "1" }, 201);
    expect(res.status).toBe(201);
  });
});

describe("fail", () => {
  it("wraps the message in { error } with the given status", async () => {
    const res = fail(404, "This API no longer exists.");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This API no longer exists." });
  });
});

describe("handle", () => {
  it("returns the handler's response untouched on success", async () => {
    const res = await handle(async () => ok({ id: "1" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: "1" } });
  });

  it("maps a known not-found message to 404", async () => {
    const res = await handle(async () => {
      throw new Error("This API no longer exists.");
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "This API no longer exists." });
  });

  it("maps a known conflict message to 409", async () => {
    const res = await handle(async () => {
      throw new Error("Another API already uses this address.");
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Another API already uses this address." });
  });

  it("maps any other Error to a 400 carrying its own message", async () => {
    const res = await handle(async () => {
      throw new Error("Give your API a name.");
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Give your API a name." });
  });

  it("maps a non-Error throw to a generic 500, never echoing the raw value", async () => {
    const res = await handle(async () => {
      throw "connection string: postgres://user:pass@host/db";
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Something went wrong. Please try again." });
  });
});
