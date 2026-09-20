import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { TokenPanel } from "./token-panel";

const ORIGINAL_TOKEN = process.env.UNIVERSAL_API_TOKEN;

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.UNIVERSAL_API_TOKEN;
  else process.env.UNIVERSAL_API_TOKEN = ORIGINAL_TOKEN;
});

it("renders the token masked, never in full", async () => {
  process.env.UNIVERSAL_API_TOKEN = "ua_realsecret1234";
  render(await TokenPanel());

  expect(screen.getByText("ua_••••••••1234")).toBeInTheDocument();
  expect(screen.queryByText("ua_realsecret1234", { exact: false })).not.toBeInTheDocument();
  expect(document.body.innerHTML).not.toContain("ua_realsecret1234");
});

it("says plainly when no token is configured, instead of rendering an empty mask", async () => {
  delete process.env.UNIVERSAL_API_TOKEN;
  render(await TokenPanel());

  expect(screen.getByText(/no token is configured/i)).toBeInTheDocument();
});
