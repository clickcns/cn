import type {
  ConversationProgress,
  VisitDictation,
  VisitDictationResponse,
} from "@repo/shared-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toWav16kMono } from "@/features/dictation/lib/wav";

export const dictationKey = (visitId: string) =>
  ["dictation", visitId] as const;

/** 브라우저가 녹음 파일을 디코딩하지 못했다(서버 오류와 구분해 보여 준다). */
export class RecordingDecodeError extends Error {
  constructor() {
    super("녹음 파일을 읽지 못했습니다. 다시 녹음해 주세요");
  }
}

/** 방문의 구술·초안과 끝내지 않은 대화 녹음. 없으면 각각 null. */
export function useDictation(visitId: string) {
  return useQuery({
    queryKey: dictationKey(visitId),
    queryFn: () => api.dictation.get(visitId),
  });
}

/** 캐시의 구술·대화 녹음을 바꾼다. 주지 않은 쪽은 그대로 둔다. */
export function useSetDictation(visitId: string) {
  const queryClient = useQueryClient();
  return (next: {
    dictation?: VisitDictation | null;
    conversation?: ConversationProgress | null;
  }) => {
    queryClient.setQueryData<VisitDictationResponse>(
      dictationKey(visitId),
      (old) => ({ dictation: null, conversation: null, ...old, ...next }),
    );
  };
}

/** 녹음을 WAV로 바꿔 올리고 음성인식·초안 결과를 받는다. append면 이전 구술에 이어 붙인다. */
export function useRecordDictation(visitId: string) {
  const setDictation = useSetDictation(visitId);
  return useMutation({
    mutationFn: async ({
      recording,
      append,
    }: {
      recording: Blob;
      append: boolean;
    }) => {
      let wav: Blob;
      try {
        wav = await toWav16kMono(recording);
      } catch {
        throw new RecordingDecodeError();
      }
      return api.dictation.record(visitId, wav, { append });
    },
    onSuccess: (dictation) => setDictation({ dictation }),
  });
}

export function useRedraftDictation(visitId: string) {
  const setDictation = useSetDictation(visitId);
  return useMutation({
    mutationFn: () => api.dictation.redraft(visitId),
    onSuccess: (dictation) => setDictation({ dictation }),
  });
}

export function useRemoveDictation(visitId: string) {
  const setDictation = useSetDictation(visitId);
  return useMutation({
    mutationFn: () => api.dictation.remove(visitId),
    // 서버가 끝내지 않은 대화 녹음도 함께 지운다.
    onSuccess: () => setDictation({ dictation: null, conversation: null }),
  });
}
