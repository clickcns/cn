import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import type { Role } from "@repo/shared-types";
import type { Request } from "express";
import { IS_PUBLIC_KEY, ROLES_KEY } from "../decorators/index.js";
import type { AuthenticatedUser } from "../types/authenticated-user.js";

/** 전역 가드. @Public()이 없으면 Bearer access token을 요구한다. */
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  /** passport 기본 메시지("Unauthorized")가 그대로 나가지 않게 한국어로 바꾼다. */
  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser | false) {
    if (err instanceof Error) throw err;
    if (err || !user) throw new UnauthorizedException("로그인이 필요합니다");
    return user;
  }
}

/** POST /auth/refresh 전용. 본문의 refreshToken을 검증한다. */
@Injectable()
export class JwtRefreshGuard extends AuthGuard("jwt-refresh") {}

/** 전역 가드. @Roles()가 붙은 엔드포인트의 역할을 확인한다. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;

    const user = context.switchToHttp().getRequest<Request>().user as
      AuthenticatedUser | undefined;
    return !!user && requiredRoles.includes(user.role);
  }
}
