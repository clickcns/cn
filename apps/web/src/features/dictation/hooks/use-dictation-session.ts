import { useRef, useState, type RefObject } from "react";
import { getErrorMessage } from "@repo/api-client";
import { DICTATION_MAX_SECONDS } from "@repo/shared-types";
import { toast } from "sonner";
import {
  RecordingDecodeError,
  useDictation,
  useRecordDictation,
  useRedraftDictation,
  useRemoveDictation,
} from "@/features/dictation/hooks/use-dictation";
import { useRecorder } from "@/features/dictation/hooks/use-recorder";

/** 보내지 못한 녹음. 다시 녹음하지 않고 그대로 다시 보낼 수 있게 남겨 둔다. */
interface FailedRecording {
  recording: Blob;
  append: boolean;
  message: string;
}

/** 녹음을 어디서 시작했는지: 기록 화면 위 패널 또는 아래 저장 버튼 바. */
export type DictationSource = "panel" | "bar";

function uploadErrorMessage(error: unknown): string {
  return error instanceof RecordingDecodeError
    ? error.message
    : getErrorMessage(error, "녹음을 보내지 못했습니다");
}

/**
 * 방문 한 건의 구술 상태: 구술(초안), 녹음기, 녹음 보내기·다시 보내기, 초안 다시 만들기·지우기.
 * 기록 화면이 한 번 만들어 위 패널(초안 확인)과 아래 저장 버튼 바(어디서나 녹음)가 함께 쓴다.
 * 저장 버튼 바에서 시작한 녹음은 패널이 안 보일 수 있으므로 결과·오류를 알림으로도 띄운다
 * (알림의 [확인하기]는 panelRef 의 패널로 올라간다. ref 는 돌려주는 값에 넣지 않는다 — React Compiler 가
 * 세션 전체를 ref 로 보고 그리는 중 읽기를 막는다).
 */
export function useDictationSession(
  visitId: string,
  panelRef: RefObject<HTMLElement | null>,
) {
  const dictationQuery = useDictation(visitId);
  const dictation = dictationQuery.data ?? null;
  const recordDictation = useRecordDictation(visitId);
  const redraft = useRedraftDictation(visitId);
  const removeDictation = useRemoveDictation(visitId);
  const [failed, setFailed] = useState<FailedRecording | null>(null);
  const sourceRef = useRef<DictationSource>("panel");

  const showPanel = () =>
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const submit = (recording: Blob, append: boolean) => {
    setFailed(null);
    recordDictation.mutate(
      { recording, append },
      {
        onSuccess: () => {
          if (sourceRef.current !== "bar") return;
          toast.success("기록 초안을 만들었습니다", {
            action: { label: "확인하기", onClick: showPanel },
          });
        },
        onError: (error) =>
          setFailed({ recording, append, message: uploadErrorMessage(error) }),
      },
    );
  };

  const recorder = useRecorder({
    maxSeconds: DICTATION_MAX_SECONDS,
    // 구술이 이미 있으면 이어 붙인다(되묻기 답·추가 설명).
    onRecorded: (recording) => submit(recording, dictation !== null),
    onError: (message) => {
      if (sourceRef.current === "bar") toast.error(message);
    },
  });

  const isRecording = recorder.status !== "idle";
  const isProcessing = recordDictation.isPending;

  return {
    dictation,
    isLoading: dictationQuery.isPending,
    recorder,
    isRecording,
    isProcessing,
    isBusy:
      isRecording ||
      isProcessing ||
      redraft.isPending ||
      removeDictation.isPending,
    failed,
    redraft,
    removeDictation,
    showPanel,
    start: (source: DictationSource) => {
      sourceRef.current = source;
      void recorder.start();
    },
    retry: () => {
      if (failed) submit(failed.recording, failed.append);
    },
    discardFailed: () => setFailed(null),
  };
}

export type DictationSession = ReturnType<typeof useDictationSession>;
