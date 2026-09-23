import type * as React from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  type = "text",
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-card text-foreground placeholder:text-muted-foreground/75 focus-visible:border-primary focus-visible:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/15 h-9 w-full min-w-0 rounded-md border px-3 text-sm tabular-nums shadow-xs transition-[color,border-color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
}
