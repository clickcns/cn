import {
  GUARDIAN_SMS_NOTE,
  guardianNoticeAvailable,
  isIsoDate,
} from "@repo/shared-types";
import { ChevronDown, MessageSquareText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogPageContent,
  DialogPageHeader,
} from "@/components/ui/dialog";
import { EmptyState, PageError, PageLoading } from "@/components/ui/page-state";
import { GuardianNoticeText } from "@/features/visits/components/guardian-notice-button";

import { VisitDetailGate } from "@/features/visits/components/visit-detail-gate";
import { useDailyVisits } from "@/features/visits/hooks/use-visits";
import { useDialogParam } from "@/hooks/use-dialog-param";
import { useToday } from "@/hooks/use-now";
import { formatDateLabel, formatTimeLabel } from "@/lib/date";
import { cn } from "@/lib/utils";

const PARAM = "notices";

/** 그날 예정 방문의 보호자 안내 문자 창을 여는 버튼(주소 ?notices=날짜). */
export function GuardianNoticesButton({ date }: { date: string }) {
  const { open } = useDialogParam(PARAM);
  return (
    <Button type="button" size="sm" variant="soft" onClick={() => open(date)}>
      <MessageSquareText />
      보호자 안내 문자
    </Button>
  );
}

/**
 * 그날 예정 방문의 보호자 안내 문자 모아 보기. 방문 일정 화면에 한 번 두고 주소(?notices=날짜)로 연다 —
 * 휴대폰의 뒤로 가기가 창만 닫는다. 목록에는 시각·수급자 이름만 두고, 행을 펼칠 때 그 방문 상세를 받아
 * 보호자 번호와 문구를 보인다(방문 목록에는 보호자 정보가 없고, 본 방문만 접속기록에 남는다).
 */
export function GuardianNoticesDialog() {
  const { value, close } = useDialogParam(PARAM);
  const date = isIsoDate(value) ? value : null;
  return (
    <Dialog
      open={date !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {date && (
        <DialogPageContent>
          <DialogPageHeader
            title={`보호자 안내 문자 · ${formatDateLabel(date)}`}
            description={GUARDIAN_SMS_NOTE}
          />
          <DialogBody>
            <NoticeList date={date} />
          </DialogBody>
        </DialogPageContent>
      )}
    </Dialog>
  );
}

function NoticeList({ date }: { date: string }) {
  const today = useToday();
  const visitsQuery = useDailyVisits(date);
  const [openId, setOpenId] = useState<string | null>(null);
  if (visitsQuery.isPending) return <PageLoading />;
  if (visitsQuery.isError) {
    return (
      <PageError
        error={visitsQuery.error}
        fallback="방문 일정을 불러오지 못했습니다"
        onRetry={() => void visitsQuery.refetch()}
      />
    );
  }
  const visits = visitsQuery.data.items.filter((visit) =>
    guardianNoticeAvailable(visit, today),
  );
  if (visits.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquareText />}
        title="안내할 예정 방문이 없습니다"
        description="예정 상태이고 오늘 이후인 방문만 안내합니다."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {visits.map((visit) => {
        const open = openId === visit.id;
        const bodyId = `notice-${visit.id}`;
        return (
          <li
            key={visit.id}
            className={cn(
              "border-border rounded-2xl border",
              open && "border-primary/40",
            )}
          >
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpenId(open ? null : visit.id)}
              className="focus-visible:ring-ring/30 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left outline-none focus-visible:ring-4"
            >
              <span className="text-primary text-lg font-bold tabular-nums">
                {formatTimeLabel(visit.scheduledAt)}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {visit.recipient.name}
              </span>
              <span className="text-muted-foreground text-sm">
                {open ? "접기" : "문구 보기"}
              </span>
              <ChevronDown
                className={cn(
                  "text-muted-foreground size-5 transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </button>
            {open && (
              <div id={bodyId} className="border-t px-4 py-4">
                <VisitDetailGate visitId={visit.id}>
                  {(detail) => <GuardianNoticeText visit={detail} />}
                </VisitDetailGate>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
