import { HTTPError, TimeoutError } from "ky";

/** 서버가 message를 주지 못했을 때(프록시 오류 등) 상태 코드별 한국어 문구. */
export function defaultMessageForStatus(status: number): string {
  if (status === 401) return "로그인이 만료되었습니다. 다시 로그인해 주세요";
  if (status === 403) return "이 작업을 할 권한이 없습니다";
  if (status === 404) return "요청한 정보를 찾을 수 없습니다";
  if (status >= 500) {
    return "서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요";
  }
  return "요청을 처리하지 못했습니다";
}

/** HTTP 응답이 있는 오류면 상태 코드, 아니면 undefined. */
export function getErrorStatus(error: unknown): number | undefined {
  return error instanceof HTTPError ? error.response.status : undefined;
}

/**
 * 화면에 보여 줄 한국어 오류 문구.
 * HTTP 오류는 createHttpClient의 beforeError가 이미 한국어 message를 넣어 둔다.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요",
): string {
  if (error instanceof HTTPError) return error.message;
  if (error instanceof TimeoutError) {
    return "서버 응답이 늦습니다. 잠시 후 다시 시도해 주세요";
  }
  // fetch 자체가 실패하면(오프라인·서버 꺼짐) TypeError가 난다.
  if (error instanceof TypeError) {
    return "서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요";
  }
  return fallback;
}

/** TanStack Query retry: 4xx는 다시 보내도 같으므로 연결 오류·5xx만 한 번 더 시도한다. */
export function shouldRetryQuery(failureCount: number, error: unknown) {
  const status = getErrorStatus(error);
  if (status !== undefined && status < 500) return false;
  return failureCount < 1;
}
