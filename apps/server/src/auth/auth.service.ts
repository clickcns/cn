import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  canUseClient,
  LOGIN_CLIENT_DENIED_MESSAGES,
  type AuthResponse,
  type AuthUser,
  type LoginSchema,
} from "@repo/shared-types";
import * as bcrypt from "bcryptjs";
import type { z } from "zod";
import { ConfigService } from "../config/config.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toAuthUser, userSelect, type UserRow } from "../user/user.mapper.js";
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  RefreshContext,
  RefreshTokenPayload,
} from "./types/authenticated-user.js";

/**
 * 없는 아이디로 로그인해도 bcrypt 비교 시간을 똑같이 써서, 응답 시간으로 계정 존재를
 * 알 수 없게 한다. 임의 문자열의 해시를 미리 계산해 둔 값(시작 시 계산하면 ~65ms 멈춘다).
 */
const DUMMY_PASSWORD_HASH =
  "$2b$10$k37f6LwcldX.4Z4Ot02ACeGbRZFEoaWvuf4/MGA5CLsfm3cnbb/7e";

const INVALID_CREDENTIALS = "아이디 또는 비밀번호가 올바르지 않습니다";
const SESSION_EXPIRED = "로그인이 만료되었습니다. 다시 로그인해 주세요";
const INACTIVE_ACCOUNT =
  "사용이 중지된 계정입니다. 기관 관리자에게 문의해 주세요";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login({
    username,
    password,
    client,
  }: z.output<typeof LoginSchema>): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { ...userSelect, password: true },
    });

    const passwordValid = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_PASSWORD_HASH,
    );
    if (!user || !passwordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (!user.isActive) {
      throw new ForbiddenException(INACTIVE_ACCOUNT);
    }
    // 그 앱을 쓸 수 없는 역할은 세션을 만들기 전에 거절한다(비밀번호 확인 뒤라 역할이 새지 않는다).
    if (client && !canUseClient(user.role, client)) {
      throw new ForbiddenException(LOGIN_CLIENT_DENIED_MESSAGES[client]);
    }

    // 만료된 세션은 로그인할 때 함께 정리한다.
    await this.prisma.refreshSession.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    const sessionId = randomUUID();
    const tokens = await this.signTokens(user, sessionId);
    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash: sha256(tokens.refreshToken),
        expiresAt: this.refreshExpiresAt(),
      },
    });
    return { ...tokens, user: toAuthUser(user) };
  }

  /**
   * refresh token을 교체한다. 이미 교체된 이전 토큰이 다시 들어오거나 만료됐으면
   * 세션을 끊는다(탈취가 의심되면 정상 사용자와 공격자 모두 다시 로그인해야 한다).
   */
  async refresh({
    userId,
    sessionId,
    refreshToken,
  }: RefreshContext): Promise<AuthResponse> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
      include: { user: { select: userSelect } },
    });
    if (!session || session.userId !== userId) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (
      !sameHash(session.tokenHash, sha256(refreshToken)) ||
      session.expiresAt < new Date()
    ) {
      await this.prisma.refreshSession.deleteMany({
        where: { id: session.id },
      });
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    if (!session.user.isActive) {
      throw new ForbiddenException(INACTIVE_ACCOUNT);
    }

    const tokens = await this.signTokens(session.user, session.id);
    // 토큰 교체는 "지금 해시일 때만" 조건부로 쓴다. 동시에 두 번 갱신되거나,
    // 그사이 로그아웃·재사용 탐지로 세션이 지워졌다면 여기서 걸러진다(세션이 되살아나지 않는다).
    const { count } = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, tokenHash: session.tokenHash },
      data: {
        tokenHash: sha256(tokens.refreshToken),
        expiresAt: this.refreshExpiresAt(),
      },
    });
    if (count === 0) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    return { ...tokens, user: toAuthUser(session.user) };
  }

  async logout(user: AuthenticatedUser): Promise<{ ok: true }> {
    await this.prisma.refreshSession.deleteMany({
      where: { id: user.sessionId, userId: user.id },
    });
    return { ok: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });
    if (!user) throw new NotFoundException("사용자를 찾을 수 없습니다");
    return toAuthUser(user);
  }

  /** access·refresh 토큰을 만든다. 세션 저장은 호출한 쪽이 한다. */
  private async signTokens(
    user: UserRow,
    sessionId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      sid: sessionId,
      role: user.role,
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      sid: sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.config.jwtAccessSecret,
        expiresIn: this.config.jwtAccessTtlSec,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.config.jwtRefreshSecret,
        expiresIn: this.config.jwtRefreshTtlSec,
        // 같은 초에 두 번 발급해도 토큰이 달라지도록 jti를 넣는다.
        jwtid: randomUUID(),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private refreshExpiresAt(): Date {
    return new Date(Date.now() + this.config.jwtRefreshTtlSec * 1000);
  }
}
