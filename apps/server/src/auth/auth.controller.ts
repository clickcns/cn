import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";
import { CurrentUser, Public } from "./decorators/index.js";
import { LoginDto, RefreshDto } from "./dto/index.js";
import { JwtRefreshGuard } from "./guards/index.js";
import type {
  AuthenticatedUser,
  RefreshContext,
} from "./types/authenticated-user.js";

/** 비밀번호 대입을 늦추기 위해 로그인은 IP당 분당 10회로 제한한다. */
const LOGIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } } as const;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle(LOGIN_THROTTLE)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@CurrentUser() context: RefreshContext, @Body() _dto: RefreshDto) {
    return this.authService.refresh(context);
  }

  @ApiBearerAuth()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  logout(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logout(user);
  }

  @ApiBearerAuth()
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }
}
