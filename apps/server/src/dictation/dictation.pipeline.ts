import type {
  DictationSentence,
  DraftIssue,
  FollowUpQuestion,
  FormId,
  RecordDraft,
} from "@repo/shared-types";
import type { LlmClient, LlmUsage } from "../llm/llm.client.js";
import type { SttClient } from "../speech/stt.client.js";
import {
  buildDraftSchema,
  buildDraftSystemPrompt,
  buildDraftUserMessage,
  buildSttPrompt,
  type DraftRecipientContext,
  type LlmDraft,
} from "./lib/draft-prompt.js";
import { toSentences } from "./lib/sentences.js";
import { followUpQuestions, validateDraft } from "./lib/validate-draft.js";

export interface DraftResult {
  draft: RecordDraft;
  issues: DraftIssue[];
  questions: FollowUpQuestion[];
  /** 검사 전 LLM 응답(평가·디버깅용) */
  raw: LlmDraft;
  usage: LlmUsage | null;
}

/** 초안을 만들 대상: 수급자 정보(용어 힌트)와 이 방문의 서식. */
export interface DictationContext {
  recipient: DraftRecipientContext;
  formIds: readonly FormId[];
}

/**
 * 구술 → 서식 초안. Nest에 묶이지 않아 평가 스크립트(scripts/dictation-eval.ts)에서도 그대로 쓴다.
 * 1) 녹음 → 음성인식 → 문장(S1, S2…)  2) 문장 → LLM 초안(방문의 서식 모두) → 자동 검사 → 되묻기 질문
 */
export class DictationPipeline {
  constructor(
    private readonly stt: SttClient,
    private readonly llm: LlmClient,
  ) {}

  async transcribe(
    pcm: Buffer,
    context: DictationContext,
    position: { take: number; firstNumber: number },
  ): Promise<DictationSentence[]> {
    const segments = await this.stt.transcribe(pcm, {
      prompt: buildSttPrompt(context.recipient, context.formIds),
    });
    return toSentences(segments, position);
  }

  async draft(
    sentences: readonly DictationSentence[],
    { recipient, formIds }: DictationContext,
  ): Promise<DraftResult> {
    const { data: raw, usage } = await this.llm.generateJson(
      buildDraftSchema(formIds),
      {
        name: "visit_record_draft",
        system: buildDraftSystemPrompt(formIds),
        user: buildDraftUserMessage(sentences, recipient),
      },
    );
    const { draft, issues } = validateDraft(formIds, raw, sentences);
    return {
      draft,
      issues,
      questions: followUpQuestions(formIds, draft),
      raw,
      usage,
    };
  }
}
