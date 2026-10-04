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
                     # 시작 전에 그 포트(3210·5210·5211)를 쓰는 이전 dev 실행 묶음을 끝낸다
                     # (scripts/free-dev-ports.mjs: 포트를 잡은 프로세스에서 turbo·pnpm까지 올라가 트리째 끝내고,
                     #  사용자 셸과 dev 명령이 아닌 node는 건드리지 않는다)
                     # (남는 까닭은 스크립트 머리 주석. 떠 있는 dev가 있을 때 dev 명령을 또 실행하면 그 dev를 끝낸다)
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
- 관리 웹: 운영자는 헤더 [기관 선택](`OrganizationScopeSelect`, 고른 값은 브라우저에 저장) 하나로 모든 화면의 목록을 한 기관으로 좁힌다(`useScopeOrganizationId`). 화면마다 기관 콤보박스를 따로 두지 않는다. "전체 기관"이면 목록(사용자·수급자·방문, 달력의 수급자 패널·고른 날 표)을 기관별로 묶고(`OrganizationGroupedRows`), 묶음 머리 줄의 [이 기관만 보기]가 헤더 선택을 그 기관으로 바꾼다.
- 현장 직원은 본인 방문만 조회한다(`visit.service.ts`의 `visitScope`가 목록·단건에 같은 조건을 건다). 예외는 지난 기록(아래 "지난 기록(과거력)") 하나다 — 같은 기관 수급자의 확정 기록은 작성자·직종과 상관없이 읽기 전용으로 본다. 기록 작성·확정은 담당자 본인만 한다. 확정된 기록은 바로 고칠 수 없고, 담당자가 [수정](`POST /visits/:id/reopen`, `canReopenVisit`)으로 작성 중으로 되돌린 뒤 고쳐 다시 확정한다. 되돌려도 이전 확정본은 지우지 않는다(아래 "확정본 이력").
- 기관 관리자·운영자는 방문 일정과 담당자를 바꾼다(`PATCH /visits/:id`, 기록 내용은 못 고친다). 일정은 확정 전(`canRescheduleVisit`), 담당자는 예정 상태이고 구술이 없을 때만(`canReassignVisit`, 남의 녹음이 넘어가지 않게) 바꾼다. 새 담당자는 같은 기관의 활성 사용자이고 그 사업을 맡을 수 있어야 하며, 서식은 새 직종 규칙으로 다시 고른다(`formIdsForNewStaff`: 두 직종에 모두 있는 선택 서식만 이전 선택을 잇는다). 검사는 `visit-update.ts`의 `planVisitUpdate`(순수 함수), 쓰기는 방문 행을 잠근 뒤 한다. 화면이 본 일시(`expectedScheduledAt`)가 지금 값과 다르면 409.
- 역할·직종 규칙은 `shared-types/src/roles.ts` 한 곳: 배정 가능(`canBeAssignedVisits`), 기관·직종 필요 여부(`requiresOrganization`·`requiresProfession`·`allowsProfession`), 부여 가능 역할(`assignableRoles`), 앱별 로그인 가능 역할(`LOGIN_CLIENT_ROLES`). 서버와 두 웹이 같은 함수를 쓴다.
- 로그인 요청에 `client`(`FIELD_WEB`/`ADMIN_WEB`)를 보내면 서버가 비밀번호 확인 뒤, 세션을 만들기 전에 역할을 확인해 403으로 거절한다.

## 인증

- access token(기본 15분) + refresh token(기본 14일). refresh 토큰은 기기·앱별 `RefreshSession`에 SHA-256 해시로 저장하고, 갱신할 때마다 교체한다. 이미 교체된 토큰이 다시 오면 탈취로 보고 그 세션을 끊는다.
- 토큰 교체는 "지금 해시일 때만" 쓰는 조건부 update다(동시 갱신·되살아난 세션 방지).
- `JwtStrategy`는 매 요청 `RefreshSession`을 조회한다. 그래서 로그아웃·비밀번호 재설정·탈취 탐지로 세션이 지워지면 이미 발급된 access token도 즉시 막힌다.
- 사용 중지·비밀번호 재설정 시 그 사용자의 세션을 모두 끊는다.
- 본인 비밀번호 바꾸기(`POST /auth/password`, `ChangePasswordSchema`): 지금 비밀번호가 맞아야 하고(틀리면 400 — 401이면 앱이 갱신 뒤 로그아웃시키므로), 지금 세션은 두고 다른 세션만 끊는다. 로그인처럼 분당 10회로 제한한다. 현장 웹 "내 정보"와 관리 웹 헤더의 [비밀번호 변경]이 쓴다(폼은 확인 칸이 있는 `ChangePasswordFormSchema`). 다른 사용자의 비밀번호는 관리 웹 사용자 화면의 [비밀번호 재설정]으로 바꾼다.
- 비밀번호는 8자 이상(`shared-types/src/user.ts`). `pnpm dev`로 띄운 서버(`ALLOW_SHORT_PASSWORDS=true`, 운영에서 켜면 시작하지 않음)와 관리 웹 개발 서버는 시작할 때 `allowShortPasswordsForDev()`를 불러 4자부터 받는다(시드 비밀번호 1234처럼). 운영 빌드·운영 서버는 8자 그대로다.
- `TRUST_PROXY`(기본 loopback)가 요청 제한이 보는 클라이언트 IP를 정한다. 인그레스 뒤에 배포하면 앞단 프록시 수(보통 `1`)를 넣는다. 넓게 잡으면 X-Forwarded-For 위조로 로그인 제한을 우회할 수 있다.
- 프론트: 로그인·갱신 결과는 `setSession()` **한 번에** 저장한다(토큰과 user를 나눠 set하면 중간 상태가 렌더링된다). 401 갱신은 `api-client`의 `refreshSession()` 하나를 공유한다.
- 프론트 갱신 규칙 두 가지(`api-client/src/http.ts`):
  - 갱신 전에 저장소를 다시 읽는다. 다른 탭이 이미 갱신했으면 그 토큰을 쓴다(옛 토큰으로 갱신하면 서버가 세션을 끊는다). 저장소 변경은 `storage` 이벤트로 따라간다.
  - 갱신이 401·403으로 거절될 때만 로그아웃한다. 네트워크 오류·시간 초과·5xx는 세션을 지우지 않는다(작성 중이던 기록이 사라진다).
- 세션이 끊기면 각 앱이 React Query 캐시를 비운다(이전 사용자의 데이터가 다음 사용자에게 보이지 않게).

## 접속기록 (개인정보 안전성 확보조치 기준 제8조·제5조)

- 표 `AccessLog`(access_logs): 누가(아이디·이름·역할 — 사용자가 바뀌어도 남게 그때 값), 언제, 어디서(IP, `TRUST_PROXY`), 무엇을(`action`: 로그인·로그인 실패·로그아웃·조회·등록·수정·삭제·내려받기·권한 변경과 작업 이름 `label`), 누구 정보를(정보주체 `recipientIds` — 목록은 앞쪽 500명과 수 `subjectCount`, 대상 `targetType`·`targetId`), 어느 기관 정보를(`organizationIds`), 결과(`status`), 상세(`detail`: 경로 값(id 빼고)과 검색 조건 또는 바꾼 칸 **이름만** — 기록 내용·비밀번호 값은 남기지 않는다, 실패하면 사용자가 본 오류 문구). 외래 키를 두지 않는다. 고칠 수 없고 3년이 지난 행만 지울 수 있다(마이그레이션의 트리거 `access_logs_guard`, TRUNCATE도 막는다). 개발 DB에서 시험 행을 지우려면 트리거를 잠시 끈다(DB 소유자만 된다).
- 남기기: API마다 `@AccessLog(action, label, target, detail)`(`access-log/access-log.decorator.ts`: 대상은 `fromParam("visit")`(경로 `:id`)·`fromResult("recipient")`(응답 id)·`listOf(응답 → 수급자 id)`) 또는 `@NoAccessLog(까닭)`을 단다 — `access-log.spec.ts`가 모든 컨트롤러 경로를 읽어 빠진 것을 잡는다(**새 API를 더하면 둘 중 하나를 꼭 단다**).
  - 흐름: 전역 가드 맨 앞 `AccessLogGuard`(`core/providers/global.providers.ts`, 막지 않음)가 자리(`response.locals`)를 만들고 응답이 끝나면(`finish`/`close`) 한 번 남긴다 → 그래서 뒤 가드가 막은 요청(역할 403, 로그인 요청 제한 429)도 최종 상태로 남는다. 전역 인터셉터 `AccessLogInterceptor`는 경로 값 대상의 정보주체·기관 찾기를 핸들러와 함께 시작하고(지우기만 먼저 — 지운 뒤에는 못 찾는다) 핸들러가 돌려준 값을 담는다. 오류 문구는 `ErrorFilter`가 담아 둔 것(사용자가 본 그대로). 남기기는 `AccessLogService.record`, 한 줄 만들기는 순수 함수 `buildAccessLog`(`access-log.entry.ts`). 남기지 못하면 그 줄 전체를 서버 로그에 남긴다.
  - 기관(`organizationIds`): 대상의 기관, 목록이면 나온 수급자들의 기관(운영자가 "전체 기관"으로 본 것도 각 기관 관리자에게 보인다), 로그인 실패면 입력한 아이디의 기관, 그 밖에는 운영자가 요청한 기관 또는 사용자 기관.
  - 권한 기록(제5조): 사용자 등록·수정은 `PERMISSION`. 성공하면 역할·직종·기관·사용 여부 중 바뀐 칸의 이전·새 값(`changes`, 이전 값은 처리 전에 찾은 사용자), 실패하면 오류 문구.
