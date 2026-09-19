import { Trash2 } from "lucide-react";
import Link from "next/link";
import { MethodBadge } from "@/components/domain/method-badge";
import { Button } from "@/components/ui/button";
import type { Route } from "@/lib/types";

interface Props {
  route: Route;
  base: string;
  href: string;
  onDelete: () => void;
}

export function RouteRow({ route, base, href, onDelete }: Props) {
  return (
    <li className="flex items-center gap-3 rounded-md border bg-surface-2 p-3 transition-colors duration-150 hover:border-primary/40">
      <MethodBadge method={route.method} className="w-16 justify-center" />
      <Link href={href} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{route.description || "Untitled route"}</span>
        <code className="block truncate font-mono text-xs text-muted-foreground">
          {base}
          {route.path}
        </code>
      </Link>
      <Button variant="ghost" size="icon" aria-label={`Delete ${route.description || route.path}`} onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
