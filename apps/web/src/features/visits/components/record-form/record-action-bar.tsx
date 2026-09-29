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
  /** 녹음 중이면 바 전체를 녹음 조작에 내준다 */
  dictationActive: boolean;
}

/**
 * 기록 저장 버튼 바. 앞에 녹음 조작이 있다.
 * - 좁은 화면: 하단 탭 바 바로 위에 고정
 * - 넓은 화면: 폼 아래에 붙어 따라오는 막대(오른쪽 정렬)
 */
export function RecordActionBar({
  isDirty,
  isPending,
  onSave,
  onConfirm,
  dictation,
  dictationActive,
}: RecordActionBarProps) {
  return (
    <div
      data-slot="action-bar"
      className="bottom-above-tab-bar border-border bg-card/95 fixed inset-x-0 z-30 border-t px-4 py-3 backdrop-blur md:sticky md:bottom-4 md:mt-2 md:rounded-2xl md:border md:px-5 md:shadow-lg"
    >
      <div className="mx-auto flex max-w-[640px] items-center gap-3 md:max-w-none">
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
  );
}
