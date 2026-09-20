// @vitest-environment node
import { POST } from "./route";

const ok = JSON.stringify({ output_text: JSON.stringify({ resources: [{ name: "Review", description: "", fields: [{ name: "rating", type: "number", required: true, unique: false, options: null, linkTo: null }], records: [] }], customEndpoints: [], removals: { resources: [], fields: [], endpoints: [] } }) });
const post = (body: unknown) => POST(new Request("http://t/api/ai/edit", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  process.env.AZURE_AI_ENDPOINT = "https://x/openai/v1/responses";
  process.env.AZURE_AI_API_KEY = "k";
  process.env.AZURE_AI_MODEL = "Luna";
  vi.restoreAllMocks();
});

it("rejects an empty instruction", async () => {
  const res = await post({ instruction: "  " });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "Describe what should change (up to 2000 characters)." });
});

it("returns 503 when not configured", async () => {
  delete process.env.AZURE_AI_API_KEY;
  const res = await post({ instruction: "Add reviews" });
  expect(res.status).toBe(503);
});

it("returns a parsed edit plan", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(ok, { status: 200 }));
  const res = await post({ instruction: "Add reviews", existing: [] });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.plan.resources[0].name).toBe("Review");
  expect(body.plan.customEndpoints).toEqual([]);
  expect(body.warnings).toEqual([]);
});

it("retries once on an unusable answer, then fails with 502", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ output_text: "not json" }), { status: 200 }));
  const res = await post({ instruction: "Add reviews" });
  expect(spy).toHaveBeenCalledTimes(2);
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: "The model returned an unusable answer. Try rephrasing." });
});

it("maps upstream 401 and timeouts", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
  expect((await post({ instruction: "x" })).status).toBe(502);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" }));
  expect((await post({ instruction: "x" })).status).toBe(504);
});

const bookLinkResources = (bookLinkValue: string) => JSON.stringify({
  output_text: JSON.stringify({
    resources: [
      {
        name: "Review",
        description: "",
        fields: [
          { name: "rating", type: "number", required: true, unique: false, options: null, linkTo: null },
          { name: "book", type: "link", required: false, unique: false, options: null, linkTo: "Book" },
        ],
        records: [{ entries: [{ field: "rating", value: "5" }, { field: "book", value: bookLinkValue }] }],
      },
    ],
    customEndpoints: [],
    removals: { resources: [], fields: [], endpoints: [] },
  }),
});
const existingBookWithRecordIds = { name: "Book", fields: [{ name: "title", type: "text", required: true, unique: false }], recordIds: ["1", "2"] };

it("rejects a link into an existing resource whose id isn't in the posted recordIds", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(bookLinkResources("9"), { status: 200 }));
  const res = await post({ instruction: "Add reviews", existing: [existingBookWithRecordIds] });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.plan.resources[0].records[0].book).toBeNull();
  expect(body.warnings).toContain("Review: 1 sample record had an unknown book link and was left empty.");
});

it("accepts a link into an existing resource whose id is in the posted recordIds", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(bookLinkResources("2"), { status: 200 }));
  const res = await post({ instruction: "Add reviews", existing: [existingBookWithRecordIds] });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.plan.resources[0].records[0].book).toBe("2");
  expect(body.warnings).toEqual([]);
});

const removalOutput = JSON.stringify({
  output_text: JSON.stringify({
    resources: [],
    customEndpoints: [],
    removals: { resources: [], fields: [{ resource: "user", field: "email" }], endpoints: [] },
  }),
});
const existingUser = { name: "User", fields: [{ name: "fullName", type: "text", required: true, unique: false }, { name: "email", type: "email", required: true, unique: true }] };

it("parses a field removal and resolves it to the existing resource's exact casing", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(removalOutput, { status: 200 }));
  const res = await post({ instruction: "i dont want user email in response", existing: [existingUser] });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.plan.removals).toEqual({ resources: [], fields: [{ resource: "User", field: "email" }], endpoints: [] });
  expect(body.warnings).toEqual([]);
});

it("passes existingRoutes through so endpoint removals can be validated", async () => {
  const raw = JSON.stringify({
    output_text: JSON.stringify({
      resources: [],
      customEndpoints: [],
      removals: { resources: [], fields: [], endpoints: [{ method: "DELETE", path: "/users/:id" }] },
    }),
  });
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(raw, { status: 200 }));
  const res = await post({ instruction: "remove the delete user endpoint", existing: [existingUser], existingRoutes: [{ method: "DELETE", path: "/users/:id" }] });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.plan.removals).toEqual({ resources: [], fields: [], endpoints: [{ method: "DELETE", path: "/users/:id" }] });
  expect(body.warnings).toEqual([]);
});
