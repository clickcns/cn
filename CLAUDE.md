# CLAUDE.md

Guidance for Claude Code.

## Project Overview

케어노트(CareNote): 방문 의료·간호·복지 기록 도우미. 의사·간호사·사회복지사가 방문(또는 상담) 1건의 법정 서식을 작성·확정하고, 기관 관리자와 운영자가 사용자·수급자·방문을 관리한다. 방문 직후 말하면 그 방문의 서식 초안을 만드는 "음성 구술 → 서식 초안"(STT + LLM)이 있다.

- 사업과 서식(자세한 규칙은 아래 "사업·서식"):
  - 일차의료 방문진료(심평원): 의사 — 별지 제4호 일차의료 방문진료 점검서식
  - 장기요양 재택의료센터(공단): 의사 — 별지 제4호 + 제6호 방문점검 기록지(의사), 간호사 — 제7호, 사회복지사 — 제8호
  - 장기요양 방문간호: 간호사 — 별지 제14호 급여제공기록지

- 이번 단계는 **React 웹 우선**이다. React Native 모바일 앱은 나중에 만들며, 그때 `@repo/shared-types`·`@repo/api-client`를 그대로 재사용한다.
- 구 레포 `D:\Apps\_carenote`(RN 앱 포함, 포트 3100/5173/5501)와는 별개다. 로컬 포트·컨테이너 이름이 겹치지 않게 골랐다.

## Monorepo Structure

Turborepo + pnpm 11 워크스페이스.

| 워크스페이스                                           | 설명                                                                  | 포트 |
| ------------------------------------------------------ | --------------------------------------------------------------------- | ---- |
| `apps/server` (`@repo/server`)                         | NestJS 11 + Prisma 7(PostgreSQL) 백엔드, prefix `/api`                | 3210 |
| `apps/web` (`@repo/web`)                               | 현장 웹: 의사·간호사·사회복지사용 반응형 웹(React 19 + Vite 8, PWA)   | 5210 |
| `apps/web-admin` (`@repo/web-admin`)                   | 운영자·기관 관리자용 관리 웹                                          | 5211 |
| `packages/shared-types`                                | zod 스키마·타입·상수 — 서버 DTO와 웹 폼 검증이 같은 스키마를 쓴다     |      |
| `packages/api-client`                                  | ky HTTP 클라이언트(토큰 갱신) + zustand 인증 스토어 + 엔드포인트 함수 |      |
| `packages/typescript-config`, `packages/eslint-config` | 공유 설정                                                             |      |

로컬 PostgreSQL 18은 `apps/server/docker-compose.yml`(컨테이너 `carenote-pg`, 포트 5510). 18 이미지는 볼륨을 `/var/lib/postgresql`에 붙인다(`…/data` 아님).

## Commands

```bash
pnpm infra:up        # PostgreSQL 기동 (infra:down / infra:reset)
pnpm db:migrate      # prisma migrate dev (스키마 변경 시 새 마이그레이션 생성)
pnpm db:seed         # 데모 기관·계정·수급자·방문 (비밀번호 1234, 내용은 docs/seed-data.md)
pnpm dev             # server + web + web-admin (turbo, Ctrl+C로 함께 종료)
pnpm dev:server | dev:web | dev:admin
pnpm build           # 전체 빌드
pnpm test            # 단위 테스트(서버: node:test + tsx, *.spec.ts)
pnpm check-types     # 전체 타입 체크
pnpm lint            # 전체 린트
pnpm format          # Prettier
pnpm --filter @repo/server dictation:eval <녹음 파일...> [--forms 서식ID,...] [--name 수급자] [--notes 메모] [--json]
                     # 구술 녹음 → 서식 초안 평가(화면 없이). WAV가 아니면 ffmpeg로 바꾼다
```

## 권한 모델

