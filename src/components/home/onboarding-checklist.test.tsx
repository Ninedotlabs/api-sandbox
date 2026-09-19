import { render, screen } from "@testing-library/react";
import { buildChecklist } from "@/lib/onboarding";
import { buildTemplateModels } from "@/lib/templates";
import { OnboardingChecklist } from "./onboarding-checklist";

it("shows progress and a button for the next step", () => {
  const project = {
    id: "p1", name: "S", slug: "s", description: "", models: buildTemplateModels("todo"), routes: [], createdAt: "", updatedAt: "",
  };
  render(<OnboardingChecklist steps={buildChecklist(project)} />);
  expect(screen.getByText("2 of 5 done")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Set up routes" })).toHaveAttribute("href", "/projects/p1/routes");
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
