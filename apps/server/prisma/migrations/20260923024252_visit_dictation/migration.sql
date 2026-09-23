-- CreateTable
CREATE TABLE "visit_dictations" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "sentences" JSONB NOT NULL,
    "draft" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "questions" JSONB NOT NULL,
    "draftError" TEXT,
    "takes" INTEGER NOT NULL,
    "audioSeconds" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_dictations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visit_dictations_visitId_key" ON "visit_dictations"("visitId");

-- AddForeignKey
ALTER TABLE "visit_dictations" ADD CONSTRAINT "visit_dictations_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
