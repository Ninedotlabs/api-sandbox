import { describe, expect, it } from "vitest";
import { describeEvent } from "./describe";

describe("describeEvent", () => {
  it("describes a sign-up differently from a returning sign-in", () => {
    expect(describeEvent({ action: "auth.sign_in", metadata: { newUser: true }, projectName: null })).toBe("Signed up and signed in");
    expect(describeEvent({ action: "auth.sign_in", metadata: {}, projectName: null })).toBe("Signed in");
  });

  it("names the endpoint and the project it belongs to", () => {
    expect(describeEvent({ action: "route.delete", metadata: { route: "GET /songs" }, projectName: "Songs" })).toBe(
      "Deleted endpoint GET /songs in Songs",
    );
  });

  it("counts endpoints added together", () => {
    expect(describeEvent({ action: "route.create", metadata: { routes: ["GET /a", "POST /a"] }, projectName: null })).toBe(
      "Added 2 endpoints",
    );
  });

  it("uses the recorded name for a project that no longer exists", () => {
    expect(describeEvent({ action: "project.delete", metadata: { name: "Tarot" }, projectName: null })).toBe("Deleted project Tarot");
  });

  it("falls back to the raw action for anything unknown", () => {
    expect(describeEvent({ action: "something.new", metadata: {}, projectName: null })).toBe("something.new");
  });
});
