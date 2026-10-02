-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('CLINIC', 'HOSPITAL', 'PUBLIC_HEALTH');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "institutionType" "InstitutionType" NOT NULL DEFAULT 'CLINIC';

-- CreateTable
CREATE TABLE "home_care_fee_schedules" (
    "id" TEXT NOT NULL,
    "effectiveMonth" TEXT NOT NULL,
    "fees" JSONB NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedById" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "home_care_fee_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_care_fee_schedules_effectiveMonth_key" ON "home_care_fee_schedules"("effectiveMonth") WHERE ("deletedAt" IS NULL);

-- AddForeignKey
ALTER TABLE "home_care_fee_schedules" ADD CONSTRAINT "home_care_fee_schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_care_fee_schedules" ADD CONSTRAINT "home_care_fee_schedules_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