- 역할(권한): `ADMIN`(운영자, 소속 기관 없음) · `MANAGER`(기관 관리자) · `STAFF`(현장 직원).
- 직종(`profession`): `DOCTOR` · `NURSE` · `SOCIAL_WORKER`. 방문 때 쓰는 서식을 정한다. 현장 직원은 필수, 기관 관리자는 직접 방문할 때만, 운영자는 없음. 면허·자격번호(`licenseNumber`)는 서식에 적는다.
- 방문은 직종이 있는 사용자(`canBeAssignedVisits`)에게 배정한다. 확정하지 않은 방문이 있으면 소속 기관·직종을 바꿀 수 없다(409, 서식이 직종으로 정해지므로).
- 기관 범위는 `apps/server/src/core/utils/org-scope.ts`에서 강제한다. ADMIN은 `organizationId` 쿼리로 기관을 고르고, 그 외는 자기 기관으로 고정된다. 다른 기관 데이터는 404로 응답한다(존재 여부 비노출).
- 현장 직원은 본인 방문만 조회한다(`visit.service.ts`의 `visitScope`가 목록·단건에 같은 조건을 건다). 기록 작성·확정은 담당자 본인만 한다. 확정된 기록은 수정할 수 없다.
- 역할·직종 규칙은 `shared-types/src/roles.ts` 한 곳: 배정 가능(`canBeAssignedVisits`), 기관·직종 필요 여부(`requiresOrganization`·`requiresProfession`·`allowsProfession`), 부여 가능 역할(`assignableRoles`), 앱별 로그인 가능 역할(`LOGIN_CLIENT_ROLES`). 서버와 두 웹이 같은 함수를 쓴다.
- 로그인 요청에 `client`(`FIELD_WEB`/`ADMIN_WEB`)를 보내면 서버가 비밀번호 확인 뒤, 세션을 만들기 전에 역할을 확인해 403으로 거절한다.

## 인증

- access token(기본 15분) + refresh token(기본 14일). refresh 토큰은 기기·앱별 `RefreshSession`에 SHA-256 해시로 저장하고, 갱신할 때마다 교체한다. 이미 교체된 토큰이 다시 오면 탈취로 보고 그 세션을 끊는다.
- 토큰 교체는 "지금 해시일 때만" 쓰는 조건부 update다(동시 갱신·되살아난 세션 방지).
- `JwtStrategy`는 매 요청 `RefreshSession`을 조회한다. 그래서 로그아웃·비밀번호 재설정·탈취 탐지로 세션이 지워지면 이미 발급된 access token도 즉시 막힌다.
- 사용 중지·비밀번호 재설정 시 그 사용자의 세션을 모두 끊는다.
- `TRUST_PROXY`(기본 loopback)가 요청 제한이 보는 클라이언트 IP를 정한다. 인그레스 뒤에 배포하면 앞단 프록시 수(보통 `1`)를 넣는다. 넓게 잡으면 X-Forwarded-For 위조로 로그인 제한을 우회할 수 있다.
- 프론트: 로그인·갱신 결과는 `setSession()` **한 번에** 저장한다(토큰과 user를 나눠 set하면 중간 상태가 렌더링된다). 401 갱신은 `api-client`의 `refreshSession()` 하나를 공유한다.
- 프론트 갱신 규칙 두 가지(`api-client/src/http.ts`):
  - 갱신 전에 저장소를 다시 읽는다. 다른 탭이 이미 갱신했으면 그 토큰을 쓴다(옛 토큰으로 갱신하면 서버가 세션을 끊는다). 저장소 변경은 `storage` 이벤트로 따라간다.
  - 갱신이 401·403으로 거절될 때만 로그아웃한다. 네트워크 오류·시간 초과·5xx는 세션을 지우지 않는다(작성 중이던 기록이 사라진다).
- 세션이 끊기면 각 앱이 React Query 캐시를 비운다(이전 사용자의 데이터가 다음 사용자에게 보이지 않게).

## 도메인 규칙

- 시간대는 한국 표준시(UTC+9). 날짜 쿼리(`date`, `from`, `to`)는 KST 날짜이며 `to`는 그날을 포함한다. 변환은 `shared-types/src/date.ts`.
- 방문 상태: `SCHEDULED`(예정) → `DRAFT`(기록 저장) → `CONFIRMED`(확정). 예정 상태만 삭제할 수 있다(`canDeleteVisit`, `isRecordEditable`). 서버는 상태 조건을 건 update/deleteMany로 동시 요청에도 규칙을 지킨다.
- 선택 입력의 빈 문자열("", 공백만)은 **스키마가 null로 바꾼다**(`shared-types/src/schema.ts`의 `blankToNull`·`optionalText`). undefined는 "변경 없음", null은 "지움". 서버·폼에서 따로 정리하지 않는다.
- 교차 필드 규칙도 스키마에 둔다: 방문 시각(`checkVisitTimes` — 종료 ≥ 시작, 24시간 이내)은 `SaveVisitRecordSchema`, 시작일 ≤ 종료일은 `VisitListQuerySchema`.
  - 저장 요청은 시작·종료 중 한쪽만 올 수 있으므로 서버가 저장된 값과 합친 뒤 `checkVisitTimes`로 다시 확인한다.
