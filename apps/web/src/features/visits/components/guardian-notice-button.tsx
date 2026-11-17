import {
  GUARDIAN_SMS_NOTE,
  guardianNoticeText,
  guardianNoticeVisitOf,
  type VisitDetail,
} from "@repo/shared-types";
import { MessageSquareText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SmsNoticeBody } from "@/features/visits/components/sms-notice-body";
import { useToday } from "@/hooks/use-now";

/**
 * 보호자 방문 안내 문자: 문구를 미리 채워 보여 주고(고칠 수 있음) 복사하거나, 휴대폰이면 문자 앱을 연다.
 * 보내기는 직원이 자기 휴대폰에서 한다(케어노트는 문자를 보내지 않는다).
 */
export function GuardianNoticeButton({ visit }: { visit: VisitDetail }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="soft"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <MessageSquareText />
        방문 안내 문자
      </Button>
      <DialogContent>
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>보호자 방문 안내</DialogTitle>
              <DialogDescription>{GUARDIAN_SMS_NOTE}</DialogDescription>
            </DialogHeader>
            <GuardianNoticeText visit={visit} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 방문 안내 문구 본문(받는 사람·문구·복사). 보호자 안내 모아 보기의 펼친 행도 쓴다. */
export function GuardianNoticeText({ visit }: { visit: VisitDetail }) {
  const today = useToday();
  const [text, setText] = useState(() =>
    guardianNoticeText(guardianNoticeVisitOf(visit), today),
  );
  return (
    <SmsNoticeBody
      recipient={visit.recipient}
      text={text}
      onTextChange={setText}
      copyLabel="방문 안내 문구"
    />
  );
}
