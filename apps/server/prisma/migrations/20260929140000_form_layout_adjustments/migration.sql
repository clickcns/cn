-- 원본 서식 조정 화면: 운영자가 서식마다 저장하는 칸 미세조정(모든 기관 공통).
-- CreateTable
CREATE TABLE "form_layout_adjustments" (
    "formId" TEXT NOT NULL,
    "adjustments" JSONB NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_layout_adjustments_pkey" PRIMARY KEY ("formId")
);

-- AddForeignKey
ALTER TABLE "form_layout_adjustments" ADD CONSTRAINT "form_layout_adjustments_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
