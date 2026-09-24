import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
  type OnModuleDestroy,
} from "@nestjs/common";
import {
  DICTATION_MAX_SECONDS,
  keepDraftForms,
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

type DraftFields = Pick<
  VisitDictation,
  "draft" | "issues" | "questions" | "draftError"
>;

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
    const row = await this.prisma.visitDictation.findUnique({
      where: { visitId },
    });
    return { dictation: row ? toVisitDictation(row) : null };
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

    let pcm: Buffer;
    let seconds: number;
    try {
      ({ pcm, seconds } = readPcmWav(audio));
    } catch (error) {
      if (error instanceof WavFormatError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
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
    let newSentences: DictationSentence[];
    try {
      newSentences = await this.pipeline.transcribe(pcm, context, {
        take,
        firstNumber: previousSentences.length + 1,
      });
    } catch (error) {
      if (error instanceof SttError) {
        this.logger.error({ visitId, detail: error.detail }, "STT failed");
        throw new ServiceUnavailableException(
          `${error.message}. 잠시 후 다시 보내 주세요`,
        );
      }
      throw error;
    }
    const sttMs = Date.now() - started;
    if (newSentences.length === 0) {
      throw new UnprocessableEntityException(
        "말소리를 알아듣지 못했습니다. 휴대폰을 입 가까이 대고 다시 녹음해 주세요",
      );
    }

    const sentences = [...previousSentences, ...newSentences];
    const draft = await this.makeDraft(visitId, sentences, context, previous);

    // 음성인식·초안에 걸린 사이에 확정됐으면 저장하지 않는다.
    const row = await this.visitService.writeIfStillWritable(
      actor,
      visitId,
      CONFIRMED_WHILE_PROCESSING,
      (tx, visit) => {
        const data = {
          sentences: asJson(sentences),
          ...draftColumns(draft, visit.formIds),
          takes: take,
          audioSeconds: (previous?.audioSeconds ?? 0) + seconds,
        };
        return tx.visitDictation.upsert({
          where: { visitId },
          create: { visitId, ...data },
          update: data,
        });
      },
    );
    this.logger.log(
      {
        visitId,
        take,
        audioSeconds: Math.round(seconds),
        sttMs,
        totalMs: Date.now() - started,
        sentences: sentences.length,
        issues: draft.issues.length,
      },
      "Dictation processed",
    );
    return toVisitDictation(row);
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
    await this.prisma.visitDictation.deleteMany({ where: { visitId } });
    return { ok: true };
  }

  /** 쓸 수 있는 방문인지 확인하고, 초안에 쓸 수급자 정보와 서식을 가져온다. */
  private async loadContext(
    actor: AuthenticatedUser,
    visitId: string,
  ): Promise<DictationContext> {
    const { formIds } = await this.visitService.assertWritable(actor, visitId);
    const { recipient } = await this.prisma.visit.findUniqueOrThrow({
      where: { id: visitId },
      select: {
        recipient: { select: { name: true, careGrade: true, notes: true } },
      },
    });
    return {
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
