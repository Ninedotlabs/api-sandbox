import { buildRequest, callResponses, extractText } from "./request";

const config = { endpoint: "https://x.services.ai.azure.com/openai/v1/responses", apiKey: "k", model: "Luna" };

it("builds a strict json_schema request with the api-key header", () => {
  const { url, init } = buildRequest(config, "A bookstore", { maxResources: 6, recordsPerResource: 8, existingNames: [] });
  expect(url).toBe(config.endpoint);
  expect((init.headers as Record<string, string>)["api-key"]).toBe("k");
  const body = JSON.parse(init.body as string);
  expect(body.model).toBe("Luna");
  expect(body.text.format).toMatchObject({ type: "json_schema", name: "api_plan", strict: true });
  expect(body.max_output_tokens).toBe(8000);
  expect(JSON.stringify(body.input)).toContain("A bookstore");
});

it("appends repair notes to the input", () => {
  const { init } = buildRequest(config, "x", { maxResources: 6, recordsPerResource: 8, existingNames: [], repairNotes: ["Book: dropped the id field"] });
  expect(init.body as string).toContain("Fix these problems");
});

it("extracts text from both Responses API shapes", () => {
  expect(extractText({ output_text: "{}" })).toBe("{}");
  expect(extractText({ output: [{ type: "message", content: [{ type: "output_text", text: "{\"a\":1}" }] }] })).toBe('{"a":1}');
  expect(extractText({ output: [] })).toBeNull();
});

it("calls fetch and returns status and text", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: "{}" }), { status: 200 }));
  const res = await callResponses(config, "x", { maxResources: 6, recordsPerResource: 8, existingNames: [] }, fetchImpl as unknown as typeof fetch);
  expect(res).toEqual({ status: 200, text: "{}" });
});
