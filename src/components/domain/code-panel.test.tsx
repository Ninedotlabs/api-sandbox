import { render, screen } from "@testing-library/react";
import { CodePanel } from "./code-panel";

it("renders JSON with highlighted keys and a copy button", () => {
  render(<CodePanel code={'{\n  "id": 1\n}'} title="Example response" />);
  expect(screen.getByText("Example response")).toBeInTheDocument();
  expect(screen.getByText('"id"')).toHaveClass("text-syntax-key");
  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
});

it("uses slate syntax colours in slate tone and highlights the HTTP method", () => {
  render(<CodePanel code={"POST /api/shop/products\nContent-Type: application/json"} language="http" tone="slate" />);
  expect(screen.getByText("POST")).toHaveClass("text-method-post-on-slate");
});
