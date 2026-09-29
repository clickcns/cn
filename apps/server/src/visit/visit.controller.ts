import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateVisitSchema,
  SameDayWarningQuerySchema,
  SaveVisitRecordSchema,
  UpdateVisitFormsSchema,
  UpdateVisitSchema,
  VisitCalendarQuerySchema,
  VisitListQuerySchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { VisitService } from "./visit.service.js";

class CreateVisitDto extends createZodDto(CreateVisitSchema) {}
class SaveVisitRecordDto extends createZodDto(SaveVisitRecordSchema) {}
class UpdateVisitFormsDto extends createZodDto(UpdateVisitFormsSchema) {}
class UpdateVisitDto extends createZodDto(UpdateVisitSchema) {}
class VisitListQueryDto extends createZodDto(VisitListQuerySchema) {}
class SameDayWarningQueryDto extends createZodDto(SameDayWarningQuerySchema) {}
class VisitCalendarQueryDto extends createZodDto(VisitCalendarQuerySchema) {}

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits")
export class VisitController {
  constructor(private readonly visitService: VisitService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: VisitListQueryDto,
  ) {
    return this.visitService.list(actor, query);
  }

  /** 기간 안의 날짜별 상태 건수(달력, 최대 42일). ":id"보다 먼저 둔다. */
  @Get("calendar")
  calendar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: VisitCalendarQueryDto,
  ) {
    return this.visitService.calendar(actor, query);
  }

  /** 만들려는 방문의 같은 날 경고. ":id"보다 먼저 둔다. */
  @Get("same-day-warnings")
  sameDayWarnings(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SameDayWarningQueryDto,
  ) {
    return this.visitService.sameDayWarnings(actor, query);
  }

  @Get(":id")
  get(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.get(actor, id);
  }

  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateVisitDto) {
    return this.visitService.create(actor, dto);
  }

  /**
   * 방문 일정·담당자 바꾸기(기관 관리자·운영자). 확정 방문은 일정을,
   * 기록을 쓰기 시작한 방문은 담당자를 바꿀 수 없다(409).
   */
  @Patch(":id")
  @Roles("ADMIN", "MANAGER")
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.visitService.update(actor, id, dto);
  }

  @Put(":id/record")
  saveRecord(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: SaveVisitRecordDto,
  ) {
    return this.visitService.saveRecord(actor, id, dto);
  }

  /** 확정 전 선택 서식 켜고 끄기(담당자 본인). 뺀 서식의 저장 값은 지워진다. */
  @Put(":id/forms")
  updateForms(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: UpdateVisitFormsDto,
  ) {
    return this.visitService.updateForms(actor, id, dto);
  }

  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.confirm(actor, id);
  }

  /** 확정한 기록을 작성 중으로 되돌린다(담당자 본인). 고친 뒤 다시 확정한다. */
  @Post(":id/reopen")
  @HttpCode(HttpStatus.OK)
  reopen(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.reopen(actor, id);
  }

  @Delete(":id")
  remove(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.remove(actor, id);
  }
}
