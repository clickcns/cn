import type * as React from "react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormDialogFooter } from "@/components/ui/form-dialog-footer";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  /** 설명 아래에 덧붙일 내용(대상 요약 등). */
  children?: React.ReactNode;
  confirmText?: string;
  destructive?: boolean;
  isPending?: boolean;
  /** 창을 연 요소가 사라졌을 때 닫은 뒤 포커스를 둘 곳(DialogContent의 returnFocus). */
  returnFocus?: () => HTMLElement | null;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  children,
  confirmText = "확인",
  destructive = false,
  isPending = false,
  returnFocus,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent size="sm" returnFocus={returnFocus}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children ? (
          <DialogBody>{children}</DialogBody>
        ) : (
          <div className="h-5" />
        )}
        <FormDialogFooter
          submitText={confirmText}
          onCancel={() => onOpenChange(false)}
          onSubmit={onConfirm}
          destructive={destructive}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
