import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtRefreshStrategy } from "./strategies/jwt-refresh.strategy.js";
import { JwtStrategy } from "./strategies/jwt.strategy.js";

@Module({
  // secret·만료는 발급 시점에 AuthService가 ConfigService에서 넘긴다.
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy],
})
export class AuthModule {}
