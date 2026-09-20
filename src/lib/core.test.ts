import { moveItem } from "./arrays";
import { FIELD_TYPES, fieldTypeMeta } from "./field-types";
import { countLabel, formatCell, timeAgo } from "./format";
import { METHOD_META } from "./methods";
import { fillPath, routeParams } from "./paths";
import { matchRoute } from "./routes";
import { article, baseUrl, pluralize, resourcePath, slugify } from "./slug";
import { ACTION_META } from "./actions";
import type { Route } from "./types";

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

describe("matchRoute", () => {
  const routes: Route[] = [
    { id: "rte_list", method: "GET", path: "/books", modelId: "mdl_book", action: "list", description: "", filters: [] },
    { id: "rte_get", method: "GET", path: "/books/:id", modelId: "mdl_book", action: "get", description: "", filters: [] },
    {
      id: "rte_nested",
      method: "GET",
      path: "/authors/:authorId/books/:bookId",
      modelId: "mdl_book",
      action: "get",
      description: "",
      filters: [],
    },
  ];

  it("matches a literal path and method", () => {
    const match = matchRoute(routes, "GET", ["books"]);
    expect(match?.route.id).toBe("rte_list");
    expect(match?.params).toEqual({});
  });

  it("extracts a single :param", () => {
    const match = matchRoute(routes, "GET", ["books", "7"]);
    expect(match?.route.id).toBe("rte_get");
    expect(match?.params).toEqual({ id: "7" });
  });

  it("extracts multiple :param segments", () => {
    const match = matchRoute(routes, "GET", ["authors", "3", "books", "9"]);
    expect(match?.route.id).toBe("rte_nested");
    expect(match?.params).toEqual({ authorId: "3", bookId: "9" });
  });

  it("returns null when the method doesn't match", () => {
    expect(matchRoute(routes, "POST", ["books"])).toBeNull();
  });

  it("returns null when no route has the right segment count", () => {
    expect(matchRoute(routes, "GET", ["books", "7", "extra"])).toBeNull();
  });

  it("returns null for an unmatched literal segment", () => {
    expect(matchRoute(routes, "GET", ["magazines"])).toBeNull();
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
