import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "../../config/config.service.js";
import type {
  RefreshContext,
  RefreshTokenPayload,
} from "../types/authenticated-user.js";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField("refreshToken"),
      ignoreExpiration: false,
      secretOrKey: configService.jwtRefreshSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: RefreshTokenPayload): RefreshContext {
    const { refreshToken } = req.body as { refreshToken: string };
    return { userId: payload.sub, sessionId: payload.sid, refreshToken };
  }
}
