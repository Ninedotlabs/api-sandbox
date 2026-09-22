"use client";

import { useEffect, useState } from "react";

export interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: "user" | "admin";
}

// One request per page load, shared by every component that asks: the avatar and the sidebar
// both need the session, and each fetching it separately would double the round trips.
let pending: Promise<SessionUser | null> | null = null;

function fetchSessionUser(): Promise<SessionUser | null> {
  pending ??= fetch("/api/auth/session")
    .then((response) => (response.ok ? response.json() : null))
    .then((session: { user?: SessionUser } | null) => session?.user ?? null)
    .catch(() => null);
  return pending;
}

/** The signed-in user, or null while loading / when signed out. `role` only decides whether
 * to show admin links; the server checks it again on every admin page and API. */
export function useSessionUser(): SessionUser | null {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    let active = true;
    void fetchSessionUser().then((next) => {
      if (active) setUser(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return user;
}
