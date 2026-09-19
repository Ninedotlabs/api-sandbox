"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/domain/wordmark";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui-store";
import { UserAvatar } from "./user-avatar";

interface Props {
  docsHref?: string;
  showSearch?: boolean;
}

export function TopBar({ docsHref, showSearch = false }: Props) {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  return (
    <header className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 md:px-8">
      <Wordmark />
      <div className="flex items-center gap-2">
        {showSearch && (
          <Button
            variant="secondary"
            size="sm"
            aria-label="Search"
            className="gap-2 rounded-xl text-ink-muted"
            onClick={() => setCommandOpen(true)}
          >
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="rounded-md bg-card px-1.5 text-[10px]">⌘K</kbd>
          </Button>
        )}
        {docsHref && (
          <Link href={docsHref} className="rounded-xl px-3 py-1.5 text-sm hover:bg-soft">
            Docs
          </Link>
        )}
        <UserAvatar />
      </div>
    </header>
  );
}
