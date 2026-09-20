import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
vi.mock("next-auth/react", () => ({ signIn: (...args: unknown[]) => signIn(...args) }));

import SignInPage from "./page";

describe("SignInPage", () => {
  it("renders the product name, a one-line description, and nothing else", () => {
    render(<SignInPage />);

    expect(screen.getByRole("heading", { name: "Universal API" })).toBeInTheDocument();
    expect(screen.getByText(/build an api without writing code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("starts a Google sign-in when the button is clicked", async () => {
    render(<SignInPage />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signIn).toHaveBeenCalledWith("google");
  });
});
