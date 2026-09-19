import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/projects" aria-label="Universal API home" className="inline-flex items-center gap-2 text-ink">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
        <path d="M7 4 3 10l4 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m13 4 4 6-4 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 10h7" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">universal</span>
    </Link>
  );
}
