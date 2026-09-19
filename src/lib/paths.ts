export function routeParams(path: string): string[] {
  return path
    .split("/")
    .filter((s) => s.startsWith(":"))
    .map((s) => s.slice(1));
}

export function fillPath(path: string, params: Record<string, string>): string {
  return path
    .split("/")
    .map((s) => (s.startsWith(":") && params[s.slice(1)] ? encodeURIComponent(params[s.slice(1)]) : s))
    .join("/");
}
