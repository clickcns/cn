import type { ReactNode } from "react";
import { CircleCheckBig, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RecordActionBarProps {
  isDirty: boolean;
  isPending: boolean;
  onSave: () => void;
  onConfirm: () => void;
  /** 저장 버튼 앞의 녹음 조작(어디서나 녹음) */
  dictation: ReactNode;
  /** 바 위로 올라오는 녹음 시트(말할 내용·처리 중·보내기 실패). 내용이 없으면 그리지 않는다 */
  dictationSheet: ReactNode;
  /** 녹음 중이면 바 전체를 녹음 조작에 내준다 */
  dictationActive: boolean;
}

/**
 * 기록 저장 버튼 바. 앞에 녹음 조작이 있고, 녹음할 때는 바 위로 시트가 올라온다.
 * 바탕은 불투명하고 화면 아래 끝에 붙어, 스크롤하는 서식이 바 아래나 바 너머로 비치지 않는다.
 * - 좁은 화면: 하단 탭 바 바로 위에 고정
 * - 넓은 화면: 서식 칸 아래 끝에 붙어 따라오는 막대(위만 둥글게, 오른쪽 정렬). 본문 아래 여백(pb-bottom-stack 의
 *   2rem)만큼 아래로 내려 페이지 끝에서도 화면 아래에 붙는다.
 */
export function RecordActionBar({
  isDirty,
  isPending,
  onSave,
  onConfirm,
  dictation,
  dictationSheet,
  dictationActive,
}: RecordActionBarProps) {
  return (
    <div
      data-slot="action-bar"
      // 녹음 시트가 올라오면 좁은 화면에서도 위가 둥근 시트처럼 보이게 한다.
      className="bottom-above-tab-bar border-border bg-card fixed inset-x-0 z-30 border-t px-4 py-3 has-[[data-slot=dictation-sheet]]:rounded-t-2xl has-[[data-slot=dictation-sheet]]:pt-4 has-[[data-slot=dictation-sheet]]:shadow-[0_-8px_24px_rgb(0_0_0/0.08)] md:sticky md:bottom-0 md:mt-2 md:-mb-8 md:rounded-t-2xl md:border md:border-b-0 md:px-5 md:shadow-[0_-8px_24px_rgb(0_0_0/0.08)]"
    >
      <div className="mx-auto max-w-[640px] md:max-w-none">
        {dictationSheet}
        <div className="flex items-center gap-3">
          {dictation}
          {!dictationActive && (
            <>
              <p
                className="text-muted-foreground hidden flex-1 md:block"
                aria-live="polite"
              >
                {isDirty
                  ? "저장하지 않은 변경 사항이 있습니다"
                  : "변경 사항 없음"}
              </p>
              <Button
                variant="outline"
                className="flex-1 md:min-w-36 md:flex-none"
                onClick={onSave}
                disabled={isPending}
              >
                <Save />
                임시 저장
                {isDirty && (
                  <span
                    className="bg-warning size-2.5 rounded-full md:hidden"
                    aria-label="저장하지 않은 변경 있음"
                  />
                )}
              </Button>
              <Button
                className="flex-1 md:min-w-36 md:flex-none"
                onClick={onConfirm}
                disabled={isPending}
              >
                <CircleCheckBig />
                확정
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
