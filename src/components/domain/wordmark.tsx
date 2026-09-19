import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/projects" className="font-script text-2xl leading-none text-ink" aria-label="Universal API home">
      universal
    </Link>
  );
}
