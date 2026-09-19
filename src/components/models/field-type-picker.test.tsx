import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUi } from "@/test/render";
import { FieldTypePicker } from "./field-type-picker";

it("picks a type from the popover", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderUi(<FieldTypePicker value="text" onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: "Field type: Text" }));
  await user.click(screen.getByRole("button", { name: /Prices, counts, ages/ }));
  expect(onChange).toHaveBeenCalledWith("number");
});
