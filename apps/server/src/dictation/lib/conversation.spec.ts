import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DictationSentence } from "@repo/shared-types";
import { mergeConversationSegments } from "./conversation.js";
import {
  buildDraftSystemPrompt,
  buildDraftUserMessage,
} from "./draft-prompt.js";

describe("mergeConversationSegments", () => {
  const first = new Date("2026-11-17T01:00:00Z");
  const resumed = new Date("2026-11-17T01:20:00Z");
  const line = (text: string, start: number, end: number) => ({
    text,
    start,
    end,
  });

  it("구간 시작·번호 순으로 잇고 시각을 첫 조각 기준으로 옮기며 번호를 다시 매긴다", () => {
    const merged = mergeConversationSegments(
      [
        // 다시 열어 이어 녹음한 구간(번호는 0부터 다시)
        {
          runStartedAt: resumed,
          index: 0,
          seconds: 60,
          sentences: [line("다 됐습니다.", 1, 2)],
        },
        {
          runStartedAt: first,
          index: 1,
          seconds: 120,
          sentences: [line("혈압 재 볼게요.", 3.04, 5)],
        },
        {
          runStartedAt: first,
          index: 0,
          seconds: 180.5,
          sentences: [
            line("안녕하세요.", 0.5, 1.2),
            line("요즘 잠은 잘 주무세요?", 10, 12),
          ],
        },
        // 읽지 못한 조각으로 번호가 비어도 잇는다.
        { runStartedAt: first, index: 3, seconds: 30, sentences: [] },
      ],
      { take: 2, firstNumber: 4 },
    );
    assert.deepEqual(
      merged.map(({ id, text, start, end, take, source }) => [
        id,
        text,
        start,
        end,
        take,
        source,
      ]),
      [
        ["S4", "안녕하세요.", 0.5, 1.2, 2, "conversation"],
        ["S5", "요즘 잠은 잘 주무세요?", 10, 12, 2, "conversation"],
        ["S6", "혈압 재 볼게요.", 183.5, 185.5, 2, "conversation"],
        ["S7", "다 됐습니다.", 331.5, 332.5, 2, "conversation"],
      ],
    );
  });
});

describe("대화 녹음 초안 요청", () => {
  const recipient = { name: "김영자", careGrade: null, notes: null };
  const sentence = (
    id: string,
    take: number,
    text: string,
    source?: "conversation",
  ): DictationSentence => ({
    id,
    text,
    take,
    start: 0,
    end: 1,
    ...(source ? { source } : {}),
  });

  it("구술만 있으면 지금과 같다(대화 규칙·녹음 머리 없음)", () => {
    const message = buildDraftUserMessage(
      [sentence("S1", 1, "혈압 130에 85.")],
      recipient,
    );
    assert.match(message, /구술 문장:\nS1 혈압 130에 85\./);
    assert.doesNotMatch(message, /방문 중 대화/);
    assert.doesNotMatch(
      buildDraftSystemPrompt(["LTC_NURSING"]),
      /방문 중 대화 녹음/,
    );
  });

  it("대화와 구술이 섞이면 녹음마다 머리를 단다", () => {
    const message = buildDraftUserMessage(
      [
        sentence("S1", 1, "어디 불편한 데 있으세요?", "conversation"),
        sentence("S2", 1, "허리가 아파요.", "conversation"),
        sentence("S3", 2, "혈압 130에 85."),
      ],
      recipient,
    );
    assert.match(
      message,
      /방문 중 대화 \(화자 구분 없음\):\nS1 .+\nS2 .+\n\n담당자 구술:\nS3 혈압 130에 85\./,
    );
    assert.match(
      buildDraftSystemPrompt(["LTC_NURSING"], { conversation: true }),
      /방문 중 대화 녹음/,
    );
  });
});
