"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Project } from "@/lib/types";
import { AppSidebar } from "./app-sidebar";
import { ProjectSwitcher } from "./project-switcher";
import { UserAvatar } from "./user-avatar";

export function TopBar({ project }: { project: Project }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="px-4 pt-4 text-sm">{project.name}</SheetTitle>
          <AppSidebar projectId={project.id} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <ProjectSwitcher current={project} />
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserAvatar />
      </div>
    </header>
  );
}
