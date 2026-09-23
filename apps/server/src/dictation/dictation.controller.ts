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
import { DICTATION_MAX_SECONDS } from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import { CurrentUser } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { STT_SAMPLE_RATE } from "../speech/wav.js";
import { DictationService } from "./dictation.service.js";

/** 16kHz·16비트 모노 WAV 최대 길이 + 여유 */
const MAX_UPLOAD_BYTES = (DICTATION_MAX_SECONDS + 30) * STT_SAMPLE_RATE * 2;
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

@ApiTags("dictation")
@ApiBearerAuth()
@Controller("visits/:id/dictation")
export class DictationController {
  constructor(private readonly dictationService: DictationService) {}

  @Get()
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
  redraft(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.dictationService.redraft(actor, id);
  }

  @Delete()
  remove(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.dictationService.remove(actor, id);
  }
}
