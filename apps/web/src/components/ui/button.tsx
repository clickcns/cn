import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";

// 모든 크기가 48px 이상이다(큰 터치 영역).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-transparent font-semibold whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        soft: "bg-primary-soft text-primary hover:bg-primary-soft/70 active:bg-primary-soft/60",
        outline:
          "border-input bg-card text-foreground hover:bg-muted active:bg-muted",
        ghost: "text-foreground hover:bg-muted active:bg-muted",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/80",
        "destructive-outline":
          "border-destructive/40 bg-card text-destructive hover:bg-destructive-soft active:bg-destructive-soft",
      },
      size: {
        default: "h-13 px-5 text-base",
        sm: "h-12 px-4 text-base",
        lg: "h-14 px-6 text-lg",
        icon: "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      // 폼 안에서 의도치 않게 제출되지 않도록 기본값을 button으로 둔다.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
