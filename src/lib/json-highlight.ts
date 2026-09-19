export type TokenKind = "key" | "string" | "number" | "boolean" | "null" | "punct";
export interface Token {
  kind: TokenKind;
  text: string;
}

const TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

export function tokenizeJson(src: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of src.matchAll(TOKEN_RE)) {
    const index = m.index ?? 0;
    if (index > last) tokens.push({ kind: "punct", text: src.slice(last, index) });
    if (m[1]) {
      tokens.push({ kind: m[2] ? "key" : "string", text: m[1] });
      if (m[2]) tokens.push({ kind: "punct", text: m[2] });
    } else if (m[3]) {
      tokens.push({ kind: "boolean", text: m[0] });
    } else if (m[0] === "null") {
      tokens.push({ kind: "null", text: m[0] });
    } else {
      tokens.push({ kind: "number", text: m[0] });
    }
    last = index + m[0].length;
  }
  if (last < src.length) tokens.push({ kind: "punct", text: src.slice(last) });
  return tokens;
}
