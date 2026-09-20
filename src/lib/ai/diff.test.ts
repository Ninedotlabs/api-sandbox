import { computeEditDiff } from "./diff";
import type { EditPlan } from "./plan";
import type { Project } from "@/lib/types";

const project: Project = {
  id: "p1", name: "Shop", slug: "shop", description: "",
  models: [{ id: "m1", name: "Book", fields: [{ id: "f1", name: "title", type: "text", required: true, unique: false }] }],
  routes: [
    { id: "r1", method: "GET", path: "/books", modelId: "m1", action: "list", description: "", filters: [] },
    { id: "r2", method: "GET", path: "/books/:id", modelId: "m1", action: "get", description: "", filters: [] },
  ],
  createdAt: "", updatedAt: "",
};

it("puts a resource with no existing match in newResources, with every field added and all five endpoints new", () => {
  const plan: EditPlan = { resources: [{ name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false }], records: [{ name: "Ann" }] }], customEndpoints: [] };
  const diff = computeEditDiff(project, plan);
  expect(diff.changedResources).toEqual([]);
  expect(diff.newResources).toEqual([{ name: "Author", isNew: true, fields: [{ name: "name", kind: "added", after: { name: "name", type: "text", required: true, unique: false } }], recordCount: 1, inboundLinks: [] }]);
  expect(diff.newEndpoints.map((e) => `${e.method} ${e.path}`)).toEqual(["GET /authors", "GET /authors/:id", "POST /authors", "PUT /authors/:id", "DELETE /authors/:id"]);
});

it("puts a matched resource in changedResources with added and changed fields, and only its missing endpoints as new", () => {
  const plan: EditPlan = { resources: [{ name: "Book", description: "", fields: [{ name: "title", type: "text", required: false, unique: false }, { name: "genre", type: "text", required: false, unique: false }], records: [] }], customEndpoints: [] };
  const diff = computeEditDiff(project, plan);
  expect(diff.newResources).toEqual([]);
  expect(diff.changedResources).toHaveLength(1);
  expect(diff.changedResources[0].name).toBe("Book");
  expect(diff.changedResources[0].fields).toEqual([
    { name: "title", kind: "changed", before: { name: "title", type: "text", required: true, unique: false }, after: { name: "title", type: "text", required: false, unique: false } },
    { name: "genre", kind: "added", after: { name: "genre", type: "text", required: false, unique: false } },
  ]);
  // /books and /books/:id (GET) already exist; only the other three are new.
  expect(diff.newEndpoints.map((e) => `${e.method} ${e.path}`)).toEqual(["POST /books", "PUT /books/:id", "DELETE /books/:id"]);
});

it("shows a data-only edit (no field changes) as a changed resource, and skips a custom endpoint that already exists", () => {
  const plan: EditPlan = {
    resources: [{ name: "Book", description: "", fields: [], records: [{ title: "Dune" }] }],
    customEndpoints: [{ method: "GET", path: "/books", resourceName: "Book", description: "Duplicate of the standard list" }, { method: "GET", path: "/books/bestsellers", resourceName: "Book", description: "Top sellers" }],
  };
  const diff = computeEditDiff(project, plan);
  expect(diff.changedResources).toEqual([{ name: "Book", isNew: false, fields: [], recordCount: 1, inboundLinks: [] }]);
  // The duplicate custom endpoint (GET /books) is skipped; POST /books is still new because
  // Book is missing that standard CRUD endpoint regardless of this being a data-only edit
  // (same completion rule test 2 exercises for Book's other missing endpoints).
  expect(diff.newEndpoints.filter((e) => e.method === "GET" && e.path === "/books")).toEqual([]);
  expect(diff.newEndpoints.some((e) => e.path === "/books/bestsellers")).toBe(true);
});

// C1: a re-listed field is only a "change" when something about it actually differs. The
// model is told to describe only what's ADDED or CHANGED, so every field it re-lists was
// previously marked "changed" even when it was identical to what already exists.
it("C1: a re-listed field identical to the current one produces no field change at all", () => {
  const plan: EditPlan = { resources: [{ name: "Book", description: "", fields: [{ name: "title", type: "text", required: true, unique: false }], records: [] }], customEndpoints: [] };
  const diff = computeEditDiff(project, plan);
  expect(diff.changedResources[0].fields).toEqual([]);
});

// Each of these isolates a single differing attribute — options, required, unique, linkTo —
// so each is its own test rather than one test that only actually exercises options.
it("C1: a field re-listed with only its options changed is marked changed", () => {
  const p: Project = { ...project, models: [{ id: "m1", name: "Order", fields: [{ id: "f1", name: "status", type: "choice", required: true, unique: false, options: ["Pending", "Shipped"] }] }] };
  const plan: EditPlan = { resources: [{ name: "Order", description: "", fields: [{ name: "status", type: "choice", required: true, unique: false, options: ["Refunded"] }], records: [] }], customEndpoints: [] };
  const diff = computeEditDiff(p, plan);
  expect(diff.changedResources[0].fields).toEqual([
    { name: "status", kind: "changed", before: { name: "status", type: "choice", required: true, unique: false, options: ["Pending", "Shipped"] }, after: { name: "status", type: "choice", required: true, unique: false, options: ["Refunded"] } },
  ]);
});

