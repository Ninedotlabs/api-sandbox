const EXAMPLES = [
  "add a Reviews resource to my Bookshop API with rating and comment, then give it 10 sample rows",
  "make /orders/:id return a 503 with a Retry-After header",
  "wrap every list response in {success, result: {items, total}}",
  "drop the email field from User",
  "duplicate my Store API and call the copy Staging",
];

/** Worked examples, in plain English, of what to actually ask an MCP-connected Claude to do. */
export function WhatToAsk() {
  return (
    <ul className="space-y-2">
      {EXAMPLES.map((example) => (
        <li key={example} className="rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink-2">
          &ldquo;{example}&rdquo;
        </li>
      ))}
    </ul>
  );
}
