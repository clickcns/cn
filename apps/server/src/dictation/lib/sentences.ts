import type { DictationSentence } from "@repo/shared-types";
import type { SttSegment } from "../../speech/stt.client.js";

/** 이만큼 말이 끊기면 문장이 끝난 것으로 본다(초). */
const PAUSE_SECONDS = 1.2;
const SENTENCE_END = /[.?!]$/;
/** "36."처럼 숫자 뒤의 점은 문장 끝이 아니라 소수점일 수 있다. */
const NUMBER_WITH_DOT = /\d\.$/;

/** 앞 단어에 띄우지 않고 붙일 조각: ".8도", ",", "%" 등 */
function attachesToPrevious(word: string, previous: string): boolean {
  return (
    /^[.,?!%)]/.test(word) ||
    (NUMBER_WITH_DOT.test(previous) && /^\d/.test(word))
  );
}

interface Draft {
  text: string;
  start: number;
  end: number;
}

/**
 * STT 인식 구간 → 문장. 인식 구간은 단어 하나일 수도, 여러 문장일 수도 있다.
 * 문장부호나 긴 쉼에서 끊고, 번호는 firstNumber부터 S1, S2…로 이어 붙인다.
 */
export function toSentences(
  segments: readonly SttSegment[],
  { take, firstNumber }: { take: number; firstNumber: number },
): DictationSentence[] {
  const drafts: Draft[] = [];
  let current: Draft | null = null;

  for (const segment of segments) {
    const word = segment.text.trim();
    if (!word) continue;
    if (current && segment.start - current.end > PAUSE_SECONDS) {
      drafts.push(current);
      current = null;
    }
    if (current) {
      current.text += attachesToPrevious(word, current.text)
        ? word
        : ` ${word}`;
      current.end = segment.end;
    } else {
      current = { text: word, start: segment.start, end: segment.end };
    }
    if (SENTENCE_END.test(word) && !NUMBER_WITH_DOT.test(word)) {
      drafts.push(current);
      current = null;
    }
  }
  if (current) drafts.push(current);

  // 한 구간에 여러 문장이 들어 있으면 문장부호 뒤 공백에서 다시 나눈다(시각은 같게 둔다).
  const pieces = drafts.flatMap((draft) =>
    draft.text
      .split(/(?<=[.?!])\s+/)
      .map((text) => ({ ...draft, text: text.trim() }))
      .filter((piece) => piece.text.length > 0),
  );

  return pieces.map((piece, index) => ({
    id: `S${firstNumber + index}`,
    text: piece.text,
    take,
    start: Math.round(piece.start * 10) / 10,
    end: Math.round(piece.end * 10) / 10,
  }));
}
