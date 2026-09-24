import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateVisitSchema,
  SaveVisitRecordSchema,
  UpdateVisitFormsSchema,
  VisitListQuerySchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { VisitService } from "./visit.service.js";

class CreateVisitDto extends createZodDto(CreateVisitSchema) {}
class SaveVisitRecordDto extends createZodDto(SaveVisitRecordSchema) {}
class UpdateVisitFormsDto extends createZodDto(UpdateVisitFormsSchema) {}
class VisitListQueryDto extends createZodDto(VisitListQuerySchema) {}

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

  @Get(":id")
  get(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.get(actor, id);
  }

  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateVisitDto) {
    return this.visitService.create(actor, dto);
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

  @Delete(":id")
  remove(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.visitService.remove(actor, id);
  }
}
