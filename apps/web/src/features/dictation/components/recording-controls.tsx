import { DICTATION_MAX_SECONDS } from "@repo/shared-types";
import { ChevronUp, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DICTATION_SHEET_ID } from "@/features/dictation/components/dictation-sheet";
import type { DictationSession } from "@/features/dictation/hooks/use-dictation-session";
import { cn } from "@/lib/utils";

/** 녹음 경과 시간(초) → "1:05" */
const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** 입력 크기 막대(0~1). 말할 때 움직이면 마이크가 소리를 받고 있다. 폭 대신 transform 으로 늘린다. */
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
 * 저장 버튼 바의 녹음 조작(서식을 채우며 아래로 내려가도 늘 보인다). 평소에는 [녹음] 버튼, 녹음 중에는
 * 바 전체가 녹음 막대(경과 시간·입력 크기·끝내기·취소)가 된다. 막대의 시간 부분을 누르면 위 시트의
 * 말할 내용을 접고 편다. 처리 중·보내기 실패는 시트가 보여 주므로 그동안 [녹음]은 누를 수 없다.
 */
export function DictationBarControl({
  session,
}: {
  session: DictationSession;
}) {
  const { recorder } = session;
  if (session.isRecording) {
    const starting = recorder.status === "starting";
    // 시작하는 동안 seconds 는 이전 녹음 값이 남아 있을 수 있다.
    const endingSoon =
      !starting &&
      DICTATION_MAX_SECONDS - recorder.seconds <= ENDING_SOON_SECONDS;
    return (
      <div className="flex flex-1 items-center gap-2">
        <button
          type="button"
          onClick={session.togglePoints}
          aria-expanded={session.pointsOpen}
          aria-controls={DICTATION_SHEET_ID}
          aria-label={
            session.pointsOpen ? "말할 내용 접기" : "말할 내용 펼치기"
          }
          className="hover:bg-muted focus-visible:ring-ring/30 flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-2 py-1.5 text-left outline-none focus-visible:ring-4"
        >
          <span className="bg-destructive size-3 shrink-0 animate-pulse rounded-full" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="font-bold whitespace-nowrap tabular-nums">
              <span className="text-destructive max-[379px]:hidden">
                녹음 중{" "}
              </span>
              <span className={cn(endingSoon && "text-destructive")}>
                {formatClock(starting ? 0 : recorder.seconds)}
              </span>
            </span>
            <LevelMeter level={recorder.level} />
          </span>
          <ChevronUp
            className={cn(
              "text-muted-foreground size-5 shrink-0 transition-transform",
              session.pointsOpen && "rotate-180",
            )}
          />
        </button>
        <span className="sr-only" aria-live="polite">
          {recordingStatus(starting, endingSoon)}
        </span>
        <Button className="px-4" onClick={recorder.stop}>
          <Square />
          끝내기
        </Button>
        <Button variant="ghost" className="px-3" onClick={recorder.cancel}>
          취소
        </Button>
      </div>
    );
  }
  return (
    <Button
      variant="soft"
      className="px-4"
      onClick={() => session.start("bar")}
      disabled={!session.canStart}
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