- 남지 않는 것: 토큰이 만료·위조돼 막힌 요청(401 — 누구의 것인지 모른다, 로그인 실패는 남긴다), 접속기록 표시가 없는 API(토큰 갱신·본인 정보·개인정보 없는 설정 조회).
- 보기: `GET /access-logs`(기관 관리자는 자기 기관이 든 기록, 운영자는 헤더 [기관 선택]), `GET /access-logs/export`(CSV, 엑셀용 BOM, 최신순 10,000줄까지 1,000줄씩 읽고 넘으면 마지막 줄에 알림). 보고 내려받는 것도 기록된다. 조회 응답의 정보주체는 앞쪽 3명(`ACCESS_LOG_SHOWN_SUBJECTS`)과 수급자로 좁힌 그 수급자만. 관리 웹 `/access-logs`: 기간·작업·사용자·수급자(대상의 이름을 누르면 그 수급자 기록만) 조건, 점검 버튼(로그인 실패·내려받기·삭제·권한 변경·실패한 요청), 상세의 조건 이름·값은 화면에서만 한국어로 바꾼다.
- 아직 없는 것: 관리자 2단계 인증, 앱 DB 계정을 INSERT·SELECT만으로 좁히기와 날마다 요약 hash(트리거는 DB 소유자를 막지 못한다), 이상 징후 알림(근무시간 밖·대량 조회), 3년 지난 행 정리 작업.

## 도메인 규칙

- 시간대는 한국 표준시(UTC+9). 날짜 쿼리(`date`, `from`, `to`)는 KST 날짜이며 `to`는 그날을 포함한다. 변환은 `shared-types/src/date.ts`.
- 방문 상태: `SCHEDULED`(예정) → `DRAFT`(기록 저장) → `CONFIRMED`(확정). [수정]을 누르면 `CONFIRMED` → `DRAFT`(확정 시각은 지운다). 예정 상태만 삭제할 수 있다(`canDeleteVisit`, `isRecordEditable`). 서버는 상태 조건을 건 update/deleteMany로 동시 요청에도 규칙을 지킨다.
- 선택 입력의 빈 문자열("", 공백만)은 **스키마가 null로 바꾼다**(`shared-types/src/schema.ts`의 `blankToNull`·`optionalText`). undefined는 "변경 없음", null은 "지움". 서버·폼에서 따로 정리하지 않는다.
- 교차 필드 규칙도 스키마에 둔다: 방문 시각(`checkVisitTimes` — 종료 ≥ 시작, 24시간 이내)은 `SaveVisitRecordSchema`, 시작일 ≤ 종료일은 `VisitListQuerySchema`.
  - 저장 요청은 시작·종료 중 한쪽만 올 수 있으므로 서버가 저장된 값과 합친 뒤 `checkVisitTimes`로 다시 확인한다.
- 방문 시각은 실제 방문 날짜 기준이다. 현장 웹 기록 화면에 "방문 날짜"를 두고, 자정을 넘긴 방문은 사용자가 "다음 날 종료"를 직접 체크한다(종료 < 시작을 자동으로 다음 날로 보지 않는다 — 오타가 23시간 방문이 되지 않게).
- 요청 타입(`*Input`)은 클라이언트가 보내는 모양(`z.input`)이다. 서버 서비스는 검증 결과(`z.output<typeof Schema>`)를 받는다.
- 방문 목록(`VisitSummary`)의 수급자는 이름·등급·주소만 싣는다. 연락처·보호자·메모는 상세(`VisitDetail`)에서만.
- 방문 목록은 페이지 단위다(`page`, `pageSize` ≤ 200, 방문 일시·id 오름차순). `status`는 여러 개를 받는다(`status=SCHEDULED&status=DRAFT`, api-client는 배열을 이렇게 보낸다). 응답의 `total`·`statusCounts`는 조건 전체 기준이므로 화면의 건수는 받은 목록을 세지 말고 이 값을 쓴다.
  - `groupBy=organization`이면 기관 이름순(그 안은 방문 일시순)으로 이어서 주고 기관별 건수(`organizationCounts`)도 준다. 기관별로 묶은 표가 페이지를 넘겨도 기관 순서대로 이어지고, 묶음 머리 줄은 받은 행이 아니라 이 건수를 쓴다.
- 방문 달력: `GET /visits/calendar`(`from`·`to` 최대 42일, 목록과 같은 권한 범위·필터에 `recipientId`)가 한국 날짜별 상태 건수를 준다. 칩 목록을 함께 주면 그 목록으로 세고(`countVisitsByDay`), 건수만 줄 때(현장 웹·상한 초과)는 DB가 센다(`Visit.scheduledDate`: `scheduledAt`에서 계산하는 한국 날짜 생성 열, 앱은 읽기만 한다. 스키마의 `dbgenerated` 기본값을 생성식과 같게 둬야 migrate diff가 비어 있다). 두 길 모두 `tallyVisitDays`로 같은 모양을 만든다. 현장 웹 방문 일정(달력과 그날 방문을 한 화면에: 좁은 화면은 한 주 줄·펼치면 한 달, 넓은 화면은 한 달 달력 옆에 그날 방문)과 관리 웹 [목록|달력]이 쓰고, 날짜를 누르면 그날 목록은 기존 목록 API로 받는다. 캐시 키는 `lists` 접두어 아래라 저장·확정·삭제 뒤 목록과 함께 다시 받는다. 달력 칸 날짜는 `monthGridDates`(일요일 시작, 4~6주).
  - `withVisits=true`면 방문 항목(`VisitCalendarItem`: 수급자 이름·등급, 담당자, 상태, 서식)도 준다. 관리 웹이 칸에 이름 칩을 그리고 "이달 수급자" 패널(`summarizeMonthRecipients`, 재택의료 월 요건 `HOME_CARE_MONTHLY_VISITS`)을 만든다. `VISIT_CALENDAR_MAX_ITEMS`(3000)를 넘으면 `visits: null`이고 칸은 건수만 보여 준다(운영자 전체 기관 보기).
  - 관리 웹 달력: 칸에는 칩을 3건까지(4건 이하면 전부) 보이고 나머지는 "+N건 더"로 띄운다. [방문 모두 펼치기](`use-calendar-prefs-store.ts`, 브라우저에 저장)를 켜면 칸마다 전부 보인다. 칩을 누르면 빠른 보기 창(일정·담당자 변경, 삭제, 이 수급자만 보기), 우클릭(터치는 길게 누르기)하면 메뉴(`calendar-context-menu.tsx`: 칩은 보기·변경·다음 주로 복사·새로 등록·삭제, 빈 칸은 그 날짜로 등록·그날 목록), 확정 전 칩은 다른 날 칸으로 끌어 옮기고 알림의 [되돌리기]로 되돌린다. 칸은 방향키(±1일·±7일)·Home/End·PageUp/Down(`shiftCalendarDate`)으로 옮기고 Enter로 칩에 들어간다. 옮기기는 낙관적 업데이트(`moveCalendarVisit`, 캐시 안에서는 `countVisitsByDay`로 다시 센다)다. React Compiler가 바뀐 칸만 다시 그리도록 칸에 넘기는 값은 늘 같게 둔다: 주소를 바꾸는 함수는 `useSearchParamsUpdater`, 최신 콜백은 `useLatestRef`, 끌기는 `useCalendarDnd`의 `handlers`, 쿼리·뮤테이션 객체(매번 새것)는 넘기지 말고 필요한 값만 꺼낸다. 수급자 필터(주소의 `recipient`)는 지금 기관 범위의 수급자일 때만 쓰고, 기관을 바꿔 범위 밖이 되면 지운다.
