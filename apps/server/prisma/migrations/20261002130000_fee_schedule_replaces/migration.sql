-- AlterTable
ALTER TABLE "home_care_fee_schedules" ADD COLUMN     "replacesId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "home_care_fee_schedules_replacesId_key" ON "home_care_fee_schedules"("replacesId");

-- AddForeignKey
ALTER TABLE "home_care_fee_schedules" ADD CONSTRAINT "home_care_fee_schedules_replacesId_fkey" FOREIGN KEY ("replacesId") REFERENCES "home_care_fee_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

