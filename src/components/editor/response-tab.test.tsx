import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Model, Project, Route } from "@/lib/types";
import { renderUi } from "@/test/render";
import { ResponseTab } from "./response-tab";

const product: Model = {
  id: "m1",
  name: "Product",
  fields: [{ id: "f1", name: "name", type: "text", required: true, unique: false }],
};

const listRoute: Route = {
  id: "r1",
  method: "GET",
  path: "/products",
  modelId: "m1",
  action: "list",
  description: "",
  filters: [],
};

const customRoute: Route = {
  id: "r2",
  method: "GET",
  path: "/ping",
  modelId: null,
  action: "custom",
  description: "",
  filters: [],
};

const project: Project = {
  id: "p1",
  name: "Store",
  slug: "store",
  description: "",
  models: [product],
  routes: [listRoute, customRoute],
  createdAt: "",
  updatedAt: "",
};

function pre(container: HTMLElement) {
  return container.querySelector("pre")!;
}

/** Sets a textarea's value directly, sidestepping userEvent's `{`/`}` key-sequence escaping
 * (irrelevant here - these are JSON bodies, not keyboard shortcuts). */
function setValue(el: HTMLElement, value: string) {
  fireEvent.change(el, { target: { value } });
}

it("shows the auto-mode preview matching today's engine output when there is no response", () => {
  const { container } = renderUi(<ResponseTab project={project} route={listRoute} onSave={vi.fn()} />);
  expect(screen.getByText(/200/)).toBeInTheDocument();
  expect(pre(container)).toHaveTextContent('"data"');
  expect(pre(container)).toHaveTextContent('"count"');
});

it("shows a truthful 501 preview for a custom route with no response defined", () => {
  const { container } = renderUi(<ResponseTab project={project} route={customRoute} onSave={vi.fn()} />);
  expect(screen.getByText(/501/)).toBeInTheDocument();
  expect(pre(container)).toHaveTextContent(/no response defined/i);
});

it("switches to template mode, edits the template, and previews the typed substitution live", async () => {
  const user = userEvent.setup();
  const { container } = renderUi(<ResponseTab project={project} route={listRoute} onSave={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: "Template" }));
  const editor = screen.getByLabelText(/template/i) as HTMLTextAreaElement;
  setValue(editor, JSON.stringify({ items: "{{records}}", total: "{{count}}" }));

  expect(pre(container)).toHaveTextContent('"items"');
  expect(pre(container)).toHaveTextContent('"total"');
  // The seeded preview data always has records, so `{{records}}` must render as a real array,
  // not the literal string "{{records}}".
  expect(pre(container).textContent).not.toContain("{{records}}");
});

it("shows a warning for an unknown placeholder instead of failing", async () => {
  const user = userEvent.setup();
  renderUi(<ResponseTab project={project} route={listRoute} onSave={vi.fn()} />);

  await user.click(screen.getByRole("button", { name: "Template" }));
  const editor = screen.getByLabelText(/template/i) as HTMLTextAreaElement;
  setValue(editor, JSON.stringify({ oops: "{{totallyMadeUp}}" }));

  expect(await screen.findByText(/unknown placeholder/i)).toBeInTheDocument();
});

it("saves a static response with a custom status and header", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderUi(<ResponseTab project={project} route={customRoute} onSave={onSave} />);

  await user.click(screen.getByRole("button", { name: "Static" }));
  const editor = screen.getByLabelText(/response body/i) as HTMLTextAreaElement;
  setValue(editor, JSON.stringify({ pong: true }));

  await user.type(screen.getByLabelText(/status/i), "202");
  await user.click(screen.getByRole("button", { name: /add header/i }));
  await user.type(screen.getByLabelText(/header name/i), "X-Custom");
  await user.type(screen.getByLabelText(/header value/i), "yes");

  await user.click(screen.getByRole("button", { name: "Save response" }));

  expect(onSave).toHaveBeenCalledWith({
    ...customRoute,
    response: { mode: "static", status: 202, headers: { "X-Custom": "yes" }, body: { pong: true } },
  });
});

it("blocks saving invalid JSON with a plain-language error", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  renderUi(<ResponseTab project={project} route={customRoute} onSave={onSave} />);

  await user.click(screen.getByRole("button", { name: "Static" }));
  const editor = screen.getByLabelText(/response body/i) as HTMLTextAreaElement;
  setValue(editor, "{ not valid json");

  await user.click(screen.getByRole("button", { name: "Save response" }));

  expect(await screen.findByText(/valid json/i)).toBeInTheDocument();
  expect(onSave).not.toHaveBeenCalled();
});
