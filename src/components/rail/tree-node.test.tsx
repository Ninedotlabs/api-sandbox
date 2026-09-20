import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TreeNode } from "./tree-node";

it("selects on a plain click", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <TreeNode label="Product" level={1} posInSet={1} setSize={1} selected={false} active onSelect={onSelect}>
      Product
    </TreeNode>,
  );
  await user.click(screen.getByRole("treeitem"));
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it("does not select when the click lands on a nested edit control, e.g. an inline rename input", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <TreeNode label="Product" level={1} posInSet={1} setSize={1} selected={false} active onSelect={onSelect}>
      <button type="button">Product</button>
    </TreeNode>,
  );
  await user.click(screen.getByRole("button", { name: "Product" }));
  expect(onSelect).not.toHaveBeenCalled();
});
