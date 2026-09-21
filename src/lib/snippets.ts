import { getAppOrigin } from "./app-origin";
import { fillPath, routeParams } from "./paths";
import { baseUrl } from "./slug";
import type { Project, Route } from "./types";

export interface Snippets {
  curl: string;
  javascript: string;
  python: string;
}

/** Renders a JSON-able value as the Python literal `requests` expects for its `json=` kwarg. */
function toPythonLiteral(value: unknown): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(toPythonLiteral).join(", ")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${toPythonLiteral(v)}`).join(", ")}}`;
  }
  return "None";
}

export function buildSnippets(project: Project, route: Route, body?: unknown, origin = getAppOrigin()): Snippets {
  const params = Object.fromEntries(routeParams(route.path).map((p) => [p, "1"]));
  const url = `${origin.replace(/\/+$/, "")}${baseUrl(project.slug)}${fillPath(route.path, params)}`;
  const hasBody = body !== undefined && ["POST", "PUT", "PATCH"].includes(route.method);
  const compact = hasBody ? JSON.stringify(body) : "";
  // Single-quoted shell string: close the quote, emit an escaped quote, reopen it.
  const curlBody = compact.replace(/'/g, "'\\''");
  const pretty = hasBody
    ? JSON.stringify(body, null, 2)
        .split("\n")
        .join("\n  ")
    : "";
  const py = hasBody ? toPythonLiteral(body) : "";

  const curl =
    route.method === "GET"
      ? `curl ${url}`
      : hasBody
        ? `curl -X ${route.method} ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '${curlBody}'`
        : `curl -X ${route.method} ${url}`;

  const javascript =
    route.method === "GET"
      ? `const res = await fetch("${url}");\nconst data = await res.json();`
      : `const res = await fetch("${url}", {\n  method: "${route.method}",${
          hasBody ? `\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${pretty}),` : ""
        }\n});\nconst data = await res.json();`;

  const fn = route.method.toLowerCase();
  const python = `import requests\n\nres = requests.${fn}("${url}"${hasBody ? `, json=${py}` : ""})\nprint(res.json())`;

  return { curl, javascript, python };
}
