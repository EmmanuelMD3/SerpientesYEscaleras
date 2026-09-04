<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, MinusCircle, XCircle } from '@lucide/vue';

import type { GameRoom, QuestionOption } from '@embedded-snakes-live/shared';

const props = defineProps<{
  room: GameRoom;
}>();

const question = computed(() => props.room.currentQuestion);
const results = computed(() => props.room.questionResults);
const activePlayerCount = computed(() => props.room.answerSummary?.activePlayerCount ?? 0);

function countForOption(optionId: string): number {
  return results.value?.distribution.find((item) => item.optionId === optionId)?.count ?? 0;
}

function percentForOption(option: QuestionOption): number {
  if (activePlayerCount.value === 0) {
    return 0;
  }

  return Math.round((countForOption(option.id) / activePlayerCount.value) * 100);
}
</script>

<template>
  <section v-if="question && results" class="grid gap-5">
    <div class="grid gap-3 sm:grid-cols-3">
      <div class="rounded-lg bg-emerald-300 p-4 text-zinc-950">
        <CheckCircle2 class="h-7 w-7" aria-hidden="true" />
        <p class="mt-2 text-sm font-black uppercase tracking-wide">Correctas</p>
        <p class="font-mono text-4xl font-black">{{ results.correctCount }}</p>
      </div>
      <div class="rounded-lg bg-rose-400 p-4 text-white">
        <XCircle class="h-7 w-7" aria-hidden="true" />
        <p class="mt-2 text-sm font-black uppercase tracking-wide">Incorrectas</p>
        <p class="font-mono text-4xl font-black">{{ results.incorrectCount }}</p>
      </div>
      <div class="rounded-lg bg-white/10 p-4 text-white">
        <MinusCircle class="h-7 w-7" aria-hidden="true" />
        <p class="mt-2 text-sm font-black uppercase tracking-wide">Sin responder</p>
        <p class="font-mono text-4xl font-black">{{ results.unansweredCount }}</p>
      </div>
    </div>

    <div class="rounded-lg border border-white/10 bg-white/10 p-5">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-black uppercase tracking-wide text-white/55">Respuesta correcta</p>
          <p class="mt-1 text-2xl font-black text-emerald-100">{{ results.correctOptionText }}</p>
        </div>
        <p class="font-mono text-4xl font-black text-white">{{ results.accuracyPercent }}%</p>
      </div>
    </div>

    <div class="grid gap-3">
      <article
        v-for="(option, index) in question.options"
        :key="option.id"
        class="rounded-lg border border-white/10 bg-white/10 p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <p class="min-w-0 text-base font-black text-white">
            {{ ['A', 'B', 'C', 'D'][index] ?? index + 1 }}. {{ option.text }}
          </p>
          <p class="font-mono text-2xl font-black text-white">{{ countForOption(option.id) }}</p>
        </div>
        <div class="mt-3 h-3 overflow-hidden rounded-full bg-zinc-950/50">
          <div
            class="h-full rounded-full"
            :class="option.id === results.correctOptionId ? 'bg-emerald-300' : 'bg-fuchsia-300'"
            :style="{ width: `${percentForOption(option)}%` }"
          />
        </div>
      </article>
    </div>
  </section>
</template>
