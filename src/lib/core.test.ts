import { moveItem } from "./arrays";
import { FIELD_TYPES, fieldTypeMeta } from "./field-types";
import { countLabel, formatCell, timeAgo } from "./format";
import { METHOD_META } from "./methods";
import { fillPath, routeParams } from "./paths";
import { article, baseUrl, pluralize, resourcePath, slugify } from "./slug";
import { ACTION_META } from "./actions";

describe("slug helpers", () => {
  it("slugifies names", () => {
    expect(slugify("  My Store! ")).toBe("my-store");
    expect(slugify("!!!")).toBe("");
  });
  it("pluralizes simple English nouns", () => {
    expect(pluralize("Product")).toBe("products");
    expect(pluralize("Category")).toBe("categories");
    expect(pluralize("Box")).toBe("boxes");
  });
  it("builds resource paths and base URLs", () => {
    expect(resourcePath("Blog Post")).toBe("/blog-posts");
    expect(baseUrl("my-store")).toBe("/api/my-store");
  });
  it("picks the right article", () => {
    expect(article("order")).toBe("an");
    expect(article("customer")).toBe("a");
  });
});

describe("paths", () => {
  it("extracts and fills params", () => {
    expect(routeParams("/a/:id/b/:slug")).toEqual(["id", "slug"]);
    expect(fillPath("/products/:id", { id: "7" })).toBe("/products/7");
    expect(fillPath("/products/:id", {})).toBe("/products/:id");
  });
});

describe("moveItem", () => {
  it("moves an element", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("ignores out-of-range moves", () => {
    const items = ["a"];
    expect(moveItem(items, 0, 3)).toBe(items);
  });
});

describe("format", () => {
  it("formats relative time", () => {
    const now = new Date("2026-09-19T12:00:00Z");
    expect(timeAgo("2026-09-19T10:00:00Z", now)).toBe("2 hours ago");
    expect(timeAgo("2026-09-19T11:59:40Z", now)).toBe("just now");
  });
  it("formats counts and cells", () => {
    expect(countLabel(1, "model")).toBe("1 model");
    expect(countLabel(3, "model")).toBe("3 models");
    expect(formatCell(true)).toBe("Yes");
    expect(formatCell(null)).toBe("—");
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
  });
});

describe("metadata tables", () => {
  it("covers every field type once", () => {
    expect(FIELD_TYPES.map((f) => f.type)).toEqual([
      "text", "number", "boolean", "date", "email", "url", "choice", "link", "json",
    ]);
    expect(fieldTypeMeta("boolean").label).toBe("Yes/No");
  });
  it("has friendly method and action labels", () => {
    expect(METHOD_META.GET.label).toBe("Read");
    expect(METHOD_META.DELETE.label).toBe("Delete");
    expect(ACTION_META.create.method).toBe("POST");
  });
});