- 관리 웹 현황판(`/dashboard`, 로그인 뒤 첫 화면 `HOME_ROUTE`): 새 API 없이 기존 API를 합친다. 이달 달력(`withVisits`)으로 오늘·이달 건수, 직원별 이달 방문(`summarizeMonthStaff`), 재택의료 기본료 위험(재택의료 수입과 같은 `useHomeCareMonth` 판정의 방문 부족·포괄평가 필요 수급자와 금액, 예정 포함 — 아래 재택의료 수입), 재택의료 밖의 이달 방문 없는 수급자(`withoutMonthVisits`)를 만들고, 확정 안 된 지난 방문은 목록 API 한 페이지(`to`=어제, `status`=예정·작성 중, `useVisitPage`)의 `total`·`statusCounts`와 앞의 몇 건을 방문 표(`VisitTable`, 지난 미확정 행에 "N일 지남")로 쓴다(인덱스 `organizationId, status, scheduledAt`). 달력 요청은 방문 달력과 같은 범위(`monthGridDates`)라 캐시를 함께 쓴다. 이름을 누르면 방문 달력(`visitsHref`: 목록 화면이 읽는 쿼리스트링 이름으로 타입을 묶었다)이 그 직원·수급자로 좁혀진다. 운영자 전체 기관에서 이달 방문이 상한을 넘으면 직원·수급자 카드는 기관을 고르라고만 한다.
- 관리 웹 재택의료 수입(`/home-care`, `?month=`, 달 넘기기는 방문 달력과 같은 `MonthNav`): 재택의료센터 수급자마다 그달 재택의료기본료(그달 수가의 `baseFee` — 아래 수가 관리) 요건(의사 1·간호사 2·사회복지사 상담 1, `HOME_CARE_MONTHLY_VISITS`)을 판정하고, 방문진료료·추가간호료·지속관리료까지 그달 받을 수 있는 금액을 센다. 하나라도 빠지면 그달 기본료는 0원이라 판정을 금액으로 보여 준다(파는 가치의 중심 — `/dev/market`).
  - 기본료 판정은 shared-types `home-care-fee.ts` 한 곳(`homeCareFeeStatuses`): 그달 산정 기간(아래 사례 정보) 안의 재택의료 방문 중 다른 기관 서비스와 겹쳐 산정하지 않는 방문을 빼고(`countedVisitIds`, 뺀 까닭은 `notes`) 방문한 직종별로 확정·지난 미확정·예정(오늘부터)으로 세고, 모자란 만큼을 확정 → 지난 미확정 → 예정 순서로 채워 확보(`SECURED`)·확정 남음(`PENDING`, `toConfirm`·`toVisit`)·방문 부족(`SHORT`, 직종별 `missing`·합 `shortfall`)으로 나누고, 산정하지 않는 달이면 포괄평가 필요(`BLOCKED`)다. 판정마다 걸린 기본료 `fee`(사망 종결 50%면 절반). "모자람"은 방문 달력 수급자 패널과 같은 `homeCareMissing`·`homeCareShortfall`(visit.ts)이다. 현황판 카드·수급자 확인도 같은 판정을 쓴다(둘 다 `useHomeCareMonth` — 아래 API를 받아 판정·판정별 기본료·예상 수입을 내는 훅).
  - 금액은 shared-types `home-care-revenue.ts` 한 곳(`homeCareMonthRevenue` → 수급자별 `homeCareRevenue`와 항목 합, 의사 한도 경고). 항목: 기본료(방문 부족이면 0), 방문진료료(제4호를 쓴 의사 방문, 단가는 기관 종별로 `visitFeeFor`, 동일 건물·세대 비율 — 방문의 `facts.visitFeeBasis`는 수가와 무관한 구분이고 금액은 셀 때 수가를 곱한다), 추가간호료(간호사 기본 2회를 넘는 방문 중 정기로 적지 않았고 30분 이상·의사 동행 아닌 방문, 월 3회 — 방문사유를 아직 안 적은 예정 방문은 추가로 본다), 지속관리료(기본료 연속 개월이 6의 배수인 달). 예정·미확정 방문도 마치고 확정하면 받을 금액으로 넣는다. 금액은 본인부담금 포함 수가, 동반인력·야간 가산은 넣지 않는다. 받지 못하는 까닭(정기 방문이 2회를 넘게 적힘, 의사 동행·30분 미만 추가 방문, 월 3회 초과, 사회복지사 상담이 방문일정 조율뿐, 방문 부족이면 끊기는 연속)은 수급자별 `issues`, 의사 1인당 월 한도(기본값 140명·140회) 초과는 기관 `warnings`다. 금액·비율·한도는 모두 인자로 받은 수가 묶음(`HomeCareFees`)에서 읽는다(`homeCareFeeStatuses`·`homeCareMonthRevenue`의 `fees`).
  - API `GET /visits/home-care-month?month=&organizationId=`(기관 관리자·운영자, `HomeCareService`): 그달 볼 재택의료센터 수급자(`HomeCareRecipient`: 사용 중이거나 그달 방문이 있고 그달 전에 종결하지 않은 수급자, 사례 정보 포함), 그달 재택의료센터 방문(달력 항목 + 시작·종료 + 서식 값 대신 금액 셈에 쓰는 사실 `facts` — `homeCareVisitFacts`가 서식 값에서 뽑는다, 읽는 칸·선택지는 `HOME_CARE_REVENUE_FIELDS`이고 서식 정의에 있는지 테스트가 본다)과 그달 수가 묶음과 근거 `feeSet`(`FeeScheduleService.forMonth`), 수급자별 직전 연속 개월 `priorStreaks`(그달 전 확정 방문을 같은 `filterWhere` 범위로 수급자·한국 날짜·직종별 groupBy, 달로 묶고 요건을 보는 것은 `homeCarePriorStreaks` — 케어노트에 확정한 기록만 센다). 방문이 `VISIT_CALENDAR_MAX_ITEMS`를 넘으면 `visits: null`(연속 개월은 세지 않음). 쿼리 키는 `visits.homeCareMonth`(`lists` 아래 — 지난달 방문을 확정해도 연속 개월이 바뀌므로).
  - 화면: 예상 수입 카드(`RevenueSummary`, 총액과 항목별 금액·건수, 항목 이름·단위는 `HOME_CARE_REVENUE_PART_INFO`), 판정별 기본료(`homeCareFeeTotals`), 청구 마감(`homeCareClaimDeadline`, 다음 달 10일), 의사 한도 경고(`WarningList`), 수급자 표(직종 칸 "확정 n/요건"과 미확정·예정, 예상 금액과 항목·연속 개월, 할 일 칸에 모자란 직종마다 [방문 잡기] → 방문 등록 창에 수급자·재택의료센터·그 직종의 최근 담당자(`lastStaffId`)를 채운다, 지난달은 글로만, 그 아래 `issues`). 등록 창의 날짜는 방문 달력과 같은 `defaultDayOf`(이번 달이면 오늘, 아니면 1일). 화면 아래 산정 기준 글도 그달 수가로 만들고 근거를 적는다.
  - 사례 정보(shared-types `home-care-case.ts`, 수급자마다 관리 웹 표의 [사례 정보] 창 `HomeCareCaseDialog`): 포괄평가 기록(`HomeCareAssessment`, 최초 평가·재평가, 재평가는 처음 최초 평가보다 뒤 — `assessmentOrderError`, 시설에서 돌아와 다시 등록하면 최초 평가를 또 적는다), 재택의료 종결(DB `Recipient.homeCareEndedOn`·`homeCareEndReason`, API 타입은 `HomeCareCase`·`HomeCareRecipient`에만: 사망·시설 입소·기타, 날짜·사유를 함께), 다른 기관 서비스 일정(`RecipientExternalService`: 종류·기관·요일·기간·이용 시간, `EXTERNAL_SERVICE_INFO`가 종류마다 겹치면 안 되는 직종과 시간 겹침만 보는지(`timed`)를 정한다). API는 `GET /recipients/:id/home-care-case`, `POST|DELETE …/assessments`, `POST|PUT|DELETE …/external-services`, `PUT …/home-care-end`(기관 관리자·운영자, `HomeCareCaseService`, 바꾸면 사례 정보 전체를 돌려준다. 화면은 재택의료 수입 캐시를 낡음으로만 표시하고 창을 닫을 때 한 번 다시 받는다 — `useRefreshHomeCareMonths`).
  - 그달 산정 기간(`homeCareMonthPeriod`): 1일~말일, 최초 포괄평가 달은 평가일부터(지침 Q2-2), 재평가 기한(평가한 달의 13개월 뒤 말일, `reassessmentWindow` — 예 '26.1.11. → '27.1.1.~2.28.)이 지난 뒤 다시 평가한 달도 평가일부터, 종결한 달은 종결일까지. 최초 평가 전 달·기한이 지나고 아직 재평가하지 않은 달은 막힘(`BLOCKED`: 장기요양 재택의료 급여 없이 방문진료료만). 포괄평가를 기록하지 않은 수급자는 달 전체로 세고 막지 않는다(표에 "포괄평가 미기록"). 사망 종결 달에 팀이 방문한 적이 있으면 요건을 못 채워도 기본료 일부(수가의 `deathFeePercent`, 지금 50%, 그 달 지속관리료 없음). 방문 한 건을 세는지는 `checkHomeCareVisit` 한 곳(산정 기간 밖, 같은 날·같은 시간 다른 기관 서비스면 빼고 이용 시간을 몰라 겹칠 수 있으면 알리기만 — `externalConflicts`의 `certain`, 시각을 모르면 `timeUnknown`, 문구는 `externalConflictText`)이고 이달 판정과 직전 연속 개월(`homeCarePriorStreaks`, 날짜만 알므로 시간 겹침 서비스는 빼지 않음)이 함께 쓴다. 같은 기관의 그달 장기요양 방문간호는 서버가 하루짜리 다른 기관 서비스(`ownLtcNursingDay`)로 넣어 보내고, 등록 경고의 `conflictsOnSameDay`도 겹치면 안 되는 직종을 `EXTERNAL_SERVICE_INFO.LTC_NURSING`에서 읽는다. "기본료 위험"(방문 부족·포괄평가 필요)은 `isFeeAtRisk`. 방문 달력의 이달 수급자 패널은 사례 정보 없이 방문만 센다.
  - 아직 보지 않는 규칙(화면 아래에도 적었다): 케어플랜 없는 긴급왕진. 금액·비율·한도가 바뀌면 [수가 관리]에서 새 수가를 넣고(배포 없음), 규칙의 모양(직종별 요건 `HOME_CARE_MONTHLY_VISITS`, 재평가 기한, 같은 날 산정 제외 종류, 셈하는 방문)이 바뀌면 `home-care-fee.ts`·`home-care-revenue.ts`·`home-care-case.ts`의 코드를 고친다. 지침을 받는 곳·값마다의 지침 쪽수·갱신 절차·확인 이력은 `docs/fees.html`(`/dev/fees`).
  - 수가 관리(관리 웹 `/fee-schedules`, shared-types `fee-schedule.ts`): 재택의료 수입이 쓰는 금액·비율·한도 묶음(`HomeCareFees`)을 시행 월(`effectiveMonth`)과 근거(지침 판·쪽)와 함께 넣는다(`HomeCareFeeSchedule`, 모든 기관 공통). 칸은 `HOME_CARE_FEE_GROUPS`(묶음 → 칸: 이름·단위, 횟수 칸은 상한) 한 목록이고 검사 스키마 `HomeCareFeesSchema`와 `HomeCareFees` 모양이 여기서 나온다. 비율은 %로 저장한다(`deathFeePercent: 50`). 그달에는 지우지 않은 묶음 중 시행 월이 그달 이하인 가장 늦은 묶음을 쓰고(`scheduleForMonth` 한 곳 — 서버 `FeeScheduleService.forMonth`도 지우지 않은 행을 모두 읽어 이것을 부른다), 없으면 코드 기본값 `DEFAULT_HOME_CARE_FEE_SET`(지침 2026판 값과 근거 — 고치면 넣은 묶음이 없는 지난달까지 바뀌므로 고치지 않는다)이다. 묶음은 덮어쓰지 않는다: [고치기](`PUT /:id`)는 한 트랜잭션으로 그 묶음을 지우고 고친 묶음을 새로 넣으며(새 묶음의 `replacesId`, 한 묶음은 한 번만 고쳐진다), 지우기는 `deletedAt`·`deletedBy`만 붙인다. 이력에는 고치기 전 묶음이 "고침", 지운 묶음이 "지움"으로 남고(화면은 기본으로 지금 쓰는 묶음만 보이고 [고치거나 지운 이력 보기]를 체크하면 함께 보인다), 고친 묶음을 펴면 고치기 전 값과 견준다. 이미 지웠거나 고친 묶음을 고치면 404. 한 시행 월에 지우지 않은 묶음은 하나다(부분 유니크 인덱스 `effectiveMonth WHERE deletedAt IS NULL`, Prisma `partialIndexes` 미리보기로 스키마에 선언, 겹치면 409). 저장은 JSON이고 읽을 때 그 뒤에 더한 칸은 기본값으로 채운다(`parseStoredFees`, 기본값이 지난달에 맞지 않으면 칸을 더하는 마이그레이션에서 지난 묶음에 값을 넣는다) — 새 종류의 금액은 `HOME_CARE_FEE_GROUPS`와 `DEFAULT_HOME_CARE_FEE_SET`에 칸을 더한다(테스트가 칸 목록과 값이 같은지 본다). API `GET /home-care-fee-schedules`(기관 관리자·운영자, 코드 기본값과 묶음 전체), `POST`·`PUT /:id`·`DELETE /:id`(운영자). 바꾸면 재택의료 수입 캐시를 다시 받는다. 방문진료료 단가는 기관 종별(`Organization.institutionType`: 의원·병원급 이상·보건소 등, 관리 웹 [기관]에서 고른다)로 고른다(`visitFeeFor`: 병원급 이상만 병원급 단가). 화면의 [사용 안내]는 둘러보기(`feeScheduleTourSteps`, 넣기·고치기 단계는 운영자만)다.
