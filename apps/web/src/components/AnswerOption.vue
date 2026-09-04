<script setup lang="ts">
import { computed } from 'vue';

import type { QuestionOption } from '@embedded-snakes-live/shared';

const props = defineProps<{
  option: QuestionOption;
  index: number;
  disabled?: boolean;
  selected?: boolean;
  correct?: boolean;
  incorrect?: boolean;
  count?: number;
  showCount?: boolean;
}>();

const emit = defineEmits<{
  select: [optionId: string];
}>();

const optionLetter = computed(() => ['A', 'B', 'C', 'D'][props.index] ?? String(props.index + 1));
const stateClass = computed(() => {
  if (props.correct) {
    return 'border-emerald-200 bg-emerald-300 text-zinc-950';
  }

  if (props.incorrect) {
    return 'border-rose-200 bg-rose-400 text-white';
  }

  if (props.selected) {
    return 'border-amber-200 bg-amber-200 text-zinc-950';
  }

  return 'border-white/15 bg-white/10 text-white hover:border-emerald-200/70 hover:bg-white/15';
});
</script>

<template>
  <button
    class="grid min-h-20 w-full grid-cols-[3rem_1fr_auto] items-center gap-4 rounded-lg border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-80"
    :class="stateClass"
    type="button"
    :disabled="disabled"
    @click="emit('select', option.id)"
  >
    <span
      class="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-950/90 font-mono text-xl font-black text-white"
    >
      {{ optionLetter }}
    </span>
    <span class="min-w-0 text-lg font-black leading-snug">{{ option.text }}</span>
    <span v-if="showCount" class="font-mono text-2xl font-black">{{ count ?? 0 }}</span>
  </button>
</template>
