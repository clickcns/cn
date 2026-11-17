import { smsUrl, type VisitRecipient } from "@repo/shared-types";
import { MessageSquareText } from "lucide-react";
import { useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * 보호자에게 보낼 문자 본문: 받는 사람, 고칠 수 있는 문구, [문구 복사]와 휴대폰이면 [문자 앱 열기].
 * 문구는 부르는 쪽이 들고 있다(방문 안내·늦음 안내가 함께 쓴다). children은 문구 위(늦음 고르기 등).
 */
export function SmsNoticeBody({
  recipient,
  text,
  onTextChange,
  copyLabel,
  children,
}: {
  recipient: Pick<VisitRecipient, "guardianName" | "guardianPhone">;
  text: string;
  onTextChange: (text: string) => void;
  /** 화면 읽기 이름: "{copyLabel} 복사" */
  copyLabel: string;
  children?: ReactNode;
}) {
  const textId = useId();
  const isTouch = useMediaQuery("(pointer: coarse)");
  const { guardianName, guardianPhone: phone } = recipient;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        <span className="text-muted-foreground font-semibold">받는 사람 </span>
        {phone ? (
          <span className="tabular-nums">
            {guardianName && `${guardianName} · `}
            {phone}
          </span>
        ) : (
          "등록된 보호자 번호 없음"
        )}
      </p>
      {children}
      <div className="flex flex-col gap-2">
        <label htmlFor={textId} className="text-sm font-semibold">
          문구
        </label>
        <Textarea
          id={textId}
          rows={5}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <CopyButton text={text} label={copyLabel} idleText="문구 복사" />
        {isTouch && phone && (
          <Button asChild size="sm">
            <a href={smsUrl(phone, text)}>
              <MessageSquareText />
              문자 앱 열기
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
