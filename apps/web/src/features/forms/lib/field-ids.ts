/** 서식 입력 칸의 DOM id. basePath는 폼 경로("forms.PRIMARY_CARE_CHECK")다. */
export const inputId = (basePath: string, key: string, suffix = "") =>
  `${basePath}-${key}${suffix}`.replace(/[^a-zA-Z0-9_-]/g, "-");

/** 칸 하나(라벨+입력)를 감싼 요소의 id. 확정 전 빈 필수 칸으로 스크롤할 때 쓴다. */
export const fieldElementId = (basePath: string, key: string) =>
  inputId(basePath, key, "-field");
