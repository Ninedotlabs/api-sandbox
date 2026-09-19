import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Model } from "@/lib/types";
import { renderUi } from "@/test/render";
import { ModelFieldTable } from "./model-field-table";

const model: Model = {
  id: "m1",
  name: "Product",
  fields: [{ id: "f1", name: "name", type: "text", required: true, unique: false }],
};

it("adds a field, blocks duplicates, then saves", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderUi(<ModelFieldTable model={model} models={[model]} onSave={onSave} />);

  await user.click(screen.getByRole("button", { name: "Add field" }));
  const second = screen.getAllByLabelText("Field name")[1];
  await user.type(second, "name");
  await user.click(screen.getByRole("button", { name: "Save fields" }));
  expect(screen.getAllByRole("alert")[0]).toHaveTextContent("This model already has a field with that name.");
  expect(onSave).not.toHaveBeenCalled();

  await user.clear(second);
  await user.type(second, "price");
  await user.click(screen.getByRole("checkbox", { name: "price is required" }));
  await user.click(screen.getByRole("button", { name: "Save fields" }));
  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0] as Model;
  expect(saved.fields.map((f) => [f.name, f.required])).toEqual([["name", true], ["price", true]]);
});

it("reorders with the keyboard", async () => {
  const user = userEvent.setup();
  const two: Model = { ...model, fields: [...model.fields, { id: "f2", name: "price", type: "number", required: false, unique: false }] };
  renderUi(<ModelFieldTable model={two} models={[two]} onSave={vi.fn()} />);
  screen.getByRole("button", { name: /Reorder price/ }).focus();
  await user.keyboard("{ArrowUp}");
  expect(screen.getAllByLabelText("Field name")[0]).toHaveValue("price");
  expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
});
