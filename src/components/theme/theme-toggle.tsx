"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "universal-api-theme";
const CHANGE_EVENT = "universal-api-theme-change";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function currentTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function ThemeToggle() {
  // Dark is the product's default, so the server snapshot has to say dark too - otherwise
  // the toggle renders the wrong icon for a frame before hydration corrects it.
  const dark = useSyncExternalStore(subscribe, currentTheme, () => true);

  function toggleTheme() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <Button
      type="button"
      suppressHydrationWarning
      variant="ghost"
      size="icon-sm"
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
      title={`Switch to ${dark ? "light" : "dark"} theme`}
      aria-pressed={dark === true}
      onClick={toggleTheme}
    >
      {dark ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
