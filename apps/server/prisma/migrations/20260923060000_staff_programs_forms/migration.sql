-- 직종·사업 도입과 방문 서식 분리. 기존 데이터를 옮긴다(장기요양 방문간호 간호사 → 현장 직원 + 직종 간호사).

-- CreateEnum
CREATE TYPE "Profession" AS ENUM ('DOCTOR', 'NURSE', 'SOCIAL_WORKER');

-- CreateEnum
CREATE TYPE "Program" AS ENUM ('PRIMARY_CARE', 'HOME_CARE_CENTER', 'LTC_NURSING');

-- 사용자: 간호사 역할은 직종으로 옮기고 역할은 현장 직원(STAFF)이 된다.
ALTER TABLE "users" ADD COLUMN "licenseNumber" TEXT,
ADD COLUMN "profession" "Profession";
UPDATE "users" SET "profession" = 'NURSE' WHERE "role" = 'NURSE';
ALTER TYPE "Role" RENAME VALUE 'NURSE' TO 'STAFF';
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STAFF';

-- 기관: 기존 기관은 장기요양 방문간호 기관
ALTER TABLE "organizations" ADD COLUMN "programs" "Program"[];
UPDATE "organizations" SET "programs" = ARRAY['LTC_NURSING']::"Program"[];

-- 수급자: 장기요양인정번호
ALTER TABLE "recipients" ADD COLUMN "ltcCertNumber" TEXT;

-- 방문: 담당자(nurseId → staffId), 사업, 서식
ALTER TABLE "visits" DROP CONSTRAINT "visits_nurseId_fkey";
DROP INDEX "visits_nurseId_scheduledAt_idx";
ALTER TABLE "visits" RENAME COLUMN "nurseId" TO "staffId";
ALTER TABLE "visits" ADD COLUMN "formIds" TEXT[],
ADD COLUMN "program" "Program";
UPDATE "visits" SET "program" = 'LTC_NURSING', "formIds" = ARRAY['LTC_NURSING'];
ALTER TABLE "visits" ALTER COLUMN "program" SET NOT NULL;

-- CreateTable
CREATE TABLE "visit_forms" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_forms_pkey" PRIMARY KEY ("id")
);

-- 기존 기록(별지 제14호, 옛 모양) → 서식 값(shared-types LTC_NURSING 서식)
INSERT INTO "visit_forms" ("id", "visitId", "formId", "data", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  v."id",
  'LTC_NURSING',
  COALESCE(v."record"->'vitals', '{}'::jsonb) || jsonb_build_object(
    'healthCare', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('value', e->>'item', 'minutes', e->'minutes', 'note', e->'note'))
      FROM jsonb_array_elements(v."record"->'healthCare') e
    ), '[]'::jsonb),
    'nursingCare', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('value', e->>'item', 'minutes', e->'minutes', 'note', e->'note'))
      FROM jsonb_array_elements(v."record"->'nursingCare') e
    ), '[]'::jsonb),
    'specialNote', COALESCE(v."record"->'specialNote', '""'::jsonb),
    'nextPlan', COALESCE(v."record"->'nextPlan', '""'::jsonb)
  ),
  v."updatedAt",
  v."updatedAt"
FROM "visits" v
WHERE v."record" IS NOT NULL;

ALTER TABLE "visits" DROP COLUMN "record";

-- 구술 초안 모양이 서식별로 바뀌었다. 문장은 두고 초안만 비워 [초안 다시 만들기]로 새로 만든다.
UPDATE "visit_dictations"
SET "draft" = '{}'::jsonb,
    "issues" = '[]'::jsonb,
    "questions" = '[]'::jsonb,
    "draftError" = '서식이 바뀌어 초안을 다시 만들어야 합니다. [초안 다시 만들기]를 눌러 주세요';

-- CreateIndex
CREATE UNIQUE INDEX "visit_forms_visitId_formId_key" ON "visit_forms"("visitId", "formId");

-- CreateIndex
CREATE INDEX "visits_staffId_scheduledAt_idx" ON "visits"("staffId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_forms" ADD CONSTRAINT "visit_forms_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
