import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

type SelectProps = React.ComponentProps<"select"> & {
  /** 바깥 래퍼의 클래스. 너비는 여기에 준다. */
  containerClassName?: string;
};

/** 네이티브 select에 공통 스타일을 입힌 것. 키보드·스크린리더 동작은 브라우저 기본을 따른다. */
export function Select({
  className,
  containerClassName,
  children,
  ...props
}: SelectProps) {
  return (
    <div
      data-slot="select-container"
      className={cn("relative w-full", containerClassName)}
    >
      <select
        data-slot="select"
        className={cn(
          "border-input bg-card text-foreground focus-visible:border-primary focus-visible:ring-primary/15 disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/15 h-9 w-full min-w-0 appearance-none truncate rounded-md border pr-9 pl-3 text-sm shadow-xs transition-[color,border-color,box-shadow] outline-none focus-visible:ring-3 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
}