- 방문 시각은 실제 방문 날짜 기준이다. 현장 웹 기록 화면에 "방문 날짜"를 두고, 자정을 넘긴 방문은 사용자가 "다음 날 종료"를 직접 체크한다(종료 < 시작을 자동으로 다음 날로 보지 않는다 — 오타가 23시간 방문이 되지 않게).
- 요청 타입(`*Input`)은 클라이언트가 보내는 모양(`z.input`)이다. 서버 서비스는 검증 결과(`z.output<typeof Schema>`)를 받는다.
- 방문 목록(`VisitSummary`)의 수급자는 이름·등급·주소만 싣는다. 연락처·보호자·메모는 상세(`VisitDetail`)에서만.
- 방문 목록은 페이지 단위다(`page`, `pageSize` ≤ 200, 방문 일시·id 오름차순). 응답의 `total`·`statusCounts`는 조건 전체 기준이므로 화면의 건수는 받은 목록을 세지 말고 이 값을 쓴다.
- 방문은 담당자의 기관에 묶인다. 확정하지 않은 방문(예정·작성 중)이 있는 사용자는 소속 기관을 바꿀 수 없다(역할을 운영자로 바꿔 기관이 비는 경우 포함, 409).
- Prisma enum과 shared-types 상수(`ROLES`, `PROFESSIONS`, `PROGRAMS`, `GENDERS`, `VISIT_STATUSES`)는 값이 일치해야 한다.

## 사업·서식 (서식 엔진)

- 사업(`Program`): `PRIMARY_CARE`(일차의료 방문진료) · `HOME_CARE_CENTER`(재택의료센터) · `LTC_NURSING`(장기요양 방문간호). 기관은 하는 사업 목록(`Organization.programs`)을 갖는다.
- 수급자는 등록(동의)한 사업 목록(`Recipient.programs`, 기관 사업의 부분집합)을 갖고, 방문의 사업은 그중에서 고른다. 등록할 때는 하나 이상이어야 하고, 수정할 때는 비어도 저장된다(등록 사업이 빈 수급자도 고치거나 사용 중지할 수 있게). 규칙은 `recipient.ts`의 `checkRecipientPrograms`(스키마와 서버가 함께 쓴다):
  - 재택의료센터·장기요양 방문간호는 장기요양등급이 있어야 한다(`requiresCareGrade`).
  - 재택의료센터와 일차의료 방문진료를 함께 등록하지 않는다. 재택의료센터 수급자의 의사 방문은 늘 재택의료센터 방문(제6호, 청구하면 제4호도)이라, 일차의료로 등록하면 제6호 없는 방문이 생긴다.
  - 기관에서 사업을 빼면 그 기관 수급자의 등록 사업에서도 뺀다(`organization.service.ts`).
- 방문의 서식은 **사업 × 담당자 직종**의 규칙(`programs.ts`의 `PROGRAM_FORMS`) 안에서 고른다. 규칙은 서식마다 필수/선택이고, 선택 서식은 `defaultOn`(미리 켜 둠)·`when`(쓰는 때 안내)을 갖는다. 화면의 선택 상태(`FormChoices`: 켠·끈 선택 서식)를 규칙 순서 목록으로 바꾸는 `resolveFormIds`는 두 웹과 서버 기본값이 쓰고, 요청으로 온 목록의 검사·정리는 서버가 `selectForms`로 한다.
  - 재택의료센터 의사: 제6호(공단) 필수, 제4호(심평원) 선택·기본 켬 — 방문진료료를 청구할 때만 쓴다(의사 월 한도 초과·비청구 방문은 제6호만).
  - 방문을 만들 때 고르고(`CreateVisitSchema.formIds`, 없으면 기본값), 확정 전까지 담당자가 기록 화면에서 선택 서식을 켜고 끈다(`PUT /visits/:id/forms`, 뺀 서식의 저장 값과 구술 초안의 그 서식 부분은 지운다).
  - `Visit.formIds`에 저장해 두므로 나중에 직종·규칙이 바뀌어도 그 방문의 서식은 그대로다.
