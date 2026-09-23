import Link from "next/link";
import { Mascot, MascotSymbol } from "@/components/brand/mascot";
import { cn } from "@/lib/utils";

/**
 * The product's signature: the stand-in, then the name. One component so the mark, the
 * name and the link home can never drift apart between the rail, the top bar and sign-in.
 *
 * It carries its own `<MascotSymbol />` because the wordmark appears on screens the landing
 * page never renders, and an SVG `<use>` with no symbol to point at draws nothing.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/projects" aria-label="Universal API home" className={cn("inline-flex items-center gap-2 text-ink", className)}>
      <MascotSymbol />
      <Mascot className="size-6 shrink-0" blinkDelay="1.7s" />
      <span className="font-display text-[17px] font-extrabold tracking-tight">
        universal<span className="text-method-delete">.</span>api
      </span>
    </Link>
  );
}
