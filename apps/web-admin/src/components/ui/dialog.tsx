import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef } from "react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function Dialog(
  props: React.ComponentProps<typeof DialogPrimitive.Root>,
) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>,
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

export function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>,
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
  /** 서식 전체를 보여 줄 때(확정본 보기) */
  xl: "max-w-3xl",
} as const;

export function DialogContent({
  className,
  children,
  size = "md",
  returnFocus,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  size?: keyof typeof SIZE_CLASSES;
  /**
   * 닫은 뒤 창을 연 요소가 사라졌으면(우클릭 메뉴 항목, 다시 그려진 칩 등) 포커스를 둘 곳.
   * 없으면 Radix 기본 동작(Dialog.Trigger로)을 따른다.
   */
  returnFocus?: () => HTMLElement | null;
}) {
  // 창을 연 요소. Dialog.Trigger 없이 연 창도(Radix는 Trigger로만 돌려준다) 닫으면 이리로 돌아간다.
  const opener = useRef<Element | null>(null);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-[#15202a]/40"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-card text-card-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border shadow-xl duration-150 outline-none",
          SIZE_CLASSES[size],
          className,
        )}
        onOpenAutoFocus={(event) => {
          // 이때는 아직 포커스가 창을 연 요소에 있다.
          opener.current = document.activeElement;
          onOpenAutoFocus?.(event);
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const element = opener.current;
          opener.current = null;
          const target =
            element instanceof HTMLElement && element.isConnected
              ? element
              : returnFocus?.();
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/25 absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-3"
          aria-label="닫기"
        >
          <XIcon className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 px-6 pt-6 pr-14",
        className,
      )}
      {...props}
    />
  );
}

/** 헤더와 푸터 사이의 스크롤 영역. 긴 폼도 창 높이를 넘지 않는다. */
export function DialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-5", className)}
      {...props}
    />
  );
}

export function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "bg-muted/40 flex shrink-0 items-center justify-end gap-2 border-t px-6 py-4",
        className,
      )}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-snug font-semibold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
