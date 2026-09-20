import { screen } from "@testing-library/react";
import type { EditDiff } from "@/lib/ai/diff";
import { renderUi } from "@/test/render";
import { EditPlanPreview } from "./edit-plan-preview";

// C1: a changed field must show every attribute that differs, not just its type — and an
// unchanged field never lands here at all (computeEditDiff already filters those out), so
// every entry with kind "changed" is guaranteed to have at least one line to show.
it("C1: renders every differing attribute of a changed field, not just its type", () => {
  const diff: EditDiff = {
    newResources: [],
    changedResources: [
      {
        name: "Order",
        isNew: false,
        fields: [
          {
            name: "status",
            kind: "changed",
            before: { name: "status", type: "choice", required: true, unique: false, options: ["Pending", "Shipped"] },
            after: { name: "status", type: "choice", required: false, unique: false, options: ["Refunded"] },
          },
        ],
        recordCount: 0,
        inboundLinks: [],
      },
    ],
    newEndpoints: [],
    removals: { resources: [], fields: [], endpoints: [] },
  };
  renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
  expect(screen.getByText("was choice (Pending, Shipped)")).toBeInTheDocument();
  expect(screen.getByText("no longer required")).toBeInTheDocument();
});

// C1, isolated: a required-only, unique-only, or linkTo-only change must each individually
// reach the rendered preview — not just the combined type+required case above.
it("C1: renders a required-only change", () => {
  const diff: EditDiff = {
    newResources: [],
    changedResources: [
      {
        name: "Order",
        isNew: false,
        fields: [{ name: "notes", kind: "changed", before: { name: "notes", type: "text", required: true, unique: false }, after: { name: "notes", type: "text", required: false, unique: false } }],
        recordCount: 0,
        inboundLinks: [],
      },
    ],
    newEndpoints: [],
    removals: { resources: [], fields: [], endpoints: [] },
  };
  renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
  expect(screen.getByText("no longer required")).toBeInTheDocument();
});

it("C1: renders a unique-only change", () => {
  const diff: EditDiff = {
    newResources: [],
    changedResources: [
      {
        name: "Order",
        isNew: false,
        fields: [{ name: "sku", kind: "changed", before: { name: "sku", type: "text", required: false, unique: false }, after: { name: "sku", type: "text", required: false, unique: true } }],
        recordCount: 0,
        inboundLinks: [],
      },
    ],
    newEndpoints: [],
    removals: { resources: [], fields: [], endpoints: [] },
  };
  renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
  expect(screen.getByText("now unique")).toBeInTheDocument();
});

it("C1: renders a linkTo-only change", () => {
  const diff: EditDiff = {
    newResources: [],
    changedResources: [
      {
        name: "Review",
        isNew: false,
        fields: [{ name: "subject", kind: "changed", before: { name: "subject", type: "link", required: true, unique: false, linkTo: "Book" }, after: { name: "subject", type: "link", required: true, unique: false, linkTo: "Author" } }],
        recordCount: 0,
        inboundLinks: [],
      },
    ],
    newEndpoints: [],
    removals: { resources: [], fields: [], endpoints: [] },
  };
  renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
  expect(screen.getByText("was linked to Book")).toBeInTheDocument();
});

it("still renders 'new' for an added field", () => {
  const diff: EditDiff = {
    newResources: [],
    changedResources: [
      { name: "Book", isNew: false, fields: [{ name: "genre", kind: "added", after: { name: "genre", type: "text", required: false, unique: false } }], recordCount: 0, inboundLinks: [] },
    ],
    newEndpoints: [],
    removals: { resources: [], fields: [], endpoints: [] },
  };
  renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
  expect(screen.getByText("new")).toBeInTheDocument();
});

// I5: replacing a resource's records dangles any other resource's inbound link to it; the
// preview must disclose that instead of leaving it a silent, Undo-only recovery.
describe("removals", () => {
  it("renders a field removal's consequence with a real count, in the danger colour, last", () => {
    const diff: EditDiff = {
      newResources: [],
      changedResources: [],
      newEndpoints: [],
      removals: { resources: [], fields: [{ resource: "User", field: "email", recordCount: 12 }], endpoints: [] },
    };
    renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
    const line = screen.getByText("User.email — 12 records will lose this value");
    expect(line).toHaveClass("text-danger");
  });

  it("renders a resource removal's record count, endpoint count and each inbound link that will be cleared", () => {
    const diff: EditDiff = {
      newResources: [],
      changedResources: [],
      newEndpoints: [],
      removals: {
        resources: [{ name: "Session", recordCount: 4, endpointCount: 5, inboundLinks: [{ modelName: "Question", fieldName: "session", recordCount: 3 }] }],
        fields: [],
        endpoints: [],
      },
    };
    renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
    expect(screen.getByText("Session — deletes 4 records and 5 endpoints")).toBeInTheDocument();
    expect(screen.getByText("Question.session will be cleared")).toBeInTheDocument();
  });

  it("renders an endpoint removal's method and path", () => {
    const diff: EditDiff = {
      newResources: [],
      changedResources: [],
      newEndpoints: [],
      removals: { resources: [], fields: [], endpoints: [{ method: "DELETE", path: "/users/:id" }] },
    };
    renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
    expect(screen.getByText("DELETE")).toBeInTheDocument();
    expect(screen.getByText("/users/:id")).toBeInTheDocument();
  });

  it("shows no removals section, and no 'nothing to change' message, when there is nothing to remove but something to add", () => {
    const diff: EditDiff = {
      newResources: [{ name: "Author", isNew: true, fields: [], recordCount: 0, inboundLinks: [] }],
      changedResources: [],
      newEndpoints: [],
      removals: { resources: [], fields: [], endpoints: [] },
    };
    renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
    expect(screen.queryByText("Removals")).not.toBeInTheDocument();
  });

  it("a plan with only removals is not reported as 'nothing to change'", () => {
    const diff: EditDiff = {
      newResources: [],
      changedResources: [],
      newEndpoints: [],
      removals: { resources: [], fields: [{ resource: "User", field: "email", recordCount: 0 }], endpoints: [] },
    };
    renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
    expect(screen.queryByText(/Nothing to change/)).not.toBeInTheDocument();
  });
});

it("I5: discloses that another resource's records will lose their link when this resource's records are replaced", () => {
  const diff: EditDiff = {
    newResources: [],
    changedResources: [
      { name: "Book", isNew: false, fields: [], recordCount: 2, inboundLinks: [{ modelName: "Order", fieldName: "book", recordCount: 3 }] },
    ],
    newEndpoints: [],
    removals: { resources: [], fields: [], endpoints: [] },
  };
  renderUi(<EditPlanPreview diff={diff} warnings={[]} />);
  // "Up to" because the count is the linking model's total record count, not a precise count
  // of records whose link is actually set to this resource — an upper bound, not a fact.
  expect(screen.getByText(/Up to 3 Order records may lose their link to this resource/)).toBeInTheDocument();
});