- 관리 웹 둘러보기(`components/ui/tour.tsx`의 `Tour`): [사용 안내]를 누르면 실제 화면의 요소를 차례로 짚고(나머지는 어둡게) 옆에 설명 말풍선을 띄운다. 단계는 `{ target: 선택자(보통 [data-tour="…"], 여럿이면 처음 보이는 것), title, body, side }` 목록이고 짚을 요소에 `data-tour`를 단다. 말풍선은 Radix Popover의 가상 기준점(`virtualRef`)에 붙어 넘치면 뒤집고, 짚을 요소가 없거나 안 보이면 화면 위쪽 가운데에 말풍선만 띄운다. ←·→로 넘기고 Esc·바깥 누르기로 닫으며 연 버튼으로 포커스를 돌려준다. 다른 화면도 단계 목록만 넘기면 쓴다.
- 수급자 차트번호(`Recipient.chartNumber`, 기관 EMR의 환자 번호)는 기관 안에서 겹치지 않는다(유니크, 겹치면 409). 수급자 검색 `q`는 이름·차트번호의 일부 또는 생년월일(`birthDateSearchCandidates`: 19420819·1942-8-19·420819처럼, 두 자리 연도는 1900·2000년대 둘 다)로 찾는다.
- 주소 지도 바로가기(`shared-types/src/maps.ts`의 `mapSearchUrl`): 네이버·카카오·구글 지도 웹 주소라 휴대폰에 앱이 있으면 앱으로 열린다. 상세주소(첫 쉼표 뒤)는 빼고 찾는다(`mapSearchQuery`). 현장 웹 방문 카드의 [지도](카드 전체 링크 위에 따로 눌리는 버튼)와 수급자 정보 카드가 쓴다.
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
- 방문한 직종은 `Visit.profession`에 저장한다(만들 때 담당자 직종, 담당자를 바꾸면 새 직종). 담당자의 지금 직종은 확정 뒤 바뀔 수 있으므로, 같은 날 경고·재택의료 월 요건·서식 규칙(선택 서식 켜고 끄기 포함)은 담당자가 아니라 이 값을 쓴다.
- 같은 날 경고: 재택의료센터 간호사 방문과 장기요양 방문간호가 같은 수급자에게 같은 날 있으면 재택의료 급여를 산정하지 않는다(재택의료센터 지침). 규칙은 `conflictsOnSameDay`, 서버가 `GET /visits/same-day-warnings`로 문구만 주고(현장 직원은 다른 직원의 방문을 볼 수 없으므로) 두 웹의 방문 등록 화면이 보여 준다. 재택의료센터 방문이면 수급자의 다른 기관 서비스(아래 재택의료 수입의 사례 정보, `externalConflicts`)도 보고, 화면이 보낸 방문 시각(`time`)으로 이용 시간이 겹치는지 가린다(시각이 없으면 "겹치면"으로 알림). 등록은 막지 않는다.
- 서식 정의는 `shared-types/src/forms/`에 서식마다 한 파일이다. 칸 종류는 하나 고르기(`single`)·여러 개 고르기(`multi`)·숫자(`number`)·글(`text`)이고, 선택 항목에 괄호 내용(`detail`: 글·선택·제공 시간(분)+메모)을 붙일 수 있다. 이 정의 하나에서 저장 검사 스키마(`formDataSchema`), 현장 웹 입력 화면(`apps/web/src/features/forms`), 관리 웹 보기, 구술 초안 요청·검사, 표시 문구(`formatFieldValue`)가 나온다. **지침이 개정되면 서식 정의만 고친다.**
- 칸 속성: `dictation`(구술로 채움), `visitSpecific`(방문마다 새로 재거나 정하는 칸 — 활력징후 측정값, 방문사유 정기·추가, 지난번 대비 변화 등. 지난 기록에서 불러오지 않고 참고로만 보여 준다. 대상 칸은 협력 기관 확인 뒤 서식 정의에서만 고친다), `question`(초안에서 비면 되묻는 질문, 같은 문구는 한 번만 묻는다), `required`(확정 전에 반드시 채울 칸 — 서버 확정과 현장 웹 [확정]이 `findMissingRequired`로 막고 현장 웹은 칸에 `*`를 붙인다. 지금 표시는 방문 사유·내용 칸만 둔 임시안이고 협력 기관 확인 뒤 서식 정의에서만 고친다).
- 서식 속성: `numberPairs`(한 줄로 적는 숫자 짝 — 혈압 수축기/이완기. 입력 화면과 초안 검사가 이 선언만 본다), `followUps`(여러 칸이 모두 비었을 때 묻는 질문), `sttTerms`(음성인식 힌트 용어), 글 칸의 `softLimit`(공단 앱 200자처럼 넘으면 경고만). 활력징후 칸과 혈압 짝은 `forms/common.ts`에서 함께 쓴다.
- 서식 검사 스키마(`formDataSchema`)는 서식마다 한 번만 만들어 재사용한다.
- 저장은 방문 단위로 모든 서식을 함께 보낸다(`PUT /visits/:id/record` → `{ forms: { 서식ID: 값 }, startedAt, endedAt }`, `VisitForm` 테이블에 서식별 한 행). 확정은 방문의 모든 서식이 저장돼 있고 서식 정의를 통과해야 한다.
- 확정본 이력(`VisitRecordVersion`): 확정할 때마다 그때의 기록(서식 값·방문 시각·담당자·직종과 서식 머리 `header`: 기관·수급자·담당자 정보, `recordHeaderSelect`)을 통째로 1차, 2차 …로 보관하고 SHA-256(`record-version.ts`, 키 정렬 JSON)을 남긴다. [수정]은 지금 확정본에 되돌린 사람·시각만 적고 지우지 않는다(이력 기능 전에 확정한 방문은 처음 [수정]할 때 그 확정본을 1차로 보관). 방문 상세에는 수(`versionCount`, 쓰기 요청마다 목록을 읽지 않게)만 싣고, 목록은 `GET /visits/:id/versions`, 한 벌은 `GET /visits/:id/versions/:version`(보관 값·hash 일치 여부). 관리 웹 상세의 "확정 이력" 카드가 보여 준다(사용자에게는 해시 대신 "원본 그대로입니다/원본과 다릅니다"만 보이고, 확인값은 접힌 "기술 정보"에 둔다). 행 값(보관 값 + 해시)은 `recordVersionData` 한 곳에서 만든다(서비스·시드). 별지 원본 5년 보관·기록 수정 이력용이다.
- 저장·서식 바꾸기·확정·구술 저장은 방문 행을 잠그고(`visit.service.ts`의 `lockWritable`, `SELECT … FOR UPDATE`) 담당자·확정 여부·서식 목록을 다시 읽은 뒤 쓴다. 그래서 확정은 그 순간의 서식 목록이 모두 저장됐는지 본다.
- 새 서식은 빈 상태로 연다. 지난 기록 값은 저절로 채우지 않고 사용자가 누를 때만 채운다(아래 "지난 기록(과거력)").
- 서식 머리(기관명·기호, 수급자 생년월일·등급·장기요양인정번호·주소, 담당자 이름·면허번호, 방문일·시각)는 서식 값이 아니라 기관·수급자·사용자·방문 정보에서 온다(확정본에는 확정 당시 값을 함께 보관한다). 주민등록번호(별지 제4호)는 저장하지 않는다(심평원 화면의 재진 불러오기를 쓴다).
- 별지 제7호(간호사) 원 서식은 한 달 5회 방문을 칸으로 적는 월간 양식이다(방문사유 줄이 정기 1~2번 칸·추가 3~5번 칸으로 나눈다 — 지침의 기본 2회 + 추가간호 3회). 여기서는 방문 1건이 한 칸이고, 방문사유(정기/추가)는 확정 전 필수, 향후계획·총평도 방문마다 적는다(월간 서식으로 모을 때 그 달 마지막 값을 쓴다).
- 서식 원본은 각 시범사업 지침의 부록이다(일차의료 방문진료 수가 시범사업 지침 별지 제4호, 장기요양 재택의료센터 시범사업 지침 별지 제6~8호, 장기요양 방문간호는 별지 제14호). 항목 이름과 구분은 원본과 협력 기관 확인으로 확정한다.

