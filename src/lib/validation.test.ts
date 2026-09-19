import type { Field, Project, Route } from "./types";
import {
  fieldErrors, validateFieldName, validateModelName, validateProjectName, validateRoute, validateSlug,
} from "./validation";

const project = (id: string, slug: string) => ({ id, slug }) as Project;
const field = (id: string, name: string, extra: Partial<Field> = {}): Field => ({
  id, name, type: "text", required: false, unique: false, ...extra,
});
const route = (id: string, method: Route["method"], path: string, action: Route["action"] = "custom"): Route => ({
  id, method, path, action, modelId: null, description: "", filters: [],
});

describe("project names and slugs", () => {
  it("requires a name", () => {
    expect(validateProjectName("  ", [])).toBe("Give your API a name.");
  });
  it("rejects names that produce an existing slug", () => {
    expect(validateProjectName("My Store", [project("p1", "my-store")])).toBe("You already have an API with this name.");
    expect(validateProjectName("My Store", [project("p1", "my-store")], "p1")).toBeNull();
  });
  it("validates slugs", () => {
    expect(validateSlug("My Store", [])).toBe("Use lowercase letters, numbers and dashes, like my-store.");
    expect(validateSlug("shop", [project("p2", "shop")], "p1")).toBe("Another API already uses this address.");
    expect(validateSlug("shop", [])).toBeNull();
  });
});

describe("model and field names", () => {
  it("rejects duplicate model names case-insensitively", () => {
    expect(validateModelName("customer", [{ id: "m1", name: "Customer", fields: [] }])).toBe(
      "A model with this name already exists.",
    );
  });
  it("rejects names starting with a digit", () => {
    expect(validateModelName("1Thing", [])).toBe("Start with a letter, and use only letters, numbers and spaces.");
  });
  it("rejects bad and duplicate field names", () => {
    expect(validateFieldName("first name", [])).toBe(
      "Start with a letter, and use only letters, numbers and underscores (no spaces).",
    );
    expect(validateFieldName("id", [])).toBe("'id' is added automatically. Pick another name.");
    expect(validateFieldName("name", [field("a", "name")], "b")).toBe("This model already has a field with that name.");
  });
  it("reports per-field errors", () => {
    const errors = fieldErrors([
      field("a", "size", { type: "choice", options: [] }),
      field("b", "owner", { type: "link" }),
      field("c", "title"),
    ]);
    expect(errors).toEqual({ a: "Add at least one choice.", b: "Pick which model this links to." });
  });
});

describe("routes", () => {
  const existing = [route("r1", "GET", "/products", "list")];
  it("rejects malformed paths", () => {
    expect(validateRoute(route("r2", "GET", "products"), existing)).toBe(
      "Paths start with / and use lowercase words, like /customers or /customers/:id.",
    );
  });
  it("requires :id for single-record actions", () => {
    expect(validateRoute(route("r2", "GET", "/products/one", "get"), existing)).toBe(
      "This action needs :id in the path, like /customers/:id.",
    );
  });
  it("rejects method + path conflicts but allows editing itself", () => {
    expect(validateRoute(route("r2", "GET", "/products"), existing)).toBe("Two routes can't share the same method and path.");
    expect(validateRoute(route("r1", "GET", "/products", "list"), existing)).toBeNull();
    expect(validateRoute(route("r2", "POST", "/products"), existing)).toBeNull();
  });
});
