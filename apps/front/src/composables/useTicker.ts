import { ref } from 'vue';

export interface TickerLine {
  readonly text: string;
  readonly done: boolean;
}

const STEP_MS = 480;
const FINAL_DELAY_MS = 500;

export function useTicker(lines: readonly string[]) {
  const visible = ref<TickerLine[]>([]);
  const complete = ref(false);

  function start(onComplete?: () => void) {
    visible.value = [];
    complete.value = false;

    let index = 0;
    function step() {
      if (index > 0) {
        const previous = visible.value[index - 1];
        if (previous) {
          visible.value.splice(index - 1, 1, { ...previous, done: true });
        }
      }
      if (index >= lines.length) {
        complete.value = true;
        if (onComplete) setTimeout(onComplete, FINAL_DELAY_MS);
        return;
      }
      visible.value = [...visible.value, { text: lines[index]!, done: false }];
      index += 1;
      setTimeout(step, STEP_MS);
    }
    step();
  }

  return { visible, complete, start };
}
