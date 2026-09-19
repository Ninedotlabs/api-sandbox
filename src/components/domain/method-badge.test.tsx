import { screen } from "@testing-library/react";
import { renderUi } from "@/test/render";
import { MethodBadge } from "./method-badge";

it("shows the method and optional friendly label", () => {
  renderUi(<MethodBadge method="POST" showLabel />);
  const label = screen.getByText("· Create");
  expect(label.parentElement).toHaveTextContent("POST· Create");
});
