import { parsePlan, PlanError, strictJsonSchema } from "./plan";

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
