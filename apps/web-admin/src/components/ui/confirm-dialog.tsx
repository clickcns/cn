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
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isPending && onOpenChange(next)}
    >
      <DialogContent size="sm">
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
