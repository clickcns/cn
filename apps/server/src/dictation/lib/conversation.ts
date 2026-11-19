import type { DictationSentence } from "@repo/shared-types";

/** 대화 녹음 조각 하나: 구간·번호·길이와 조각 안 시각 기준 문장. */
export interface ConversationSegmentRow {
  runStartedAt: Date;
  index: number;
  seconds: number;
  sentences: readonly Pick<DictationSentence, "text" | "start" | "end">[];
}

/** 조각을 잇는 순서: 구간 시작순, 그 안은 번호순. */
const bySegmentOrder = (a: ConversationSegmentRow, b: ConversationSegmentRow) =>
  a.runStartedAt.getTime() - b.runStartedAt.getTime() || a.index - b.index;

/**
 * 조각을 구간 시작·번호 순으로 이어 한 녹음(take)의 문장으로 만든다. 시각은 첫 조각 시작 기준으로 옮기고
 * (멈춘 동안은 빼고), 번호는 firstNumber부터 S1, S2…로 다시 매긴다. 번호가 비어 있어도(읽지 못한 조각) 잇는다.
 */
export function mergeConversationSegments(
  segments: readonly ConversationSegmentRow[],
  { take, firstNumber }: { take: number; firstNumber: number },
): DictationSentence[] {
  const sentences: DictationSentence[] = [];
  let offset = 0;
  for (const segment of [...segments].sort(bySegmentOrder)) {
    for (const sentence of segment.sentences) {
      sentences.push({
        id: `S${firstNumber + sentences.length}`,
        text: sentence.text,
        take,
        start: Math.round((offset + sentence.start) * 10) / 10,
        end: Math.round((offset + sentence.end) * 10) / 10,
        source: "conversation",
      });
    }
    offset += segment.seconds;
  }
  return sentences;
}
