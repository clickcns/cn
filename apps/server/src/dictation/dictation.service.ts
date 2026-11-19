import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  CONVERSATION_MAX_SECONDS,
  CONVERSATION_SEGMENT_MAX_SECONDS,
  DICTATION_MAX_SECONDS,
  keepDraftForms,
  type ConversationProgress,
  type DictationSentence,
  type FormId,
  type VisitDictation,
  type VisitDictationResponse,
} from "@repo/shared-types";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { ConfigService } from "../config/index.js";
import type { Prisma } from "../generated/prisma/client.js";
import { LlmError } from "../llm/llm.client.js";
import { PrismaService } from "../prisma/index.js";
import { toCareGrade } from "../recipient/recipient.mapper.js";
import { SttClient, SttError } from "../speech/stt.client.js";
import { readPcmWav, WavFormatError } from "../speech/wav.js";
import { VisitService } from "../visit/visit.service.js";
import {
  DictationPipeline,
  type DictationContext,
} from "./dictation.pipeline.js";
import { toVisitDictation } from "./dictation.mapper.js";
import {
  mergeConversationSegments,
  type ConversationSegmentRow,
} from "./lib/conversation.js";

/** 이보다 짧은 녹음은 잘못 누른 것으로 본다(초). */
const MIN_AUDIO_SECONDS = 1;
/** 녹음 길이 판정 여유(초). 브라우저 녹음기는 끝이 조금 길 수 있다. */
const AUDIO_SECONDS_SLACK = 5;

const DRAFT_FAILED =
  "기록 초안을 만들지 못했습니다. 잠시 후 [초안 다시 만들기]를 눌러 주세요";
const LLM_NOT_CONFIGURED =
  "초안을 만드는 LLM이 설정되지 않았습니다(LLM_API_KEY). 음성인식 결과만 저장했습니다";
const CONFIRMED_WHILE_PROCESSING =
  "녹음을 처리하는 동안 방문 기록이 확정되어 구술을 저장하지 않았습니다";
const NO_RECORDING_CONSENT =
  "이 수급자는 대화 녹음 동의 기록이 없습니다. 기관 관리자에게 동의 기록을 요청해 주세요";
/** 대화 녹음 길이 상한을 넘겨 받는 여유(초). 화면이 상한에서 저절로 끝내므로 늦게 온 조각만 받는다. */
const CONVERSATION_OVER_SLACK = 15 * 60;
const CONVERSATION_TOO_LONG =
  "대화 녹음이 너무 깁니다. [끝내고 초안 만들기]를 눌러 주세요";

type DraftFields = Pick<
  VisitDictation,
  "draft" | "issues" | "questions" | "draftError"
>;

/** 16kHz·모노 WAV를 읽는다. 형식이 틀리면 400. */
function readAudio(audio: Buffer): { pcm: Buffer; seconds: number } {
  try {
    return readPcmWav(audio);
  } catch (error) {
    if (error instanceof WavFormatError) {
      throw new BadRequestException(error.message);
    }
    throw error;
  }
}

/** DB JSON 칸에 넣는다(Prisma의 InputJsonValue로 바꾼다). */
const asJson = (value: unknown) => value as Prisma.InputJsonValue;

/**
 * 초안을 DB 칸으로 바꾼다. 음성인식·초안을 만드는 사이에 방문에서 뺀 서식은 지운다
 * (formIds는 저장 직전 잠근 상태에서 읽은 방문의 서식이다).
 */
const draftColumns = (fields: DraftFields, formIds: readonly FormId[]) => {
  const kept = keepDraftForms(fields, formIds);
  return {
    draft: asJson(kept.draft),
    issues: asJson(kept.issues),
    questions: asJson(kept.questions),
    draftError: fields.draftError,
  };
};

