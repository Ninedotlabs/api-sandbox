import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
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
    window.history.replaceState(null, "", "/sign-in");
    render(<SignInPage />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/projects" });
  });

  it("returns the user to the app page they originally requested", async () => {
    window.history.replaceState(null, "", "/sign-in?callbackUrl=%2Fmcp%3Ftab%3Ddeployed");
    render(<SignInPage />);

    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));

    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/mcp?tab=deployed" });
  });

  it("turns an OAuth callback failure into a clear retry state", () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("error=OAuthCallback") as never);
    render(<SignInPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(/couldn't complete that sign-in/i);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeEnabled();
  });
});
