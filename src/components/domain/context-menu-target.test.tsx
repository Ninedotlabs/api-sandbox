import { createEvent, fireEvent, screen } from "@testing-library/react";
import type { ContextMenuItemSpec } from "@/lib/context-menu-items";
import { renderUi } from "@/test/render";
import { useUiStore } from "@/store/ui-store";
import { ContextMenuTarget } from "./context-menu-target";

function items(): ContextMenuItemSpec[] {
  return [
    { id: "one", label: "One", onSelect: vi.fn() },
    { id: "two", label: "Two", danger: true, separatorBefore: true, onSelect: vi.fn() },
  ];
}

function renderTarget(spec = items()) {
  renderUi(
    <ContextMenuTarget items={spec}>
      <div data-testid="row">Row</div>
    </ContextMenuTarget>,
  );
  return screen.getByTestId("row");
}

beforeEach(() => {
  useUiStore.setState({ seenContextMenuHint: false });
});

it("opens the menu and prevents the browser's default menu on a plain right-click", () => {
  const row = renderTarget();
  const event = createEvent.contextMenu(row, { bubbles: true, cancelable: true });
  fireEvent(row, event);
  expect(event.defaultPrevented).toBe(true);
  expect(screen.getByRole("menu")).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "One" })).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: "Two" })).toBeInTheDocument();
});

it("leaves the browser's menu untouched on Shift+right-click", () => {
  const row = renderTarget();
  const event = createEvent.contextMenu(row, { bubbles: true, cancelable: true, shiftKey: true });
  fireEvent(row, event);
  expect(event.defaultPrevented).toBe(false);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("calls the matching item's onSelect and not the others", () => {
  const spec = items();
  const row = renderTarget(spec);
  fireEvent(row, createEvent.contextMenu(row, { bubbles: true, cancelable: true }));
  fireEvent.click(screen.getByRole("menuitem", { name: "One" }));
  expect(spec[0].onSelect).toHaveBeenCalledTimes(1);
  expect(spec[1].onSelect).not.toHaveBeenCalled();
});

it("shows the browser-menu hint the first time a menu is opened, and not once it has been seen", () => {
  const row = renderTarget();
  fireEvent(row, createEvent.contextMenu(row, { bubbles: true, cancelable: true }));
  expect(screen.getByText("Shift + right-click for the browser menu")).toBeInTheDocument();
  expect(useUiStore.getState().seenContextMenuHint).toBe(true);
});

it("does not let a right-click bubble up to open an ancestor's context menu too", () => {
  const outer = items();
  const inner: ContextMenuItemSpec[] = [{ id: "inner-one", label: "Inner", onSelect: vi.fn() }];
  renderUi(
    <ContextMenuTarget items={outer}>
      <div data-testid="background">
        <ContextMenuTarget items={inner}>
          <div data-testid="row">Row</div>
        </ContextMenuTarget>
      </div>
    </ContextMenuTarget>,
  );
  const row = screen.getByTestId("row");
  fireEvent(row, createEvent.contextMenu(row, { bubbles: true, cancelable: true }));
  expect(screen.getAllByRole("menu")).toHaveLength(1);
  expect(screen.getByRole("menuitem", { name: "Inner" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "One" })).not.toBeInTheDocument();
});

it("does not show the hint again once it has already been seen", () => {
  useUiStore.setState({ seenContextMenuHint: true });
  const row = renderTarget();
  fireEvent(row, createEvent.contextMenu(row, { bubbles: true, cancelable: true }));
  expect(screen.getByRole("menu")).toBeInTheDocument();
  expect(screen.queryByText("Shift + right-click for the browser menu")).not.toBeInTheDocument();
});
