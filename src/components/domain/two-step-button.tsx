"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: "danger" | "secondary";
  className?: string;
  disabled?: boolean;
}

const DISARM_MS = 3000;

export function TwoStepButton({ label, confirmLabel, onConfirm, variant = "danger", className, disabled }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      aria-live="polite"
      className={cn(
        variant === "danger" && "bg-pastel-rose text-pastel-rose-ink hover:bg-pastel-rose/80",
        armed && variant === "danger" && "bg-destructive text-white hover:bg-destructive/90",
        className,
      )}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}
