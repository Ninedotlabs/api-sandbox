import { fireEvent, screen } from "@testing-library/react";
import { buildTemplateModels } from "@/lib/templates";
import { useUiStore } from "@/store/ui-store";
import { renderUi } from "@/test/render";
import { CommandPalette } from "./command-palette";

beforeEach(() => useUiStore.setState({ commandOpen: false }));

it("opens with Ctrl+K and lists models", async () => {
  const project = {
    id: "p1", name: "Store", slug: "store", description: "", models: buildTemplateModels("store"), routes: [], createdAt: "", updatedAt: "",
  };
  renderUi(<CommandPalette project={project} />);
  expect(screen.queryByPlaceholderText(/Search pages/)).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(await screen.findByPlaceholderText(/Search pages/)).toBeInTheDocument();
  expect(screen.getByText("Customer")).toBeInTheDocument();
  expect(screen.getByText("Docs")).toBeInTheDocument();
});
