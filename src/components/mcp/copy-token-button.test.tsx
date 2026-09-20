import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { renderUi } from "@/test/render";
import { CopyTokenButton } from "./copy-token-button";

afterEach(() => {
  vi.restoreAllMocks();
});

// `userEvent.setup()` installs its own `navigator.clipboard` stub the first time it's called,
// so the write spy is attached to *that* object afterward rather than assigned beforehand.
function setupUser() {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  return { user, writeText };
}

it("fetches the real token only on click, and copies it without ever rendering it", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ data: { token: "ua_realsecret1234" } }), { status: 200 }),
  );
  const { user, writeText } = setupUser();
  renderUi(<CopyTokenButton />);

  expect(fetchSpy).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: /copy/i }));

  await waitFor(() => expect(writeText).toHaveBeenCalledWith("ua_realsecret1234"));
  expect(fetchSpy).toHaveBeenCalledWith("/api/mcp/token");
  expect(screen.queryByText("ua_realsecret1234")).not.toBeInTheDocument();
});

it("shows an error and copies nothing when the fetch fails", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "No token is configured for this deployment." }), { status: 404 }));
  const { user, writeText } = setupUser();
  renderUi(<CopyTokenButton />);

  await user.click(screen.getByRole("button", { name: /copy/i }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Copy token" })).toBeInTheDocument());
  expect(writeText).not.toHaveBeenCalled();
});
