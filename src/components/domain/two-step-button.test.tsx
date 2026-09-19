import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TwoStepButton } from "./two-step-button";

it("asks for confirmation on the first click and confirms on the second", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<TwoStepButton label="Delete API" confirmLabel="Sure? Delete" onConfirm={onConfirm} />);
  await user.click(screen.getByRole("button", { name: "Delete API" }));
  expect(screen.getByRole("button", { name: "Sure? Delete" })).toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sure? Delete" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Delete API" })).toBeInTheDocument();
});

it("disarms after three seconds", () => {
  // Uses fireEvent instead of userEvent here: userEvent's click, combined with
  // `advanceTimers`, hangs indefinitely under vitest 4's fake timers in this
  // environment (reproduced with a bare <button>, unrelated to this
  // component) — a tooling incompatibility, not a bug in TwoStepButton.
  vi.useFakeTimers();
  render(<TwoStepButton label="Delete" confirmLabel="Sure?" onConfirm={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  act(() => vi.advanceTimersByTime(3100));
  expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  vi.useRealTimers();
});