## 지난 기록(과거력)

같은 수급자의 이전 방문 기록을 기록 화면에서 보고 이번 기록에 다시 쓴다(반복 작성 줄이기).

- API: `GET /recipients/:id/records?beforeVisitId=&cursor=&limit=`(`apps/server/src/visit/recipient-records.controller.ts`, 최신순 `{ items: RecipientRecord[], nextCursor }`, limit 기본 10·최대 30). 볼 수 있는 기록은 같은 기관(운영자는 모든 기관)의 **확정 기록(작성자·직종 무관, 읽기 전용)과 본인의 작성 중 기록**이다. 조건은 `visit/record-history.ts`의 `recordHistoryWhere` 한 곳이다. `beforeVisitId`는 그 방문보다 앞선(같은 시각 포함, 그 방문은 빼고) 기록만 주며, 그 방문을 볼 수 있어야 한다(현장 직원은 본인 방문, 아니면 404). cursor 는 방문 일시·id keyset(`encodeRecordCursor`). 쓰기·PDF·`GET /visits/:id`의 권한은 그대로다.
- 다시 쓰기 규칙(shared-types `forms/reuse.ts`): 저장된 값은 그때의 서식 정의로 검사한 값이라 지금 정의에 없는 칸·선택지·괄호 내용은 버린다(`sanitizeFieldValue`). `visitSpecific` 칸과 고른 항목의 제공 시간(분)은 다시 쓰지 않는다(`reusableFieldValue`·`reusableValues`, 메모는 남긴다). 칸마다 지난 값은 `latestFieldValues`(최신순으로 빈 값 아닌 첫 값, 숫자 짝은 한 기록에서 함께).
- 현장 웹(`features/past-records`):
  - 기록 화면 옆(좁은 화면은 서식 위) "지난 기록" 카드(`PastRecordsCard`), 누르면 보기 창(`PastRecordDialog`, 주소 `?past=방문id` — 휴대폰 뒤로 가기가 창만 닫는다, 좁은 화면은 화면 전체 `DialogPageContent`). 앞뒤 기록으로 넘기고, 작성 중인 기록 화면이면 서식마다 [이 서식 전체 불러오기]·구분마다 [이 구분 불러오기](이번 방문에도 있는 서식만, 다른 서식은 보기만).
  - 기록 폼 탭 위 줄(`PastRecordsTools`): [지난 기록 보기]·[지난 값 모두 적용]과 "지난 값 표시" 스위치(기억함). [지난 값 모두 적용]은 비어 있는 칸을 칸마다 가장 최근 지난 값으로 채우고(`visitSpecific` 칸·제공 시간 제외, 입력한 칸은 그대로), 그 뒤 [적용 취소]가 되어 채운 값 그대로인 칸을 다시 비운다(그사이 고친 칸은 그대로, 알림의 [되돌리기]도 같은 동작). 칸마다 채우는 버튼은 두지 않는다.
  - 지난 값 표시는 줄을 늘리지 않고 입력 부품에 색으로 단다(글을 읽지 않고 훑어서 비교하게): 고르는 칸은 지난번에 고른 칩에 ⟲(지금 고르지 않았으면 점선 칩 — `RadioChips`·`CheckChips`의 `past`), 숫자 칸·숫자 짝은 칸 이름 줄 오른쪽에 "⟲ 지난 값"(`PastInline`), 글 칸은 비어 있을 때 입력란 안에 흐리게. 지금 값이 지난 값과 다르면 "바뀜"(`PastChangedBadge`, 여러 개 고르는 칸은 순서 무시 — `sameFieldValue`, `visitSpecific` 칸은 달지 않음).
  - 지난 기록 값은 **사용자가 누를 때만** 채운다(새 서식은 빈 상태). 지난 기록에서 채운 칸은 왼쪽 강조선을 단다(`usePastFills` — 화면에 머무는 동안만 기억, 칸 값이 채운 값 그대로일 때만 표시하므로 고치면 사라진다. `FormFields`의 `past` 묶음 `FormPast`).
  - 불러오기는 `mergeFormValues`(`features/forms/lib/merge-form-values.ts`)로 합친다. 지난 기록은 여러 개 고르는 칸을 그 기록대로 바꾸고(replace), 음성 초안(`mergeDraft`)은 이미 고른 항목에 더한다(union). 둘 다 빈 값으로 지우지 않고, 이미 입력한 값이 바뀌면 먼저 묻는다. 채운 뒤 그 서식을 열어 첫 채운 칸으로 가고 알림의 [되돌리기]로 되돌린다. 저장은 기존 [임시 저장].
  - 쿼리 키는 `visitKeys.pastRecords`(`lists` 아래 — 저장·확정·삭제 뒤 함께 다시 받는다). 칸마다 지난 값은 같은 쿼리의 모듈 수준 `select`라 녹음 중 다시 그려도 다시 계산하지 않는다.

## 방문 전 준비 (현장 웹)

집 앞에서 "지난번에 무엇을 했고 오늘 무엇을 챙길지"를 30초 안에 보게 한다. 새 API·DB 없이 기존 쿼리로 만들고, 규칙은 shared-types 선언 한 곳이다 — **서식 칸을 바꾸면 이 목록도 고친다**(서버 spec이 칸·선택지가 서식 정의에 있는지 본다).

