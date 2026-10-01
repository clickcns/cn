-- CreateEnum
CREATE TYPE "HomeCareAssessmentKind" AS ENUM ('INITIAL', 'REASSESS');

-- CreateEnum
CREATE TYPE "HomeCareEndReason" AS ENUM ('DEATH', 'FACILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "ExternalServiceKind" AS ENUM ('LTC_NURSING', 'HOME_NURSING', 'DAY_CARE', 'BATH', 'SHORT_STAY', 'FACILITY', 'LTC_SOCIAL_WORKER', 'CHRONIC_CARE', 'DISABILITY_DOCTOR');

-- AlterTable
ALTER TABLE "recipients" ADD COLUMN     "homeCareEndReason" "HomeCareEndReason",
ADD COLUMN     "homeCareEndedOn" DATE;

-- CreateTable
CREATE TABLE "home_care_assessments" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "assessedOn" DATE NOT NULL,
    "kind" "HomeCareAssessmentKind" NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "home_care_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient_external_services" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "kind" "ExternalServiceKind" NOT NULL,
    "provider" TEXT,
    "weekdays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "startsOn" DATE,
    "endsOn" DATE,
    "startTime" TEXT,
    "endTime" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipient_external_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "home_care_assessments_recipientId_assessedOn_key" ON "home_care_assessments"("recipientId", "assessedOn");

-- CreateIndex
CREATE INDEX "recipient_external_services_recipientId_idx" ON "recipient_external_services"("recipientId");

-- AddForeignKey
ALTER TABLE "home_care_assessments" ADD CONSTRAINT "home_care_assessments_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_care_assessments" ADD CONSTRAINT "home_care_assessments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipient_external_services" ADD CONSTRAINT "recipient_external_services_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
