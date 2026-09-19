import { buildBody, valuesFromBody } from "./request-body";
import type { Model } from "./types";

const model: Model = {
  id: "m",
  name: "Product",
  fields: [
    { id: "1", name: "name", type: "text", required: true, unique: false },
    { id: "2", name: "price", type: "number", required: true, unique: false },
    { id: "3", name: "inStock", type: "boolean", required: false, unique: false },
    { id: "4", name: "meta", type: "json", required: false, unique: false },
  ],
};

it("converts form values to a typed body and drops blanks", () => {
  expect(buildBody(model, { name: "Lamp", price: "25", inStock: true, meta: '{"a":1}' })).toEqual({
    name: "Lamp", price: 25, inStock: true, meta: { a: 1 },
  });
  expect(buildBody(model, { name: "", price: "abc" })).toEqual({ price: "abc" });
});

it("turns a body back into form values", () => {
  expect(valuesFromBody(model, { name: "Lamp", price: 25, inStock: false, meta: { a: 1 } })).toEqual({
    name: "Lamp", price: "25", inStock: false, meta: '{"a":1}',
  });
  expect(valuesFromBody(model, "nope")).toEqual({});
});
