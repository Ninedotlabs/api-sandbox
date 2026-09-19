import { tokenizeJson } from "./json-highlight";

it("tokenizes JSON without losing text", () => {
  const src = '{\n  "a": 1,\n  "b": "x",\n  "c": true,\n  "d": null\n}';
  const tokens = tokenizeJson(src);
  expect(tokens.map((t) => t.text).join("")).toBe(src);
  const kinds = tokens.filter((t) => t.kind !== "punct").map((t) => `${t.kind}:${t.text}`);
  expect(kinds).toEqual(['key:"a"', "number:1", 'key:"b"', 'string:"x"', 'key:"c"', "boolean:true", 'key:"d"', "null:null"]);
});
