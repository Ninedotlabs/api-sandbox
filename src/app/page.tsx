import type { Metadata } from "next";
import Link from "next/link";
import {
  ConsoleIcon,
  ExplodedStack,
  PlugIcon,
  RecordsIcon,
  ResourceIcon,
  RoutesIcon,
  ShapeIcon,
  StatusIcon,
} from "@/components/landing/art";
import { EndpointDemo } from "@/components/landing/endpoint-demo";
import { Mascot, MascotSymbol } from "@/components/brand/mascot";
import "./landing.css";

/**
 * The marketing landing page, served at `/` to everyone — signed in or not. It is listed
 * in `EXEMPT_PATHS` in `src/proxy.ts`, so the sign-in gate never redirects it away; a
 * landing page nobody can reach without an account would be pointless.
 *
 * It shares the product's typefaces and palette - both now come from the landing design
 * (see `globals.css`) - but keeps its own poster-scale layout, sticker treatment and
 * mascot in `landing.css` and `src/components/landing/`, which the workspace has no use
 * for.
 */

export const metadata: Metadata = {
  title: "Universal API — mock APIs with real URLs",
  description:
    "Design a mock API the way you'd sketch it on paper, and get a public URL that answers real HTTP. No server to write, no deploy to wait for.",
};

const APP_HREF = "/projects";

const MCP_TOOLS = [
  "create_project",
  "generate_api",
  "create_resource",
  "create_endpoints",
  "set_endpoint_response",
  "call_mock_endpoint",
  "describe_api",
];