- 서식 정의는 `shared-types/src/forms/`에 서식마다 한 파일이다. 칸 종류는 하나 고르기(`single`)·여러 개 고르기(`multi`)·숫자(`number`)·글(`text`)이고, 선택 항목에 괄호 내용(`detail`: 글·선택·제공 시간(분)+메모)을 붙일 수 있다. 이 정의 하나에서 저장 검사 스키마(`formDataSchema`), 현장 웹 입력 화면(`apps/web/src/features/forms`), 관리 웹 보기, 구술 초안 요청·검사, 표시 문구(`formatFieldValue`)가 나온다. **지침이 개정되면 서식 정의만 고친다.**
- 칸 속성: `dictation`(구술로 채움), `carryOver`(같은 수급자의 지난 방문 값을 기본값으로 — 대상자 구분·거동불편 유형·이동 정보 등), `question`(초안에서 비면 되묻는 질문, 같은 문구는 한 번만 묻는다).
- 서식 속성: `numberPairs`(한 줄로 적는 숫자 짝 — 혈압 수축기/이완기. 입력 화면과 초안 검사가 이 선언만 본다), `followUps`(여러 칸이 모두 비었을 때 묻는 질문), `sttTerms`(음성인식 힌트 용어), 글 칸의 `softLimit`(공단 앱 200자처럼 넘으면 경고만). 활력징후 칸과 혈압 짝은 `forms/common.ts`에서 함께 쓴다.
- 서식 검사 스키마(`formDataSchema`)는 서식마다 한 번만 만들어 재사용한다. 이월 값(`carryOver`)은 담당자가 확정 전 방문을 열 때만 찾는다.
- 저장은 방문 단위로 모든 서식을 함께 보낸다(`PUT /visits/:id/record` → `{ forms: { 서식ID: 값 }, startedAt, endedAt }`, `VisitForm` 테이블에 서식별 한 행). 확정은 방문의 모든 서식이 저장돼 있고 서식 정의를 통과해야 한다.
- 저장·서식 바꾸기·확정·구술 저장은 방문 행을 잠그고(`visit.service.ts`의 `lockWritable`, `SELECT … FOR UPDATE`) 담당자·확정 여부·서식 목록을 다시 읽은 뒤 쓴다. 그래서 확정은 그 순간의 서식 목록이 모두 저장됐는지 본다.
- 이월 값은 방문 상세의 `carryOver`로 준다(아직 저장하지 않은 서식에만, 이 방문보다 앞선 같은 수급자의 같은 서식에서).
- 서식 머리(기관명·기호, 수급자 생년월일·등급·장기요양인정번호·주소, 담당자 이름·면허번호, 방문일·시각)는 서식 값이 아니라 기관·수급자·사용자·방문 정보에서 온다. 주민등록번호(별지 제4호)는 저장하지 않는다(심평원 화면의 재진 불러오기를 쓴다).
- 별지 제7호(간호사) 원 서식은 한 달 5회 방문을 칸으로 적는 월간 양식이다. 여기서는 방문 1건이 한 칸이고, 향후계획·총평도 방문마다 적는다(월간 서식으로 모을 때 그 달 마지막 값을 쓴다).
- 서식 원본은 각 시범사업 지침의 부록이다(일차의료 방문진료 수가 시범사업 지침 별지 제4호, 장기요양 재택의료센터 시범사업 지침 별지 제6~8호, 장기요양 방문간호는 별지 제14호). 항목 이름과 구분은 원본과 협력 기관 확인으로 확정한다.

## 음성 구술 → 서식 초안

흐름: 현장 웹 녹음(MediaRecorder) → 브라우저에서 16kHz·모노 WAV로 변환(`features/dictation/lib/wav.ts`) → `POST /visits/:id/dictation` → STT → 문장(S1, S2…) → LLM 초안(방문의 서식 모두를 한 번에) → 자동 검사 → 되묻기 질문 → `VisitDictation` 저장 → 담당자가 "서식에 채우기" → 기존 [임시 저장]·[확정].

- **초안은 기록이 아니다.** 폼에 채울 뿐이고, 저장·확정은 기존 기록 API가 한다. 자동 제출 없음.
- 서버 구성(`apps/server/src/`):
  - `speech/` STT gRPC 클라이언트(cns `speech-stt-app`, Whisper)와 WAV 해석
  - `llm/` OpenAI 호환 chat completions 클라이언트. JSON 스키마(`response_format`)로 형태를 강제하고 zod로 다시 검사한다. 기본은 Gemini, 주소·모델만 바꿔 vLLM·Ollama 등으로 갈아탈 수 있다.
  - `dictation/dictation.pipeline.ts` Nest에 묶이지 않은 파이프라인. 평가 스크립트(`scripts/dictation-eval.ts`)도 그대로 쓴다.
  - `dictation/lib/` 문장 나누기, 서식 정의에서 만드는 프롬프트·LLM 응답 스키마(`draft-prompt.ts`), 한글 숫자 해석, 초안 검사기(단위 테스트 있음)
