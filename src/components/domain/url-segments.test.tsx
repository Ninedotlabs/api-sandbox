import { render, screen } from "@testing-library/react";
import { UrlSegments } from "./url-segments";

it("renders the base URL as coloured segments", () => {
  render(<UrlSegments slug="my-store" tail="/:resource" />);
  expect(screen.getByText("/api")).toHaveClass("bg-pastel-blue");
  expect(screen.getByText("/my-store")).toHaveClass("bg-pastel-violet");
  expect(screen.getByText("/:resource")).toHaveClass("bg-pastel-peach");
  expect(screen.getByRole("group", { name: "API address" })).toHaveTextContent("/api/my-store/:resource");
});
