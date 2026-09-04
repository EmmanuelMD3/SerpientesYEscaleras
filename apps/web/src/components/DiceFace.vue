<script setup lang="ts">
import { computed } from 'vue';

import type { DiceValue } from '@embedded-snakes-live/shared';

const props = defineProps<{
  value?: DiceValue | null;
  rolling?: boolean | undefined;
}>();

const face = computed(() => {
  if (props.rolling) {
    return '🎲';
  }

  if (!props.value) {
    return '🎲';
  }

  return ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][props.value - 1] ?? '🎲';
});
</script>

<template>
  <div
    class="flex aspect-square w-full max-w-48 items-center justify-center rounded-lg border border-white/15 bg-white text-8xl text-zinc-950 shadow-2xl"
    :class="rolling ? 'animate-dice-roll' : ''"
    aria-live="polite"
  >
    {{ face }}
  </div>
</template>
