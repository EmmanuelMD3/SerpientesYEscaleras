<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import type { CountdownState } from '@embedded-snakes-live/shared';

const props = defineProps<{
  countdown: CountdownState;
}>();

const now = ref(Date.now());
let intervalId: number | undefined;

const remainingSeconds = computed(() =>
  Math.max(0, Math.ceil((new Date(props.countdown.endsAt).getTime() - now.value) / 1000)),
);

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
  <section class="rounded-lg border border-amber-200/40 bg-amber-200 p-6 text-center text-zinc-950 shadow-glow">
    <p class="text-sm font-black uppercase tracking-[0.25em]">Pregunta {{ countdown.nextQuestionNumber }}</p>
    <p class="mt-3 font-mono text-8xl font-black leading-none sm:text-9xl">
      {{ remainingSeconds || 'GO' }}
    </p>
    <p class="mt-3 text-lg font-black">Preparense</p>
  </section>
</template>
