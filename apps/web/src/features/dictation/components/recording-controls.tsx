import { DICTATION_MAX_SECONDS } from "@repo/shared-types";
import { CircleAlert, LoaderCircle, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DictationSession } from "@/features/dictation/hooks/use-dictation-session";
import { cn } from "@/lib/utils";

/** 녹음 경과 시간(초) → "1:05" */
const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** 저장 버튼 바의 입력 크기 막대(0~1). 말할 때 움직이면 마이크가 소리를 받고 있다. 폭 대신 transform 으로 늘린다. */
function LevelMeter({ level }: { level: number }) {
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

/** 자동으로 끝나기 전 이만큼(초) 남으면 알린다. */
const ENDING_SOON_SECONDS = 30;

/** 녹음 중 안내 한 줄. 초마다 바뀌지 않아 화면 읽기 프로그램이 상태가 바뀔 때만 읽는다. */
function recordingStatus(starting: boolean, endingSoon: boolean): string {
  if (starting) return "마이크를 켜는 중입니다";
  if (endingSoon) return `${ENDING_SOON_SECONDS}초 안에 녹음이 저절로 끝납니다`;
  return `녹음 중 · 최대 ${formatClock(DICTATION_MAX_SECONDS)}`;
}

/**
 * 패널의 녹음 중 표시: 마이크 원(둘레가 입력 크기만큼 커진다), 경과 시간, 끝내기·취소.
 * 마이크 권한을 묻는 동안(starting)은 준비 중이라고 보여 준다.
 */
export function RecordingControls({
  recorder,
}: {
  recorder: DictationSession["recorder"];
}) {
  const { status, seconds, level } = recorder;
  const starting = status === "starting";
  // 시작하는 동안 seconds 는 이전 녹음 값이 남아 있을 수 있다.
  const endingSoon =
    !starting && DICTATION_MAX_SECONDS - seconds <= ENDING_SOON_SECONDS;

  return (
    <div className="border-destructive/20 bg-destructive-soft/50 flex flex-col items-center gap-5 rounded-2xl border px-4 pt-7 pb-4">
      <div className="relative flex size-18 items-center justify-center">
        {/* 말할 때 둘레가 움직이면 마이크가 소리를 받고 있다. 크기 대신 transform 으로 키운다. */}
        <span
          aria-hidden
          className="bg-destructive/15 absolute inset-0 rounded-full transition-transform duration-100"
          style={{ transform: `scale(${1 + level * 0.6})` }}
        />
        <span className="bg-destructive text-destructive-foreground relative flex size-full items-center justify-center rounded-full shadow-sm">
          <Mic className="size-8" />
        </span>
      </div>
      <div className="text-center">
        <p className="text-4xl leading-none font-bold tabular-nums">
          {formatClock(seconds)}
        </p>
        <p
          aria-live="polite"
          className={cn(
            "mt-2 text-sm",
            endingSoon
              ? "text-destructive font-semibold"
              : "text-muted-foreground",
          )}
        >
          {recordingStatus(starting, endingSoon)}
        </p>
      </div>
      <div className="flex w-full gap-3">
        <Button size="lg" className="flex-1" onClick={recorder.stop}>
          <Square />
          녹음 끝내기
        </Button>
        <Button size="lg" variant="outline" onClick={recorder.cancel}>
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
        <span className="bg-destructive size-3 shrink-0 animate-pulse rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="font-bold whitespace-nowrap tabular-nums">
            <span className="text-destructive">녹음 중</span>{" "}
            {formatClock(recorder.seconds)}
          </span>
          <LevelMeter level={recorder.level} />
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
