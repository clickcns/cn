import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { RecipientRecordQuerySchema } from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { VisitService } from "./visit.service.js";

class RecipientRecordQueryDto extends createZodDto(
  RecipientRecordQuerySchema,
) {}

/** 수급자의 지난 기록(과거력). 방문 기록을 읽으므로 방문 모듈에 둔다. */
@ApiTags("visits")
@ApiBearerAuth()
@Controller("recipients")
export class RecipientRecordsController {
  constructor(private readonly visitService: VisitService) {}

  /**
   * 지난 기록(최신순): 같은 기관의 확정 기록은 작성자·직종과 상관없이 읽기 전용, 확정 전 기록은 본인 것만.
   * 현장 직원도 다른 직원의 확정 기록을 보는 유일한 길이다(조건은 record-history.ts).
   */
  @Get(":id/records")
  records(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Query() query: RecipientRecordQueryDto,
  ) {
    return this.visitService.records(actor, id, query);
  }
}
