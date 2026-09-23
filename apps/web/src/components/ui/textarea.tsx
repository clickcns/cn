import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-card text-foreground placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-ring/15 aria-invalid:border-destructive field-sizing-content min-h-32 w-full resize-y rounded-xl border px-4 py-3 text-base leading-relaxed transition-colors outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
