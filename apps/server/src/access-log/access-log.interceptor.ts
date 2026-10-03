import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { from, Observable, switchMap, tap } from "rxjs";
import { accessLogHolder } from "./access-log.context.js";
import { paramId } from "./access-log.entry.js";
import { AccessLogService } from "./access-log.service.js";

/**
 * 접속기록 가드를 지난 요청: 경로 값 대상(방문·수급자 등)의 정보주체·기관 찾기를 핸들러와 함께
 * 시작하고(지우는 요청만 먼저 찾는다 — 지운 뒤에는 찾을 수 없다), 핸들러가 돌려준 값을 담아 둔다.
 * 남기기는 응답이 끝날 때 가드가 건 쪽에서 한다.
 */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  constructor(private readonly accessLogs: AccessLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const http = context.switchToHttp();
    const holder = accessLogHolder(http.getResponse<Response>());
    if (!holder) return next.handle();

    const target = holder.spec.target;
    if (target && target.kind !== "list" && target.from === "param") {
      holder.prepared = this.accessLogs.resolveTarget(
        target.kind,
        paramId(http.getRequest<Request>()),
      );
    }
    const handle = () =>
      next.handle().pipe(
        tap((result) => {
          holder.result = result;
        }),
      );
    return holder.spec.action === "DELETE" && holder.prepared
      ? from(holder.prepared).pipe(switchMap(handle))
      : handle();
  }
}
