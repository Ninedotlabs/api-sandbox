import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { EndpointDemo } from "./endpoint-demo";

/**
 * The demo is the page's only interactive claim: that a mock endpoint answers like a real
 * one, failures included. These tests hold it to that - every tab shows a different real
 * response, and the failure is announced in words, not only by a colour.
 */

it("opens on the GET example, already rendered", () => {
  render(<EndpointDemo />);

  expect(screen.getByRole("tab", { name: "GET" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Blinding Lights");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("200 OK");
});

it("switches to the create example, which returns 201 and a saved row", async () => {
  render(<EndpointDemo />);

  await userEvent.click(screen.getByRole("tab", { name: "POST" }));

  const panel = screen.getByRole("tabpanel");
  expect(panel).toHaveTextContent("201 Created");
  expect(panel).toHaveTextContent("Holocene");
  expect(screen.getByText("The row is saved — the next GET returns it.")).toBeInTheDocument();
});

it("shows the failure in words, so colour is never the only signal", async () => {
  render(<EndpointDemo />);

  await userEvent.click(screen.getByRole("tab", { name: "GET → 404" }));

  const panel = screen.getByRole("tabpanel");
  expect(panel).toHaveTextContent("404 Not Found");
  expect(panel).toHaveTextContent("This record no longer exists.");
});

it("moves between examples with the arrow keys", async () => {
  render(<EndpointDemo />);

  screen.getByRole("tab", { name: "GET" }).focus();
  await userEvent.keyboard("{ArrowRight}");

  expect(screen.getByRole("tab", { name: "POST" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("201 Created");
});
