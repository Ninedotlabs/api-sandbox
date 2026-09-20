import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { WhatToAsk } from "./what-to-ask";

it("shows worked examples of what the product can do today", () => {
  render(<WhatToAsk />);
  expect(screen.getByText(/add a Reviews resource to my Bookshop API with rating and comment/)).toBeInTheDocument();
  expect(screen.getByText(/make \/orders\/:id return a 503 with a Retry-After header/)).toBeInTheDocument();
  expect(screen.getByText(/wrap every list response in \{success, result: \{items, total\}\}/)).toBeInTheDocument();
  expect(screen.getByText(/drop the email field from User/)).toBeInTheDocument();
  expect(screen.getByText(/duplicate my Store API and call the copy Staging/)).toBeInTheDocument();
});
