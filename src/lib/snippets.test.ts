import { buildCrudRoutes } from "./crud";
import { buildSnippets } from "./snippets";
import type { Model, Project } from "./types";

const product: Model = { id: "m1", name: "Product", fields: [] };
const routes = buildCrudRoutes(product, ["get", "create"], []);
const project: Project = { id: "p", name: "Shop", slug: "shop", description: "", models: [product], routes, createdAt: "", updatedAt: "" };

it("builds a GET with params filled", () => {
  const get = routes.find((r) => r.action === "get")!;
  const s = buildSnippets(project, get);
  expect(s.curl).toBe("curl http://localhost:3000/api/shop/products/1");
  expect(s.javascript).toContain('fetch("http://localhost:3000/api/shop/products/1")');
  expect(s.python).toContain('requests.get("http://localhost:3000/api/shop/products/1")');
});

it("builds a POST with a JSON body", () => {
  const create = routes.find((r) => r.action === "create")!;
  const s = buildSnippets(project, create, { name: "Lamp", price: 25 });
  expect(s.curl).toBe(`curl -X POST http://localhost:3000/api/shop/products \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Lamp","price":25}'`);
  expect(s.javascript).toContain('method: "POST"');
  expect(s.javascript).toContain('body: JSON.stringify({\n    "name": "Lamp",\n    "price": 25\n  })');
  expect(s.python).toContain("requests.post(");
  expect(s.python).toContain('json={"name": "Lamp", "price": 25}');
});
