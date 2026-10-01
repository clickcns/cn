-- 포털 입력 표시. 확정한 서식을 심평원·공단 전산에 옮겨 적었다고 담당자·관리자가 표시한다(서식마다 하나).
-- 공식 전산과 연결되지 않으므로 표시가 곧 미입력 목록의 기준이다. 표만 더하므로 이전 서버도 그대로 돈다.

-- CreateTable
CREATE TABLE "visit_portal_entries" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "enteredById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_portal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_portal_entries_visitId_formId_key" ON "visit_portal_entries"("visitId", "formId");

-- AddForeignKey
ALTER TABLE "visit_portal_entries" ADD CONSTRAINT "visit_portal_entries_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_portal_entries" ADD CONSTRAINT "visit_portal_entries_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
