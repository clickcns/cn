import {
  Controller,
  Get,
  Header,
  Query,
  type StreamableFile,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AccessLogQuerySchema } from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { AccessLog } from "./access-log.decorator.js";
import { AccessLogService } from "./access-log.service.js";
import { fileResponse } from "../core/utils/file-response.js";

class AccessLogQueryDto extends createZodDto(AccessLogQuerySchema) {}

/**
 * 접속기록 보기·내려받기. 기관 관리자는 자기 기관 기록, 운영자는 전체(organizationId로 좁힌다).
 * 보고 내려받는 것도 접속기록으로 남는다.
 */
@ApiTags("access-logs")
@ApiBearerAuth()
@Roles("ADMIN", "MANAGER")
@Controller("access-logs")
export class AccessLogController {
  constructor(private readonly accessLogService: AccessLogService) {}

  @Get()
  @AccessLog("VIEW", "접속기록 조회")
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AccessLogQueryDto,
  ) {
    return this.accessLogService.list(actor, query);
  }

  @Get("export")
  @Header("Cache-Control", "no-store")
  @AccessLog("DOWNLOAD", "접속기록 내려받기")
  async export(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: AccessLogQueryDto,
  ): Promise<StreamableFile> {
    const csv = await this.accessLogService.exportCsv(actor, query);
    return fileResponse(Buffer.from(csv, "utf8"), {
      type: "text/csv; charset=utf-8",
      filename: `접속기록_${query.from}_${query.to}.csv`,
      fallbackName: "access-log.csv",
    });
  }
}
