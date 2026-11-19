import { cn } from "@/lib/utils";

/*
 * 녹음 조작(구술 녹음 막대·대화 녹음)과 바 위 시트가 함께 쓰는 작은 조각.
 */

/** 저장 버튼 바 위 시트의 id. 녹음 막대·대화 녹음 표시가 접고 펴는 대상(aria-controls)이다. */
export const DICTATION_SHEET_ID = "dictation-sheet";

/** 입력 크기 막대(0~1). 말할 때 움직이면 마이크가 소리를 받고 있다. 폭 대신 transform 으로 늘린다. */
export function LevelMeter({ level }: { level: number }) {
  return (
    <span
      className="bg-destructive-soft block h-1.5 overflow-hidden rounded-full"
      aria-hidden
    >
      <span
        className="bg-destructive block h-full origin-left rounded-full transition-transform duration-100"
        style={{ transform: `scaleX(${level})` }}
      />
    </span>
  );
}

/** 녹음 중 표시 점(녹음 중이면 깜박이는 빨간 점, 멈추면 회색). */
export function RecordingDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "size-3 shrink-0 rounded-full",
        active ? "bg-destructive animate-pulse" : "bg-muted-foreground",
      )}
    />
  );
}
