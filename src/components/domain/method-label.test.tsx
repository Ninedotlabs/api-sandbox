import { render, screen } from "@testing-library/react";
import { MethodLabel } from "./method-label";

it("renders the method in its colour classes", () => {
  render(<MethodLabel method="DELETE" />);
  const el = screen.getByText("DELETE");
  expect(el).toHaveClass("text-method-delete", "bg-method-delete-tint", "font-mono");
});
