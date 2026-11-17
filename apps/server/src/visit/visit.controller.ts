import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateVisitSchema,
  HomeCareMonthQuerySchema,
  MarkPortalEntrySchema,
  PortalQueueQuerySchema,
  SameDayWarningQuerySchema,
  SaveVisitRecordSchema,
  UpdateVisitFormsSchema,
  UpdateVisitSchema,
  UsualDurationsQuerySchema,
  VisitCalendarQuerySchema,
  VisitListQuerySchema,
  type HomeCareMonthResponse,
  type PortalQueueResponse,
  type UsualDurationsResponse,
  type VisitCalendarResponse,
  type VisitListResponse,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import {
  AccessLog,
  fromParam,
  fromResult,
  listOf,
  NoAccessLog,
} from "../access-log/access-log.decorator.js";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { HomeCareService } from "./home-care.service.js";
import { PortalEntryService } from "./portal-entry.service.js";
import { VisitService } from "./visit.service.js";

class CreateVisitDto extends createZodDto(CreateVisitSchema) {}
class SaveVisitRecordDto extends createZodDto(SaveVisitRecordSchema) {}
class UpdateVisitFormsDto extends createZodDto(UpdateVisitFormsSchema) {}
class UpdateVisitDto extends createZodDto(UpdateVisitSchema) {}
class VisitListQueryDto extends createZodDto(VisitListQuerySchema) {}
class SameDayWarningQueryDto extends createZodDto(SameDayWarningQuerySchema) {}
class VisitCalendarQueryDto extends createZodDto(VisitCalendarQuerySchema) {}
class PortalQueueQueryDto extends createZodDto(PortalQueueQuerySchema) {}
class MarkPortalEntryDto extends createZodDto(MarkPortalEntrySchema) {}
class UsualDurationsQueryDto extends createZodDto(UsualDurationsQuerySchema) {}
class HomeCareMonthQueryDto extends createZodDto(HomeCareMonthQuerySchema) {}

@ApiTags("visits")
@ApiBearerAuth()
@Controller("visits")
export class VisitController {
  constructor(
    private readonly visitService: VisitService,
    private readonly portalEntryService: PortalEntryService,
    private readonly homeCareService: HomeCareService,
  ) {}

