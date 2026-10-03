import type { Response } from "express";
import type { AccessLogSpec } from "./access-log.decorator.js";
import type { ResolvedTarget } from "./access-log.entry.js";

/**
 * 한 요청의 접속기록 자리(response.locals). 가드가 만들고, 인터셉터가 대상 찾기와 응답 값을 채우며,
 * 응답이 끝나면 서비스가 읽어 남긴다. 가드에서 막힌 요청은 대상 찾기·응답 값이 없다.
 */
export interface AccessLogHolder {
  spec: AccessLogSpec;
  /** 경로 값 대상을 찾는 중(인터셉터가 시작) */
  prepared: Promise<ResolvedTarget | null> | null;
  /** 핸들러가 돌려준 값 */
  result?: unknown;
}

const HOLDER = "accessLog";
/** 에러 필터가 보낸 오류 문구(사용자가 본 그대로 남기려고) */
const ERROR_MESSAGE = "errorMessage";

export function setAccessLogHolder(
  response: Response,
  holder: AccessLogHolder,
): void {
  response.locals[HOLDER] = holder;
}

export function accessLogHolder(
  response: Response,
): AccessLogHolder | undefined {
  return response.locals[HOLDER] as AccessLogHolder | undefined;
}

export function setResponseErrorMessage(
  response: Response,
  message: string,
): void {
  response.locals[ERROR_MESSAGE] = message;
}

export function responseErrorMessage(response: Response): string | undefined {
  const message: unknown = response.locals[ERROR_MESSAGE];
  return typeof message === "string" ? message : undefined;
}
