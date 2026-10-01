import type { PastFieldValue } from "@repo/shared-types";
import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateLabel } from "@/lib/date";

/** 지난 값과 달라진 칸의 표시. */
export function PastChangedBadge() {
  return (
    <Badge variant="warning" size="sm">
      바뀜
    </Badge>
  );
}

/**
 * 지난 값과 달라진 칸 아래의 지난 값 한 줄: "지난 값 · 9월 22일 (화): 유". onRestore 가 있으면
 * [되돌리기](지난 값으로)를 붙인다(방문마다 새로 재는 칸은 없음).
 */
export function PastDiffLine({
  label,
  text,
  past,
  onRestore,
}: {
  label: string;
  text: string;
  past: Pick<PastFieldValue, "date" | "draft">;
  onRestore?: () => void;
}) {
  const source = `${formatDateLabel(past.date)}${past.draft ? " · 작성 중" : ""}`;
  return (
    <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
      <span>
        지난 값 · {source}:{" "}
        <span className="text-foreground font-semibold">{text}</span>
      </span>
      {onRestore && (
        <button
          type="button"
          onClick={onRestore}
          aria-label={`${label} 지난 값으로 되돌리기`}
          className="text-primary focus-visible:ring-ring/30 min-h-11 rounded-lg px-2 font-semibold outline-none hover:underline focus-visible:ring-4"
        >
          되돌리기
        </button>
      )}
    </p>
  );
}

/** 지난 기록에서 채운 칸의 표시: "지난 기록 · 9월 22일 (화)" */
export function PastFillBadge({ date }: { date: string }) {
  return (
    <Badge variant="primary" size="sm">
      <History />
      지난 기록 · {formatDateLabel(date)}
    </Badge>
  );
}

/**
 * 빈 칸 옆 지난 값. onFill 이 있으면 누르면 채우는 버튼, 없으면(방문마다 새로 재거나 정하는 칸) 참고 글만.
 * label 은 칸 이름(화면 읽기 프로그램에 알린다).
 */
export function PastValueHint({
  label,
  text,
  past,
  onFill,
}: {
  label: string;
  /** 보여 줄 지난 값 글(formatFieldValue) */
  text: string;
  past: Pick<PastFieldValue, "date" | "draft">;
  onFill?: () => void;
}) {
  const source = `${formatDateLabel(past.date)}${past.draft ? " · 작성 중" : ""}`;
  if (!onFill) {
    return (
      <p className="text-muted-foreground text-sm">
        지난 값 · {source}: {text}
      </p>
    );
  }
  return (
    <button
      type="button"
      onClick={onFill}
      aria-label={`${label} 지난 값 ${text}, ${source} 기록. 눌러서 채우기`}
      className="bg-primary-soft/60 text-primary hover:bg-primary-soft focus-visible:ring-ring/30 flex min-h-12 w-fit max-w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-sm outline-none focus-visible:ring-4"
    >
      <History className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0">
        <span className="font-semibold">지난 값 · {source}</span>
        <span className="text-foreground line-clamp-2">{text}</span>
      </span>
    </button>
  );
}
