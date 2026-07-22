<template>
  <header class="site-header">
    <div class="wrap">
      <div class="wordmark">QJ<span>FIT</span></div>
      <div class="quota-pill" :data-empty="checksLeft <= 0">
        {{ quotaLabel }}
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ checksLeft: number }>();

const quotaLabel = computed(() => {
  if (props.checksLeft <= 0) return '0 CHECKS LEFT TODAY';
  const noun = props.checksLeft === 1 ? 'CHECK' : 'CHECKS';
  return `${props.checksLeft} ${noun} LEFT TODAY`;
});
</script>

<style scoped>
.site-header {
  position: relative;
  z-index: 2;
  border-bottom: 1px solid var(--ink-line);
  padding: var(--space-5) 0;
}
.site-header .wrap {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
}
.wordmark {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: 0.06em;
  color: var(--cream-text);
}
.wordmark span {
  color: var(--stamp-blue-bright);
}
.tagline {
  margin: 0 auto 0 var(--space-6);
  font-family: var(--font-display);
  font-style: italic;
  font-weight: 400;
  color: var(--dim-text);
  font-size: 0.95rem;
}
@media (max-width: 640px) {
  .tagline {
    display: none;
  }
}
.quota-pill {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--cream-text);
  border: 1px dashed rgba(233, 228, 209, 0.35);
  border-radius: 999px;
  padding: var(--space-2) var(--space-4);
  white-space: nowrap;
  transition:
    border-color 0.3s ease,
    color 0.3s ease;
}
.quota-pill[data-empty='true'] {
  color: var(--score-low);
  border-color: rgba(156, 43, 31, 0.55);
}
</style>