it("C1: a field re-listed with only its required flag changed is marked changed", () => {
  const p: Project = { ...project, models: [{ id: "m1", name: "Order", fields: [{ id: "f1", name: "notes", type: "text", required: true, unique: false }] }] };
  const plan: EditPlan = { resources: [{ name: "Order", description: "", fields: [{ name: "notes", type: "text", required: false, unique: false }], records: [] }], customEndpoints: [] };
  const diff = computeEditDiff(p, plan);
  expect(diff.changedResources[0].fields).toEqual([
    { name: "notes", kind: "changed", before: { name: "notes", type: "text", required: true, unique: false }, after: { name: "notes", type: "text", required: false, unique: false } },
  ]);
});

it("C1: a field re-listed with only its unique flag changed is marked changed", () => {
  const p: Project = { ...project, models: [{ id: "m1", name: "Order", fields: [{ id: "f1", name: "sku", type: "text", required: false, unique: false }] }] };
  const plan: EditPlan = { resources: [{ name: "Order", description: "", fields: [{ name: "sku", type: "text", required: false, unique: true }], records: [] }], customEndpoints: [] };
  const diff = computeEditDiff(p, plan);
  expect(diff.changedResources[0].fields).toEqual([
    { name: "sku", kind: "changed", before: { name: "sku", type: "text", required: false, unique: false }, after: { name: "sku", type: "text", required: false, unique: true } },
  ]);
});

it("C1: a field re-listed with only its linkTo target changed is marked changed", () => {
  const p: Project = {
    ...project,
    models: [
      { id: "m1", name: "Book", fields: [] },
      { id: "m2", name: "Author", fields: [] },
      { id: "m3", name: "Review", fields: [{ id: "f3", name: "subject", type: "link", required: true, unique: false, linkTo: "m1" }] },
    ],
  };
  const plan: EditPlan = { resources: [{ name: "Review", description: "", fields: [{ name: "subject", type: "link", required: true, unique: false, linkTo: "Author" }], records: [] }], customEndpoints: [] };
  const diff = computeEditDiff(p, plan);
  expect(diff.changedResources[0].fields).toEqual([
    { name: "subject", kind: "changed", before: { name: "subject", type: "link", required: true, unique: false, linkTo: "Book" }, after: { name: "subject", type: "link", required: true, unique: false, linkTo: "Author" } },
  ]);
});

// M10: `before.linkTo` must be resolved to a resource name (like `after.linkTo`), or an
// untouched link field is wrongly flagged as changed.
it("M10: an untouched link field (same target, resolved by name) is not shown as changed", () => {
  const p: Project = {
    ...project,
    models: [
      { id: "m1", name: "Book", fields: [{ id: "f1", name: "title", type: "text", required: true, unique: false }] },
      { id: "m2", name: "Review", fields: [{ id: "f2", name: "book", type: "link", required: true, unique: false, linkTo: "m1" }] },
    ],
  };
  const plan: EditPlan = { resources: [{ name: "Review", description: "", fields: [{ name: "book", type: "link", required: true, unique: false, linkTo: "Book" }], records: [] }], customEndpoints: [] };
  const diff = computeEditDiff(p, plan);
  expect(diff.changedResources[0].fields).toEqual([]);
});

// I5: replacing a resource's records dangles inbound links; the preview needs to know about
// them so it can disclose it.
it("I5: a changed resource whose records are replaced reports inbound links from other models", () => {
  const p: Project = {
    ...project,
    models: [
      { id: "m1", name: "Book", fields: [{ id: "f1", name: "title", type: "text", required: true, unique: false }] },
      { id: "m2", name: "Order", fields: [{ id: "f2", name: "book", type: "link", required: true, unique: false, linkTo: "m1" }] },
    ],
  };
  const plan: EditPlan = { resources: [{ name: "Book", description: "", fields: [], records: [{ title: "Dune" }] }], customEndpoints: [] };
  const diff = computeEditDiff(p, plan, { Order: 3 });
  expect(diff.changedResources[0].inboundLinks).toEqual([{ modelName: "Order", fieldName: "book", recordCount: 3 }]);
});

it("I5: no inbound-link disclosure when the resource's records aren't being replaced, or when no counts are supplied", () => {
  const p: Project = {
    ...project,
    models: [
      { id: "m1", name: "Book", fields: [{ id: "f1", name: "title", type: "text", required: true, unique: false }] },
      { id: "m2", name: "Order", fields: [{ id: "f2", name: "book", type: "link", required: true, unique: false, linkTo: "m1" }] },
    ],
  };
  const noRecordsPlan: EditPlan = { resources: [{ name: "Book", description: "", fields: [{ name: "genre", type: "text", required: false, unique: false }], records: [] }], customEndpoints: [] };
  expect(computeEditDiff(p, noRecordsPlan).changedResources[0].inboundLinks).toEqual([]);
  const replacePlan: EditPlan = { resources: [{ name: "Book", description: "", fields: [], records: [{ title: "Dune" }] }], customEndpoints: [] };
  expect(computeEditDiff(p, replacePlan).changedResources[0].inboundLinks).toEqual([]);
});
