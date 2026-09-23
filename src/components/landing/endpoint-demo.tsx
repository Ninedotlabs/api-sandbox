"use client";

import { useState } from "react";
import { Mascot, type MascotMood } from "@/components/brand/mascot";

/**
 * The landing page's one interactive moment: three real requests against a mock API,
 * switchable. It demonstrates the product's claim ("a URL your app can actually call")
 * rather than restating it, including the unhappy path — a 404 carrying this app's own
 * error message, so the page never promises a mock that only ever succeeds.
 *
 * The examples are written out rather than fetched: the page must render its full state
 * on first paint, with no network and nothing to wait for.
 */

interface Example {
  key: string;
  /** The tab's label. Reads as a request, not a noun, so the three are one set. */
  tab: string;
  rotate: string;
  color: string;
  onColor: string;
  path: string;
  status: string;
  /** Pink for a failure — the status text says so too, so colour is never the only signal. */
  statusColor: string;
  mood: MascotMood;
  note: string;
  body: React.ReactNode;
}

const EXAMPLES: Example[] = [
  {
    key: "get",
    tab: "GET",
    rotate: "-3deg",
    color: "var(--blue)",
    onColor: "var(--on-blue)",
    path: "/api/songs/songs/3",
    status: "200 OK · 24 ms",
    statusColor: "var(--mint)",
    mood: "idle",
    note: "Reads straight from the rows you seeded.",
    body: (
      <>
        <span className="d">$</span> <b>curl https://your-api.app/api/songs/songs/3</b>
        {"\n\n"}
        {"{\n"}
        {"  "}<span className="k">&quot;id&quot;</span>: <span className="s">&quot;3&quot;</span>,{"\n"}
        {"  "}<span className="k">&quot;title&quot;</span>: <span className="s">&quot;Blinding Lights&quot;</span>,{"\n"}
        {"  "}<span className="k">&quot;artist&quot;</span>: <span className="s">&quot;The Weeknd&quot;</span>,{"\n"}
        {"  "}<span className="k">&quot;genre&quot;</span>: <span className="s">&quot;Pop&quot;</span>,{"\n"}
        {"  "}<span className="k">&quot;durationSeconds&quot;</span>: <span className="n">200</span>{"\n"}
        {"}"}<span className="caret">▍</span>
      </>
    ),
  },
  {
    key: "post",
    tab: "POST",
    rotate: "2deg",
    color: "var(--pink)",
    onColor: "var(--on-pink)",
    path: "/api/songs/songs",
    status: "201 Created · 31 ms",
    statusColor: "var(--mint)",
    mood: "wink",
    note: "The row is saved — the next GET returns it.",
    body: (
      <>
        <span className="d">$</span>{" "}
        <b>
          curl -X POST https://your-api.app/api/songs/songs \{"\n"}
          {"    "}-d &#39;&#123;&quot;title&quot;:&quot;Holocene&quot;,&quot;artist&quot;:&quot;Bon Iver&quot;&#125;&#39;
        </b>
        {"\n\n"}
        {"{\n"}
        {"  "}<span className="k">&quot;id&quot;</span>: <span className="s">&quot;9&quot;</span>,{"\n"}
        {"  "}<span className="k">&quot;title&quot;</span>: <span className="s">&quot;Holocene&quot;</span>,{"\n"}
        {"  "}<span className="k">&quot;artist&quot;</span>: <span className="s">&quot;Bon Iver&quot;</span>{"\n"}
        {"}"}<span className="caret">▍</span>
      </>
    ),
  },
  {
    key: "missing",
    tab: "GET → 404",
    rotate: "-2deg",
    color: "var(--violet)",
    onColor: "var(--on-violet)",
    path: "/api/songs/songs/404",
    status: "404 Not Found · 18 ms",
    statusColor: "var(--pink)",
    mood: "alarm",
    note: "Real failures, so your empty and error states get tested too.",
    body: (
      <>
        <span className="d">$</span> <b>curl https://your-api.app/api/songs/songs/404</b>
        {"\n\n"}
        {"{\n"}
        {"  "}<span className="k">&quot;error&quot;</span>: <span className="s">&quot;This record no longer exists.&quot;</span>{"\n"}
        {"}"}<span className="caret">▍</span>
      </>
    ),
  },
];

export function EndpointDemo() {
  const [activeKey, setActiveKey] = useState(EXAMPLES[0].key);
  const active = EXAMPLES.find((example) => example.key === activeKey) ?? EXAMPLES[0];

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : EXAMPLES.length - 1;
    const next = EXAMPLES[(index + step) % EXAMPLES.length];
    setActiveKey(next.key);
    document.getElementById(`landing-tab-${next.key}`)?.focus();
  }

  return (
    <>
      <div className="switch" role="tablist" aria-label="Example requests">
        {EXAMPLES.map((example, index) => (
          <button
            key={example.key}
            type="button"
            role="tab"
            id={`landing-tab-${example.key}`}
            aria-controls="landing-request"
            aria-selected={example.key === activeKey}
            onClick={() => setActiveKey(example.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            style={{ "--rot": example.rotate, "--c": example.color, "--on": example.onColor } as React.CSSProperties}
          >
            {example.tab}
          </button>
        ))}
      </div>

      <div className="terminal" id="landing-request" role="tabpanel" aria-labelledby={`landing-tab-${active.key}`}>
        <div className="bar">
          <span className="dot" style={{ background: "var(--pink)" }} />
          <span className="dot" style={{ background: "var(--yellow)" }} />
          <span className="dot" style={{ background: "var(--mint)" }} />
          <span className="path">{active.path}</span>
          <span className="status">
            <span className="dot" style={{ width: 7, height: 7, background: active.statusColor }} />
            <span>{active.status}</span>
          </span>
        </div>
        <div className="body">
          <pre>{active.body}</pre>
        </div>
      </div>

      <p className="reaction">
        <Mascot mood={active.mood} blinkDelay="3.6s" />
        <span>{active.note}</span>
      </p>
    </>
  );
}
