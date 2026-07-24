<template>
  <article class="card" :style="{ '--delay': `${index * 70}ms` }">
    <div class="card-head">
      <div class="stamp" :class="tier">
        <span class="n">{{ job.score }}</span>
        <span class="cap">MATCH</span>
      </div>
      <div style="flex: 1">
        <div class="card-meta-top">
          <span class="source-tag">{{ sourceLabel(job.source).toUpperCase() }}</span>
          <span class="posted-ago">{{ job.daysAgo === 0 ? 'today' : `${job.daysAgo}d ago` }}</span>
        </div>
        <div class="card-title">{{ job.title }}</div>
        <div class="card-sub">{{ job.company }} · {{ job.location }} · {{ job.contract }} · {{ remotePolicyLabel(job.remote) }}</div>
      </div>
    </div>

    <p class="card-summary">"{{ job.summary }}"</p>

    <div class="tag-row">
      <span v-for="reason in job.reasons" :key="`reason-${reason}`" class="tag reason">{{ reason }}</span>
      <span v-for="gap in job.gaps" :key="`gap-${gap}`" class="tag gap">GAP: {{ gap }}</span>
    </div>

    <div class="card-full" :class="{ open: isOpen }">{{ job.full }}</div>

    <div class="card-foot">
      <button class="expand-toggle" @click="isOpen = !isOpen">
        {{ isOpen ? 'Full brief ▴' : 'Full brief ▾' }}
      </button>
      <a class="orig-link" :href="job.url" target="_blank" rel="noopener">Open original listing ↗</a>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { remotePolicyLabel, scoreTier, sourceLabel } from '../types/job.js';
import type { MatchedJob } from '../types/job.js';

const props = defineProps<{ job: MatchedJob; index: number }>();
const isOpen = ref(false);
const tier = computed(() => scoreTier(props.job.score));
</script>

<style scoped>
.card {
  background: var(--paper-100);
  color: var(--paper-ink);
  border-radius: 3px;
  padding: var(--space-5) var(--space-6);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
  transform: rotate(var(--tilt, 0deg));
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease;
  opacity: 0;
  animation: card-in 0.5s cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
  animation-delay: var(--delay, 0ms);
}
@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(10px) rotate(var(--tilt, 0deg));
  }
  to {
    opacity: 1;
    transform: translateY(0) rotate(var(--tilt, 0deg));
  }
}
@media (prefers-reduced-motion: reduce) {
  .card {
    animation: none;
    opacity: 1;
  }
}
.card:nth-child(4n + 1) {
  --tilt: -0.6deg;
}
.card:nth-child(4n + 2) {
  --tilt: 0.4deg;
}
.card:nth-child(4n + 3) {
  --tilt: -0.3deg;
}
.card:nth-child(4n + 4) {
  --tilt: 0.6deg;
}
.card:hover {
  transform: rotate(0deg) translateY(-3px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.45);
}

.card-head {
  display: flex;
  gap: var(--space-5);
}
.stamp {
  flex: none;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-weight: 700;
  border: 2px solid;
  transform: rotate(-7deg);
  animation: stamp-in 0.4s cubic-bezier(0.3, 1.4, 0.5, 1) forwards;
  animation-delay: calc(var(--delay, 0ms) + 260ms);
  opacity: 0;
}
@keyframes stamp-in {
  0% {
    opacity: 0;
    transform: rotate(-7deg) scale(1.6);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 1;
    transform: rotate(-7deg) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .stamp {
    animation: none;
    opacity: 1;
    transform: rotate(-7deg) scale(1);
  }
}
.stamp .n {
  font-size: 1.25rem;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.stamp .cap {
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  margin-top: 2px;
}
.stamp.high {
  color: var(--score-high);
  border-color: var(--score-high);
  background: var(--score-high-tint);
}
.stamp.mid {
  color: var(--score-mid);
  border-color: var(--score-mid);
  background: var(--score-mid-tint);
}
.stamp.low {
  color: var(--score-low);
  border-color: var(--score-low);
  background: var(--score-low-tint);
}

.card-meta-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.source-tag {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: var(--paper-muted);
  border: 1px solid var(--paper-line);
  border-radius: 3px;
  padding: 2px 7px;
}
.posted-ago {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--paper-muted);
}
.card-title {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 1.15rem;
  margin: var(--space-2) 0 2px;
}
.card-sub {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--paper-muted);
  margin-bottom: var(--space-3);
}
.card-summary {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 0.95rem;
  color: var(--paper-ink);
  margin: 0 0 var(--space-3);
}
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--space-3);
}
.tag {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  border-radius: 3px;
  padding: 2px 8px;
  border: 1px solid;
}
.tag.reason {
  color: var(--score-high);
  border-color: var(--score-high);
  background: var(--score-high-tint);
}
.tag.gap {
  color: var(--score-low);
  border-color: var(--score-low);
  background: var(--score-low-tint);
}

.card-foot {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  border-top: 1px solid var(--paper-line);
  padding-top: var(--space-3);
}
.expand-toggle {
  background: none;
  border: none;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--stamp-blue);
  cursor: pointer;
  padding: 0;
}
.expand-toggle:hover {
  text-decoration: underline;
}
.card-full {
  display: none;
  font-size: 0.9rem;
  color: var(--paper-ink);
  margin-top: var(--space-3);
  line-height: 1.6;
}
.card-full.open {
  display: block;
}
.orig-link {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  margin-left: auto;
}
</style>
