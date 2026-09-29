import type { VisitSummary } from "@repo/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVisitListHref } from "@/features/visits/hooks/use-visit-list-href";
import { useDeleteVisit } from "@/features/visits/hooks/use-visits";
import { formatDateTime } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

export type DeletableVisit = Pick<VisitSummary, "id" | "scheduledAt"> & {
  recipient: { name: string };
  staff: { name: string };
};

/**
 * 예정 상태의 방문 삭제. 삭제되면 목록으로 돌아간다.
 * onDeleted를 주면 이동하지 않고 그 함수를 부른다(달력의 빠른 보기 창).
 */
export function DeleteVisitButton({
  visit,
  onDeleted,
  size,
}: {
  visit: DeletableVisit;
  onDeleted?: () => void;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const listHref = useVisitListHref();

  return (
    <>
      <Button
        variant="destructive-outline"
        size={size}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
        방문 삭제
      </Button>
      <DeleteVisitDialog
        visit={visit}
        open={open}
        onOpenChange={setOpen}
        onDeleted={onDeleted ?? (() => navigate(listHref, { replace: true }))}
      />
    </>
  );
}

/** 예정 방문 삭제 확인 창. 삭제되면 창을 닫고 onDeleted를 부른다(달력 우클릭 메뉴도 쓴다). */
export function DeleteVisitDialog({
  visit,
  open,
  onOpenChange,
  onDeleted,
  returnFocus,
}: {
  visit: DeletableVisit;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const queryClient = useQueryClient();
  const deleteVisit = useDeleteVisit();

  const onConfirm = () => {
    deleteVisit.mutate(visit.id, {
      onSuccess: () => {
        onOpenChange(false);
        onDeleted?.();
        queryClient.removeQueries({
          queryKey: queryKeys.visits.detail(visit.id),
        });
      },
      onError: () => {
        // 그사이 담당자가 기록을 시작했을 수 있다(409). 최신 상태를 다시 불러온다.
        onOpenChange(false);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.visits.detail(visit.id),
        });
      },
    });
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title="이 방문을 삭제할까요?"
      description="삭제한 방문은 되돌릴 수 없습니다. 현장 웹의 일정에서도 사라집니다."
      confirmText="삭제"
      destructive
      isPending={deleteVisit.isPending}
      returnFocus={returnFocus}
    >
      <div className="bg-muted/70 rounded-md px-3.5 py-3 text-sm">
        <p className="font-medium">{visit.recipient.name}</p>
        <p className="text-muted-foreground mt-0.5 tabular-nums">
          {formatDateTime(visit.scheduledAt)} · {visit.staff.name}
        </p>
      </div>
    </ConfirmDialog>
  );
}
