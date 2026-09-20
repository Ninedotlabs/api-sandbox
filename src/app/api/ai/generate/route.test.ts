// @vitest-environment node
import { POST } from "./route";

const ok = JSON.stringify({ output_text: JSON.stringify({ resources: [{ name: "Book", description: "", fields: [{ name: "title", type: "text", required: true, unique: false, options: null, linkTo: null }], records: [] }] }) });
const post = (body: unknown) => POST(new Request("http://t/api/ai/generate", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  process.env.AZURE_AI_ENDPOINT = "https://x/openai/v1/responses";
  process.env.AZURE_AI_API_KEY = "k";
  process.env.AZURE_AI_MODEL = "Luna";
  vi.restoreAllMocks();
});

it("rejects an empty description", async () => {
  const res = await post({ description: "  " });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "Describe the API you want (up to 2000 characters)." });
});

it("returns 503 when not configured", async () => {
  delete process.env.AZURE_AI_API_KEY;
  const res = await post({ description: "A shop" });
  expect(res.status).toBe(503);
});

it("returns a parsed plan", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(ok, { status: 200 }));
  const res = await post({ description: "A bookstore", existingResourceNames: [] });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.plan.resources[0].name).toBe("Book");
  expect(body.warnings).toEqual([]);
});

it("retries once on an unusable answer, then fails with 502", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ output_text: "not json" }), { status: 200 }));
  const res = await post({ description: "A bookstore" });
  expect(spy).toHaveBeenCalledTimes(2);
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: "The model returned an unusable answer. Try rephrasing." });
});

it("maps upstream 401 and timeouts", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
  expect((await post({ description: "x" })).status).toBe(502);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" }));
  expect((await post({ description: "x" })).status).toBe(504);
});
