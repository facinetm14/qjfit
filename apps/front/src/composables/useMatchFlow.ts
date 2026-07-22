import { ref } from 'vue';
import { MOCK_MATCHED_JOBS, POOL_STATS } from '../data/jobs.fixture.js';
import type { MatchedJob, PoolStats } from '../types/job.js';

export type FlowPanel = 'upload' | 'scanning' | 'results' | 'limited';

const MAX_CHECKS_PER_DAY = 2;
// Simulated latency standing in for POST /api/match + GET /api/match/:id polling
// until the backend implements the route contract in ADR 0016.
const MOCK_MATCH_DELAY_MS = 2900;

export function createMatchFlow(poolStats: PoolStats = POOL_STATS) {
  const panel = ref<FlowPanel>('upload');
  const checksLeft = ref(MAX_CHECKS_PER_DAY);
  const selectedFile = ref<File | null>(null);
  const results = ref<readonly MatchedJob[]>([]);

  function selectFile(file: File | null) {
    selectedFile.value = file;
  }

  async function requestMatch(_file: File): Promise<readonly MatchedJob[]> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_MATCH_DELAY_MS));
    return MOCK_MATCHED_JOBS;
  }

  async function runCheck() {
    const file = selectedFile.value;
    if (!file) return;

    if (checksLeft.value <= 0) {
      panel.value = 'limited';
      return;
    }

    checksLeft.value -= 1;
    panel.value = 'scanning';
    results.value = await requestMatch(file);
    panel.value = 'results';
  }

  function reset() {
    panel.value = 'upload';
    checksLeft.value = MAX_CHECKS_PER_DAY;
    selectedFile.value = null;
    results.value = [];
  }

  return {
    panel,
    checksLeft,
    selectedFile,
    results,
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
