import { onUnmounted, ref } from 'vue';
import { formatCountdown, msUntilMidnight } from '../utils/countdown.js';

const TICK_INTERVAL_MS = 30_000;

export function useMidnightCountdown() {
  const label = ref('—');
  let timer: ReturnType<typeof setInterval> | null = null;

  function tick() {
    label.value = formatCountdown(msUntilMidnight(new Date()));
  }

  function start() {
    tick();
    stop();
    timer = setInterval(tick, TICK_INTERVAL_MS);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  onUnmounted(stop);

  return { label, start, stop };
}
