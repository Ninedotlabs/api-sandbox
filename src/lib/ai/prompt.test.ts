import { buildEditInstruction } from "./prompt";

const opts = { existing: [{ name: "User", fields: [{ name: "email", type: "email" as const, required: true, unique: true }] }] };

it("no longer tells the model to refuse every removal", () => {
  const text = buildEditInstruction(opts);
  expect(text).not.toContain("Never propose removing a resource, field or endpoint");
});

it("tells the model to propose a removal only when the instruction explicitly asked for one", () => {
  const text = buildEditInstruction(opts);
  expect(text.toLowerCase()).toContain("removals");
  expect(text).toMatch(/explicitly asks?/i);
  expect(text.toLowerCase()).toContain("as a side effect");
  expect(text.toLowerCase()).toContain("tidy");
  expect(text.toLowerCase()).toContain("didn't mention");
  expect(text.toLowerCase()).toContain("both");
});

it("keeps every pre-existing rule intact", () => {
  const text = buildEditInstruction(opts);
  expect(text).toContain("return only what's added or changed — never repeat what you're leaving untouched");
  expect(text).toContain("Never include an id field.");
  expect(text).toContain("These resources already exist:");
  expect(text).toContain("For a resource you are adding, use its full field list and up to 8 realistic sample records, as if starting fresh.");
  expect(text).toContain("For a resource you're changing, use its existing exact name and list in \"fields\" only what's added or changed");
  expect(text).toContain("Use choice with an options list for fixed sets, and link with linkTo set to another resource's exact name.");
  expect(text).toContain("Every record must include all required fields, respect unique fields, use realistic varied values");
  expect(text).toContain("For an endpoint beyond list/get/create/update/delete, add it to customEndpoints");
});
