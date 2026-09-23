import {
  createParamDecorator,
  SetMetadata,
  type ExecutionContext,
} from "@nestjs/common";
import type { Role } from "@repo/shared-types";
import type { Request } from "express";

export const IS_PUBLIC_KEY = "isPublic";
/** 인증 없이 호출할 수 있는 엔드포인트. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = "roles";
/** 지정한 역할만 호출할 수 있는 엔드포인트. 없으면 로그인한 모든 사용자. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** request.user(AuthenticatedUser 또는 RefreshContext)를 주입한다. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<Request>().user,
);