export default function LandingPage() {
  return (
    <div className="landing">
      <MascotSymbol />

      <div className="wrap">
        <nav className="nav">
          <Link className="brand" href="#top">
            <Mascot blinkDelay=".4s" />
            universal<span className="dot">.</span>api
          </Link>
          <ul>
            <li className="hide-sm">
              <a className="link" href="#endpoint">
                The endpoint
              </a>
            </li>
            <li className="hide-sm">
              <a className="link" href="#steps">
                How it works
              </a>
            </li>
            <li className="hide-sm">
              <a className="link" href="#mcp">
                With Claude
              </a>
            </li>
            <li>
              <Link className="btn-sm" href={APP_HREF}>
                Open the app
              </Link>
            </li>
          </ul>
        </nav>

        <header className="hero" id="top">
          <div className="hero-grid">
            <div className="settle">
              <p className="eyebrow">Mock APIs · real URLs</p>
              <h1>
                Fake it. <span className="quiet">Ship it.</span>
              </h1>
              <p className="lede">
                Universal API is the stand-in for the backend you haven&apos;t built yet. Describe a resource, mock its endpoints,
                and call a public URL that answers real HTTP — no server to write, no deploy to wait for.
              </p>
              <div className="cta-row">
                <Link className="btn" href={APP_HREF}>
                  Start building →
                </Link>
                <a className="btn alt" href="#endpoint">
                  Look at a response
                </a>
              </div>
              <p className="cta-note">Sign in with Google · every project is private to your account</p>
            </div>

            <div className="sheet settle" style={{ "--d": ".12s" } as React.CSSProperties}>
              <Mascot className="mascot-peek" blinkDelay="2.1s" label="The stand-in, a peeled sticker with eyes, peeking over the sheet" />

              <span className="sticker sk-blue sk-a" style={{ "--fs": ".95rem" } as React.CSSProperties}>
                GET
              </span>
              <span className="sticker sk-pink sk-b" style={{ "--fs": ".95rem" } as React.CSSProperties}>
                POST
              </span>
              <span className="sticker sk-violet sk-c">DELETE</span>
              <span className="sticker sk-yellow sk-d">200 OK</span>
              <span className="sticker sk-mint sk-e">{"{ }"}</span>

              <div className="exploded-wrap" aria-hidden="true">
                <ExplodedStack />
              </div>
            </div>
          </div>
        </header>

        <section id="endpoint">
          <div className="head-row">
            <div className="sec-head">
              <p className="eyebrow">01 — the point of it</p>
              <h2>A URL your app can actually call.</h2>
              <p>
                Not a spec file, not a collection to import. A live endpoint with CORS open, answering real methods and real status
                codes.
              </p>
            </div>
          </div>
          <EndpointDemo />
        </section>

        <section id="steps">
          <div className="sec-head">
            <p className="eyebrow">02 — three moves</p>
            <h2>Sketch it, mock it, call it.</h2>
            <p>The whole loop takes about as long as writing the TODO comment you&apos;d have left instead.</p>
          </div>

          <div className="grid-3">
            <article className="card settle">
              <ResourceIcon />
              <div>
                <p className="num">STEP 01</p>
                <h3>Name a resource</h3>
                <p>
                  Song, Order, Card — then give it fields with real types: text, number, boolean, date, email, link. Mark what&apos;s
                  required and what must be unique.
                </p>
              </div>
            </article>

            <article className="card settle" style={{ "--d": ".08s" } as React.CSSProperties}>
              <RoutesIcon />
              <div>
                <p className="num">STEP 02</p>
                <h3>Mock the endpoints</h3>
                <p>
                  Generate the standard five — list, get, create, update, delete — or write a custom route and shape its exact body,
                  status and headers.
                </p>
              </div>
            </article>

            <article className="card settle" style={{ "--d": ".16s" } as React.CSSProperties}>
              <PlugIcon />
              <div>
                <p className="num">STEP 03</p>
                <h3>Point your app at it</h3>
                <p>
                  Swap the base URL and build your screens. Seed sample rows or write your own. It behaves like production until
                  production exists.
                </p>
              </div>
            </article>
          </div>
        </section>

        <section id="inside">
          <div className="sec-head">
            <p className="eyebrow">03 — what you work in</p>
            <h2>A resource is just a list of fields.</h2>
            <p>
              No YAML, no schema language. Name the field, pick a type, say whether it&apos;s required — the endpoints and the sample
              data follow from that.
            </p>
          </div>

          <div className="window">
            <div className="bar">
              <span className="dot" style={{ background: "var(--pink)" }} />
              <span className="dot" style={{ background: "var(--yellow)" }} />
              <span className="dot" style={{ background: "var(--mint)" }} />
              <span className="title">Songs · Song</span>
            </div>
            <div className="cols">
              <div className="side">
                <span className="on">Song</span>
                <span>Artist</span>
                <span>Playlist</span>
                <span className="mono">+ resource</span>
              </div>
              <div className="main">
                <div className="row">
                  <span className="name">title</span>
                  <span className="chipt">text</span>
                  <span className="chipt req">required</span>
                  <span className="grab">⠿</span>
                </div>
                <div className="row">
                  <span className="name">artist</span>
                  <span className="chipt">text</span>
                  <span className="chipt req">required</span>
                  <span className="grab">⠿</span>
                </div>
                <div className="row">
                  <span className="name">durationSeconds</span>
                  <span className="chipt">number</span>
                  <span className="grab">⠿</span>
                </div>
                <div className="row">
                  <span className="name">coverUrl</span>
                  <span className="chipt">url</span>
                  <span className="grab">⠿</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 18 }}>
            <div className="feat">
              <RecordsIcon />
              <div>
                <h3>Sample data, generated</h3>
                <p>Fields become believable rows — names, emails, dates — so your list screen has something to render on day one.</p>
              </div>
            </div>
            <div className="feat">
              <StatusIcon />
              <div>
                <h3>Real status codes</h3>
                <p>404 for a record that&apos;s gone, 409 for a duplicate address, 201 on create. Your error handling gets a proper workout.</p>
              </div>
            </div>
            <div className="feat">
              <ShapeIcon />
              <div>
                <h3>Responses you shape</h3>
                <p>Wrap results your way, return a fixed body, or a 503 with a Retry-After. Placeholders fill in live values at call time.</p>
              </div>
            </div>
            <div className="feat">
              <ConsoleIcon />
              <div>
                <h3>A console built in</h3>
                <p>Send a request, read the response, keep the log beside the endpoint you&apos;re editing. No second tool to keep in sync.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="mcp">
          <div className="band">
            <div>
              <p className="eyebrow">04 — for the AI on your team</p>
              <h2>Let Claude build it while you review.</h2>
              <p>
                Every control the dashboard has is an MCP tool as well. Describe the API in a sentence and watch resources, endpoints
                and sample rows appear — then open the same project in the browser and take over.
              </p>
              <div className="tools">
                {MCP_TOOLS.map((tool) => (
                  <span className="tool" key={tool}>
                    {tool}
                  </span>
                ))}
              </div>
            </div>

            <div className="chat">
              <div className="bar">
                <span className="dot" style={{ background: "var(--band-accent-2)" }} />
                <span className="path">claude · mcp</span>
              </div>
              <div className="body">
                <pre>
                  <span className="who">you</span>
                  {" — a tarot API with 78 cards\n      and a four-card draw\n\n"}
                  <span className="who-ai">claude</span>
                  {" — created "}
                  <b>Tarot</b>
                  {"\n      · Card · 78 records\n      · GET /cards, /cards/:id\n      · GET /draw/:id → 4 cards"}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section id="start" className="close">
          <Mascot mood="wink" blinkDelay="1.2s" label="The stand-in, winking" />
          <div className="stickers">
            <span className="sticker sk-pink" style={{ "--rot": "-4deg" } as React.CSSProperties}>
              PUT
            </span>
            <span className="sticker sk-yellow" style={{ "--rot": "3deg" } as React.CSSProperties}>
              201 Created
            </span>
            <span className="sticker sk-blue" style={{ "--rot": "-2deg" } as React.CSSProperties}>
              PATCH
            </span>
          </div>
          <h2>Your frontend doesn&apos;t need to wait.</h2>
          <p>Sketch the API, take the URL, keep building. Move to the real backend when it&apos;s ready — the shape won&apos;t change.</p>
          <Link className="btn" href={APP_HREF}>
            Start building →
          </Link>
        </section>

        <footer>
          <Link className="brand" href="#top">
            <Mascot blinkDelay="5s" />
            universal.api
          </Link>
          <span>Mock APIs with real URLs · built in the browser or by MCP</span>
        </footer>
      </div>
    </div>
  );
}
