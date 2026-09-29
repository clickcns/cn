import { useState } from "react";
import { getErrorMessage } from "@repo/api-client";
import type { VisitDetail } from "@repo/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteVisit } from "@/features/visits/hooks/use-visit-mutations";
import { formatDateTimeLabel } from "@/lib/date";
import { visitKeys } from "@/lib/query-keys";

/**
 * 예정 방문 삭제(기록을 저장하기 전까지). 지운 뒤의 이동은 onDeleted가 한다.
 */
export function DeleteVisitButton({
  visit,
  onDeleted,
}: {
  visit: VisitDetail;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const deleteVisit = useDeleteVisit(visit.id);

  const handleConfirm = () => {
    deleteVisit.mutate(undefined, {
      onSuccess: () => {
        setOpen(false);
        toast.success("방문을 삭제했습니다");
        onDeleted();
      },
      onError: (error) => {
        // 그사이 기록이 저장됐을 수 있다(409). 최신 상태를 다시 불러온다.
        setOpen(false);
        toast.error(getErrorMessage(error, "방문을 삭제하지 못했습니다"));
        void queryClient.invalidateQueries({
          queryKey: visitKeys.detail(visit.id),
        });
      },
    });
  };

  return (
    <>
      <Button
        variant="destructive-outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Trash2 />
        방문 삭제
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        onConfirm={handleConfirm}
        isPending={deleteVisit.isPending}
        title="이 방문을 삭제할까요?"
        description={`${formatDateTimeLabel(visit.scheduledAt)} ${visit.recipient.name} 님 방문을 삭제합니다. 되돌릴 수 없고, 녹음한 구술이 있으면 함께 지워집니다.`}
        confirmText="삭제"
        variant="destructive"
      />
    </>
  );
}
