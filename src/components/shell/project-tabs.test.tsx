import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { ProjectTabs } from "./project-tabs";

it("renders Build, Test and Docs tabs and marks the active one", () => {
  vi.mocked(usePathname).mockReturnValue("/projects/p1/console");
  render(<ProjectTabs projectId="p1" />);
  expect(screen.getByRole("link", { name: "Build" })).toHaveAttribute("href", "/projects/p1");
  expect(screen.getByRole("link", { name: "Test" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/projects/p1/docs");
});
