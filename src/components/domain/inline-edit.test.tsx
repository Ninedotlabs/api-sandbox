import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEdit } from "./inline-edit";

it("edits on click, validates, saves on Enter and cancels on Escape", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<InlineEdit value="Product" ariaLabel="Resource name" onSave={onSave} validate={(v) => (v.trim() ? null : "Give the resource a name.")} />);
  await user.click(screen.getByRole("button", { name: "Resource name: Product" }));
  const input = screen.getByRole("textbox", { name: "Resource name" });
  await user.clear(input);
  await user.keyboard("{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent("Give the resource a name.");
  await user.type(input, "Item{Enter}");
  expect(onSave).toHaveBeenCalledWith("Item");
  await user.click(screen.getByRole("button", { name: "Resource name: Product" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
