"use client";

import { Bot, FolderKanban, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserAvatar() {
  const [user, setUser] = useState<{ name?: string | null; email?: string | null; image?: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session")
      .then((response) => (response.ok ? response.json() : null))
      .then((session: { user?: { name?: string | null; email?: string | null; image?: string | null } } | null) => {
        if (active) setUser(session?.user ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const initials = user?.name
    ?.split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Your account"
          className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-line bg-surface text-xs font-semibold text-ink-2 transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {user?.image ? (
            // Google avatar URLs are user-specific and short-lived; rendering them directly
            // avoids maintaining a brittle remote-host allowlist in next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
          ) : (
            initials || <UserRound className="size-4" aria-hidden />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>
          <span className="block truncate text-ink">{user?.name || "Your workspace"}</span>
          <span className="block truncate font-normal">{user?.email || "Signed in with Google"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/projects">
            <FolderKanban aria-hidden /> Projects
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/mcp">
            <Bot aria-hidden /> MCP connection
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut({ redirectTo: "/sign-in" })}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
