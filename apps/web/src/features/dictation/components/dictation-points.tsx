import { useId } from "react";
import type { VisitDictationPoint } from "@repo/shared-types";
import { Badge } from "@/components/ui/badge";

/**
 * 녹음 중 안내(저장 버튼 바 위 시트): 이 방문(사업 × 직종)에서 말할 내용의 핵심만 짚는다.
 * 문장을 따라 읽게 하지 않고, 무엇을 말하면 되는지만 보여 준다.
 */
export function DictationPoints({
  points,
}: {
  points: readonly VisitDictationPoint[];
}) {
  const titleId = useId();
  if (points.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="flex flex-col">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 id={titleId} className="font-bold">
          말할 내용
        </h3>
        <p className="text-muted-foreground text-sm">
          순서는 자유롭게, 오늘 한 것만
        </p>
      </div>
      <ul className="border-border divide-border divide-y rounded-xl border">
        {points.map((point) => (
          <li
            key={point.topic}
            className="flex flex-col px-4 py-2.5 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <p className="flex shrink-0 items-center gap-2 font-semibold sm:w-44">
              {point.topic}
              {point.required && (
                <Badge variant="warning" size="sm">
                  필수
                </Badge>
              )}
            </p>
            <p className="text-muted-foreground text-sm">{point.hint}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
