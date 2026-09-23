/**
 * "The stand-in" — the product's mascot.
 *
 * A mock API is a stand-in, so the mark is the page's own material: a vinyl sticker with
 * one corner peeled, and two eyes. Nothing else — the silhouette has to survive being
 * rendered at 26px in the footer. Expression lives entirely in the eyes, which is why it
 * can stay this simple.
 *
 * Drawn once as an SVG `<symbol>` (render `<MascotSymbol />` once per page) and referenced
 * by every instance. `Wordmark` renders its own copy, which is how the mark reaches every
 * screen in the app without the landing page being involved.
 */

import "./mascot.css";

export type MascotMood = "idle" | "wink" | "alarm";

export const MASCOT_SYMBOL_ID = "brand-standin";

export function MascotSymbol() {
  return (
    <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
      <symbol id={MASCOT_SYMBOL_ID} viewBox="0 0 64 64">
        {/* Tilted in the artwork rather than with CSS, so transforms stay free for the
            hover lift and the hero's bob. Scaled slightly so the rotated corners can't
            clip the viewBox. */}
        <g transform="translate(32 32) rotate(-7) scale(.93) translate(-32 -32)">
          <path
            className="body"
            d="M16 3 H38 L61 26 V48 A13 13 0 0 1 48 61 H16 A13 13 0 0 1 3 48 V16 A13 13 0 0 1 16 3 Z"
            fill="#ffd23d"
          />
          {/* the curl: the sticker's white backing, lifting */}
          <path className="curl" d="M38 3 L61 26 H48 A10 10 0 0 1 38 16 Z" fill="#fff8dd" />
          <path className="curl-edge" d="M38 3 A10 26 0 0 0 48 26 A26 10 0 0 0 61 26" fill="#e9b800" opacity=".55" />
          <g className="eyes">
            <circle className="eye eye-l" cx="24" cy="36" r="5.6" fill="#15181c" />
            <circle className="eye eye-r" cx="43" cy="36" r="5.6" fill="#15181c" />
            <path className="eye-wink" d="M37.5 36 q5.5 6 11 0" stroke="#15181c" strokeWidth="4" fill="none" strokeLinecap="round" />
          </g>
        </g>
      </symbol>
    </svg>
  );
}

interface MascotProps {
  mood?: MascotMood;
  className?: string;
  /** Offsets this instance's blink so several mascots never blink in unison. */
  blinkDelay?: string;
  /** Omit for decorative instances; they are hidden from assistive tech. */
  label?: string;
  id?: string;
}

export function Mascot({ mood = "idle", className, blinkDelay, label, id }: MascotProps) {
  return (
    <svg
      id={id}
      className={className ? `mascot ${className}` : "mascot"}
      data-mood={mood}
      viewBox="0 0 64 64"
      style={blinkDelay ? ({ "--bd": blinkDelay } as React.CSSProperties) : undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <use href={`#${MASCOT_SYMBOL_ID}`} />
    </svg>
  );
}
