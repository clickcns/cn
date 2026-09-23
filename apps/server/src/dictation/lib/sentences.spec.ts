import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SttSegment } from "../../speech/stt.client.js";
import { toSentences } from "./sentences.js";

/** [text, start, end] → STT 인식 구간 */
const segments = (items: [string, number, number][]): SttSegment[] =>
  items.map(([text, start, end]) => ({
    text,
    start,
    end,
    avgLogprob: -0.1,
    noSpeechProb: 0,
  }));

describe("toSentences", () => {
  it("단어 단위 구간을 문장부호에서 나누고 번호를 붙인다", () => {
    const result = toSentences(
      segments([
        ["방문", 0, 0.4],
        ["마쳤습니다.", 0.4, 1.0],
        ["혈압", 1.2, 1.5],
        ["130에", 1.5, 2.0],
        ["85,", 2.0, 2.4],
        ["체온", 2.5, 2.8],
        ["36", 2.8, 3.0],
        [".8도입니다.", 3.0, 3.6],
      ]),
      { take: 1, firstNumber: 1 },
    );
    assert.deepEqual(
      result.map((s) => [s.id, s.text]),
      [
        ["S1", "방문 마쳤습니다."],
        ["S2", "혈압 130에 85, 체온 36.8도입니다."],
      ],
    );
  });

  it("숫자 뒤의 점은 문장 끝으로 보지 않는다", () => {
    const result = toSentences(
      segments([
        ["체온", 0, 0.3],
        ["36.", 0.3, 0.6],
        ["8도예요.", 0.6, 1.0],
      ]),
      { take: 1, firstNumber: 1 },
    );
    assert.deepEqual(
      result.map((s) => s.text),
      ["체온 36.8도예요."],
    );
  });

  it("긴 쉼에서 끊고, 이어 붙이는 녹음은 번호를 이어 간다", () => {
    const result = toSentences(
      segments([
        ["맥박은", 0, 0.5],
        ["72회", 0.5, 1.0],
        ["호흡은", 3.0, 3.5],
        ["18회", 3.5, 4.0],
      ]),
      { take: 2, firstNumber: 8 },
    );
    assert.deepEqual(
      result.map((s) => [s.id, s.text, s.take]),
      [
        ["S8", "맥박은 72회", 2],
        ["S9", "호흡은 18회", 2],
      ],
    );
  });

  it("한 구간에 여러 문장이 있으면 나눈다", () => {
    const result = toSentences(
      segments([["혈압 130에 85입니다. 맥박 72회입니다.", 0, 4]]),
      { take: 1, firstNumber: 1 },
    );
    assert.deepEqual(
      result.map((s) => s.text),
      ["혈압 130에 85입니다.", "맥박 72회입니다."],
    );
  });
});
