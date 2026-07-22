/*
  Warnings:

  - You are about to drop the column `status` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the `profile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `scores` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "scores" DROP CONSTRAINT "scores_jobId_fkey";

-- DropIndex
DROP INDEX "jobs_status_fetchedAt_idx";

-- AlterTable
ALTER TABLE "jobs" DROP COLUMN "status";

-- DropTable
DROP TABLE "profile";

-- DropTable
DROP TABLE "scores";

-- DropEnum
DROP TYPE "JobStatus";

-- CreateIndex
CREATE INDEX "jobs_fetchedAt_idx" ON "jobs"("fetchedAt");
