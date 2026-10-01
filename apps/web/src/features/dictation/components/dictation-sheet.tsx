import type { VisitDictationPoint } from "@repo/shared-types";
import { CircleAlert, LoaderCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { DictationPoints } from "@/features/dictation/components/dictation-points";
import type { DictationSession } from "@/features/dictation/hooks/use-dictation-session";

/** 시트의 id. 녹음 막대가 접고 펴는 대상(aria-controls)이다. */
export const DICTATION_SHEET_ID = "dictation-sheet";

/**
 * 저장 버튼 바 위로 올라오는 시트. 서식을 가리지 않게 필요할 때만 열린다(비모달, 뒤의 서식은 스크롤된다).
 * - 녹음 중: 말할 내용(녹음 막대로 접고 펴며, 마지막 선택을 기억한다)
 * - 처리 중: 초안을 만드는 중이라는 안내
 * - 보내기 실패: 다시 보내기·녹음 버리기
 */
export function DictationSheet({
  session,
  points,
}: {
  session: DictationSession;
  points: readonly VisitDictationPoint[];
}) {
  const content = (() => {
    if (session.isRecording) {
      return session.pointsOpen ? <DictationPoints points={points} /> : null;
    }
    if (session.isProcessing) {
      return (
        <div role="status" className="flex items-center gap-3">
          <LoaderCircle className="text-primary size-6 shrink-0 animate-spin" />
          <div>
            <p className="font-bold">기록 초안을 만드는 중입니다</p>
            <p className="text-muted-foreground text-sm">
              음성을 글로 옮겨 서식 항목을 채웁니다. 보통 10~30초 걸립니다.
            </p>
          </div>
        </div>
      );
    }
    if (session.failed) {
      return (
        <Notice
          tone="destructive"
          icon={CircleAlert}
          message={session.failed.message}
        >
          <div className="flex gap-3">
            <Button className="flex-1" onClick={session.retry}>
              <RotateCw />
              다시 보내기
            </Button>
            <Button variant="outline" onClick={session.discardFailed}>
              녹음 버리기
            </Button>
          </div>
        </Notice>
      );
    }
    return null;
  })();

  if (!content) return null;
  return (
    <div
      id={DICTATION_SHEET_ID}
      // 저장 버튼 바가 이 표시로 시트가 있는지 알아 위를 둥글게 그린다(has-[[data-slot=dictation-sheet]]).
      data-slot="dictation-sheet"
      className="border-border mb-3 max-h-[60dvh] overflow-y-auto border-b pb-3"
    >
      {content}
    </div>
  );
}
