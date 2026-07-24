<template>
  <section class="upload-grid">
    <div>
      <p class="eyebrow reveal" style="animation-delay: 0.05s">
        No account · no history · two checks a day
      </p>
      <h1 class="headline reveal" style="animation-delay: 0.12s">
        Upload your CV.<br />See what actually fits.
      </h1>
      <p class="sub reveal" style="animation-delay: 0.2s">
        We read your CV, cross-reference it against every open role currently
        tracked from multiple jobboards (France&nbsp;Travail,
        Welcome&nbsp;to&nbsp;the&nbsp;Jungle, etc.) and hand back a scored,
        ranked shortlist.
      </p>

      <div class="reveal" style="animation-delay: 0.28s">
        <div
          class="dropzone"
          :class="{ 'drag-over': isDragOver }"
          tabindex="0"
          role="button"
          aria-label="Upload your CV, PDF or DOCX, 5 megabytes maximum"
          @click="openFileDialog"
          @keydown.enter.prevent="openFileDialog"
          @keydown.space.prevent="openFileDialog"
          @dragenter.prevent="isDragOver = true"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="onDrop"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          <div class="dz-title">Drag your CV here, or click to select</div>
          <div class="dz-sub">PDF OR DOCX · 5&nbsp;MB MAX</div>
          <input
            ref="fileInputRef"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            @change="onFileInputChange"
          />
        </div>

        <div class="file-chip" :class="{ visible: !!file }">
          <span>{{ fileLabel }}</span>
          <button
            class="remove-file"
            aria-label="Remove file"
            @click.stop="clearFile"
          >
            ✕
          </button>
        </div>

        <p v-if="fileError" class="file-error" role="alert">{{ fileError }}</p>

        <button
          class="btn btn-primary"
          :disabled="!file || !!fileError"
          @click="$emit(ClientEvents.CV_SUBMITTED)"
        >
          Run the check →
        </button>
      </div>

      <div
        class="notice reveal"
        style="animation-delay: 0.34s; margin-top: var(--space-7)"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
          <path d="M4 4l16 16" stroke-width="1.5" />
        </svg>
        <p>
          <strong>Nothing is stored.</strong> Your CV is read into memory to
          compute this match and discarded the moment it resolves. Its content
          is sent to our Agent for scoring only.
        </p>
      </div>
    </div>

    <aside class="side-card reveal" style="animation-delay: 0.3s">
      <h3>Current pool</h3>
      <div class="pool-stat">
        <span class="n">{{ poolStats.total }}</span
        ><span class="l">open roles tracked right now</span>
      </div>
      <div class="pool-stat">
        <span class="n">{{ poolStats.refreshedHoursAgo }}h</span
        ><span class="l">since last refresh</span>
      </div>
      <div
        class="source-line"
        v-for="entry in poolStats.bySource"
        :key="entry.source"
      >
        <span>{{ sourceLabel(entry.source) }}</span
        ><span>{{ entry.count }}</span>
      </div>
    </aside>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { PoolStats } from "../types/job.js";
import { ClientEvents, sourceLabel } from "../types/job.js";

const props = defineProps<{ file: File | null; fileError: string | null; poolStats: PoolStats }>();
const emit = defineEmits<{
  (e: typeof ClientEvents.CV_UPLOADED, file: File | null): void;
  (e: typeof ClientEvents.CV_SUBMITTED): void;
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragOver = ref(false);

const fileLabel = computed(() => {
  if (!props.file) return "—";
  const kb = Math.max(1, Math.round(props.file.size / 1024));
  return `${props.file.name} · ${kb} KB`;
});

function openFileDialog() {
  fileInputRef.value?.click();
}

function onFileInputChange() {
  const file = fileInputRef.value?.files?.[0] ?? null;
  emit(ClientEvents.CV_UPLOADED, file);
}

function onDrop(e: DragEvent) {
  isDragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) emit(ClientEvents.CV_UPLOADED, file);
}

function clearFile() {
  if (fileInputRef.value) fileInputRef.value.value = "";
  emit(ClientEvents.CV_UPLOADED, null);
}
</script>

<style scoped>
.upload-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: var(--space-7);
  align-items: start;
}
@media (max-width: 860px) {
  .upload-grid {
    grid-template-columns: 1fr;
  }
}

.dropzone {
  border: 1.5px dashed rgba(233, 228, 209, 0.28);
  border-radius: 6px;
  background: rgba(233, 228, 209, 0.02);
  padding: var(--space-8) var(--space-6);
  text-align: center;
  cursor: pointer;
  position: relative;
  transition:
    border-color 0.25s ease,
    background 0.25s ease,
    transform 0.25s ease;
}
.dropzone:hover {
  border-color: rgba(233, 228, 209, 0.45);
}
.dropzone.drag-over {
  border-color: var(--stamp-blue-bright);
  background: rgba(111, 155, 209, 0.08);
  transform: scale(1.01);
}
.dropzone svg {
  width: 34px;
  height: 34px;
  color: var(--dim-text);
  margin-bottom: var(--space-4);
}
.dropzone .dz-title {
  font-size: 1.05rem;
  color: var(--cream-text);
  margin-bottom: var(--space-2);
}
.dropzone .dz-sub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: var(--dim-text);
}
.dropzone input[type="file"] {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.file-chip {
  display: none;
  align-items: center;
  gap: var(--space-3);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  background: var(--ink-800);
  border: 1px solid var(--ink-line);
  border-radius: 4px;
  padding: var(--space-3) var(--space-4);
  margin-top: var(--space-4);
}
.file-chip.visible {
  display: flex;
}
.file-chip .remove-file {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--dim-text);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.9rem;
}
.file-chip .remove-file:hover {
  color: var(--score-low);
}

.file-error {
  color: var(--score-low);
  font-size: 0.85rem;
  margin: var(--space-3) 0 0;
}

.notice {
  border-top: 1px solid var(--ink-line);
  padding-top: var(--space-5);
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}
.notice svg {
  width: 18px;
  height: 18px;
  flex: none;
  margin-top: 3px;
  color: var(--stamp-blue-bright);
}
.notice p {
  margin: 0;
  font-size: 0.88rem;
  color: var(--dim-text);
}
.notice strong {
  color: var(--cream-text);
  font-weight: 600;
}

.side-card {
  background: var(--ink-800);
  border: 1px solid var(--ink-line);
  border-radius: 6px;
  padding: var(--space-6);
}
.side-card h3 {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--dim-text);
  margin: 0 0 var(--space-4);
}
.pool-stat {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.pool-stat .n {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1.4rem;
  color: var(--cream-text);
  font-variant-numeric: tabular-nums;
}
.pool-stat .l {
  font-size: 0.85rem;
  color: var(--dim-text);
}
.source-line {
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--dim-text);
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--ink-line);
  padding: var(--space-2) 0;
}
.source-line span:last-child {
  color: var(--cream-text);
}
</style>