- 초안(`RecordDraft`)은 서식별 `{ values, evidence }`다. values는 서식 값과 같은 모양(채운 칸만), evidence 키는 칸 키 또는 "칸키.항목값". 여러 개 고르는 칸을 폼에 채울 때는 이미 고른 항목에 합친다.
- 초안에는 만들 때 쓴 서식마다 키가 있다(채운 칸이 없어도). 그래서 초안 키에 없는 서식은 그 뒤에 더한 서식이고, 현장 웹이 [초안 다시 만들기]를 안내한다. 서식을 빼면 서버가 초안에서 그 서식의 값·검사 결과·되묻기를 지운다(`keepDraftForms`). 녹음을 처리하는 사이에 뺀 서식도 저장 직전(잠근 상태)에 같은 방법으로 지운다. 두 서식에 같은 검사 문제가 나오면 서식마다 남기고, 같은 문구는 화면에서 한 번만 보여 준다.
- **숫자는 코드로 다시 대조한다**(`validate-draft.ts`): LLM은 값마다 근거 문장 ID와 숫자 원문(quote)을 돌려주고, 근거 문장에 quote가 있고 quote를 읽은 값이 같고 칸 범위 안일 때만 남긴다(증감 칸은 크기로 대조). 아니면 비우고 `issues`(removed)에 이유를 남긴다. 근거 문장이 없는 선택·글도 뺀다. 비운 값은 되묻기 질문이 된다. 글 칸의 숫자가 구술에 없으면 확인 요청(check)만 남긴다.
- 되묻기 답은 `append=true`로 올려 이전 문장 뒤에 이어 붙이고(번호 이어서), 전체 문장으로 초안을 다시 만든다.
- 실패 처리: STT가 실패하면 저장하지 않는다(503, 브라우저에 녹음이 남아 [다시 보내기]). 초안만 실패하면 문장은 저장하고 `draftError`를 남긴다([초안 다시 만들기] = `POST …/dictation/redraft`).
- 권한은 기록 작성과 같다(`VisitService.assertWritable`: 담당자, 확정 전). 녹음 요청은 따로 분당 20회로 제한한다.
- 설정(`apps/server/.env`): `STT_GRPC_URL`, `LLM_BASE_URL`, `LLM_API_KEY`(비면 음성인식까지만), `LLM_MODEL`(기본 `gemini-3.8-flash`), `LLM_REASONING_EFFORT`.
- 개발용 STT 주소는 cns NodePort(인터넷에 평문 gRPC)다. 실제 대상자 음성은 넣지 않는다. 클러스터에 배포하면 `speech-stt-app.default.svc.cluster.local:50051`을 쓴다. 실제 대상자 데이터 단계에서는 LLM도 저장·학습하지 않는 기업용 API나 자체 서버로 바꾼다.
- 브라우저 마이크는 `localhost` 또는 HTTPS에서만 켜진다.

## 워크스페이스 패키지 해석

- `@repo/shared-types`의 package.json `exports`에 `"@repo/source"` 조건(→ `src/index.ts`)이 있다. 이 조건을 켠 쪽만 src를 읽는다.
  - 웹 두 개: vite `resolve.conditions`, tsconfig는 `@repo/typescript-config/react.json`의 `customConditions`. HMR 즉시 반영, alias·paths 불필요.
  - 서버(Node·tsc): 조건을 모르므로 **dist**(CJS)를 쓴다. turbo가 `^build`로 먼저 빌드한다.
- `@repo/api-client`는 빌드 없이 src를 바로 export한다(웹 전용). 오류 문구(`getErrorMessage`)·재시도 규칙(`shouldRetryQuery`)도 여기 있다. 오래 걸리는 요청은 `withTimeout(ms)`로 시간 제한을 준다(401 뒤 토큰 갱신 재요청에도 같은 제한이 걸린다).
- 새 워크스페이스 패키지를 만들 때도 같은 `"@repo/source"` 조건을 쓰면 앱 설정을 고칠 필요가 없다. 추후 React Native(Metro)는 `resolver.unstable_conditionNames`에 같은 조건을 넣는다.

## Development Workflow

코드 변경 후 루트에서 `pnpm build`와 `pnpm lint`로 전체를 검증한다. `check-types`만으로는 Vite 번들링·Nest 빌드 실패를 놓칠 수 있다.

## Code Style

- Prettier: 세미콜론, 더블 쿼트, 2칸, trailing comma, printWidth 80, Tailwind 클래스 정렬
- 서버 import는 `.js` 확장자(nodenext)
- UI 텍스트와 에러 메시지는 한국어
