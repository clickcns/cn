import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { setAccessLogHolder } from "./access-log.context.js";
import { ACCESS_LOG_KEY, type AccessLogSpec } from "./access-log.decorator.js";
import { AccessLogService } from "./access-log.service.js";

/**
 * 접속기록의 시작: 전역 가드 중 맨 앞(요청 제한·인증·역할 가드보다 먼저)에서 @AccessLog를 단 요청에
 * 자리를 만들고, 응답이 끝나면(또는 연결이 끊기면) 한 번 남긴다. 그래서 뒤 가드가 막은 요청(역할 403,
 * 로그인 요청 제한 429)도 최종 상태로 남는다. 막지는 않는다.
 */
@Injectable()
export class AccessLogGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessLogs: AccessLogService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") return true;
    const spec = this.reflector.getAllAndOverride<AccessLogSpec | undefined>(
      ACCESS_LOG_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!spec) return true;
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const holder = { spec, prepared: null };
    setAccessLogHolder(response, holder);

    let recorded = false;
    const record = () => {
      if (recorded) return;
      recorded = true;
      void this.accessLogs.record(request, response, holder);
    };
    response.once("finish", record);
    response.once("close", record);
    return true;
  }
}
