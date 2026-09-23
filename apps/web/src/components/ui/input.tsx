import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-ring/15 aria-invalid:border-destructive aria-invalid:ring-destructive/15 h-13 w-full min-w-0 rounded-xl border px-4 text-base transition-colors outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
