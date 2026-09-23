import { ICON_FAMILIES, type ProjectIconDefinition, resolveProjectIcon } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

/**
 * A project's icon: one isometric tile, one glyph laid on its top face.
 *
 * The tile geometry and the three face tones are shared by every icon, so the set reads as
 * one family. Each glyph is drawn in flat 24×24 coordinates and then mapped onto the top
 * plane by `TOP_FACE`, which is why a circle here lands as a circle *in perspective* rather
 * than a sticker pasted on a 3D box.
 */

// Maps flat glyph coordinates (centred on 0,0) onto the tile's top face:
// x → right-and-down, y → left-and-down, at the tile's 2:1 isometric ratio.
// 1.4 fills the top face edge to edge for a glyph drawn within ±9, with a little margin.
const S = 1.4;
const TOP_FACE = `matrix(${(S * 0.866).toFixed(4)} ${(S * 0.5).toFixed(4)} ${(-S * 0.866).toFixed(4)} ${(S * 0.5).toFixed(4)} 32 21)`;

const GLYPHS: Record<string, React.ReactNode> = {
  cube: <rect x={-6} y={-6} width={12} height={12} rx={2} />,
  layers: (
    <>
      <rect x={-8} y={-7} width={16} height={4} rx={1.6} />
      <rect x={-8} y={-1} width={16} height={4} rx={1.6} opacity={0.8} />
      <rect x={-8} y={5} width={11} height={4} rx={1.6} opacity={0.6} />
    </>
  ),
  grid: (
    <>
      <rect x={-8} y={-8} width={7} height={7} rx={1.4} />
      <rect x={1} y={-8} width={7} height={7} rx={1.4} opacity={0.75} />
      <rect x={-8} y={1} width={7} height={7} rx={1.4} opacity={0.75} />
      <rect x={1} y={1} width={7} height={7} rx={1.4} opacity={0.55} />
    </>
  ),
  bolt: <path d="M1 -9 L-7 1 H-1 L-3 9 L6 -2 H0 Z" />,
  sparkle: <path d="M0 -9 Q1.6 -1.6 9 0 Q1.6 1.6 0 9 Q-1.6 1.6 -9 0 Q-1.6 -1.6 0 -9 Z" />,
  flask: (
    <>
      <path d="M-3 -8 H3 V-2 L7 7 H-7 L-3 -2 Z" />
      <rect x={-4.5} y={-9.5} width={9} height={2.4} rx={1.2} />
    </>
  ),

  cart: (
    <>
      <path d="M-8 -6 H-5 L-2.5 4 H6 L8 -3 H-4" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={-1} cy={7} r={1.8} />
      <circle cx={5.5} cy={7} r={1.8} />
    </>
  ),
  tag: (
    <>
      <path d="M-8 -2 L-1 -9 H8 V0 L1 7 Z" />
      <circle cx={4} cy={-5} r={1.8} fill="var(--icon-hole)" />
    </>
  ),
  card: (
    <>
      <rect x={-9} y={-6} width={18} height={12} rx={2.4} />
      <rect x={-9} y={-2.5} width={18} height={2.6} fill="var(--icon-hole)" />
    </>
  ),
  package: (
    <>
      <rect x={-8} y={-7} width={16} height={14} rx={2} />
      <rect x={-1.6} y={-7} width={3.2} height={14} fill="var(--icon-hole)" />
    </>
  ),
  ticket: (
    <>
      <rect x={-9} y={-5} width={18} height={10} rx={2.4} />
      <circle cx={0} cy={-5} r={2.2} fill="var(--icon-hole)" />
      <circle cx={0} cy={5} r={2.2} fill="var(--icon-hole)" />
    </>
  ),
  chart: (
    <>
      <rect x={-8} y={-1} width={4} height={9} rx={1.2} />
      <rect x={-2} y={-6} width={4} height={14} rx={1.2} opacity={0.85} />
      <rect x={4} y={-9} width={4} height={17} rx={1.2} opacity={0.7} />
    </>
  ),

  music: (
    <>
      <path d="M-1 6 V-8 L8 -10 V4" fill="none" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={-3.6} cy={6} r={3.2} />
      <circle cx={5.4} cy={4} r={3.2} />
    </>
  ),
  camera: (
    <>
      <rect x={-9} y={-5} width={18} height={12} rx={2.6} />
      <circle cx={0} cy={1} r={3.6} fill="var(--icon-hole)" />
      <rect x={-3} y={-8} width={6} height={3} rx={1.2} />
    </>
  ),
  book: (
    <>
      <path d="M-8 -8 H6 A2 2 0 0 1 8 -6 V8 H-6 A2 2 0 0 1 -8 6 Z" />
      <path d="M-4.5 -8 V8" strokeWidth={1.8} fill="none" stroke="var(--icon-hole)" />
    </>
  ),
  image: (
    <>
      <rect x={-9} y={-7} width={18} height={14} rx={2.4} />
      <circle cx={-3} cy={-2} r={2.2} fill="var(--icon-hole)" />
      <path d="M-9 6 L-1 -1 L9 7 Z" fill="var(--icon-hole)" />
    </>
  ),
  play: (
    <>
      <circle cx={0} cy={0} r={9} />
      <path d="M-3 -4.6 L5 0 L-3 4.6 Z" fill="var(--icon-hole)" />
    </>
  ),
  mic: (
    <>
      <rect x={-3.2} y={-9} width={6.4} height={11} rx={3.2} />
      <path d="M-6 0 A6 6 0 0 0 6 0" fill="none" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M0 6 V9" strokeWidth={2.2} strokeLinecap="round" />
    </>
  ),

  user: (
    <>
      <circle cx={0} cy={-4} r={4} />
      <path d="M-8 8 A8 7 0 0 1 8 8 Z" />
    </>
  ),
  chat: (
    <>
      <path d="M-9 -7 H9 V3 H-1 L-6 7.5 V3 H-9 Z" />
      <circle cx={-3.5} cy={-2} r={1.3} fill="var(--icon-hole)" />
      <circle cx={0} cy={-2} r={1.3} fill="var(--icon-hole)" />
      <circle cx={3.5} cy={-2} r={1.3} fill="var(--icon-hole)" />
    </>
  ),
  calendar: (
    <>
      <rect x={-8.5} y={-7} width={17} height={14} rx={2.2} />
      <rect x={-8.5} y={-7} width={17} height={4.2} fill="var(--icon-hole)" />
      <rect x={-4.5} y={0} width={3} height={3} rx={0.8} fill="var(--icon-hole)" />
      <rect x={1.5} y={0} width={3} height={3} rx={0.8} fill="var(--icon-hole)" />
    </>
  ),
  pin: (
    <>
      <path d="M0 9 C5 2 7 -1 7 -4 A7 7 0 1 0 -7 -4 C-7 -1 -5 2 0 9 Z" />
      <circle cx={0} cy={-4} r={2.6} fill="var(--icon-hole)" />
    </>
  ),

  database: (
    <>
      <ellipse cx={0} cy={-6} rx={9} ry={3.4} />
      <path d="M-9 -6 V4 A9 3.4 0 0 0 9 4 V-6" />
      <path d="M-9 -1 A9 3.4 0 0 0 9 -1" fill="none" stroke="var(--icon-hole)" strokeWidth={1.4} />
    </>
  ),
  cloud: <path d="M-6 5 A5 5 0 0 1 -5 -4.5 A6.5 6.5 0 0 1 6.5 -2.5 A4 4 0 0 1 6 5 Z" />,
  key: (
    <>
      <circle cx={-4} cy={-1} r={5} />
      <circle cx={-4} cy={-1} r={1.8} fill="var(--icon-hole)" />
      <path d="M0.6 -1 H9 M6.5 -1 V3 M9 -1 V2" strokeWidth={2.2} fill="none" strokeLinecap="round" />
    </>
  ),
  shield: (
    <>
      <path d="M0 -9 L8 -6 V1 C8 5 4 8 0 9.5 C-4 8 -8 5 -8 1 V-6 Z" />
      <path d="M-3.4 0 L-0.6 3 L4 -3" fill="none" stroke="var(--icon-hole)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.42} />
    </>
  ),
  terminal: (
    <>
      <rect x={-9} y={-7} width={18} height={14} rx={2.4} />
      <path d="M-5 -2.5 L-1.5 0.5 L-5 3.5" fill="none" stroke="var(--icon-hole)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.42} />
      <path d="M1 4 H5.5" stroke="var(--icon-hole)" strokeWidth={2} strokeLinecap="round" opacity={0.42} />
    </>
  ),
  gear: (
    <>
      <path d="M-2 -9.5 H2 L2.6 -6.4 L5.2 -5.3 L7.8 -7 L10 -4.2 L8 -1.9 V1.9 L10 4.2 L7.8 7 L5.2 5.3 L2.6 6.4 L2 9.5 H-2 L-2.6 6.4 L-5.2 5.3 L-7.8 7 L-10 4.2 L-8 1.9 V-1.9 L-10 -4.2 L-7.8 -7 L-5.2 -5.3 L-2.6 -6.4 Z" />
      <circle cx={0} cy={0} r={3.2} fill="var(--icon-hole)" />
    </>
  ),
};

