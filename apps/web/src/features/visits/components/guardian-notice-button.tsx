import {
  formatKstDate,
  guardianNoticeText,
  smsUrl,
  type VisitDetail,
} from "@repo/shared-types";
import { MessageSquareText } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";

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
        {open && <GuardianNoticeBody visit={visit} />}
      </DialogContent>
    </Dialog>
  );
}

function GuardianNoticeBody({ visit }: { visit: VisitDetail }) {
  const textId = useId();
  const isTouch = useMediaQuery("(pointer: coarse)");
  const { recipient } = visit;
  const [text, setText] = useState(() =>
    guardianNoticeText(
      {
        scheduledAt: visit.scheduledAt,
        recipientName: recipient.name,
        profession: visit.profession,
        staffName: visit.staff.name,
        organizationName: visit.organization.name,
      },
      formatKstDate(),
    ),
  );
  const phone = recipient.guardianPhone;

  return (
    <>
      <DialogHeader>
        <DialogTitle>보호자 방문 안내</DialogTitle>
        <DialogDescription>
          문자는 내 휴대폰 문자 앱으로 보냅니다. 케어노트는 문자를 보내지
          않습니다.
        </DialogDescription>
      </DialogHeader>
      <p className="text-sm">
        <span className="text-muted-foreground font-semibold">받는 사람 </span>
        {phone ? (
          <span className="tabular-nums">
            {recipient.guardianName && `${recipient.guardianName} · `}
            {phone}
          </span>
        ) : (
          "등록된 보호자 번호 없음"
        )}
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor={textId} className="text-sm font-semibold">
          문구
        </label>
        <Textarea
          id={textId}
          rows={5}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label="방문 안내 문구" idleText="문구 복사" />
        {isTouch && phone && (
          <Button asChild size="sm">
            <a href={smsUrl(phone, text)}>
              <MessageSquareText />
              문자 앱 열기
            </a>
          </Button>
        )}
      </div>
    </>
  );
}
