-- DropForeignKey
ALTER TABLE "fetch_logs" DROP CONSTRAINT "fetch_logs_runId_fkey";

-- AlterTable
ALTER TABLE "fetch_runs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "fetch_logs" ADD CONSTRAINT "fetch_logs_runId_fkey" FOREIGN KEY ("runId") REFERENCES "fetch_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
