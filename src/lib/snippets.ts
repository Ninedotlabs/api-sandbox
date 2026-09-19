import { fillPath, routeParams } from "./paths";
import { baseUrl } from "./slug";
import type { Project, Route } from "./types";

const ORIGIN = "http://localhost:3000";

export interface Snippets {
  curl: string;
  javascript: string;
  python: string;
}

export function buildSnippets(project: Project, route: Route, body?: unknown): Snippets {
  const params = Object.fromEntries(routeParams(route.path).map((p) => [p, "1"]));
  const url = `${ORIGIN}${baseUrl(project.slug)}${fillPath(route.path, params)}`;
  const hasBody = body !== undefined && ["POST", "PUT", "PATCH"].includes(route.method);
  const compact = hasBody ? JSON.stringify(body) : "";
  const pretty = hasBody
    ? JSON.stringify(body, null, 2)
        .split("\n")
        .join("\n  ")
    : "";
  const py = hasBody
    ? JSON.stringify(body)
        .replace(/,"/g, ', "')
        .replace(/":/g, '": ')
    : "";

  const curl =
    route.method === "GET"
      ? `curl ${url}`
      : hasBody
        ? `curl -X ${route.method} ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '${compact}'`
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
