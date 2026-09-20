import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEdit } from "./inline-edit";

it("edits on click, validates, saves on Enter and cancels on Escape", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<InlineEdit value="Product" ariaLabel="Resource name" onSave={onSave} validate={(v) => (v.trim() ? null : "Give the resource a name.")} />);
  await user.click(screen.getByText("Product"));
  const input = screen.getByRole("textbox", { name: "Resource name" });
  await user.clear(input);
  await user.keyboard("{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent("Give the resource a name.");
  await user.type(input, "Item{Enter}");
  expect(onSave).toHaveBeenCalledWith("Item");
  await user.click(screen.getByText("Product"));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

it("can be switched into edit mode externally, e.g. from a context menu's Rename", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onEditingChange = vi.fn();
  const { rerender } = render(
    <InlineEdit value="Product" ariaLabel="Resource name" onSave={onSave} editing={false} onEditingChange={onEditingChange} />,
  );
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

  rerender(
    <InlineEdit value="Product" ariaLabel="Resource name" onSave={onSave} editing={true} onEditingChange={onEditingChange} />,
  );
  const input = screen.getByRole("textbox", { name: "Resource name" });
  await user.clear(input);
  await user.type(input, "Item{Enter}");
  expect(onSave).toHaveBeenCalledWith("Item");
  // Committing tells the controller to leave edit mode, rather than managing its own state.
  expect(onEditingChange).toHaveBeenCalledWith(false);
});

it("keeps the editor open with the draft intact and shows the error when a blur races an in-flight save", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn(
    () =>
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error("Could not save.")), 0);
      }),
  );
  render(<InlineEdit value="Product" ariaLabel="Resource name" onSave={onSave} />);
  await user.click(screen.getByText("Product"));
  const input = screen.getByRole("textbox", { name: "Resource name" });
  await user.clear(input);
  await user.type(input, "Item");
  await user.keyboard("{Enter}");
  // The commit from Enter is still in flight; a blur that races it must not close the editor.
  fireEvent.blur(input);
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not save.");
  expect(screen.getByRole("textbox", { name: "Resource name" })).toHaveValue("Item");
});
