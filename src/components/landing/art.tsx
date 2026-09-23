/**
 * The landing page's drawings: one isometric family, one light source, drawn by hand so
 * the page never depends on an icon set whose style it can't control.
 *
 * `ExplodedStack` is the hero's anchor — the product's own model (a resource, its records,
 * the endpoint over them) pulled apart and labelled, so the picture teaches rather than
 * decorates. Its viewBox is wider than the drawing to leave room for the labels.
 */

export function ExplodedStack() {
  return (
    <svg className="exploded" viewBox="-66 0 432 250" role="img" aria-label="Three layers: a resource, its records, and the endpoint over them">
      <defs>
        <linearGradient id="landing-gY" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe89a" />
          <stop offset="1" stopColor="#ffc400" />
        </linearGradient>
        <linearGradient id="landing-gB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8ba4ff" />
          <stop offset="1" stopColor="#2b59ff" />
        </linearGradient>
        <linearGradient id="landing-gP" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8fae" />
          <stop offset="1" stopColor="#ff3d6e" />
        </linearGradient>
      </defs>

      <g transform="translate(0,64)">
        <path d="M150 150 L216 112 L150 74 L84 112 Z" fill="url(#landing-gP)" />
        <path d="M84 112 L150 150 L150 168 L84 130 Z" fill="#c22a52" />
        <path d="M216 112 L150 150 L150 168 L216 130 Z" fill="#e03462" />
        <path className="lead" d="M216 126 L262 126" fill="none" />
        <text x="266" y="130">endpoint</text>
      </g>

      <g transform="translate(0,14)">
        <path d="M150 150 L216 112 L150 74 L84 112 Z" fill="url(#landing-gB)" />
        <path d="M84 112 L150 150 L150 166 L84 128 Z" fill="#1b3bb5" />
        <path d="M216 112 L150 150 L150 166 L216 128 Z" fill="#2449d8" />
        <path className="lead" d="M84 126 L38 126" fill="none" />
        <text x="34" y="130" textAnchor="end">records</text>
      </g>

      <g transform="translate(0,-36)">
        <path d="M150 150 L216 112 L150 74 L84 112 Z" fill="url(#landing-gY)" />
        <path d="M84 112 L150 150 L150 164 L84 126 Z" fill="#c79400" />
        <path d="M216 112 L150 150 L150 164 L216 126 Z" fill="#e8ae00" />
        <path d="M150 88 L194 113 L150 138 L106 113 Z" fill="#fff" opacity=".3" />
        <path className="lead" d="M216 122 L262 122" fill="none" />
        <text x="266" y="126">resource</text>
      </g>
    </svg>
  );
}

export function ResourceIcon() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="A resource block">
      <path d="M32 8 L56 22 L32 36 L8 22 Z" fill="#2b59ff" />
      <path d="M8 22 L32 36 L32 56 L8 42 Z" fill="#1b3bb5" />
      <path d="M56 22 L32 36 L32 56 L56 42 Z" fill="#3f6bff" />
      <path d="M32 14 L45 22 L32 30 L19 22 Z" fill="#fff" opacity=".34" />
    </svg>
  );
}

export function RoutesIcon() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="Stacked endpoint routes">
      <path d="M32 6 L54 18 L32 30 L10 18 Z" fill="#12c39a" />
      <path d="M10 18 L32 30 L32 38 L10 26 Z" fill="#0b8b6e" />
      <path d="M54 18 L32 30 L32 38 L54 26 Z" fill="#0fb790" />
      <path d="M32 26 L54 38 L32 50 L10 38 Z" fill="#ffd23d" />
      <path d="M10 38 L32 50 L32 58 L10 46 Z" fill="#c79400" />
      <path d="M54 38 L32 50 L32 58 L54 46 Z" fill="#e8ae00" />
    </svg>
  );
}

export function PlugIcon() {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label="A plug meeting a socket">
      <path d="M30 10 L52 22 L52 44 L30 32 Z" fill="#7a5cff" />
      <path d="M52 22 L30 10 L30 32 L52 44 Z" fill="#5b3fe0" opacity=".55" />
      <path d="M30 32 L52 44 L30 56 L8 44 Z" fill="#9b7eff" />
      <rect x="24" y="24" width="5" height="13" rx="2.5" fill="#fff" opacity=".85" />
      <rect x="34" y="30" width="5" height="13" rx="2.5" fill="#fff" opacity=".85" />
    </svg>
  );
}

export function RecordsIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 4 L34 12 L20 20 L6 12 Z" fill="#ffd23d" />
      <path d="M6 12 L20 20 L20 25 L6 17 Z" fill="#c79400" />
      <path d="M34 12 L20 20 L20 25 L34 17 Z" fill="#e8ae00" />
      <path d="M20 17 L34 25 L20 33 L6 25 Z" fill="#ffd23d" />
      <path d="M6 25 L20 33 L20 38 L6 30 Z" fill="#c79400" />
      <path d="M34 25 L20 33 L20 38 L34 30 Z" fill="#e8ae00" />
    </svg>
  );
}

export function StatusIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 5 L33 12 L33 27 L20 34 L7 27 L7 12 Z" fill="#12c39a" />
      <path d="M20 5 L33 12 L20 19 L7 12 Z" fill="#43e3b8" />
      <path d="M14 19 l4 4 l8 -9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ShapeIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" fill="#2b59ff" />
      <path d="M20 4 L34 12 L20 20 L6 12 Z" fill="#6483ff" />
      <path d="M15 17 l-4 3 l4 3 M25 17 l4 3 l-4 3" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ConsoleIcon() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 4 L34 12 L34 28 L20 36 L6 28 L6 12 Z" fill="#ff3d6e" />
      <path d="M20 4 L34 12 L20 20 L6 12 Z" fill="#ff8fae" />
      <path d="M14 22 h12" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M14 27 h7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
