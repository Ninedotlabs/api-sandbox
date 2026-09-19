import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEdit } from "@/components/domain/inline-edit";
import { renderUi } from "@/test/render";
import { EditorHeader } from "./editor-header";

it("shows the kicker, description and actions", () => {
  renderUi(
    <EditorHeader kicker="Resource" title="Product" description="/products" actions={<button>Delete</button>} />,
  );
  expect(screen.getByText("Resource")).toBeInTheDocument();
  expect(screen.getByText("Product")).toBeInTheDocument();
  expect(screen.getByText("/products")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
});

it("renames inline, and keeps editing while the name is invalid", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderUi(
    <EditorHeader
      kicker="Resource"
      title={
        <InlineEdit
          value="Product"
          ariaLabel="Resource name"
          validate={(v) => (v.trim() ? null : "Give the model a name.")}
          onSave={onSave}
        />
      }
    />,
  );

  await user.click(screen.getByRole("button", { name: "Resource name: Product" }));
  const input = screen.getByLabelText("Resource name");
  await user.clear(input);
  await user.keyboard("{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent("Give the model a name.");
  expect(onSave).not.toHaveBeenCalled();

  await user.type(input, "Item{Enter}");
  expect(onSave).toHaveBeenCalledWith("Item");
});
