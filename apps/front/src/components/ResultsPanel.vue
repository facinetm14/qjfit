<template>
  <section>
    <p class="eyebrow">Match complete</p>
    <h1 class="headline" style="font-size: clamp(1.8rem, 3vw + 1rem, 2.6rem)">Your shortlist.</h1>

    <div class="results-top">
      <div class="results-count"><b>{{ filteredJobs.length }}</b> of {{ poolTotal }} roles matched</div>
      <div class="spacer" />
      <select class="sort-select" v-model="sortOrder" aria-label="Sort results">
        <option value="score">Sort: score, high → low</option>
        <option value="date">Sort: newest first</option>
      </select>
    </div>

    <div class="results-layout">
      <ResultsFilters
        :min-score="minScore"
        :sources="sources"
        :contracts="contracts"
        :remote-policies="remotePolicies"
        @update:min-score="minScore = $event"
        @toggle-source="toggleSource"
        @toggle-contract="toggleContract"
        @toggle-remote="toggleRemote"
      />

      <div class="cards">
        <ResultCard v-for="(job, idx) in filteredJobs" :key="job.id" :job="job" :index="idx" />

        <div v-if="filteredJobs.length === 0" class="empty-state">
          <p>No roles clear that bar today.</p>
          <p class="n">Try lowering the minimum score, or widening your filters.</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { toRef } from 'vue';
import ResultsFilters from './ResultsFilters.vue';
import ResultCard from './ResultCard.vue';
import { useJobFilters } from '../composables/useJobFilters.js';
import type { MatchedJob } from '../types/job.js';

const props = defineProps<{ jobs: readonly MatchedJob[]; poolTotal: number }>();

const jobsRef = toRef(props, 'jobs');
const { minScore, sources, contracts, remotePolicies, sortOrder, filteredJobs, toggleSource, toggleContract, toggleRemote } =
  useJobFilters(jobsRef);
</script>

<style scoped>
.results-top {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  flex-wrap: wrap;
  border-bottom: 1px solid var(--ink-line);
  padding-bottom: var(--space-5);
  margin-bottom: var(--space-6);
}
.results-count {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--cream-text);
  font-variant-numeric: tabular-nums;
}
.results-count b {
  color: var(--stamp-blue-bright);
}
.results-top .spacer {
  flex: 1;
}
.sort-select {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  background: var(--ink-800);
  color: var(--cream-text);
  border: 1px solid var(--ink-line);
  border-radius: 4px;
  padding: var(--space-2) var(--space-3);
}

.results-layout {
  display: grid;
  grid-template-columns: 15rem 1fr;
  gap: var(--space-7);
  align-items: start;
}
@media (max-width: 860px) {
  .results-layout {
    grid-template-columns: 1fr;
  }
}

.cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.empty-state {
  text-align: center;
  padding: var(--space-8) 0;
  color: var(--dim-text);
}
.empty-state .n {
  font-family: var(--font-mono);
  font-size: 0.85rem;
}
</style>