interface Props {
  /** Either pass the project, or an already-resolved definition (the picker does the latter). */
  project?: { slug: string; icon?: string | null };
  definition?: ProjectIconDefinition;
  className?: string;
  /** Decorative by default: the project's name is always beside it. */
  label?: string;
}

export function ProjectIcon({ project, definition, className, label }: Props) {
  const icon = definition ?? resolveProjectIcon(project ?? { slug: "" });
  const tones = ICON_FAMILIES[icon.family];
  const glyph = GLYPHS[icon.id] ?? GLYPHS.cube;

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d="M32 6 L58 21 L32 36 L6 21 Z" fill={tones.top} />
      <path d="M6 21 L32 36 L32 58 L6 43 Z" fill={tones.left} />
      <path d="M58 21 L32 36 L32 58 L58 43 Z" fill={tones.right} />
      {/* the glyph, laid flat on the top face */}
      <g
        transform={TOP_FACE}
        fill={tones.ink}
        stroke={tones.ink}
        style={{ "--icon-hole": tones.top } as React.CSSProperties}
      >
        {glyph}
      </g>
      {/* a single highlight along the lit edge keeps every tile lit from the same side */}
      <path d="M32 6 L58 21 L32 36 L6 21 Z" fill="#ffffff" opacity={0.08} />
    </svg>
  );
}
