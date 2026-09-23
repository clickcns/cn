# 케어노트 (CareNote)

방문 의료·간호·복지 기록 도우미. 의사·간호사·사회복지사가 방문 1건의 법정 서식을 작성·확정하고, 기관 관리자가 사용자·수급자·방문을 관리한다.

| 사업                         | 직종별 서식                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| 일차의료 방문진료 (심평원)   | 의사: 별지 제4호 점검서식                                    |
| 장기요양 재택의료센터 (공단) | 의사: 별지 제4호 + 제6호 · 간호사: 제7호 · 사회복지사: 제8호 |
| 장기요양 방문간호            | 간호사: 별지 제14호 급여제공기록지                           |

| 앱            | 주소 (로컬)                                                   |
| ------------- | ------------------------------------------------------------- |
| 현장 웹       | http://localhost:5210                                         |
| 관리 웹       | http://localhost:5211                                         |
| API · Swagger | http://localhost:3210/api · http://localhost:3210/api/swagger |

## 시작하기

전제: Node 22 이상, pnpm 11, Docker.

```bash
pnpm install
cp apps/server/.env.example apps/server/.env

pnpm infra:up     # PostgreSQL 18 (localhost:5510)
pnpm db:deploy    # 마이그레이션 적용
pnpm db:seed      # 데모 데이터
pnpm dev          # 서버 + 현장 웹 + 관리 웹
pnpm test         # 단위 테스트(초안 검사 규칙 등)
```

### 데모 계정 (비밀번호 모두 `1234`)

| 아이디             | 역할·직종   | 기관              | 쓰는 곳          |
| ------------------ | ----------- | ----------------- | ---------------- |
| `nurse1`, `nurse2` | 간호사      | 데모 방문간호센터 | 현장 웹          |
| `manager`          | 기관 관리자 | 데모 방문간호센터 | 현장 웹, 관리 웹 |
| `doctor1`          | 의사        | 데모 재택의료의원 | 현장 웹          |
| `hnurse1`          | 간호사      | 데모 재택의료의원 | 현장 웹          |
| `social1`          | 사회복지사  | 데모 재택의료의원 | 현장 웹          |
| `manager2`         | 기관 관리자 | 데모 재택의료의원 | 현장 웹, 관리 웹 |
| `admin`            | 운영자      | 없음              | 관리 웹          |

수급자·방문 등 시드 전체 내용과 초기화 방법은 [docs/seed-data.md](docs/seed-data.md).

## 음성 구술 → 서식 초안

현장 웹 방문 기록 화면 맨 위의 **음성으로 기록**에서 방문 직후 2~3분 말하면 그 방문의 서식 초안이 만들어진다(의사 재택의료 방문이면 별지 제4호·제6호를 한 번에).

- 음성인식: cns의 `speech-stt-app`(gRPC, Whisper) · 초안: Gemini(OpenAI 호환 API)
- `apps/server/.env`의 `LLM_API_KEY`에 Gemini 키를 넣어야 초안이 만들어진다(없으면 음성인식까지만).
- 마이크는 `localhost` 또는 HTTPS 주소에서만 켜진다. 휴대폰 실기기로 시험하려면 HTTPS로 배포해야 한다.
- 개발용 STT 주소(`211.254.168.186:30051`)는 인터넷에 암호화 없이 열린 포트다. **실제 대상자 음성은 넣지 않는다**(가상 데이터만).

화면 없이 녹음 파일로 결과만 보려면(평가용, ffmpeg 필요):

```bash
pnpm --filter @repo/server dictation:eval 녹음.m4a --name 김영자 --notes "천골 욕창 관리 중"
pnpm --filter @repo/server dictation:eval 의사.m4a --forms PRIMARY_CARE_CHECK,HOME_CARE_DOCTOR
```

## 구조

```
apps/
  server/        NestJS + Prisma (PostgreSQL)
  web/           현장 웹: 의사·간호사·사회복지사용 반응형 웹 (PWA)
  web-admin/     관리 웹
packages/
  shared-types/  zod 스키마·타입, 서식 정의(forms/) (서버·웹 공용)
  api-client/    API 클라이언트·인증 스토어 (웹 공용, 추후 모바일 앱 재사용)
  typescript-config/, eslint-config/
```

자세한 규칙은 [CLAUDE.md](CLAUDE.md).
