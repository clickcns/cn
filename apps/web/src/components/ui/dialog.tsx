import { useRef, type ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export function Dialog(props: ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

export function DialogClose(
  props: ComponentProps<typeof DialogPrimitive.Close>,
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

type ContentProps = ComponentProps<typeof DialogPrimitive.Content>;

/**
 * 닫으면 창을 연 요소로 포커스를 돌려준다. Radix 는 Dialog.Trigger 로만 돌려주므로 상태로 연 창(확인 창 등)은
 * 포커스를 잃는다. onCloseAutoFocus 에서 기본 동작을 막으면 그쪽이 포커스를 정한다(불러온 칸으로 가기 등).
 */
function useReturnFocus({
  onOpenAutoFocus,
  onCloseAutoFocus,
}: Pick<ContentProps, "onOpenAutoFocus" | "onCloseAutoFocus">) {
  const opener = useRef<Element | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      // 이때는 아직 포커스가 창을 연 요소에 있다.
      opener.current = document.activeElement;
      onOpenAutoFocus?.(event);
    },
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      const element = opener.current;
      opener.current = null;
      if (event.defaultPrevented) return;
      if (element instanceof HTMLElement && element.isConnected) {
        event.preventDefault();
        element.focus();
      }
    },
  };
}

function DialogOverlay() {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className="data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/40 duration-150"
    />
  );
}

export function DialogContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ContentProps) {
  const focus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-card text-card-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 rounded-2xl p-6 shadow-xl duration-150 outline-none",
          className,
        )}
        {...focus}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * 긴 내용을 보는 창(지난 기록 보기 등): 좁은 화면은 화면 전체, 넓은 화면은 가운데 큰 창.
 * 머리·DialogBody(스크롤)·바닥을 세로로 쌓는다.
 */
export function DialogPageContent({
  className,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ContentProps) {
  const focus = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-card text-card-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 flex flex-col overflow-hidden duration-150 outline-none md:inset-auto md:top-1/2 md:left-1/2 md:max-h-[calc(100dvh-3rem)] md:w-[calc(100%-2rem)] md:max-w-3xl md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:shadow-xl",
          className,
        )}
        {...focus}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/** DialogPageContent 의 머리와 바닥 사이 스크롤 영역. */
export function DialogBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6",
        className,
      )}
      {...props}
    />
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("grid grid-cols-2 gap-3", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-xl leading-snug font-bold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-base", className)}
      {...props}
    />
  );
}
