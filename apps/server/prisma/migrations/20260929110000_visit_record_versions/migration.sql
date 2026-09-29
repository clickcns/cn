-- 확정본 이력. 확정할 때마다 그때의 기록을 통째로 보관하고(1차, 2차 …) SHA-256을 남긴다.
-- [수정]으로 되돌려도 이전 확정본은 그대로 둔다(별지 원본 5년 보관, 기록 수정 이력).
-- 이 기능 전에 확정한 방문은 처음 [수정]할 때 그 확정본을 1차로 보관한다(visit.service.ts reopen).

-- CreateTable
CREATE TABLE "visit_record_versions" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "reopenedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_record_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_record_versions_visitId_version_key" ON "visit_record_versions"("visitId", "version");

-- AddForeignKey
ALTER TABLE "visit_record_versions" ADD CONSTRAINT "visit_record_versions_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_record_versions" ADD CONSTRAINT "visit_record_versions_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_record_versions" ADD CONSTRAINT "visit_record_versions_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
