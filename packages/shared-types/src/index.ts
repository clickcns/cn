// 오류 문구 한국어 설정을 가장 먼저 적용한다.
import "./locale.js";

export * from "./roles.js";
export * from "./programs.js";
export * from "./forms/index.js";
export * from "./auth.js";
export * from "./organization.js";
export * from "./user.js";
export * from "./recipient.js";
export * from "./visit.js";
export * from "./dictation.js";
export * from "./date.js";
export * from "./schema.js";
export * from "./text.js";

/** 서버 오류 응답 본문. */
export interface ApiErrorBody {
  statusCode: number;
  message: string;
  errors?: unknown;
  timestamp: string;
  path: string;
}
