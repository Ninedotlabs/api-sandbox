import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { renderUi } from "@/test/render";
import { ConnectSection } from "./connect-section";

it("shows the local stdio command and config by default, and mentions building it first", () => {
  const { container } = renderUi(<ConnectSection origin="https://app.example.com" />);
  expect(container).toHaveTextContent("claude mcp add universal-api -e UNIVERSAL_API_TOKEN=");
  expect(container).toHaveTextContent("./dist/mcp/stdio.js");
  expect(container).toHaveTextContent(/npm run build:mcp/);
  const pres = container.querySelectorAll("pre");
  expect(pres[1]).toHaveTextContent('"command":');
  expect(pres[1]).toHaveTextContent('"node"');
});

it("switches to the deployed HTTP command and config against the page's own origin", async () => {
  const user = userEvent.setup();
  const { container } = renderUi(<ConnectSection origin="https://app.example.com" />);

  await user.click(screen.getByRole("tab", { name: /deployed/i }));

  expect(container).toHaveTextContent("claude mcp add --transport http universal-api https://app.example.com/api/mcp");
  const pres = container.querySelectorAll("pre");
  expect(pres[1]).toHaveTextContent('"type":');
  expect(pres[1]).toHaveTextContent('"http"');
});
