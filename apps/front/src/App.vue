<template>
  <div class="atmosphere" aria-hidden="true" />

  <AppHeader :checks-left="flow.checksLeft.value" />

  <main class="stage">
    <div class="wrap">
      <UploadPanel
        v-if="flow.panel.value === 'upload'"
        :file="flow.selectedFile.value"
        :pool-stats="flow.poolStats"
        @cv-uploaded="flow.selectFile"
        @cv-submitted="flow.runCheck"
      />
      <ScanningPanel v-else-if="flow.panel.value === 'scanning'" />
      <ResultsPanel
        v-else-if="flow.panel.value === 'results'"
        :jobs="flow.results.value"
        :pool-total="flow.poolStats.total"
      />
      <LimitedPanel v-else-if="flow.panel.value === 'limited'" />
    </div>
  </main>

  <AppFooter />
</template>

<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue";
import AppFooter from "./components/AppFooter.vue";
import UploadPanel from "./components/UploadPanel.vue";
import ScanningPanel from "./components/ScanningPanel.vue";
import ResultsPanel from "./components/ResultsPanel.vue";
import LimitedPanel from "./components/LimitedPanel.vue";
import { useMatchFlow } from "./composables/useMatchFlow.js";

const flow = useMatchFlow();
</script>

<style scoped>
.stage {
  position: relative;
  z-index: 1;
  padding: var(--space-8) 0 var(--space-7);
  min-height: 60vh;
}
</style>
