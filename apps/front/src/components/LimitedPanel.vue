<template>
  <section>
    <div class="limit-box">
      <div class="limit-stamp">TODAY'S QUOTA USED</div>
      <p>You've used both checks for today. A fresh pair unlocks at midnight.</p>
      <div class="countdown">{{ label }}</div>
      <p class="fine">Rate limits protect the shared job pool and scoring budget for every visitor, not just you — see §3.2.2 of the PRD.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useMidnightCountdown } from '../composables/useMidnightCountdown.js';

const { label, start } = useMidnightCountdown();
onMounted(start);
</script>

<style scoped>
.limit-box {
  border: 2px solid var(--score-low);
  border-radius: 6px;
  padding: var(--space-8) var(--space-6);
  text-align: center;
  max-width: 36rem;
  margin: var(--space-6) auto 0;
  position: relative;
  background: rgba(156, 43, 31, 0.06);
}
.limit-stamp {
  display: inline-block;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
  color: var(--score-low);
  border: 3px solid var(--score-low);
  border-radius: 4px;
  padding: var(--space-3) var(--space-5);
  transform: rotate(-4deg);
  margin-bottom: var(--space-5);
}
.limit-box p {
  color: var(--dim-text);
  font-size: 0.95rem;
}
.limit-box .countdown {
  font-family: var(--font-mono);
  font-size: 1.6rem;
  color: var(--cream-text);
  margin: var(--space-4) 0;
  font-variant-numeric: tabular-nums;
}
.limit-box .fine {
  font-size: 0.8rem;
  color: var(--paper-muted);
  border-top: 1px solid var(--ink-line);
  padding-top: var(--space-4);
  margin-top: var(--space-5);
}
</style>