- 방문 전 확인(`features/briefing`의 `BriefingCard`, 예정·작성 중 방문만): 지난 기록에서 정한 칸만 그대로 보인다(AI·요약 없음). 칸 목록은 `visit-briefing.ts`의 `BRIEFING_FIELDS`(`kind`: 간호지시·계획·살펴볼 것·한 일·메모, `values`로 그 선택지일 때만 — 예: 낙상 "예"면 "있었음"). `buildVisitBriefing`이 직종 × 사업마다 보일 칸이 있는 가장 최근 기록 하나에서 뽑고(기록을 섞지 않음, 제공 시간 빼고 메모는 남김 — `withoutMinutes`), `briefingForViewer`가 방문 직종(`visit.profession`) 기준으로 맨 위 줄을 고른다(간호사에게는 의사 간호지시, 누구에게나 본인 직종의 계획 — 기록마다 첫 계획 칸 하나). 서식 둘을 쓴 기록(의사 제6호·제4호)은 칸 이름에 서식 번호를 붙인다. [기록 보기]는 지난 기록 창(`?past=`)을 연다.
- 활력징후 추이(`features/vitals`의 `VitalsTrendCard`, 모든 상태·직종): `vital-signs.ts`의 `VITAL_SIGNS`(혈압 짝·맥박·체온·호흡·혈당·체중 변화 — 칸은 서식이 함께 쓰는 `forms/common.ts`의 정의 그대로라 이름·단위·소수 자리·`signed`를 거기서 읽고, 같은 키의 칸이 어느 서식에서나 그 정의인지 spec이 본다) → `vitalTrends`가 오래된 순 점과 지난 점과의 차(`change`)를 낸다. 확정한 방문이면 이번 값을 마지막 점으로 더한다. **기록된 값과 단순 차이만** — 정상 범위·기준선·색 경고는 넣지 않는다(의료기기 경계). 체중 변화(`signed`)는 이미 변화값이라 차이를 셈하지 않는다(0 기준 막대). 요약 줄은 `vitalSummary`. 그래프는 Recharts를 `vitals-chart.tsx` 한 파일에만 두고 `React.lazy`로 펼쳐서 점이 둘 이상일 때만 받는다(기록 화면 첫 청크에 넣지 않음, 그림은 `aria-hidden`이고 화면 읽기는 표와 `vitalChangeLabel`). [이전 기록 더 보기]는 같은 쿼리의 다음 쪽이며 `RECORD_HISTORY_MAX_LIMIT`(30)건까지다(다시 받기·접속기록 줄 수).
- 두 카드는 지난 기록 카드와 같은 `visitKeys.pastRecords` 쿼리를 쓴다(요청이 늘지 않음, 브리핑은 모듈 수준 `select` `usePastBriefing`). 둘 다 `CollapsibleCard`(`components/ui`): 요약 줄은 늘 보이고, 넓은 화면은 늘 펼침, 좁은 화면은 접어 두고 마지막 선택을 기억한다. 기록 화면 옆 칸 순서는 방문 요약 → 방문 전 확인 → 수급자 정보 → 활력징후 추이 → 지난 기록.
- 다음 방문 줄(`NextVisitStrip`, 방문 일정에서 고른 날이 오늘일 때): `day-schedule.ts`의 `upcomingVisits`(목록 순서 그대로 예정 방문만, 지금부터 몇 분 — 지났으면 "지금 차례"), 길 안내(`MapMenuButton`)·[기록 열기], 그다음 두 건, 건수는 서버 `statusCounts`. 1분 시계는 `hooks/use-now.ts`(`useSyncExternalStore`, 화면에 돌아오면 바로)이고 이 줄만 다시 그린다. 주소를 좌표로 바꾸는 외부 API는 쓰지 않는다(주소는 개인정보).
- 보호자 방문 안내 문자(`GuardianNoticeButton`, 수급자 정보 카드 보호자 줄의 `guardianAction`, 기록 화면에서 예정이고 오늘 이후인 방문만 — `guardianNoticeAvailable`): 문구는 `guardian-notice.ts`의 `guardianNoticeText`(기관·수급자 이름·"오늘/내일"(`relativeDayLabel`)·일시·직종과 담당자만, 보호자 이름·주소·진단은 넣지 않음)이고 창에서 고칠 수 있다. 케어노트는 문자를 보내지 않는다: [문구 복사](`components/ui/copy-button.tsx`, 포털 입력과 공용)와 휴대폰(`pointer: coarse`)·번호가 있을 때 [문자 앱 열기](`smsUrl`: `sms:번호?&body=…`, 번호는 `tel:`과 같은 `dialablePhone`, 기기마다 다를 수 있어 복사를 늘 함께 둔다).

## 포털 입력 도우미 (공식 전산에 옮겨 적기)

케어노트는 심평원·공단 전산과 연결되지 않는다(공개 쓰기 API 없음, 인증서를 다루지 않음). 확정한 기록을 담당자가 옮겨 적도록 포털 화면 순서대로 늘어놓고, 서식마다 한 번 [입력 완료]로 표시한다. 칸마다 체크하지 않는다(포털에서 한 번, 여기서 또 한 번 누르는 일이 되므로).

- 옮겨 적을 곳은 서식 정의의 `FormDef.portal`(제4호 `HIRA` 심평원 자료제출 시스템, 제6~8호 `NHIS_HOME_CARE` 공단 정보마당, 제14호 `NHIS_LTC_APP` 스마트장기요양 앱)이다. 서식 머리의 "작성 후 … 입력합니다"도 이 값의 이름(`PORTAL_INFO[form.portal].label`)이다.
- 나머지 규칙은 shared-types `portal-entry.ts` 한 곳이고, 두 웹은 `portalGuide(visit, formId, entry)` 하나를 그린다: 포털 안내(`PORTAL_INFO`: 주소·로그인 안내·앞뒤 단계·늘 보이는 주의, 칸 순서 근거 `orderNote` — 정보마당 화면 순서는 확인 전이라 서식 순서), 머리 칸(심평원은 작성의사·면허번호·실시일·수진자 — 주민번호는 저장하지 않아 [재진 불러오기] 안내), 서식 칸(고른 항목은 이름(제공 시간은 "· 15분"), 괄호 글·메모·숫자·글 칸은 붙여 넣을 값, 빈 칸은 "비워 둠" — 괄호 이름·증감은 엔진의 `optionDetailText`·`signedChange`를 화면·PDF와 함께 쓴다), 제출 전 확인(면허번호 없음, 시작 시각 없음, 포털에 넣은 뒤 다시 확정).
- 표시는 `VisitPortalEntry`(방문·서식마다 한 행, 표시를 지우면 행 삭제). 서식 저장과 따로라 [수정]·다시 확정해도 남고, 화면이 "넣은 뒤 다시 확정"을 알린다. API(`PortalEntryService`, 권한은 방문 조회 `visitScope`와 같음): `GET /visits/portal-queue`(확정 방문 중 표시 없는 서식, 기간은 지난달 1일~오늘 `defaultPortalQueueFrom` — 지난달분 청구 마감이 이달 10일이고, 기능 전 오래된 확정 방문이 쌓이지 않게. 범위는 방문 목록과 같은 `filterWhere`, 1000건 넘으면 `truncated`), `GET /visits/:id/portal-entries`, `PUT /visits/:id/portal-entries/:formId`(확정한 방문만 409, 방문에 없는 서식 404, 메모 200자), `DELETE …`(표시 지우기).
- 관리 웹 `/portal`(포털 입력): 왼쪽 미입력 목록(포털별, 오래된 것부터), 오른쪽 도우미(방문 정보·포털 바로가기, 제출 전 확인, 화면 순서대로 칸, 메모와 [입력 완료 · 다음으로] — 누르면 다음 서식이 열린다). 고른 서식은 주소 `?visit=&form=`. 쿼리 키는 `visits.portalQueue`(`lists` 아래)·`visits.portalEntries`(상세 아래). [입력 완료]는 그 서식만 목록 캐시에서 빼고(목록 전체를 다시 받지 않음), [되돌리기]만 목록을 다시 받는다.
- 현장 웹: 확정된 기록 화면의 "공식 전산 입력" 카드(서식별 입력 완료 여부, [옮겨 적기] → 전체 화면 창 `PortalEntryDialog`, 휴대폰은 메모 없이 [입력 완료]만).

## 서식 PDF (`apps/server/src/form-pdf/`)

