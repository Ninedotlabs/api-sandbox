import { parsePlan, parseEditPlan, PlanError, strictJsonSchema, type ExistingResourceSummary } from "./plan";

const good = {
  resources: [
    {
      name: "Book", description: "A book for sale",
      fields: [
        { name: "title", type: "text", required: true, unique: false, options: null, linkTo: null },
        { name: "price", type: "number", required: true, unique: false, options: null, linkTo: null },
        { name: "genre", type: "choice", required: false, unique: false, options: ["Fiction", "Science"], linkTo: null },
        { name: "author", type: "link", required: false, unique: false, options: null, linkTo: "Author" },
      ],
      records: [
        { entries: [{ field: "title", value: "Dune" }, { field: "price", value: "12.5" }, { field: "genre", value: "Fiction" }, { field: "author", value: "1" }] },
        { entries: [{ field: "title", value: "Cosmos" }, { field: "price", value: "abc" }] },
      ],
    },
    { name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false, options: null, linkTo: null }], records: [{ entries: [{ field: "name", value: "Frank Herbert" }] }] },
  ],
};

it("accepts a good plan and coerces record values by type", () => {
  const { plan, warnings } = parsePlan(good, []);
  expect(plan.resources.map((r) => r.name)).toEqual(["Book", "Author"]);
  expect(plan.resources[0].records[0]).toEqual({ title: "Dune", price: 12.5, genre: "Fiction", author: "1" });
  expect(plan.resources[0].records).toHaveLength(1);
  expect(warnings).toEqual(["Book: dropped 1 sample record that did not match the schema."]);
});

it("renames clashes, drops id fields and unknown links", () => {
  const raw = {
    resources: [{
      name: "Product", description: "",
      fields: [
        { name: "id", type: "text", required: true, unique: true, options: null, linkTo: null },
        { name: "name", type: "text", required: true, unique: false, options: null, linkTo: null },
        { name: "owner", type: "link", required: false, unique: false, options: null, linkTo: "Nobody" },
      ],
      records: [],
    }],
  };
  const { plan, warnings } = parsePlan(raw, ["Product"]);
  expect(plan.resources[0].name).toBe("Product2");
  expect(plan.resources[0].fields.map((f) => [f.name, f.type])).toEqual([["name", "text"], ["owner", "text"]]);
  expect(warnings).toContain("Renamed Product to Product2 because a resource with that name already exists.");
  expect(warnings).toContain("Product2: dropped the id field; ids are added automatically.");
  expect(warnings).toContain("Product2: owner linked to an unknown resource, changed to text.");
});

it("rejects an empty or malformed plan", () => {
  expect(() => parsePlan({ resources: [] }, [])).toThrow(PlanError);
  expect(() => parsePlan({ nope: true }, [])).toThrow(PlanError);
});

it("produces a closed strict JSON schema", () => {
  const schema = strictJsonSchema() as { properties: Record<string, unknown>; additionalProperties: boolean; required: string[] };
  expect(schema.additionalProperties).toBe(false);
  expect(schema.required).toEqual(["resources"]);
  expect(JSON.stringify(schema)).not.toContain('"$schema"');
});

it("keeps records with a required link field and resolves the link to an id", () => {
  const raw = {
    resources: [
      { name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false, options: null, linkTo: null }], records: [{ entries: [{ field: "name", value: "Frank Herbert" }] }] },
      {
        name: "Book", description: "",
        fields: [
          { name: "title", type: "text", required: true, unique: false, options: null, linkTo: null },
          { name: "author", type: "link", required: true, unique: false, options: null, linkTo: "Author" },
        ],
        records: [{ entries: [{ field: "title", value: "Dune" }, { field: "author", value: "1" }] }],
      },
    ],
  };
  const { plan, warnings } = parsePlan(raw, []);
  const book = plan.resources.find((r) => r.name === "Book")!;
  expect(book.records).toEqual([{ title: "Dune", author: "1" }]);
  expect(warnings).toEqual([]);
});

