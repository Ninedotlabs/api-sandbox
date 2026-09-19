import { render, screen } from "@testing-library/react";
import type { Project } from "@/lib/types";
import { ProjectCard } from "./project-card";

it("summarises a project", () => {
  const project: Project = {
    id: "p1", name: "My Store", slug: "my-store", description: "Sells lamps",
    models: [{ id: "m", name: "Product", fields: [] }], routes: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  render(<ProjectCard project={project} />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/p1");
  expect(screen.getByText("/api/my-store")).toBeInTheDocument();
  expect(screen.getByText("1 model · 0 routes")).toBeInTheDocument();
});
