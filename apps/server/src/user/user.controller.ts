import { Body, Controller, Get, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserListQuerySchema,
  type UserSummary,
} from "@repo/shared-types";
import { createZodDto } from "nestjs-zod";
import {
  AccessLog,
  fromParam,
  fromResult,
  listOf,
} from "../access-log/access-log.decorator.js";
import { CurrentUser, Roles } from "../auth/decorators/index.js";
import type { AuthenticatedUser } from "../auth/types/authenticated-user.js";
import { UuidParam } from "../core/decorators/uuid-param.js";
import { UserService } from "./user.service.js";

class CreateUserDto extends createZodDto(CreateUserSchema) {}
class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
class UserListQueryDto extends createZodDto(UserListQuerySchema) {}

/** 운영자는 전체, 기관 관리자는 자기 기관 사용자만 다룬다. */
@ApiTags("users")
@ApiBearerAuth()
@Roles("ADMIN", "MANAGER")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  @AccessLog(
    "VIEW",
    "사용자 목록",
    listOf<UserSummary[]>(undefined, (result) => result.length),
  )
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: UserListQueryDto,
  ) {
    return this.userService.list(actor, query);
  }

  @Post()
  @AccessLog("PERMISSION", "사용자 등록", fromResult("user"))
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.userService.create(actor, dto);
  }

  @Patch(":id")
  @AccessLog("PERMISSION", "사용자 정보·권한 변경", fromParam("user"))
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @UuidParam() id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.userService.update(actor, id, dto);
  }
}