@Injectable()
export class DictationService implements OnModuleDestroy {
  private readonly logger = new Logger(DictationService.name);
  private readonly llmConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly visitService: VisitService,
    private readonly pipeline: DictationPipeline,
    private readonly stt: SttClient,
    config: ConfigService,
  ) {
    this.llmConfigured = config.speech.LLM_API_KEY !== "";
  }

  onModuleDestroy(): void {
    this.stt.close();
  }

  async get(
    actor: AuthenticatedUser,
    visitId: string,
  ): Promise<VisitDictationResponse> {
    await this.visitService.assertWritable(actor, visitId);
    const [row, conversation] = await Promise.all([
      this.prisma.visitDictation.findUnique({ where: { visitId } }),
      this.conversationProgress(visitId),
    ]);
    return { dictation: row ? toVisitDictation(row) : null, conversation };
  }

  /**
   * 녹음 한 번 처리: 음성인식 → 문장 → 초안. append면 이전 문장 뒤에 이어 붙여(되묻기 답)
   * 전체 문장으로 초안을 다시 만들고, 아니면 이전 구술을 바꾼다.
   * 음성인식이 실패하면 저장하지 않는다(브라우저에 녹음이 남아 있어 다시 보낼 수 있다).
   * 초안만 실패하면 문장은 저장하고 draftError를 남긴다.
   */
  async record(
    actor: AuthenticatedUser,
    visitId: string,
    audio: Buffer,
    append: boolean,
  ): Promise<VisitDictation> {
    const context = await this.loadContext(actor, visitId);

    const { pcm, seconds } = readAudio(audio);
    if (seconds < MIN_AUDIO_SECONDS) {
      throw new BadRequestException("녹음이 너무 짧습니다");
    }
    if (seconds > DICTATION_MAX_SECONDS + AUDIO_SECONDS_SLACK) {
      throw new BadRequestException(
        `녹음은 한 번에 ${DICTATION_MAX_SECONDS / 60}분까지입니다`,
      );
    }

    const previousRow = append
      ? await this.prisma.visitDictation.findUnique({ where: { visitId } })
      : null;
    const previous = previousRow ? toVisitDictation(previousRow) : null;
    const previousSentences = previous?.sentences ?? [];
    const take = (previous?.takes ?? 0) + 1;

    const started = Date.now();
    const newSentences = await this.transcribe(visitId, () =>
      this.pipeline.transcribe(pcm, context, {
        take,
        firstNumber: previousSentences.length + 1,
      }),
    );
    const sttMs = Date.now() - started;
    if (newSentences.length === 0) {
      throw new UnprocessableEntityException(
        "말소리를 알아듣지 못했습니다. 휴대폰을 입 가까이 대고 다시 녹음해 주세요",
      );
    }

    const { dictation, issues } = await this.saveTake(actor, context, {
      previous,
      newSentences,
      take,
      seconds,
    });
    this.logger.log(
      {
        visitId,
        take,
        audioSeconds: Math.round(seconds),
        sttMs,
        totalMs: Date.now() - started,
        sentences: dictation.sentences.length,
        issues,
      },
      "Dictation processed",
    );
    return dictation;
  }

  /** 저장된 문장으로 초안만 다시 만든다(초안 실패 뒤 다시 시도). */
  async redraft(
    actor: AuthenticatedUser,
    visitId: string,
  ): Promise<VisitDictation> {
    const context = await this.loadContext(actor, visitId);
    const row = await this.prisma.visitDictation.findUnique({
      where: { visitId },
    });
    if (!row) throw new NotFoundException("구술 기록이 없습니다");

    const current = toVisitDictation(row);
    const draft = await this.makeDraft(
      visitId,
      current.sentences,
      context,
      current,
    );
    const updated = await this.visitService.writeIfStillWritable(
      actor,
      visitId,
      CONFIRMED_WHILE_PROCESSING,
      (tx, visit) =>
        tx.visitDictation.update({
          where: { visitId },
          data: draftColumns(draft, visit.formIds),
        }),
    );
    return toVisitDictation(updated);
  }

  /** 구술을 지우고 처음부터 다시 녹음한다. 저장한 서식(VisitForm)은 건드리지 않는다. */
  async remove(
    actor: AuthenticatedUser,
    visitId: string,
  ): Promise<{ ok: true }> {
    await this.visitService.assertWritable(actor, visitId);
    await this.prisma.$transaction([
      this.prisma.visitDictation.deleteMany({ where: { visitId } }),
      this.prisma.visitConversationSegment.deleteMany({ where: { visitId } }),
    ]);
    return { ok: true };
  }

  /**
   * 대화 녹음 조각 하나: 음성인식해 문장만 둔다(음성은 남기지 않는다). 같은 구간·번호를 다시 보내면 바꾼다
   * (보내기 재시도). 수급자 녹음 동의가 있어야 한다. 조각은 구간(runId)마다 번호를 매기므로 다시 열어
   * 이어 녹음하거나 다른 기기에서 녹음해도 앞 조각을 덮지 않는다.
   */
  async recordConversationSegment(
    actor: AuthenticatedUser,
    visitId: string,
    audio: Buffer,
    {
      runId,
      runStartedAt,
      index,
    }: { runId: string; runStartedAt: Date; index: number },
  ): Promise<ConversationProgress> {
    const context = await this.loadContext(actor, visitId, {
      requireRecordingConsent: true,
    });
    const { pcm, seconds } = readAudio(audio);
    if (seconds > CONVERSATION_SEGMENT_MAX_SECONDS + AUDIO_SECONDS_SLACK) {
      throw new BadRequestException("대화 녹음 조각이 너무 깁니다");
    }
    // 음성인식 전에 길이 상한을 보고, 같은 행으로 돌려줄 진행도 센다.
    const others = (
      await this.prisma.visitConversationSegment.findMany({
        where: { visitId },
        select: { runId: true, index: true, seconds: true },
      })
    ).filter((row) => row.runId !== runId || row.index !== index);
    const pendingSeconds = others.reduce((sum, row) => sum + row.seconds, 0);
    if (pendingSeconds >= CONVERSATION_MAX_SECONDS + CONVERSATION_OVER_SLACK) {
      throw new BadRequestException(CONVERSATION_TOO_LONG);
    }

    const sentences = await this.transcribe(visitId, () =>
      this.pipeline.transcribe(
        pcm,
        context,
        { take: 0, firstNumber: 1 },
        { conversation: true },
      ),
    );
    const data = {
      runStartedAt,
      seconds,
      sentences: asJson(
        sentences.map(({ text, start, end }) => ({ text, start, end })),
      ),
    };
    await this.visitService.writeIfStillWritable(
      actor,
      visitId,
      CONFIRMED_WHILE_PROCESSING,
      (tx) =>
        tx.visitConversationSegment.upsert({
          where: { visitId_runId_index: { visitId, runId, index } },
          create: { visitId, runId, index, ...data },
          update: data,
        }),
    );
    this.logger.log(
      { visitId, index, audioSeconds: Math.round(seconds) },
      "Conversation segment transcribed",
    );
    return { segments: others.length + 1, seconds: pendingSeconds + seconds };
  }

  /**
   * 대화 녹음 마치기: 서버에 있는 조각을 모두 구간 시작·번호 순으로 이어 한 번의 녹음으로 구술 문장에 더하고
   * (이전 구술이 있으면 그 뒤), 전체 문장으로 초안을 만든다. 이은 조각만 지운다 — 초안을 만드는 사이 늦게
   * 도착한 조각은 남아 다음 [초안 만들기]에 들어간다. 녹음 동의가 지워졌으면 403(버리기만 할 수 있다).
   */
  async finishConversation(
    actor: AuthenticatedUser,
    visitId: string,
  ): Promise<VisitDictation> {
    const context = await this.loadContext(actor, visitId, {
      requireRecordingConsent: true,
    });
    const [rows, previousRow] = await Promise.all([
      this.prisma.visitConversationSegment.findMany({
        where: { visitId },
        select: {
          id: true,
          runStartedAt: true,
          index: true,
          seconds: true,
          sentences: true,
        },
      }),
      this.prisma.visitDictation.findUnique({ where: { visitId } }),
    ]);
    if (rows.length === 0) {
      throw new NotFoundException("대화 녹음이 없습니다");
    }
    const seconds = rows.reduce((sum, row) => sum + row.seconds, 0);

    const previous = previousRow ? toVisitDictation(previousRow) : null;
    const take = (previous?.takes ?? 0) + 1;
    const newSentences = mergeConversationSegments(
      rows.map((row) => ({
        ...row,
        // 조각을 저장할 때 넣은 모양 그대로다.
        sentences:
          row.sentences as unknown as ConversationSegmentRow["sentences"],
      })),
      { take, firstNumber: (previous?.sentences.length ?? 0) + 1 },
    );
    const ids = rows.map((row) => row.id);
    if (newSentences.length === 0) {
      // 말소리가 없는 조각뿐이면 초안을 만들 것이 없다. 조각은 지운다(남겨 두면 확정을 막는다).
      await this.prisma.visitConversationSegment.deleteMany({
        where: { id: { in: ids } },
      });
      throw new UnprocessableEntityException(
        "대화에서 말소리를 알아듣지 못했습니다. 휴대폰을 대화하는 곳 가까이 두고 녹음해 주세요",
      );
    }

    const started = Date.now();
    const { dictation, issues } = await this.saveTake(actor, context, {
      previous,
      newSentences,
      take,
      seconds,
      // 이은 조각만 지운다(같은 트랜잭션).
      afterWrite: (tx) =>
        tx.visitConversationSegment.deleteMany({ where: { id: { in: ids } } }),
    });
    this.logger.log(
      {
        visitId,
        take,
        segments: rows.length,
        audioSeconds: Math.round(seconds),
        llmAndSaveMs: Date.now() - started,
        sentences: newSentences.length,
        issues,
      },
      "Conversation drafted",
    );
    return dictation;
  }

  /** 끝내지 않은 대화 녹음(올린 조각)을 버린다. 구술은 그대로 둔다. 동의가 지워져도 버릴 수 있다. */
  async discardConversation(
    actor: AuthenticatedUser,
    visitId: string,
  ): Promise<{ ok: true }> {
    await this.visitService.assertWritable(actor, visitId);
    await this.prisma.visitConversationSegment.deleteMany({
      where: { visitId },
    });
    return { ok: true };
  }

  /** 올렸지만 초안으로 만들지 않은 대화 녹음(방문의 조각 모두). */
  private async conversationProgress(
    visitId: string,
  ): Promise<ConversationProgress | null> {
    const { _count, _sum } =
      await this.prisma.visitConversationSegment.aggregate({
        where: { visitId },
        _count: true,
        _sum: { seconds: true },
      });
    return _count > 0 ? { segments: _count, seconds: _sum.seconds ?? 0 } : null;
  }

  /**
   * 녹음 한 번(구술 또는 대화)의 문장을 이전 문장 뒤에 붙여 전체로 초안을 만들고 저장한다.
   * 음성인식·초안에 걸린 사이에 확정됐으면 저장하지 않는다. afterWrite는 같은 트랜잭션에서 더 쓸 것.
   */
  private async saveTake(
    actor: AuthenticatedUser,
    context: DictationContext & { visitId: string },
    {
      previous,
      newSentences,
      take,
      seconds,
      afterWrite,
    }: {
      previous: VisitDictation | null;
      newSentences: readonly DictationSentence[];
      take: number;
      seconds: number;
      afterWrite?: (tx: Prisma.TransactionClient) => Promise<unknown>;
    },
  ): Promise<{ dictation: VisitDictation; issues: number }> {
    const { visitId } = context;
    const sentences = [...(previous?.sentences ?? []), ...newSentences];
    const draft = await this.makeDraft(visitId, sentences, context, previous);
    const row = await this.visitService.writeIfStillWritable(
      actor,
      visitId,
      CONFIRMED_WHILE_PROCESSING,
      async (tx, visit) => {
        const data = {
          sentences: asJson(sentences),
          ...draftColumns(draft, visit.formIds),
          takes: take,
          audioSeconds: (previous?.audioSeconds ?? 0) + seconds,
        };
        const saved = await tx.visitDictation.upsert({
          where: { visitId },
          create: { visitId, ...data },
          update: data,
        });
        await afterWrite?.(tx);
        return saved;
      },
    );
    return { dictation: toVisitDictation(row), issues: draft.issues.length };
  }

  /** 음성인식. STT가 실패하면 503(브라우저에 녹음이 남아 다시 보낸다). */
  private async transcribe(
    visitId: string,
    run: () => Promise<DictationSentence[]>,
  ): Promise<DictationSentence[]> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof SttError) {
        this.logger.error({ visitId, detail: error.detail }, "STT failed");
        throw new ServiceUnavailableException(
          `${error.message}. 잠시 후 다시 보내 주세요`,
        );
      }
      throw error;
    }
  }

  /**
   * 쓸 수 있는 방문인지 확인하고, 초안에 쓸 수급자 정보와 서식을 가져온다.
   * requireRecordingConsent면 수급자 대화 녹음 동의가 없을 때 403.
   */
  private async loadContext(
    actor: AuthenticatedUser,
    visitId: string,
    { requireRecordingConsent = false } = {},
  ): Promise<DictationContext & { visitId: string }> {
    const { formIds } = await this.visitService.assertWritable(actor, visitId);
    const {
      recipient: { recordingConsentOn, ...recipient },
    } = await this.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      select: {
        recipient: {
          select: {
            name: true,
            careGrade: true,
            notes: true,
            recordingConsentOn: true,
          },
        },
      },
    });
    if (requireRecordingConsent && !recordingConsentOn) {
      throw new ForbiddenException(NO_RECORDING_CONSENT);
    }
    return {
      visitId,
      recipient: { ...recipient, careGrade: toCareGrade(recipient.careGrade) },
      formIds,
    };
  }

  /**
   * 초안 만들기. 실패하면 이전 초안(있으면)을 그대로 두고 draftError만 남긴다.
   * 음성인식 결과는 이미 있으므로 요청 자체는 실패시키지 않는다.
   */
  private async makeDraft(
    visitId: string,
    sentences: readonly DictationSentence[],
    context: DictationContext,
    fallback: Pick<VisitDictation, "draft" | "issues" | "questions"> | null,
  ): Promise<DraftFields> {
    const keep = (draftError: string): DraftFields => ({
      draft: fallback?.draft ?? {},
      issues: fallback?.issues ?? [],
      questions: fallback?.questions ?? [],
      draftError,
    });

    if (!this.llmConfigured) return keep(LLM_NOT_CONFIGURED);

    const started = Date.now();
    try {
      const { draft, issues, questions, usage } = await this.pipeline.draft(
        sentences,
        context,
      );
      this.logger.log(
        { visitId, llmMs: Date.now() - started, usage },
        "Draft generated",
      );
      return { draft, issues, questions, draftError: null };
    } catch (error) {
      if (error instanceof LlmError) {
        this.logger.error({ visitId, detail: error.message }, "Draft failed");
        return keep(DRAFT_FAILED);
      }
      throw error;
    }
  }
}
