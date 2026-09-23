import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import LandingPage from "./page";

/**
 * The landing page is the only page a signed-out visitor can reach, so what matters here
 * is that it renders its whole story without a session, a database or a network call, and
 * that the routes into the app are real links rather than dead anchors.
 */

it("renders the whole page for a signed-out visitor, with no data fetching", () => {
  render(<LandingPage />);

  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Fake it. Ship it.");
  expect(screen.getByRole("heading", { name: "A URL your app can actually call." })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Sketch it, mock it, call it." })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Let Claude build it while you review." })).toBeInTheDocument();
});

it("sends every call to action into the app, never to a dead anchor", () => {
  render(<LandingPage />);

  const intoApp = screen.getAllByRole("link").filter((link) => link.getAttribute("href") === "/projects");
  expect(intoApp.map((link) => link.textContent?.trim())).toEqual(["Open the app", "Start building →", "Start building →"]);

  for (const link of screen.getAllByRole("link")) {
    expect(link.getAttribute("href")).not.toBe("#");
  }
});

it("names the mascot for assistive tech only where it carries meaning", () => {
  render(<LandingPage />);

  // Decorative copies are hidden; the two that say something about the product are named.
  expect(screen.getByRole("img", { name: /peeking over the sheet/ })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /winking/ })).toBeInTheDocument();
});