it("resolves link values against the target's original position even after earlier records are dropped", () => {
  const raw = {
    resources: [
      {
        name: "Author", description: "",
        fields: [{ name: "name", type: "text", required: true, unique: false, options: null, linkTo: null }],
        records: [
          { entries: [] },
          { entries: [{ field: "name", value: "Frank Herbert" }] },
        ],
      },
      {
        name: "Book", description: "",
        fields: [
          { name: "title", type: "text", required: true, unique: false, options: null, linkTo: null },
          { name: "author", type: "link", required: true, unique: false, options: null, linkTo: "Author" },
        ],
        records: [{ entries: [{ field: "title", value: "Dune" }, { field: "author", value: "2" }] }],
      },
    ],
  };
  const { plan, warnings } = parsePlan(raw, []);
  const author = plan.resources.find((r) => r.name === "Author")!;
  const book = plan.resources.find((r) => r.name === "Book")!;
  expect(author.records).toEqual([{ name: "Frank Herbert" }]);
  expect(book.records).toEqual([{ title: "Dune", author: "1" }]);
  expect(warnings).toContain("Author: dropped 1 sample record that did not match the schema.");
});

it("sets an unresolved link to null and warns once per field", () => {
  const raw = {
    resources: [
      { name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false, options: null, linkTo: null }], records: [{ entries: [{ field: "name", value: "Frank Herbert" }] }] },
      {
        name: "Book", description: "",
        fields: [
          { name: "title", type: "text", required: true, unique: false, options: null, linkTo: null },
          { name: "author", type: "link", required: false, unique: false, options: null, linkTo: "Author" },
        ],
        records: [{ entries: [{ field: "title", value: "Dune" }, { field: "author", value: "9" }] }],
      },
    ],
  };
  const { plan, warnings } = parsePlan(raw, []);
  const book = plan.resources.find((r) => r.name === "Book")!;
  expect(book.records).toEqual([{ title: "Dune", author: null }]);
  expect(warnings).toContain("Book: 1 sample record had an unknown author link and was left empty.");
});

const existingBook: ExistingResourceSummary = {
  name: "Book",
  fields: [
    { name: "title", type: "text", required: true, unique: false },
    { name: "price", type: "number", required: true, unique: false },
  ],
};

it("edit: matches an existing resource by name instead of renaming it", () => {
  const raw = {
    resources: [{ name: "book", description: "", fields: [{ name: "genre", type: "choice", required: false, unique: false, options: ["Fiction"], linkTo: null }], records: [] }],
    customEndpoints: [],
  };
  const { plan, warnings } = parseEditPlan(raw, [existingBook]);
  expect(plan.resources[0].name).toBe("Book");
  expect(plan.resources[0].fields.map((f) => f.name)).toEqual(["genre"]);
  expect(warnings).toEqual([]);
});

it("edit: validates a changed resource's records against its current fields merged with the plan's", () => {
  const raw = {
    resources: [{
      name: "Book", description: "",
      fields: [{ name: "genre", type: "text", required: false, unique: false, options: null, linkTo: null }],
      records: [{ entries: [{ field: "title", value: "Dune" }, { field: "price", value: "12.5" }, { field: "genre", value: "Fiction" }] }],
    }],
    customEndpoints: [],
  };
  const { plan, warnings } = parseEditPlan(raw, [existingBook]);
  // "title" and "price" aren't in this resource's plan fields, but they're on the current
  // resource, so a record naming them is valid and they come through unchanged.
  expect(plan.resources[0].records).toEqual([{ title: "Dune", price: 12.5, genre: "Fiction" }]);
  expect(warnings).toEqual([]);
});

it("edit: a brand-new resource still avoids clashing with an existing name", () => {
  const raw = { resources: [{ name: "Book", description: "", fields: [{ name: "isbn", type: "text", required: false, unique: false, options: null, linkTo: null }], records: [] }, { name: "Book", description: "", fields: [], records: [] }], customEndpoints: [] };
  // Two resources both literally named "Book": the first matches the existing one, the
  // second is new and must not collide with either.
  const { plan, warnings } = parseEditPlan(raw, [existingBook]);
  expect(plan.resources.map((r) => r.name)).toEqual(["Book", "Book2"]);
  expect(warnings).toContain("Renamed Book to Book2 because a resource with that name already exists.");
});

