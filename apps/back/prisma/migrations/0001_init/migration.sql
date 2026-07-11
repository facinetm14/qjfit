CREATE TYPE "ContractType" AS ENUM ('CDI', 'CDD', 'Freelance', 'Internship', 'Apprenticeship', 'Other');
CREATE TYPE "RemotePolicy" AS ENUM ('Full', 'Hybrid', 'OnSite', 'Unknown');
CREATE TYPE "JobStatus" AS ENUM ('new', 'scored', 'score_failed');
CREATE TYPE "RunStatus" AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE "profile" (
  "id" TEXT PRIMARY KEY,
  "targetRole" TEXT NOT NULL,
  "targetCompanyIndustry" TEXT[] NOT NULL DEFAULT '{}',
  "techStack" TEXT[] NOT NULL DEFAULT '{}',
  "seniorityMin" INTEGER NOT NULL,
  "seniorityMax" INTEGER NOT NULL,
  "location" TEXT NOT NULL,
  "excludedKeywords" TEXT[] NOT NULL DEFAULT '{}',
  "contractTypes" "ContractType"[] NOT NULL DEFAULT '{}',
  "salaryMin" INTEGER,
  "bio" TEXT,
  "availability" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "jobs" (
  "id" TEXT PRIMARY KEY,
  "title" TEXT NOT NULL,
  "company" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "contractType" "ContractType" NOT NULL,
  "remotePolicy" "RemotePolicy" NOT NULL,
  "description" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "sourceJobId" TEXT,
  "dedupKey" TEXT NOT NULL,
  "salaryMin" INTEGER,
  "salaryMax" INTEGER,
  "experienceMin" INTEGER,
  "experienceMax" INTEGER,
  "status" "JobStatus" NOT NULL DEFAULT 'new',
  "fetchedAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "jobs_source_sourceJobId_key" UNIQUE ("source", "sourceJobId")
);

CREATE TABLE "scores" (
  "id" TEXT PRIMARY KEY,
  "jobId" TEXT NOT NULL UNIQUE REFERENCES "jobs"("id") ON DELETE CASCADE,
  "score" INTEGER NOT NULL,
  "summary" TEXT NOT NULL,
  "matchReasons" TEXT[] NOT NULL DEFAULT '{}',
  "missingSkills" TEXT[] NOT NULL DEFAULT '{}',
  "seniorityFit" TEXT NOT NULL,
  "redFlags" TEXT[] NOT NULL DEFAULT '{}',
  "rawResponse" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "fetch_runs" (
  "id" TEXT PRIMARY KEY,
  "status" "RunStatus" NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMPTZ,
  "endedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "fetch_logs" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL REFERENCES "fetch_runs"("id") ON DELETE CASCADE,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "fetched" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "jobs_dedupKey_idx" ON "jobs"("dedupKey");
CREATE INDEX "jobs_status_fetchedAt_idx" ON "jobs"("status", "fetchedAt");
CREATE INDEX "scores_score_idx" ON "scores"("score");
CREATE INDEX "fetch_runs_createdAt_idx" ON "fetch_runs"("createdAt");
CREATE INDEX "fetch_logs_runId_source_idx" ON "fetch_logs"("runId", "source");
