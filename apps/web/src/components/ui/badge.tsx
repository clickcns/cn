import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full font-semibold whitespace-nowrap [&>svg]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary-soft text-primary",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        destructive: "bg-destructive-soft text-destructive",
        neutral: "bg-muted text-foreground",
        outline: "border border-border bg-card text-foreground",
      },
      size: {
        default: "h-8 px-3 text-sm",
        // 줄 안에 붙이는 작은 표시(예: "필수")
        sm: "h-6 px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  },
);

export type BadgeVariant = NonNullable<
  VariantProps<typeof badgeVariants>["variant"]
>;

export function Badge({
  className,
  variant,
  size,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}
