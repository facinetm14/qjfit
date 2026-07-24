<template>
  <section>
    <div class="error-box">
      <div class="error-stamp">SOMETHING WENT WRONG</div>
      <p>{{ message }}</p>
      <button class="btn btn-primary" @click="$emit('retry')">Try again</button>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ message: string }>();
defineEmits<{ (e: 'retry'): void }>();
</script>

<style scoped>
.error-box {
  border: 2px solid var(--score-low);
  border-radius: 6px;
  padding: var(--space-8) var(--space-6);
  text-align: center;
  max-width: 36rem;
  margin: var(--space-6) auto 0;
  background: rgba(156, 43, 31, 0.06);
}
.error-stamp {
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
.error-box p {
  color: var(--dim-text);
  font-size: 0.95rem;
  margin-bottom: var(--space-6);
}
.error-box .btn {
  margin: 0 auto;
}
</style>
