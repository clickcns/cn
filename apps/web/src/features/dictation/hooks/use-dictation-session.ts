import { useRef, useState, type RefObject } from "react";
import { getErrorMessage } from "@repo/api-client";
import { DICTATION_MAX_SECONDS } from "@repo/shared-types";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConversationRecorder } from "@/features/dictation/hooks/use-conversation-recorder";
import {
  dictationKey,
  RecordingDecodeError,
  useDictation,
  useRecordDictation,
  useRedraftDictation,
  useRemoveDictation,
  useSetDictation,
} from "@/features/dictation/hooks/use-dictation";
import { useRecorder } from "@/features/dictation/hooks/use-recorder";
import { useStoredFlag } from "@/hooks/use-stored-flag";

/** 보내지 못한 녹음. 다시 녹음하지 않고 그대로 다시 보낼 수 있게 남겨 둔다. */
interface FailedRecording {
  recording: Blob;
  append: boolean;
  message: string;
}

/** 녹음을 어디서 시작했는지: 기록 화면 위 초안 카드 또는 아래 저장 버튼 바. */
export type DictationSource = "panel" | "bar";

function uploadErrorMessage(error: unknown): string {
  return error instanceof RecordingDecodeError
    ? error.message
    : getErrorMessage(error, "녹음을 보내지 못했습니다");
}

/**
 * 방문 한 건의 구술 상태: 구술(초안), 녹음기, 녹음 보내기·다시 보내기, 초안 다시 만들기·지우기,
 * 녹음할 때 말할 내용을 펼쳐 둘지, 방문 중 대화 녹음(conversation — 수급자 녹음 동의가 있을 때만 화면이 연다). 기록 화면이 한 번 만들어 위 초안 카드와 아래 저장 버튼 바(녹음 막대와
 * 그 위로 올라오는 시트)가 함께 쓴다. 초안 카드는 아래로 내려가 있으면 안 보이므로 저장 버튼 바에서 시작한
 * 녹음은 결과를 알림으로도 띄우고, 마이크를 켜지 못하면 늘 알림으로 알린다
 * (알림의 [확인하기]는 panelRef 의 카드로 올라간다. ref 는 돌려주는 값에 넣지 않는다 — React Compiler 가
 * 세션 전체를 ref 로 보고 그리는 중 읽기를 막는다).
 */
export function useDictationSession(
  visitId: string,
  panelRef: RefObject<HTMLElement | null>,
) {
  const dictationQuery = useDictation(visitId);
  const response = dictationQuery.data;
  const dictation = response?.dictation ?? null;
  const setDictation = useSetDictation(visitId);
  const queryClient = useQueryClient();
  const recordDictation = useRecordDictation(visitId);
  const redraft = useRedraftDictation(visitId);
  const removeDictation = useRemoveDictation(visitId);
  const [failed, setFailed] = useState<FailedRecording | null>(null);
  // 녹음할 때 말할 내용을 펼쳐 둘지(마지막 선택, 처음에는 펼침).
  const [pointsOpen, togglePoints] = useStoredFlag(
    "carenote:dictation-points-open",
    true,
  );
  // 대화 녹음 조작 시트를 펼쳐 둘지(바의 녹음 표시로 접고 편다, 마지막 선택을 기억).
  const [conversationSheetOpen, toggleConversationSheet] = useStoredFlag(
    "carenote:conversation-sheet-open",
    true,
  );
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
    onError: (message) => toast.error(message),
  });

  const conversation = useConversationRecorder({
    visitId,
    pending: response?.conversation ?? null,
    onProgress: (progress) => setDictation({ conversation: progress }),
    onFinished: (next, dropped) => {
      // 이은 조각은 서버가 지웠다. 초안을 만드는 사이 늦게 온 조각은 남으므로 진행은 다시 받는다.
      setDictation({ dictation: next, conversation: null });
      void queryClient.invalidateQueries({ queryKey: dictationKey(visitId) });
      if (dropped) toast.warning(dropped);
      toast.success("대화 녹음으로 기록 초안을 만들었습니다", {
        action: { label: "확인하기", onClick: showPanel },
      });
    },
    onStale: () =>
      void queryClient.invalidateQueries({ queryKey: dictationKey(visitId) }),
    onDiscarded: () => setDictation({ conversation: null }),
    onError: (message) => toast.error(message),
  });

  const isRecording = recorder.status !== "idle";
  const isProcessing = recordDictation.isPending;
  /** 대화 녹음 중(멈춤·초안 만드는 중 포함) */
  const isConversationActive = conversation.status !== "idle";
  const isBusy =
    isRecording ||
    isProcessing ||
    redraft.isPending ||
    removeDictation.isPending ||
    isConversationActive;

  return {
    dictation,
    /** 구술(과 끝내지 않은 대화 녹음)을 받았다 — 대화 녹음은 이것을 안 뒤에 시작한다 */
    isLoaded: dictationQuery.isSuccess,
    /** 끝내지 않은 대화 녹음(서버에 보낸 조각). 없으면 null */
    pendingConversation: response?.conversation ?? null,
    conversation,
    isConversationActive,
    recorder,
    isRecording,
    isProcessing,
    isBusy,
    /** 새 녹음을 시작할 수 있다(보내지 못한 녹음이 있으면 먼저 다시 보내거나 버린다) */
    canStart: !isBusy && failed === null,
    failed,
    redraft,
    removeDictation,
    start: (source: DictationSource) => {
      sourceRef.current = source;
      void recorder.start();
    },
    retry: () => {
      if (failed) submit(failed.recording, failed.append);
    },
    discardFailed: () => setFailed(null),
    pointsOpen,
    togglePoints,
    conversationSheetOpen,
    toggleConversationSheet,
  };
}

export type DictationSession = ReturnType<typeof useDictationSession>;
