import { ref } from 'vue';
import { POOL_STATS } from '../data/jobs.fixture.js';
import type { MatchedJob, PoolStats } from '../types/job.js';
import type { ApiCreateMatchResponse, ApiMatchTicket, ApiRateLimitExceededResponse } from '../types/match-api.js';
import { toMatchedJob } from '../utils/map-scored-job.js';
import { validateCvFile } from '../utils/validate-cv-file.js';

export type FlowPanel = 'upload' | 'scanning' | 'results' | 'limited' | 'error';

const POLL_INTERVAL_MS = 2000;
// Match tickets live for minutes, not hours (ADR 0016 §4) — bail out well
// before that TTL rather than polling a ticket that's already expired.
const MAX_POLL_ATTEMPTS = 90;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMatchFlow(poolStats: PoolStats = POOL_STATS) {
  const panel = ref<FlowPanel>('upload');
  // Optimistic default shown before the first real request — the server is
  // the only source of truth for the actual count (IP+day, in Redis) and
  // corrects this as soon as a request resolves.
  const checksLeft = ref(2);
  const selectedFile = ref<File | null>(null);
  const fileError = ref<string | null>(null);
  const results = ref<readonly MatchedJob[]>([]);
  const resetAt = ref<Date | null>(null);
  const errorMessage = ref<string | null>(null);

  function selectFile(file: File | null) {
    selectedFile.value = file;
    fileError.value = file ? validateCvFile(file).error ?? null : null;
  }

  async function pollTicket(ticketId: string): Promise<ApiMatchTicket> {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      const response = await fetch(`/api/match/${ticketId}`);
      if (response.status === 404) {
        throw new Error('This match request has expired. Please try again.');
      }
      if (!response.ok) {
        throw new Error('Unable to check your match status. Please try again.');
      }

      const ticket = (await response.json()) as ApiMatchTicket;
      if (ticket.status !== 'pending') {
        return ticket;
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error('This is taking longer than expected. Please try again.');
  }

  async function runCheck() {
    const file = selectedFile.value;
    if (!file) return;

    const validation = validateCvFile(file);
    if (!validation.valid) {
      fileError.value = validation.error ?? 'This file cannot be uploaded.';
      return;
    }

    panel.value = 'scanning';
    errorMessage.value = null;

    try {
      const formData = new FormData();
      formData.append('cv', file);
      const response = await fetch('/api/match', { method: 'POST', body: formData });

      if (response.status === 429) {
        const body = (await response.json()) as ApiRateLimitExceededResponse;
        resetAt.value = new Date(body.resetAt);
        checksLeft.value = 0;
        panel.value = 'limited';
        return;
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? 'Unable to submit your CV. Please try again.');
      }

      const body = (await response.json()) as ApiCreateMatchResponse;
      checksLeft.value = body.remaining;

      const ticket = await pollTicket(body.ticketId);
      if (ticket.status === 'failed') {
        throw new Error(ticket.error);
      }

      const now = new Date();
      results.value = ticket.status === 'completed' ? ticket.results.map((job) => toMatchedJob(job, now)) : [];
      panel.value = 'results';
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      panel.value = 'error';
    }
  }

  function reset() {
    panel.value = 'upload';
    selectedFile.value = null;
    fileError.value = null;
    results.value = [];
    errorMessage.value = null;
  }

  return {
    panel,
    checksLeft,
    selectedFile,
    fileError,
    results,
    resetAt,
    errorMessage,
    poolStats,
    selectFile,
    runCheck,
    reset
  };
}

let singleton: ReturnType<typeof createMatchFlow> | null = null;

export function useMatchFlow() {
  if (!singleton) {
    singleton = createMatchFlow();
  }
  return singleton;
}