it("edit: a link can target an existing resource that isn't itself part of this edit", () => {
  const raw = {
    resources: [{ name: "Review", description: "", fields: [{ name: "rating", type: "number", required: true, unique: false, options: null, linkTo: null }, { name: "book", type: "link", required: true, unique: false, options: null, linkTo: "Book" }], records: [{ entries: [{ field: "rating", value: "5" }, { field: "book", value: "1" }] }] }],
    customEndpoints: [],
  };
  const { plan, warnings } = parseEditPlan(raw, [existingBook]);
  expect(plan.resources[0].fields.find((f) => f.name === "book")!.linkTo).toBe("Book");
  expect(plan.resources[0].records[0]).toEqual({ rating: 5, book: "1" });
  expect(warnings).toEqual([]);
});

it("edit: a link into an untouched resource is accepted when it matches one of its known record ids", () => {
  const existingBookWithIds: ExistingResourceSummary = { ...existingBook, recordIds: ["10", "11"] };
  const raw = {
    resources: [{ name: "Review", description: "", fields: [{ name: "rating", type: "number", required: true, unique: false, options: null, linkTo: null }, { name: "book", type: "link", required: true, unique: false, options: null, linkTo: "Book" }], records: [{ entries: [{ field: "rating", value: "5" }, { field: "book", value: "11" }] }] }],
    customEndpoints: [],
  };
  const { plan, warnings } = parseEditPlan(raw, [existingBookWithIds]);
  expect(plan.resources[0].records[0]).toEqual({ rating: 5, book: "11" });
  expect(warnings).toEqual([]);
});

it("edit: a link into an untouched resource is nulled and warned about when it doesn't match a known record id", () => {
  const existingBookWithIds: ExistingResourceSummary = { ...existingBook, recordIds: ["10", "11"] };
  const raw = {
    resources: [{ name: "Review", description: "", fields: [{ name: "rating", type: "number", required: true, unique: false, options: null, linkTo: null }, { name: "book", type: "link", required: true, unique: false, options: null, linkTo: "Book" }], records: [{ entries: [{ field: "rating", value: "5" }, { field: "book", value: "1" }] }] }],
    customEndpoints: [],
  };
  const { plan, warnings } = parseEditPlan(raw, [existingBookWithIds]);
  expect(plan.resources[0].records[0]).toEqual({ rating: 5, book: null });
  expect(warnings).toContain("Review: 1 sample record had an unknown book link and was left empty.");
});

it("edit: caps and validates customEndpoints, resolving resourceName or leaving it null", () => {
  const raw = {
    resources: [{ name: "Book", description: "", fields: [], records: [] }],
    customEndpoints: [
      { method: "GET", path: "/books/bestsellers", resourceName: "Book", description: "The 10 best-selling books" },
      { method: "GET", path: "not-a-path", resourceName: null, description: "" },
      { method: "GET", path: "/ping", resourceName: "Nobody", description: "" },
    ],
  };
  const { plan, warnings } = parseEditPlan(raw, [existingBook]);
  expect(plan.customEndpoints).toHaveLength(2);
  expect(plan.customEndpoints[0]).toEqual({ method: "GET", path: "/books/bestsellers", resourceName: "Book", description: "The 10 best-selling books" });
  expect(plan.customEndpoints[1]).toEqual({ method: "GET", path: "/ping", resourceName: null, description: "" });
  expect(warnings).toContain('Skipped a custom endpoint with an unusable path ("not-a-path").');
});

it("edit: an answer with nothing to change is valid, not an error", () => {
  const { plan, warnings } = parseEditPlan({ resources: [], customEndpoints: [] }, [existingBook]);
  expect(plan).toEqual({ resources: [], customEndpoints: [] });
  expect(warnings).toEqual([]);
});

it("edit: still rejects a malformed answer", () => {
  expect(() => parseEditPlan({ nope: true }, [existingBook])).toThrow(PlanError);
});
