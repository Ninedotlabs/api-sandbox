"use client";

import { Bot, Boxes, CircleCheck, Globe2, Menu, ShieldCheck, Terminal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./user-avatar";
import { useSessionUser } from "./use-session-user";

const NAV_ITEMS = [
  { href: "/projects", label: "Projects", description: "Build and test APIs", icon: Boxes },
  { href: "/mcp", label: "MCP connection", description: "Control everything with AI", icon: Bot },
];

// Shown only to admins. Hiding it is cosmetic - `/admin` itself 404s for everyone else.
const ADMIN_ITEM = { href: "/admin", label: "Admin", description: "Users, activity and settings", icon: ShieldCheck };

interface Props {
  title: string;
  description: string;
  children: React.ReactNode;
}

function NavItems({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const user = useSessionUser();
  const items = user?.role === "admin" ? [...NAV_ITEMS, ADMIN_ITEM] : NAV_ITEMS;

  return items.map((item) => {
    const active =
      pathname === item.href ||
      (item.href === "/projects" && pathname.startsWith("/projects/")) ||
      (item.href === "/admin" && pathname.startsWith("/admin/"));
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
          active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-panel hover:text-ink",
          compact && "gap-2 px-2 py-2",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0">
          <span className="block text-sm font-medium">{item.label}</span>
          {!compact && <span className="block truncate text-xs text-ink-3">{item.description}</span>}
        </span>
      </Link>
    );
  });
}

function SidebarContent() {
  return (
    <>
      <div className="flex h-16 items-center border-b border-line px-5">
        <Wordmark />
      </div>
      <nav aria-label="Dashboard navigation" className="space-y-1 p-3">
        <NavItems />
      </nav>
      <div className="mt-auto p-3">
        <div className="space-y-2 rounded-xl border border-line bg-panel p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Terminal className="size-3.5 text-accent" aria-hidden />
            Build in the browser or MCP
          </div>
          <p className="text-xs leading-relaxed text-ink-3">Both update the same live mock API.</p>
        </div>
      </div>
    </>
  );
}

export function DashboardShell({ title, description, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col border-r border-line bg-rail/95 md:flex">
        <SidebarContent />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 md:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open dashboard sidebar" onClick={() => setMenuOpen(true)}>
                <Menu aria-hidden />
              </Button>
              <Wordmark />
            </div>
            <div className="hidden min-w-0 md:block">
              <h1 className="truncate text-base font-semibold text-ink">{title}</h1>
              <p className="truncate text-xs text-ink-3">{description}</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="mr-2 hidden items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 lg:flex">
                <Globe2 className="size-3.5 text-success" aria-hidden />
                Public mock URLs
                <CircleCheck className="size-3.5 text-success" aria-hidden />
              </div>
              <ThemeToggle />
              <UserAvatar />
            </div>
          </div>
        </header>
        {children}
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-[280px] flex-col gap-0 bg-rail p-0 sm:max-w-[280px] md:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Dashboard navigation</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </div>
  );
}
