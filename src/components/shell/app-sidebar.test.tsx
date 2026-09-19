import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";

it("links every section and marks the active one", () => {
  vi.mocked(usePathname).mockReturnValue("/projects/p1/models/m1");
  render(<AppSidebar projectId="p1" />);
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/projects/p1");
  expect(screen.getByRole("link", { name: "Test" })).toHaveAttribute("href", "/projects/p1/console");
  expect(screen.getByRole("link", { name: "Models" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
});
