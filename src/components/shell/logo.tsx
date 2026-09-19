import { Braces } from "lucide-react";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/projects" className="flex items-center gap-2 font-semibold" aria-label="Universal API home">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Braces className="size-4" />
      </span>
      {!compact && <span>Universal API</span>}
    </Link>
  );
}