- 확정본 한 벌을 PDF로 준다: `GET /visits/:id/versions/:version/pdf?style=original|standard`(권한은 방문 조회와 같은 `visitScope`). 방문의 서식을 서식 순서대로 한 파일에 담고, 파일 이름은 서버가 정한다(`수급자_방문일_N차.pdf`, `inline`; api-client가 `Content-Disposition`에서 읽어 `{ blob, filename }`으로 준다). 쪽 아래 출력 표시에 몇 차 확정본인지 적고, 보관 값이 hash와 다르면(`hashMatches`) "보관 값이 원본과 다릅니다"를 붙인다.
  - `standard`(표준 서식): 서식 정의(`FormDef`)로 그린다(`standard/render.ts`: 머리 줄 + 섹션·칸·선택지 □/○, 숫자 짝, 넘치면 다음 장 "(계속)"). 고른 항목·숫자 글은 화면과 같은 `formatSelectedOption`·`formatFieldValue`를 쓴다(제공 시간·메모, 증감). 모든 서식과 지침 개정에 코드 수정 없이 맞는다.
  - `original`(원본 서식, 기본값): 지침 부록 원본 PDF(`assets/templates/<FormId>.pdf`) 위에 좌표로 채운다. 원본이 있는 서식은 `FORMS_WITH_ORIGINAL_PDF`(shared-types, `hasOriginalPdf`로 화면이 버튼 이름을 고른다)이고, 서버 `build.ts`의 `ORIGINAL_PAGES`가 그 키를 모두 가져야 컴파일된다. 원본이 없는 서식(지금 제14호)은 표준 서식으로 나온다.
- 원본 위 자리는 서식마다 선언한다(`overlay/layouts.ts`: 선택지마다 □ 체크·○ 점과 괄호 칸, 글·숫자 칸, 머리 글자 `texts`). 좌표는 좌상단 원점 pt. `form-pdf.spec.ts`가 서식 정의의 모든 칸·선택지에 자리가 있는지 본다 — **서식 정의에 칸이나 선택지를 더하면 원본 자리도 더해야 테스트가 통과한다**(지침 개정으로 원본이 바뀌면 템플릿 PDF와 좌표를 함께 바꾼다).
- 제7호(간호사)는 한 장에 방문 5칸이라 따로 그린다(`overlay/home-care-nurse.ts`, 칸 자리는 첫 칸 좌표로 적고 칸마다 좌표계를 옮겨 그린다). 칸은 방문사유로 나눈다(`planNursePages`): 정기는 1~2번 칸, 추가는 3~5번 칸에 날짜순, 어느 쪽이든 넘치면 다음 장(방문사유가 빈 옛 확정본은 정기로 본다). 방문 PDF는 그 방문만(정기면 1번 칸, 추가면 3번 칸), 월간 기록지 `GET /recipients/:id/home-care-nurse-pdf?month=YYYY-MM`(기관 관리자·운영자, 기관 범위)는 그 수급자의 그 달 확정 방문(지금 확정본)을 모으고 향후계획·총평은 그 달 마지막 방문 값을 모든 장에 쓴다.
- 원본 서식 조정(관리 웹 `/form-layouts`, 운영자 전용, 모든 기관 공통): 원본 위 자리마다 ID가 있고(서식 칸은 `overlay/layout.ts`의 `slotId`, 머리·방문 칸 값은 `ITEM_LABELS` 키 — 그리는 코드가 쓰는 ID가 모두 칸 목록에 있는지 테스트가 본다), 운영자가 칸마다 옮기기(dx·dy)·칸 넓히기(dw·dh)·글자 크기·굵기·정렬과 채운 값 전체 옮기기를 저장한다(`FormLayoutAdjustment`, 서식마다 한 행, 코드 기본 자리에 더하는 값). 계산은 shared-types `form-layout.ts`의 `adjustRect`·`adjustPoint`·`adjustStyle`을 서버 그리기(`Placement`)와 편집 화면이 함께 쓴다. 칸 목록은 `overlay/describe.ts`가 그리는 코드와 같은 자리 선언에서 만든다(글 칸도 `TextSlot`으로 자리를 고정하고 글만 기록에서 꺼내므로 표본 값과 무관하다. 제7호 방문 칸은 첫 칸 자리이고 다섯 칸에 함께 적용). 편집 화면은 저장하지 않은 조정으로 서버가 그린 표본 PDF(`POST /form-layouts/:formId/preview`, 모든 선택지를 고른 표본)를 pdf.js로 띄우고, 그 위 손잡이를 끌거나 방향키로 옮긴다. 저장은 불러온 시각(`expectedUpdatedAt`)이 다르면 409, 서식에 없는 칸 ID는 400. 그래서 편집 화면은 서식 상세를 다시 받지 않는다(`useFormLayout`: 다시 받아 저장 시각이 바뀌면 초안이 409 없이 남의 저장을 덮어쓴다). 확정본 PDF는 볼 때마다 그리므로 이전 확정본도 새 자리로 나온다(기록 값·hash와 무관). 자리 선언에서 칸을 빼면 저장된 그 칸 조정은 읽을 때 버린다.
- 기본 글자 크기(`overlay/layout.ts`): 입력 값 10pt(원본 인쇄 글자 10~11pt에 맞춤), 괄호 내용 9pt, 출력 표시 6.5pt, 제7호 방문 칸 9pt(`home-care-nurse.ts`의 `COLUMN_SIZE`, 칸 폭 약 69pt). 칸보다 길면 그릴 때 칸에 맞게 줄인다. 표시 크기(`MARK_SIZE`: □ 체크 9, ○ 점 7.5, 제7호 증/감 동그라미 11)를 그림으로 바꾸는 규칙은 `render.ts`의 `drawPlacedMark` 한 곳이다(□는 체크 너비, ○ 점 지름은 0.7배, 동그라미는 지름). 조정 화면에서 표시 칸의 `size`는 표시 크기다(여러 칸을 골라 한꺼번에 바꿀 수 있다). 그리는 코드의 기본 자리·글자 모양·표시 크기가 칸 목록(`describe.ts`)과 같은지 `form-pdf.spec.ts`가 본다. 조정 화면 표본은 글자가 가장 긴 날짜(12월)라 좁은 칸이 드러난다.
- 조정 화면은 WinForms 디자이너처럼 쓴다: 여러 칸 고르기(사각형·목록 묶음/범위 포함), 고른 칸 함께 끌기·모서리 끌어 크기, 끄는 동안 다른 칸 선에 붙는 맞춤선, 맞춤 도구(첫째로 고른 칸 기준), 되돌리기·다시 하기, 글자 모양 복사·붙여넣기, 방향키 옮기기. 단축키 목록은 `layout-toolbar.tsx`의 `SHORTCUTS`(화면의 [단축키])가 원본이다. 편집 규칙(칸 자리·선택·맞춤·맞춤선·한도·되돌리기 기록)은 shared-types `form-layout-edit.ts`의 순수 함수이고 서버 `form-layout-edit.spec.ts`가 확인한다(끌기는 begin→apply→commit/cancel로 한 걸음, 3px 안의 떨림은 누르기로 본다). 단축키는 편집 화면 안에 포커스가 있을 때만 받는다(손잡이 레이어는 누르기의 기본 동작을 막으므로 직접 포커스를 가져온다). `useLayoutEditor`는 React Compiler가 건너뛰지 않게 `??=` 같은 아직 못 다루는 문법을 쓰지 않는다(건너뛰어도 경고가 없다).
- 새 원본 서식 더하기: `scripts/form-def-json.ts <서식ID>`로 서식 정의를 JSON으로 뽑고 `scripts/form-pdf-coords.py 원본.pdf --def def.json`(pymupdf)이 선택지 이름 옆 □/○를 찾아 좌표 초안을 만든다(윤곽선 글자 PDF는 `--dump`로 □/○ 위치만). 초안을 `layouts.ts`에 옮기고 `scripts/form-pdf-preview.ts <폴더>`(모든 칸을 채운 표본, 하나 고르기는 장마다 다음 선택지)로 눈으로 맞춘다.
- 글꼴은 Pretendard(OFL, `assets/fonts`)이고 쓴 글자만 넣는다(`renderPdf`). 1차는 그리지 않고 넘어온 글자만 모으고(폭 0, 글꼴 배치 없음), 2차는 그 글자만 HarfBuzz로 줄인 글꼴(`subset-font`, `noLayoutClosure`)로 그린다. 2차에만 생기는 글("…", 이어지는 장의 "(계속)")이 있으면 더해서 다시 그린다. pdf-lib 자체 subset은 Pretendard 글자를 비우고(fontkit이 짝수로 맞추지 않은 glyf를 짧은 loca로 적는다), layout closure를 켜면 `-`·`:` 뒤가 1em 벌어진다. 자산은 `nest-cli.json` assets로 dist에 복사된다(Dockerfile이 확인).
- 화면: 관리 웹 방문 상세 "확정 이력" 카드(지금 확정본과 각 차수 창에 [원본 서식 PDF]·[표준 서식 PDF], 제7호 방문이면 [N월 월간 기록지]), 현장 웹 확정된 기록 화면의 [서식 PDF](원본). PDF는 누르자마자 빈 탭을 열고 받은 뒤 채운다(`open-pdf.ts`, 팝업 차단 방지).

## 음성 구술 → 서식 초안

흐름: 현장 웹 녹음(MediaRecorder) → 브라우저에서 16kHz·모노 WAV로 변환(`features/dictation/lib/wav.ts`) → `POST /visits/:id/dictation` → STT → 문장(S1, S2…) → LLM 초안(방문의 서식 모두를 한 번에) → 자동 검사 → 되묻기 질문 → `VisitDictation` 저장 → 담당자가 "서식에 채우기" → 기존 [임시 저장]·[확정].

