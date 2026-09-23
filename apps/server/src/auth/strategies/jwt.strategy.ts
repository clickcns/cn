import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "../../config/config.service.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  AccessTokenPayload,
  AuthenticatedUser,
} from "../types/authenticated-user.js";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.jwtAccessSecret,
    });
  }

  /**
   * 매 요청 세션과 사용자 상태를 DB에서 다시 읽는다(조회 1회).
   * - 로그아웃·비밀번호 재설정·탈취 탐지로 세션이 지워지면 access token도 곧바로 막힌다.
   * - 역할 변경·사용 중지도 즉시 반영된다.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
      select: {
        userId: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            role: true,
            profession: true,
            organizationId: true,
            isActive: true,
          },
        },
      },
    });
    const user = session?.user;
    if (
      !session ||
      !user ||
      session.userId !== payload.sub ||
      session.expiresAt < new Date() ||
      !user.isActive
    ) {
      throw new UnauthorizedException("로그인이 필요합니다");
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      profession: user.profession,
      organizationId: user.organizationId,
      sessionId: payload.sid,
    };
  }
}
