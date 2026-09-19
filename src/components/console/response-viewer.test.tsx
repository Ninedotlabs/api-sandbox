import { render, screen } from "@testing-library/react";
import { ResponseViewer } from "./response-viewer";

it("explains the status and shows the body", () => {
  render(
    <ResponseViewer
      loading={false}
      response={{ status: 400, durationMs: 212, body: { error: "Validation failed", details: ["'name' is required"] } }}
    />,
  );
  expect(screen.getByText("400 Bad Request")).toBeInTheDocument();
  expect(screen.getByText("212 ms")).toBeInTheDocument();
  expect(screen.getByText(/needs fixing/)).toBeInTheDocument();
  expect(screen.getByText(`"'name' is required"`)).toBeInTheDocument();
});

it("shows an empty state before the first request", () => {
  render(<ResponseViewer loading={false} response={null} />);
  expect(screen.getByText("No response yet")).toBeInTheDocument();
});
