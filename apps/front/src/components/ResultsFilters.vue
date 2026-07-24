<template>
  <div class="filters">
    <div class="filter-group" data-tab="score">
      <label for="scoreRange" style="margin-bottom: 2px">Minimum score</label>
      <input
        id="scoreRange"
        type="range"
        min="0"
        max="100"
        step="5"
        :value="minScore"
        @input="$emit('update:minScore', Number(($event.target as HTMLInputElement).value))"
      />
      <div class="range-value"><span>{{ minScore }}</span><span>100</span></div>
    </div>

    <div class="filter-group" data-tab="source">
      <label v-for="value in sourceOptions" :key="value">
        <input type="checkbox" :checked="sources.includes(value)" @change="$emit('toggle-source', value)" />
        {{ sourceLabel(value) }}
      </label>
    </div>

    <div class="filter-group" data-tab="contract">
      <div class="chip-row">
        <button
          v-for="value in contractOptions"
          :key="value"
          type="button"
          class="chip-toggle"
          :aria-pressed="contracts.includes(value)"
          @click="$emit('toggle-contract', value)"
        >
          {{ value }}
        </button>
      </div>
    </div>

    <div class="filter-group" data-tab="remote">
      <div class="chip-row">
        <button
          v-for="value in remoteOptions"
          :key="value"
          type="button"
          class="chip-toggle"
          :aria-pressed="remotePolicies.includes(value)"
          @click="$emit('toggle-remote', value)"
        >
          {{ remotePolicyLabel(value) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ContractType, JobSource, RemotePolicy } from '../types/job.js';
import { remotePolicyLabel, sourceLabel } from '../types/job.js';

defineProps<{
  minScore: number;
  sources: readonly JobSource[];
  contracts: readonly ContractType[];
  remotePolicies: readonly RemotePolicy[];
}>();
defineEmits<{
  (e: 'update:minScore', value: number): void;
  (e: 'toggle-source', value: JobSource): void;
  (e: 'toggle-contract', value: ContractType): void;
  (e: 'toggle-remote', value: RemotePolicy): void;
}>();

const sourceOptions: JobSource[] = ['france-travail', 'wttj-rss'];
const contractOptions: ContractType[] = ['CDI', 'CDD', 'Freelance', 'Internship', 'Apprenticeship', 'Other'];
const remoteOptions: RemotePolicy[] = ['Full', 'Hybrid', 'OnSite'];
</script>

<style scoped>
.filters {
  position: sticky;
  top: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.filter-group {
  background: var(--paper-100);
  border-radius: 2px 8px 8px 8px;
  position: relative;
  padding: var(--space-4);
}
.filter-group::before {
  content: attr(data-tab);
  position: absolute;
  top: -1.6rem;
  left: 0;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  color: var(--paper-muted);
  background: var(--paper-200);
  padding: 3px 10px;
  border-radius: 4px 4px 0 0;
}
.filter-group label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.85rem;
  color: var(--paper-ink);
  margin-bottom: var(--space-2);
  cursor: pointer;
}
.filter-group label:last-child {
  margin-bottom: 0;
}
.filter-group input[type='checkbox'] {
  accent-color: var(--stamp-blue);
}
.filter-group input[type='range'] {
  width: 100%;
  accent-color: var(--stamp-blue);
}
.range-value {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--paper-muted);
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.chip-toggle {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.02em;
  border: 1px solid var(--paper-line);
  background: transparent;
  color: var(--paper-ink);
  border-radius: 999px;
  padding: 4px 10px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.chip-toggle[aria-pressed='true'] {
  background: var(--stamp-blue);
  border-color: var(--stamp-blue);
  color: var(--cream-text);
}
</style>
