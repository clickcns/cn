import type { Profession, Role } from "@repo/shared-types";

/** JwtStrategy가 request.user에 싣는 현재 사용자. */
export interface AuthenticatedUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  profession: Profession | null;
  organizationId: string | null;
  /** 이 access token을 발급한 로그인 세션 */
  sessionId: string;
}

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role: Role;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
}

/** JwtRefreshStrategy가 request.user에 싣는 값. */
export interface RefreshContext {
  userId: string;
  sessionId: string;
  refreshToken: string;
}
