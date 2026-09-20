import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const { AZURE_AI_ENDPOINT, AZURE_AI_API_KEY, AZURE_AI_MODEL } = env;
if (!AZURE_AI_ENDPOINT || !AZURE_AI_API_KEY || !AZURE_AI_MODEL) { console.error("Missing AZURE_AI_ENDPOINT, AZURE_AI_API_KEY or AZURE_AI_MODEL in .env.local"); process.exit(1); }
const res = await fetch(AZURE_AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "api-key": AZURE_AI_API_KEY }, body: JSON.stringify({ model: AZURE_AI_MODEL, input: "Reply with the single word OK.", max_output_tokens: 20 }) });
const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text.slice(0, 200));
process.exit(res.ok ? 0 : 1);
