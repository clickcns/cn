import type { Blocker } from "react-router";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** 저장하지 않은 채 다른 화면으로 가려 할 때 묻는 창. */
export function UnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  return (
    <ConfirmDialog
      open={blocker.state === "blocked"}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
      onConfirm={() => blocker.proceed?.()}
      title="저장하지 않은 내용이 있습니다"
      description="이 화면을 나가면 입력한 내용이 사라집니다. 먼저 [임시 저장]을 눌러 주세요."
      cancelText="계속 작성"
      confirmText="나가기"
      variant="destructive"
    />
  );
}
