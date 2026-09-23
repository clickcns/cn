import { Body, Controller, Get, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateRecipientSchema,
  RecipientListQuerySchema,
  UpdateRecipientSchema,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { RecipientService } from "./recipient.service.js";

class CreateRecipientDto extends createZodDto(CreateRecipientSchema) {}
class UpdateRecipientDto extends createZodDto(UpdateRecipientSchema) {}
class RecipientListQueryDto extends createZodDto(RecipientListQuerySchema) {}

/** 조회는 기관 소속 누구나, 등록·수정은 운영자와 기관 관리자만. */
@ApiTags("recipients")
@ApiBearerAuth()
@Controller("recipients")
export class RecipientController {
  constructor(private readonly recipientService: RecipientService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: RecipientListQueryDto,
  ) {
    return this.recipientService.list(actor, query);
  }

  @Get(":id")
  get(@CurrentUser() actor: AuthenticatedUser, @UuidParam() id: string) {
    return this.recipientService.get(actor, id);
  }

  @Roles("ADMIN", "MANAGER")
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateRecipientDto,
  ) {
    return this.recipientService.create(actor, dto);
  }

  @Roles("ADMIN", "MANAGER")
  @Patch(":id")
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: UpdateRecipientDto,
  ) {
    return this.recipientService.update(actor, id, dto);
  }
}
