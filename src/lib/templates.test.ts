import { buildTemplateModels, templateModelNames, TEMPLATES } from "./templates";

it("lists three templates", () => {
  expect(TEMPLATES.map((t) => t.id)).toEqual(["blog", "store", "todo"]);
});

it("builds the store models with resolved links", () => {
  const models = buildTemplateModels("store");
  expect(models.map((m) => m.name)).toEqual(["Product", "Customer", "Order"]);
  const customer = models.find((m) => m.name === "Customer")!;
  const order = models.find((m) => m.name === "Order")!;
  expect(order.fields.find((f) => f.name === "customer")!.linkTo).toBe(customer.id);
  expect(templateModelNames("todo")).toEqual(["Task"]);
});

it("generates fresh ids each time", () => {
  expect(buildTemplateModels("todo")[0].id).not.toBe(buildTemplateModels("todo")[0].id);
});
