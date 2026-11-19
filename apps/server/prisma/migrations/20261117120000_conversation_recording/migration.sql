-- AlterTable
ALTER TABLE "recipients" ADD COLUMN     "recordingConsentBy" TEXT,
ADD COLUMN     "recordingConsentOn" DATE;

-- CreateTable
CREATE TABLE "visit_conversation_segments" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "runStartedAt" TIMESTAMP(3) NOT NULL,
    "index" INTEGER NOT NULL,
    "seconds" DOUBLE PRECISION NOT NULL,
    "sentences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_conversation_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_conversation_segments_visitId_runId_index_key" ON "visit_conversation_segments"("visitId", "runId", "index");

-- AddForeignKey
ALTER TABLE "visit_conversation_segments" ADD CONSTRAINT "visit_conversation_segments_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

