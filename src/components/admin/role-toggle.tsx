"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  userId: string;
  role: "user" | "admin";
  email: string | null;
}

export function RoleToggle({ userId, role, email }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const next = role === "admin" ? "user" : "admin";

  async function change() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Couldn't change this role.");
      toast.success(next === "admin" ? `${email ?? "User"} is now an admin` : `${email ?? "User"} is no longer an admin`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't change this role.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Button variant="outline" size="sm" className="rounded-md" disabled={saving} onClick={() => void change()}>
      {role === "admin" ? "Remove admin" : "Make admin"}
    </Button>
  );
}
