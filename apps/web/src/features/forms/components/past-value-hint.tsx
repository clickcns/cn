import type { PastFieldValue } from "@repo/shared-types";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateLabel } from "@/lib/date";

/**
 * 지난 값과 달라진 칸의 표시(방문마다 새로 정하는 칸에는 달지 않는다). 지난 값은 글로 늘어놓지 않고
 * 마우스를 올리면(화면 읽기 프로그램은 함께) 알려 준다.
 */
export function PastChangedBadge({ pastText }: { pastText: string }) {
  return (
    <Badge variant="warning" size="sm" title={`지난 기록: ${pastText}`}>
      바뀜
      <span className="sr-only">(지난 기록: {pastText})</span>
    </Badge>
  );
}

/**
 * 칸 이름 줄 오른쪽의 지난 값: "⟲ 78 회/분". 줄을 늘리지 않고 지금 값과 나란히 보게 한다
 * (고르는 칸은 칩 자체에 표시하므로 숫자 칸에 쓴다).
 */
export function PastInline({
  text,
  past,
}: {
  text: string;
  past: Pick<PastFieldValue, "date" | "draft">;
}) {
  const source = `${formatDateLabel(past.date)}${past.draft ? " · 작성 중" : ""}`;
  return (
    <span
      className="text-primary ml-auto inline-flex items-center gap-1 text-sm font-semibold tabular-nums"
      title={`지난 기록(${source})`}
    >
      <History className="size-4 shrink-0" aria-hidden />
      <span className="sr-only">지난 기록({source}) 값</span>
      {text}
    </span>
  );
}
