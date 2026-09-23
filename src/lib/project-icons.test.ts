import { describe, expect, it } from "vitest";
import { PROJECT_ICONS, isProjectIconId, resolveProjectIcon } from "./project-icons";

describe("project icons", () => {
  it("gives every project a face, with nothing stored", () => {
    const icon = resolveProjectIcon({ slug: "my-store" });
    expect(PROJECT_ICONS).toContain(icon);
  });

  it("keeps the same icon for the same project, forever", () => {
    const first = resolveProjectIcon({ slug: "bookshop" });
    const again = resolveProjectIcon({ slug: "bookshop" });
    expect(again.id).toBe(first.id);
  });

  it("gives different projects different icons often enough to tell them apart", () => {
    const slugs = Array.from({ length: 40 }, (_, i) => `project-${i}`);
    const chosen = new Set(slugs.map((slug) => resolveProjectIcon({ slug }).id));
    // Not every icon, but nowhere near everyone sharing one.
    expect(chosen.size).toBeGreaterThan(PROJECT_ICONS.length / 2);
  });

  it("prefers the project's own choice", () => {
    expect(resolveProjectIcon({ slug: "bookshop", icon: "rocket-ship" }).id).not.toBe("rocket-ship");
    expect(resolveProjectIcon({ slug: "bookshop", icon: "cart" }).id).toBe("cart");
  });

  it("falls back to the derived icon when a stored id is no longer in the library", () => {
    const derived = resolveProjectIcon({ slug: "bookshop" });
    expect(resolveProjectIcon({ slug: "bookshop", icon: "retired-icon" }).id).toBe(derived.id);
  });

  it("recognises only ids the library actually has", () => {
    expect(isProjectIconId("cart")).toBe(true);
    expect(isProjectIconId("not-an-icon")).toBe(false);
    expect(isProjectIconId(null)).toBe(false);
  });

  it("has unique ids and a label for each", () => {
    expect(new Set(PROJECT_ICONS.map((i) => i.id)).size).toBe(PROJECT_ICONS.length);
    for (const icon of PROJECT_ICONS) expect(icon.label.trim()).not.toBe("");
  });
});
