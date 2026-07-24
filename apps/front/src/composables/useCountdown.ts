import { onUnmounted, ref } from 'vue';
import { formatCountdown, msUntil } from '../utils/countdown.js';

const TICK_INTERVAL_MS = 30_000;

export function useCountdown() {
  const label = ref('—');
  let timer: ReturnType<typeof setInterval> | null = null;
  let target: Date | null = null;

  function tick() {
    if (!target) return;
    label.value = formatCountdown(msUntil(target, new Date()));
  }

  function start(resetAt: Date) {
    target = resetAt;
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
