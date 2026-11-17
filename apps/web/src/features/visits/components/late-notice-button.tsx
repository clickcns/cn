import {
  GUARDIAN_SMS_NOTE,
  guardianLateNoticeText,
  guardianNoticeVisitOf,
  lateMinuteChoices,
  type PlannedVisit,
  type VisitDetail,
} from "@repo/shared-types";
import { Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RadioChips } from "@/components/ui/choice-chips";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SmsNoticeBody } from "@/features/visits/components/sms-notice-body";
import { VisitDetailGate } from "@/features/visits/components/visit-detail-gate";

/**
 * 다음 방문에 늦을 것 같을 때 그 수급자의 보호자에게 보낼 문구. 늦음(분)을 고르면 문구를 새로 만든다.
 * 보호자 번호는 창을 연 뒤 그 방문 상세에서 받는다(방문 목록에는 보호자 정보가 없다).
 * 동선의 여유가 빠듯하거나 늦을 수 있으면(status) 버튼을 눈에 띄게 한다.
 */
export function LateNoticeButton({
  entry,
}: {
  /** 다음 방문의 동선(planDay) — 여유를 모르면 slack·status가 null */
  entry: Pick<PlannedVisit<{ id: string }>, "visit" | "slack" | "status">;
}) {
  const [open, setOpen] = useState(false);
  const { slack, status } = entry;
  const visitId = entry.visit.id;
  const emphasized = status === "TIGHT" || status === "LATE";
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        variant={emphasized ? "soft" : "ghost"}
        onClick={() => setOpen(true)}
      >
        <Clock />
        늦음 안내
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>보호자 늦음 안내</DialogTitle>
          <DialogDescription>{GUARDIAN_SMS_NOTE}</DialogDescription>
        </DialogHeader>
        {/* 창이 열린 채 다음 방문이 바뀌면 문구·선택을 새 방문으로 새로 만든다(이전 수급자 문구가 남지 않게) */}
        {open && (
          <VisitDetailGate key={visitId} visitId={visitId}>
            {(visit) => <LateNoticeText visit={visit} slack={slack} />}
          </VisitDetailGate>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LateNoticeText({
  visit,
  slack,
}: {
  visit: VisitDetail;
  slack: number | null;
}) {
  // 창을 연 때의 여유로 한 번만 정한다(1분마다 바뀌어 고른 값이 선택지에서 빠지지 않게)
  const [{ choices, suggested }] = useState(() => lateMinuteChoices(slack));
  const [late, setLate] = useState(suggested);
  const [text, setText] = useState(() =>
    guardianLateNoticeText(guardianNoticeVisitOf(visit), suggested),
  );
  const choose = (minutes: number) => {
    setLate(minutes);
    setText(guardianLateNoticeText(guardianNoticeVisitOf(visit), minutes));
  };

  return (
    <SmsNoticeBody
      recipient={visit.recipient}
      text={text}
      onTextChange={setText}
      copyLabel="늦음 안내 문구"
    >
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">
          {visit.recipient.name} 님 방문을 얼마나 늦을까요?
        </p>
        <RadioChips
          label="늦음"
          options={choices.map((minutes) => ({
            value: String(minutes),
            label: `${minutes}분`,
          }))}
          value={String(late)}
          onChange={(value) => value && choose(Number(value))}
        />
        <p className="text-muted-foreground text-sm">
          고르면 문구를 새로 만듭니다. 이동 시간은 따로 계산하지 않습니다.
        </p>
      </div>
    </SmsNoticeBody>
  );
}