  @Get()
  @AccessLog(
    "VIEW",
    "방문 목록",
    listOf((result: VisitListResponse) =>
      result.items.map((visit) => visit.recipient.id),
    ),
  )
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: VisitListQueryDto,
  ) {
    return this.visitService.list(actor, query);
  }

  /** 기간 안의 날짜별 상태 건수(달력, 최대 42일). ":id"보다 먼저 둔다. */
  @Get("calendar")
  @AccessLog(
    "VIEW",
    "방문 달력",
    listOf((result: VisitCalendarResponse) =>
      (result.visits ?? []).map((visit) => visit.recipient.id),
    ),
  )
  calendar(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: VisitCalendarQueryDto,
  ) {
    return this.visitService.calendar(actor, query);
  }

  /** 만들려는 방문의 같은 날 경고. ":id"보다 먼저 둔다. */
  @Get("same-day-warnings")
  @NoAccessLog("방문 등록 화면 보조: 같은 날 경고 문구만 준다")
  sameDayWarnings(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: SameDayWarningQueryDto,
  ) {
    return this.visitService.sameDayWarnings(actor, query);
  }

  /**
   * 확정했지만 심평원·공단에 넣었다고 표시하지 않은 서식(포털 미입력 목록). 기본 기간은 지난달 1일부터
   * 오늘까지. ":id"보다 먼저 둔다.
   */
  @Get("portal-queue")
  @AccessLog(
    "VIEW",
    "포털 미입력 목록",
    listOf((result: PortalQueueResponse) =>
      result.items.map((item) => item.recipient.id),
    ),
  )
  portalQueue(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: PortalQueueQueryDto,
  ) {
    return this.portalEntryService.queue(actor, query);
  }

  /**
   * 재택의료 수입: 그달 재택의료센터 방문(금액 셈에 쓰는 사실만)과 수급자별 직전 연속 개월.
   * 기관 관리자·운영자. ":id"보다 먼저 둔다.
   */
  @Get("home-care-month")
  @Roles("ADMIN", "MANAGER")
  @AccessLog(
    "VIEW",
    "재택의료 수입",
    listOf((result: HomeCareMonthResponse) =>
      result.recipients.map((recipient) => recipient.id),
    ),
  )
  homeCareMonth(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: HomeCareMonthQueryDto,
  ) {
    return this.homeCareService.month(actor, query);
  }

  /**
   * 그날 본인 방문의 평소 방문 시간(현장 웹 동선 1단계 — 같은 수급자의 확정 기록에서 분만).
   * ":id"보다 먼저 둔다.
   */
  @Get("usual-durations")
  @AccessLog(
    "VIEW",
    "평소 방문 시간",
    listOf((result: UsualDurationsResponse) =>
      result.items.map((item) => item.recipientId),
    ),
  )
  usualDurations(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: UsualDurationsQueryDto,
  ) {
    return this.visitService.usualDurations(actor, query);
  }

  @Get(":id")
  @AccessLog("VIEW", "방문 기록", fromParam("visit"))
  get(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.get(actor, id);
  }

  @Post()
  @AccessLog("CREATE", "방문 등록", fromResult("visit"))
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateVisitDto) {
    return this.visitService.create(actor, dto);
  }

  /**
   * 방문 일정·담당자 바꾸기(기관 관리자·운영자). 확정 방문은 일정을,
   * 기록을 쓰기 시작한 방문은 담당자를 바꿀 수 없다(409).
   */
  @Patch(":id")
  @Roles("ADMIN", "MANAGER")
  @AccessLog("UPDATE", "방문 일정·담당자 변경", fromParam("visit"))
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: UpdateVisitDto,
  ) {
    return this.visitService.update(actor, id, dto);
  }

  @Put(":id/record")
  @AccessLog("UPDATE", "방문 기록 저장", fromParam("visit"))
  saveRecord(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: SaveVisitRecordDto,
  ) {
    return this.visitService.saveRecord(actor, id, dto);
  }

  /** 확정 전 선택 서식 켜고 끄기(담당자 본인). 뺀 서식의 저장 값은 지워진다. */
  @Put(":id/forms")
  @AccessLog("UPDATE", "방문 서식 바꾸기", fromParam("visit"))
  updateForms(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: UpdateVisitFormsDto,
  ) {
    return this.visitService.updateForms(actor, id, dto);
  }

  @Post(":id/confirm")
  @HttpCode(HttpStatus.OK)
  @AccessLog("UPDATE", "방문 기록 확정", fromParam("visit"))
  confirm(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.confirm(actor, id);
  }

  /** 확정한 기록을 작성 중으로 되돌린다(담당자 본인). 고친 뒤 다시 확정한다. */
  @Post(":id/reopen")
  @HttpCode(HttpStatus.OK)
  @AccessLog("UPDATE", "확정 되돌리기", fromParam("visit"))
  reopen(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.reopen(actor, id);
  }

  /** 방문 서식의 포털 입력 표시. 방문을 볼 수 있으면 본다. */
  @Get(":id/portal-entries")
  @AccessLog("VIEW", "포털 입력 표시", fromParam("visit"))
  portalEntries(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
  ) {
    return this.portalEntryService.entries(actor, id);
  }

  /** 확정한 서식을 포털에 넣었다고 표시한다(담당자 본인·관리자, 방문을 볼 수 있는 사람). */
  @Put(":id/portal-entries/:formId")
  @AccessLog("UPDATE", "포털 입력 완료 표시", fromParam("visit"))
  markPortalEntry(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Param("formId") formId: string,
    @Body() dto: MarkPortalEntryDto,
  ) {
    return this.portalEntryService.mark(actor, id, formId, dto);
  }

  /** 포털 입력 표시를 지운다. */
  @Delete(":id/portal-entries/:formId")
  @AccessLog("UPDATE", "포털 입력 표시 지우기", fromParam("visit"))
  unmarkPortalEntry(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Param("formId") formId: string,
  ) {
    return this.portalEntryService.unmark(actor, id, formId);
  }

  /** 확정본 이력(1차, 2차 …, 요약만). 방문을 볼 수 있으면 본다. */
  @Get(":id/versions")
  @AccessLog("VIEW", "확정 이력", fromParam("visit"))
  versions(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.versions(actor, id);
  }

  /** 확정본 한 벌(1차, 2차 …): 보관한 기록 값과 위변조 확인. 방문을 볼 수 있으면 본다. */
  @Get(":id/versions/:version")
  @AccessLog("VIEW", "확정본 보기", fromParam("visit"))
  version(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Param("version", ParseIntPipe) version: number,
  ) {
    return this.visitService.version(actor, id, version);
  }

  @Delete(":id")
  @AccessLog("DELETE", "방문 삭제", fromParam("visit"))
  remove(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.remove(actor, id);
  }
}
