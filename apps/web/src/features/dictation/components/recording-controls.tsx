import { DICTATION_MAX_SECONDS } from "@repo/shared-types";
import { CircleAlert, LoaderCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DictationSession } from "@/features/dictation/hooks/use-dictation-session";
import { cn } from "@/lib/utils";

/** 녹음 경과 시간(초) → "1:05" */
const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** 입력 크기 막대(0~1). 말할 때 움직이면 마이크가 소리를 받고 있다. 폭 대신 transform 으로 늘린다. */
function LevelMeter({
  level,
  className,
}: {
  level: number;
  className?: string;
}) {
  return (
    <span
      className={cn("block overflow-hidden rounded-full", className)}
      aria-hidden
    >
      <span
        className="bg-destructive block h-full origin-left rounded-full transition-transform duration-100"
        style={{ transform: `scaleX(${level})` }}
      />
    </span>
  );
}

function RecordingDot() {
  return (
    <span className="bg-destructive size-3 shrink-0 animate-pulse rounded-full" />
  );
}

/** 패널의 녹음 중 표시: 경과 시간, 입력 크기, 끝내기·취소. */
export function RecordingControls({
  seconds,
  level,
  onStop,
  onCancel,
}: {
  seconds: number;
  level: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="border-destructive/30 bg-destructive-soft flex flex-col gap-4 rounded-xl border p-4">
      <div className="flex items-center gap-3" aria-live="polite">
        <RecordingDot />
        <span className="text-destructive font-bold">녹음 중</span>
        <span className="ml-auto text-2xl font-bold tabular-nums">
          {formatClock(seconds)}
          <span className="text-muted-foreground text-base font-normal">
            {" "}
            / {formatClock(DICTATION_MAX_SECONDS)}
          </span>
        </span>
      </div>
      <LevelMeter level={level} className="bg-card h-2.5" />
      <div className="flex gap-3">
        <Button size="lg" className="flex-1" onClick={onStop}>
          <Square />
          녹음 끝내기
        </Button>
        <Button size="lg" variant="outline" onClick={onCancel}>
          취소
        </Button>
      </div>
    </div>
  );
}

/**
 * 저장 버튼 바의 녹음 조작(서식을 채우며 아래로 내려가도 늘 보인다). 평소에는 [녹음] 버튼,
 * 녹음 중에는 바 전체가 녹음 막대(경과 시간·입력 크기·끝내기·취소)가 된다. 처리 중·보내기 실패는
 * 누르면 위 패널로 올라간다.
 */
export function DictationBarControl({
  session,
}: {
  session: DictationSession;
}) {
  const { recorder } = session;
  if (session.isRecording) {
    return (
      <div className="flex flex-1 items-center gap-3" aria-live="polite">
        <RecordingDot />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-bold whitespace-nowrap tabular-nums">
            <span className="text-destructive">녹음 중</span>{" "}
            {formatClock(recorder.seconds)}
          </span>
          <LevelMeter
            level={recorder.level}
            className="bg-destructive-soft h-1.5"
          />
        </div>
        <Button onClick={recorder.stop}>
          <Square />
          끝내기
        </Button>
        <Button variant="ghost" onClick={recorder.cancel}>
          취소
        </Button>
      </div>
    );
  }
  if (session.isProcessing) {
    return (
      <Button variant="soft" className="px-4" onClick={session.showPanel}>
        <LoaderCircle className="animate-spin" />
        <span className="hidden md:inline">초안 만드는 중</span>
      </Button>
    );
  }
  if (session.failed) {
    return (
      <Button
        variant="destructive-outline"
        className="px-4"
        onClick={session.showPanel}
        aria-label="녹음을 보내지 못했습니다. 눌러서 확인"
      >
        <CircleAlert />
        <span className="hidden md:inline">보내지 못함</span>
      </Button>
    );
  }
  return (
    <Button
      variant="soft"
      className="px-4"
      onClick={() => session.start("bar")}
      disabled={session.isBusy}
      aria-label={session.dictation ? "이어서 말하기" : "녹음"}
    >
      <Mic />
      <span className="md:hidden">녹음</span>
      <span className="hidden md:inline">
        {session.dictation ? "이어서 말하기" : "녹음"}
      </span>
    </Button>
  );
}
