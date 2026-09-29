-- 수급자 차트번호(기관 EMR의 환자 번호). 이름·생년월일과 함께 검색에 쓰고, 기관 안에서 겹치지 않는다
-- (NULL은 여러 개 둘 수 있다).

-- AlterTable
ALTER TABLE "recipients" ADD COLUMN     "chartNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "recipients_organizationId_chartNumber_key" ON "recipients"("organizationId", "chartNumber");
