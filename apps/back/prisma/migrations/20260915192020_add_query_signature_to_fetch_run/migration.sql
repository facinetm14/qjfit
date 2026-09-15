-- AlterTable
ALTER TABLE "fetch_runs" ADD COLUMN     "querySignature" TEXT;

-- CreateIndex
CREATE INDEX "fetch_runs_querySignature_status_endedAt_idx" ON "fetch_runs"("querySignature", "status", "endedAt");
