import { BookOpen, Database, Home, Play, Route as RouteIcon, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  segment: string;
  label: string;
  icon: LucideIcon;
}

export const PROJECT_NAV: NavItem[] = [
  { segment: "", label: "Home", icon: Home },
  { segment: "models", label: "Models", icon: Database },
  { segment: "routes", label: "Routes", icon: RouteIcon },
  { segment: "console", label: "Test", icon: Play },
  { segment: "docs", label: "Docs", icon: BookOpen },
  { segment: "settings", label: "Settings", icon: Settings },
];

export function navHref(projectId: string, segment: string): string {
  return segment ? `/projects/${projectId}/${segment}` : `/projects/${projectId}`;
}

export function isNavActive(pathname: string, projectId: string, segment: string): boolean {
  const href = navHref(projectId, segment);
  return segment ? pathname.startsWith(href) : pathname === href;
}
