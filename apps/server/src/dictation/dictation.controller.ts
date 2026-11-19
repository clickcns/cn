import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import {
  CONVERSATION_MAX_RUN_SEGMENTS,
  CONVERSATION_SEGMENT_MAX_SECONDS,
  DICTATION_MAX_SECONDS,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { AccessLog, fromParam } from "../access-log/access-log.decorator.js";
import { CurrentUser } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { STT_SAMPLE_RATE } from "../speech/wav.js";
import { DictationService } from "./dictation.service.js";

/** 16kHz·16비트 모노 WAV 최대 길이 + 여유 */
const MAX_UPLOAD_BYTES = (DICTATION_MAX_SECONDS + 30) * STT_SAMPLE_RATE * 2;
const MAX_SEGMENT_BYTES =
  (CONVERSATION_SEGMENT_MAX_SECONDS + 30) * STT_SAMPLE_RATE * 2;
/** 음성인식(GPU)·LLM 비용이 드는 요청이라 따로 제한한다. */
const DICTATION_THROTTLE = { default: { limit: 20, ttl: 60_000 } };

const DictationUploadSchema = z.object({
  /** "true"면 이전 구술 뒤에 이어 붙인다(되묻기 답). multipart 필드라 문자열이다. */
  append: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
class DictationUploadDto extends createZodDto(DictationUploadSchema) {}

/** 대화 녹음 조각의 multipart 필드(문자열). */
const ConversationSegmentSchema = z.object({
  /** 마이크를 켠 구간(브라우저가 정한 uuid) */
  runId: z.uuid(),
  /** 구간을 시작한 때(ISO 시각) — 조각을 잇는 순서 */
  runStartedAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  /** 구간 안 번호 */
  index: z.coerce
    .number()
    .int()
    .min(0)
    .max(CONVERSATION_MAX_RUN_SEGMENTS - 1),
});
class ConversationSegmentDto extends createZodDto(ConversationSegmentSchema) {}

@ApiTags("dictation")
@ApiBearerAuth()
@Controller("visits/:id/dictation")
export class DictationController {
  constructor(private readonly dictationService: DictationService) {}

  @Get()
  @AccessLog("VIEW", "구술 초안", fromParam("visit"))
  get(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.dictationService.get(actor, id);
  }

  /** 녹음(16kHz·모노·16비트 WAV) → 음성인식 → 기록 초안. 보통 10~30초 걸린다. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle(DICTATION_THROTTLE)
  @UseInterceptors(
    FileInterceptor("audio", {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["audio"],
      properties: {
        audio: { type: "string", format: "binary" },
        append: { type: "string", enum: ["true", "false"] },
      },
    },
  })
  @AccessLog("CREATE", "구술 녹음 보내기", fromParam("visit"))
  record(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: DictationUploadDto,
  ) {
    if (!file) throw new BadRequestException("녹음 파일이 없습니다");
    return this.dictationService.record(actor, id, file.buffer, dto.append);
  }

  /** 저장된 문장으로 초안만 다시 만든다. */
  @Post("redraft")
  @HttpCode(HttpStatus.OK)
  @Throttle(DICTATION_THROTTLE)
  @AccessLog("UPDATE", "구술 초안 다시 만들기", fromParam("visit"))
  redraft(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.dictationService.redraft(actor, id);
  }

  /** 방문 중 대화 녹음 조각(16kHz·모노 WAV, 3분 안팎)을 음성인식해 둔다. 수급자 녹음 동의가 있어야 한다. */
  @Post("conversation/segments")
  @HttpCode(HttpStatus.OK)
  @Throttle(DICTATION_THROTTLE)
  @UseInterceptors(
    FileInterceptor("audio", {
      limits: { fileSize: MAX_SEGMENT_BYTES, files: 1 },
    }),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["audio", "runId", "runStartedAt", "index"],
      properties: {
        audio: { type: "string", format: "binary" },
        runId: { type: "string", format: "uuid" },
        runStartedAt: { type: "string", format: "date-time" },
        index: { type: "integer" },
      },
    },
  })
  @AccessLog("CREATE", "대화 녹음 보내기", fromParam("visit"))
  recordConversationSegment(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ConversationSegmentDto,
  ) {
    if (!file) throw new BadRequestException("녹음 파일이 없습니다");
    return this.dictationService.recordConversationSegment(
      actor,
      id,
      file.buffer,
      dto,
    );
  }

  /** 대화 녹음을 마치고 서버에 있는 조각을 모두 이어 초안을 만든다(이전 구술이 있으면 그 뒤에 이어 붙인다). */
  @Post("conversation/finish")
  @HttpCode(HttpStatus.OK)
  @Throttle(DICTATION_THROTTLE)
  @AccessLog("UPDATE", "대화 녹음 초안 만들기", fromParam("visit"))
  finishConversation(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
  ) {
    return this.dictationService.finishConversation(actor, id);
  }

  @Delete("conversation")
  @AccessLog("DELETE", "대화 녹음 버리기", fromParam("visit"))
  discardConversation(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
  ) {
    return this.dictationService.discardConversation(actor, id);
  }

  @Delete()
  @AccessLog("DELETE", "구술 지우기", fromParam("visit"))
  remove(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.dictationService.remove(actor, id);
  }
}
