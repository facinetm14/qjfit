<template>
  <section>
    <p class="eyebrow">Processing — this can take up to two minutes</p>
    <h1 class="headline" style="font-size: clamp(1.8rem, 3vw + 1rem, 2.6rem)">Reading your dossier.</h1>
    <div class="scan-stage">
      <div class="scan-doc">
        <div class="line" /><div class="line" /><div class="line" />
        <div class="line" /><div class="line" /><div class="line" />
        <div class="scan-beam" />
      </div>
      <div class="ticker" aria-live="polite">
        <div v-for="(line, idx) in visible" :key="idx" class="line" :class="{ done: line.done }">
          {{ line.text }}<span v-if="idx === visible.length - 1 && !complete" class="caret" />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useTicker } from '../composables/useTicker.js';
import { TICKER_LINES } from '../data/jobs.fixture.js';

const { visible, complete, start } = useTicker(TICKER_LINES);

onMounted(() => start());
</script>

<style scoped>
.scan-stage {
  border: 1px solid var(--ink-line);
  border-radius: 6px;
  overflow: hidden;
  background: var(--ink-800);
  position: relative;
  padding: var(--space-7) var(--space-6);
  margin-top: var(--space-6);
}
.scan-doc {
  width: 180px;
  margin: 0 auto var(--space-6);
  position: relative;
  background: var(--paper-100);
  border-radius: 3px;
  padding: var(--space-4) var(--space-4);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}
.scan-doc .line {
  height: 6px;
  background: var(--paper-line);
  border-radius: 2px;
  margin-bottom: 8px;
}
.scan-doc .line:nth-child(1) {
  width: 70%;
}
.scan-doc .line:nth-child(2) {
  width: 92%;
}
.scan-doc .line:nth-child(3) {
  width: 60%;
}
.scan-doc .line:nth-child(4) {
  width: 85%;
}
.scan-doc .line:nth-child(5) {
  width: 75%;
}
.scan-doc .line:nth-child(6) {
  width: 50%;
}
.scan-beam {
  position: absolute;
  left: 0;
  right: 0;
  height: 30%;
  background: linear-gradient(
    to bottom,
    transparent,
    rgba(44, 74, 114, 0.5),
    rgba(44, 74, 114, 0.85),
    rgba(44, 74, 114, 0.5),
    transparent
  );
  mix-blend-mode: multiply;
  animation: sweep 2.2s ease-in-out infinite;
}
.scan-beam::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  background: var(--stamp-blue-bright);
  box-shadow: 0 0 8px 1px var(--stamp-blue-bright);
}
@keyframes sweep {
  0% {
    top: -34%;
  }
  100% {
    top: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .scan-beam {
    animation: none;
    top: 30%;
  }
}

.ticker {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--dim-text);
  max-width: 34rem;
  margin: 0 auto;
  min-height: 7.5em;
}
.ticker .line {
  opacity: 0;
  animation: reveal 0.5s ease forwards;
  margin-bottom: 6px;
}
.ticker .line.done {
  color: var(--stamp-blue-bright);
}
.ticker .line .caret {
  display: inline-block;
  width: 7px;
  height: 1em;
  background: var(--dim-text);
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}
</style>
