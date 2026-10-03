import { SetMetadata } from "@nestjs/common";
import type { AccessAction, AccessTargetType } from "@repo/shared-types";
import type { Request } from "express";

export const ACCESS_LOG_KEY = "accessLog";
export const NO_ACCESS_LOG_KEY = "noAccessLog";

type SubjectIds = readonly (string | null | undefined)[];

/**
 * 처리한 대상. 방문·수급자·사용자·기관 하나는 경로 값 `:id`(param)나 응답의 id(result)에서, 목록은
 * 응답에서 정보주체(수급자) id와 수를 꺼낸다.
 */
export type AccessTarget =
  | { kind: AccessTargetType; from: "param" | "result" }
  | {
      kind: "list";
      recipients?: (result: unknown) => SubjectIds;
      count?: (result: unknown) => number;
    };

export interface AccessLogSpec {
  action: AccessAction;
  /** 작업 이름(예: "방문 기록 확정") */
  label: string;
  target?: AccessTarget;
  /**
   * 기본 상세(경로 값과, 조회는 검색 조건·바꾸는 요청은 바꾼 칸 이름) 대신 남길 내용.
   * 비밀 값은 넣지 않는다.
   */
  detail?: (request: Request) => Record<string, unknown>;
}

/**
 * 이 API의 접속기록: 누가 언제 어디서 어떤 정보주체를 어떻게 처리했나(응답이 끝나면 성공·실패·가드
 * 거절 모두 한 줄). 모든 API는 이것이나 @NoAccessLog 중 하나를 단다(access-log.spec.ts가 본다).
 */
export const AccessLog = (
  action: AccessAction,
  label: string,
  target?: AccessTarget,
  detail?: AccessLogSpec["detail"],
) =>
  SetMetadata(ACCESS_LOG_KEY, {
    action,
    label,
    target,
    detail,
  } satisfies AccessLogSpec);

/** 접속기록을 남기지 않는 API(개인정보를 다루지 않는다 등). 까닭을 적는다. */
export const NoAccessLog = (reason: string) =>
  SetMetadata(NO_ACCESS_LOG_KEY, reason);

/** 경로 값 `:id`의 대상. 처리 전에(지우기) 또는 함께 정보주체·기관을 찾는다. */
export const fromParam = (kind: AccessTargetType): AccessTarget => ({
  kind,
  from: "param",
});

/** 응답의 id가 대상(새로 만든 것). */
export const fromResult = (kind: AccessTargetType): AccessTarget => ({
  kind,
  from: "result",
});

/** 목록: 응답에서 정보주체(수급자) id들, 수급자가 아닌 목록(사용자 등)은 수만. */
export function listOf<T>(
  recipients?: (result: T) => SubjectIds,
  count?: (result: T) => number,
): AccessTarget {
  return {
    kind: "list",
    recipients: recipients as ((result: unknown) => SubjectIds) | undefined,
    count: count as ((result: unknown) => number) | undefined,
  };
}
