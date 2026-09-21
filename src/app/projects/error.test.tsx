import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUi } from "@/test/render";
import ProjectsError from "./error";

describe("projects error boundary", () => {
  it("logs the caught error instead of swallowing it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new TypeError("randomUUID is not a function");
    renderUi(<ProjectsError error={error} reset={() => {}} />);
    expect(spy).toHaveBeenCalledWith(error);
    spy.mockRestore();
  });

  it("doesn't blame the database for errors it can't attribute", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderUi(<ProjectsError error={new Error("boom")} reset={() => {}} />);
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    expect(screen.queryByText(/database/i)).not.toBeInTheDocument();
  });

  it("shows the digest so a server error can be matched to its log line", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderUi(<ProjectsError error={Object.assign(new Error("x"), { digest: "abc123" })} reset={() => {}} />);
    expect(screen.getByText("Reference: abc123")).toBeInTheDocument();
  });

  it("retries through reset", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    renderUi(<ProjectsError error={new Error("x")} reset={reset} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
