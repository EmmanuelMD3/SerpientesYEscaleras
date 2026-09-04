<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import type { PublicQuestion } from '@embedded-snakes-live/shared';

const props = defineProps<{
  question: PublicQuestion;
}>();

const now = ref(Date.now());
let intervalId: number | undefined;

const totalMs = computed(() =>
  Math.max(
    1,
    new Date(props.question.expiresAt).getTime() - new Date(props.question.startedAt).getTime(),
  ),
);
const remainingMs = computed(() =>
  Math.max(0, new Date(props.question.expiresAt).getTime() - now.value),
);
const remainingSeconds = computed(() => Math.ceil(remainingMs.value / 1000));
const progressPercent = computed(() => Math.max(0, Math.min(100, (remainingMs.value / totalMs.value) * 100)));

onMounted(() => {
  intervalId = window.setInterval(() => {
    now.value = Date.now();
  }, 200);
});

onBeforeUnmount(() => {
  if (intervalId) {
    window.clearInterval(intervalId);
  }
});
</script>

<template>
  <div class="rounded-lg border border-white/10 bg-white/10 p-4">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-black uppercase tracking-wide text-white/55">Tiempo</p>
      <p class="font-mono text-2xl font-black text-white">{{ remainingSeconds }}s</p>
    </div>
    <div class="mt-3 h-3 overflow-hidden rounded-full bg-zinc-950/50">
      <div
        class="h-full rounded-full bg-emerald-300 transition-[width] duration-200"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
  </div>
</template>