- **초안은 기록이 아니다.** 폼에 채울 뿐이고, 저장·확정은 기존 기록 API가 한다. 자동 제출 없음.
- 서버 구성(`apps/server/src/`):
  - `speech/` STT gRPC 클라이언트(cns `speech-stt-app`, Whisper)와 WAV 해석
  - `llm/` OpenAI 호환 chat completions 클라이언트. JSON 스키마(`response_format`)로 형태를 강제하고 zod로 다시 검사한다. 기본은 Gemini, 주소·모델만 바꿔 vLLM·Ollama 등으로 갈아탈 수 있다.
  - `dictation/dictation.pipeline.ts` Nest에 묶이지 않은 파이프라인. 평가 스크립트(`scripts/dictation-eval.ts`)도 그대로 쓴다.
  - `dictation/lib/` 문장 나누기, 서식 정의에서 만드는 프롬프트·LLM 응답 스키마(`draft-prompt.ts`), 한글 숫자 해석, 초안 검사기(단위 테스트 있음)
- 초안(`RecordDraft`)은 서식별 `{ values, evidence }`다. values는 서식 값과 같은 모양(채운 칸만), evidence 키는 칸 키 또는 "칸키.항목값". 여러 개 고르는 칸을 폼에 채울 때는 이미 고른 항목에 합친다(`mergeDraft` → `mergeFormValues` union).
- 초안에는 만들 때 쓴 서식마다 키가 있다(채운 칸이 없어도). 그래서 초안 키에 없는 서식은 그 뒤에 더한 서식이고, 현장 웹이 [초안 다시 만들기]를 안내한다. 서식을 빼면 서버가 초안에서 그 서식의 값·검사 결과·되묻기를 지운다(`keepDraftForms`). 녹음을 처리하는 사이에 뺀 서식도 저장 직전(잠근 상태)에 같은 방법으로 지운다. 두 서식에 같은 검사 문제가 나오면 서식마다 남기고, 같은 문구는 화면에서 한 번만 보여 준다.
- **숫자는 코드로 다시 대조한다**(`validate-draft.ts`): LLM은 값마다 근거 문장 ID와 숫자 원문(quote)을 돌려주고, 근거 문장에 quote가 있고 quote를 읽은 값이 같고 칸 범위 안일 때만 남긴다(증감 칸은 크기로 대조). 아니면 비우고 `issues`(removed)에 이유를 남긴다. 근거 문장이 없는 선택·글도 뺀다. 비운 값은 되묻기 질문이 된다. 글 칸의 숫자가 구술에 없으면 확인 요청(check)만 남긴다.
- 되묻기 답은 `append=true`로 올려 이전 문장 뒤에 이어 붙이고(번호 이어서), 전체 문장으로 초안을 다시 만든다.
- 현장 웹 녹음 화면:
  - 메인 화면은 서식이다. 녹음은 저장 버튼 바의 [녹음]으로 시작하고, 녹음하는 동안 바 위로 시트(`DictationSheet`, 비모달)가 올라와 사업 × 방문 직종의 "말할 내용"을 짚어 준다. 녹음 막대의 시간 부분을 누르면 접고 펴며, 마지막 선택을 브라우저에 기억한다(처음에는 펼침). 처리 중·보내기 실패([다시 보내기]·[녹음 버리기])도 이 시트가 보여 준다. 초안 카드(`DictationPanel`)는 구술이 생긴 뒤에만 서식 위에 나타난다.
  - 말할 내용은 문장 예시가 아니라 핵심 한 줄씩이다(shared-types `dictation-points.ts`의 `DICTATION_POINTS`, `dictationPoints`). 항목마다 채우는 칸("서식ID.칸키")을 적어 방문에 없는 서식의 칸만 채우는 항목은 빼고, 필수 칸이 있으면 "필수"를 붙인다. 테스트가 규칙마다 항목이 있는지, 칸이 그 규칙 서식의 구술 칸인지, 필수 칸과 되묻는 질문(`question`)이 있는 칸을 모두 다루는지 본다 — **서식 칸을 바꾸면 말할 내용도 고친다.**
  - 초안 뒤에는 요약(채운 항목·빠진 필수 수)과 서식별 채운 값(근거 문장은 [근거 문장 보기]를 켤 때만)을 보이고, "빠진 항목"(`missingDictationItems`)은 필수·질문 있는 칸을 질문·고를 수 있는 것과 함께, 질문 없는 부가 칸은 이름만 칩으로 모은다. 서버 되묻기에 질문 없는 빈 구술 칸(부가, 숫자 짝은 한 항목)을 더한다. 기록에 이미 저장한 값이 있는 칸과 followUps 묶음이 채워진 칸은 뺀다.
  - 녹음 상태(녹음기·보내기·다시 보내기·말할 내용 펼침)는 `useDictationSession`이다. 기록 폼이 만들고, 위 초안 카드와 저장 버튼 바(`DictationBarControl`, 녹음 중에는 바 전체가 녹음 막대)·시트가 함께 쓴다. 저장 버튼 바에서 녹음하면 결과를 알림으로도 띄우고([확인하기]는 초안 카드로), 마이크를 켜지 못하면 늘 알림으로 알린다. 세션 반환값에 ref를 넣지 않는다(React Compiler가 세션 전체를 ref로 보고 그리는 중 읽기를 막는다). 카드 자리 ref는 기록 폼이 따로 넘긴다.
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

## 배포 (cn.clickcns.com)

- 주소: `cn.clickcns.com`(현장 웹) · `cn.clickcns.com/admin`(관리 웹) · `/api`(서버) · `/dev`(개발 지침 문서 `docs/dev-guide.html`: 현장 웹 이미지에 `dev/index.html`로 넣고 nginx가 `/dev`·`/dev/`로 준다, 검색 제외. 시장조사 `docs/market.html`은 `dev/market.html`로 넣어 `/dev/market`으로, 수가 근거(지침 받는 곳·쪽수·갱신 절차) `docs/fees.html`은 `/dev/fees`로 준다 — 새 문서는 Dockerfile·`.dockerignore`·`docker-web.yml` 경로에 함께 더한다. 두 문서는 서로 `/dev`·`/dev/market` 절대 경로로 잇는다. 현장 웹 서비스 워커는 `/dev`도 가로채지 않는다). 한 도메인이라 두 웹 모두 API를 `/api`로 부른다. 두 웹의 로그인 저장 키가 달라(`carenote-web-auth`·`carenote-admin-auth`) 세션이 섞이지 않는다.
- 흐름: `main`에 push → GitHub Actions(`docker-server.yml`·`docker-web.yml`·`docker-web-admin.yml`, 바뀐 경로만) → `build-image.yml`이 루트 `Dockerfile`의 target(`server`·`web`·`web-admin`)을 빌드해 `ghcr.io/clickcns/cn/<target>:<커밋 SHA 7자리>`로 올림 → `clickcns/cns-k8s`의 `projects/cn/values.yaml` 태그 갱신(시크릿 `K8S_UPDATE_TOKEN`) → ArgoCD 앱 `cn`이 자동 동기화.
- 이미지: 서버는 `pnpm deploy --prod --legacy`로 prod 의존만 뽑는다(shared-types dist 포함, 실행 확인 단계 있음). 관리 웹은 빌드할 때만 vite `base: "/admin/"`(개발 서버는 `/`)이고 라우터 `basename`은 `import.meta.env.BASE_URL`, 공개 파일 경로도 `BASE_URL`을 붙인다. 현장 웹 서비스 워커는 `/api`·`/admin`을 가로채지 않는다(`navigateFallbackDenylist`). 로컬 확인: `docker build --target server -t cn-server .`
- 차트: `cns-k8s/projects/cn`(서브차트 `cn-server`·`cn-web`·`cn-web-admin` + 인그레스). 서버는 요청 제한이 파드 메모리에 있어 1개로 둔다. 서버 환경 변수는 시크릿 `cn-server-secret`(git 밖 `projects/cn/secrets.yaml`, 키 목록은 `secrets.example.yaml`).
- DB: 호스트 PostgreSQL 18의 `cn` DB(pgbouncer 6432). 마이그레이션은 배포에 포함되지 않는다 — 로컬에서 `pnpm db:deploy:prod`(`apps/server/.env.production`의 `DATABASE_URL`, gitignore). 스키마가 바뀌는 커밋은 push 전에 먼저 적용한다(마이그레이션은 이전 서버도 돌아가게 더하는 방향으로 쓴다). 처음 운영자 계정은 `pnpm db:admin:prod`(이미 있으면 건드리지 않음).

## Development Workflow

코드 변경 후 루트에서 `pnpm build`와 `pnpm lint`로 전체를 검증한다. `check-types`만으로는 Vite 번들링·Nest 빌드 실패를 놓칠 수 있다.

## Code Style

- Prettier: 세미콜론, 더블 쿼트, 2칸, trailing comma, printWidth 80, Tailwind 클래스 정렬
- 서버 import는 `.js` 확장자(nodenext)
- UI 텍스트와 에러 메시지는 한국어
