import type { ComponentProps } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer focus-visible:ring-ring/30 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-7 rounded-full bg-white shadow-md transition-transform data-[state=checked]:translate-x-6 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  );
}
