import { getErrorStatus } from "@repo/api-client";
import {
  canDeleteVisit,
  canRescheduleVisit,
  formLabel,
  PROGRAM_LABELS,
  staffDisplayName,
} from "@repo/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  ExternalLinkIcon,
  FilterIcon,
  LockIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import {
  DescriptionList,
  type DescriptionItem,
} from "@/components/ui/description-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteVisitButton } from "@/features/visits/components/delete-visit-button";
import { VisitEditForm } from "@/features/visits/components/visit-edit-form";
import { VisitStatusBadge } from "@/features/visits/components/visit-status-badge";
import type { VisitListLinkState } from "@/features/visits/hooks/use-visit-list-href";
import { useVisit } from "@/features/visits/hooks/use-visits";
import type { QuickViewVisit } from "@/features/visits/lib/calendar-items";
import { findChip, findSelectedCell } from "@/features/visits/lib/calendar-dom";
import {
  formatCareGrade,
  formatDateTime,
  formatVisitTimeRange,
  orDash,
} from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import { ROUTES } from "@/lib/routes";

interface VisitQuickViewDialogProps {
  /** 연 방문. null이면 닫혀 있다. */
  visit: QuickViewVisit | null;
  /** 처음 보여 줄 화면. "edit"이면 일정·담당자 변경을 바로 연다(우클릭 메뉴). */
  mode?: "view" | "edit";
  onClose: () => void;
  /** 달력을 이 수급자 방문만 보게 한다. */
  onFilterRecipient?: (recipientId: string) => void;
  organizationNames?: Map<string, string>;
}

/**
 * 달력·표에서 방문을 누르면 여는 빠른 보기 창. 달력을 떠나지 않고
 * 요약을 보고 일정·담당자 변경, 삭제, 상세 기록 보기를 한다.
 */
export function VisitQuickViewDialog({
  visit,
  mode = "view",
  onClose,
  onFilterRecipient,
  organizationNames,
}: VisitQuickViewDialogProps) {
  // 닫을 때 창을 연 칩이 사라졌으면(일정을 옮겨 다시 그려짐·삭제) 이 방문의 칩, 그것도 없으면 고른 날 칸으로 간다.
  const openedVisitId = useRef<string | null>(null);
  return (
    <Dialog
      open={visit !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        size="lg"
        onOpenAutoFocus={() => {
          openedVisitId.current = visit?.id ?? null;
        }}
        returnFocus={() =>
          (openedVisitId.current && findChip(openedVisitId.current)) ||
          findSelectedCell()
        }
      >
        {visit && (
          <QuickViewContent
            key={`${visit.id}:${mode}`}
            initial={visit}
            initialMode={mode}
            onClose={onClose}
            onFilterRecipient={onFilterRecipient}
            organizationNames={organizationNames}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function QuickViewContent({
  initial,
  initialMode,
  onClose,
  onFilterRecipient,
  organizationNames,
}: {
  initial: QuickViewVisit;
  initialMode: "view" | "edit";
  onClose: () => void;
  onFilterRecipient?: (recipientId: string) => void;
  organizationNames?: Map<string, string>;
}) {
  const [mode, setMode] = useState(initialMode);
  const location = useLocation();
  const queryClient = useQueryClient();
  // 달력 항목으로 바로 그리고, 최신 상세(주소·실제 방문 시각 등)가 오면 바꿔 그린다.
  const detailQuery = useVisit(initial.id);
  const detail = detailQuery.data;
  const visit: QuickViewVisit = detail ?? initial;
  const notFound =
    detailQuery.isError && getErrorStatus(detailQuery.error) === 404;

  // 그사이 지워졌으면 달력·목록을 다시 받는다.
  useEffect(() => {
    if (notFound) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.visits.lists });
    }
  }, [notFound, queryClient]);

  if (mode === "edit") {
    // 변경 화면으로 바로 열었으면 끝내거나 취소할 때 창을 닫는다.
    const leave = initialMode === "edit" ? onClose : () => setMode("view");
    return <VisitEditForm visit={visit} onDone={leave} onCancel={leave} />;
  }

  const linkState: VisitListLinkState = { listSearch: location.search };
  const organizationName = organizationNames?.get(visit.organizationId);
  const items: DescriptionItem[] = [
    { label: "방문 예정 일시", value: formatDateTime(visit.scheduledAt) },
    { label: "상태", value: <VisitStatusBadge status={visit.status} /> },
    { label: "사업", value: PROGRAM_LABELS[visit.program] },
    {
      label: "담당자",
      value: staffDisplayName(visit.staff),
    },
    {
      label: "작성 서식",
      value: visit.formIds.map(formLabel).join(", "),
      wide: true,
    },
    {
      label: "수급자",
      value: `${visit.recipient.name} · ${formatCareGrade(visit.recipient.careGrade)}`,
    },
    ...(organizationName ? [{ label: "기관", value: organizationName }] : []),
    ...(detail
      ? [
          { label: "연락처", value: orDash(detail.recipient.phone) },
          {
            label: "실제 방문 시각",
            value: detail.startedAt
              ? formatVisitTimeRange(
                  detail.scheduledAt,
                  detail.startedAt,
                  detail.endedAt,
                )
              : "기록 전",
          },
          {
            label: "주소",
            value: orDash(detail.recipient.address),
            wide: true,
          },
          ...(detail.confirmedAt
            ? [
                {
                  label: "확정 일시",
                  value: formatDateTime(detail.confirmedAt),
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{visit.recipient.name} 방문</DialogTitle>
        <DialogDescription>
          {formatDateTime(visit.scheduledAt)} · {PROGRAM_LABELS[visit.program]}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        {notFound ? (
          <p role="alert" className="text-destructive text-sm">
            이 방문을 찾을 수 없습니다. 그사이 삭제됐을 수 있습니다.
          </p>
        ) : (
          <>
            <DescriptionList items={items} columns={2} />
            {!canRescheduleVisit(visit.status) && (
              <p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-md px-3 py-2 text-[13px]">
                <LockIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                확정된 방문은 일정을 바꿀 수 없습니다. 담당자가 현장 웹에서
                [수정]으로 되돌린 뒤 바꿀 수 있습니다.
              </p>
            )}
          </>
        )}
      </DialogBody>
      {!notFound && (
        <DialogFooter className="flex-wrap justify-between">
          <div className="flex flex-wrap gap-2">
            {onFilterRecipient && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onFilterRecipient(visit.recipient.id);
                  onClose();
                }}
              >
                <FilterIcon />이 수급자만 보기
              </Button>
            )}
            {canDeleteVisit(visit.status) && (
              <DeleteVisitButton visit={visit} size="sm" onDeleted={onClose} />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={ROUTES.visitDetail(visit.id)} state={linkState}>
                <ExternalLinkIcon />
                상세 기록 보기
              </Link>
            </Button>
            {canRescheduleVisit(visit.status) && (
              <Button size="sm" onClick={() => setMode("edit")}>
                <CalendarClockIcon />
                일정·담당자 변경
              </Button>
            )}
          </div>
        </DialogFooter>
      )}
    </>
  );
}
