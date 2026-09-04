<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Dices, HelpCircle, Users } from '@lucide/vue';

import { GAME_STATUS, type GameRoom, type QuestionOption } from '@embedded-snakes-live/shared';

import AdminDicePanel from './AdminDicePanel.vue';
import AnswerOption from './AnswerOption.vue';
import CountdownOverlay from './CountdownOverlay.vue';
import QuestionResults from './QuestionResults.vue';
import QuestionTimer from './QuestionTimer.vue';

const props = defineProps<{
  room: GameRoom;
  isAdvancing?: boolean;
  isStartingDice?: boolean;
}>();

const emit = defineEmits<{
  next: [];
  startDice: [];
}>();

const question = computed(() => props.room.currentQuestion);
const answerSummary = computed(() => props.room.answerSummary);
const hasMoreQuestions = computed(() => {
  if (!props.room.questionResults) {
    return true;
  }

  return props.room.questionResults.questionNumber < props.room.questionResults.totalQuestions;
});
const nextButtonLabel = computed(() =>
  hasMoreQuestions.value ? 'Siguiente pregunta' : 'Terminar partida',
);

function optionCount(option: QuestionOption): number {
  return (
    props.room.questionResults?.distribution.find((item) => item.optionId === option.id)?.count ?? 0
  );
}
</script>

<template>
  <section class="grid gap-5">
    <CountdownOverlay
      v-if="room.status === GAME_STATUS.COUNTDOWN && room.countdown"
      :countdown="room.countdown"
    />

    <template v-else-if="room.status === GAME_STATUS.QUESTION_ACTIVE && question">
      <header class="rounded-lg border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-sm font-black uppercase tracking-[0.25em] text-emerald-200">
              Pregunta {{ question.questionNumber }} / {{ question.totalQuestions }}
            </p>
            <h2 class="mt-3 text-3xl font-black leading-tight sm:text-5xl">{{ question.text }}</h2>
            <p class="mt-3 text-sm font-black uppercase tracking-wide text-white/55">
              {{ question.category }} - {{ question.difficulty }}
            </p>
          </div>
          <div class="rounded-lg bg-emerald-300 p-4 text-zinc-950">
            <Users class="h-8 w-8" aria-hidden="true" />
            <p class="mt-2 text-sm font-black uppercase tracking-wide">Respuestas</p>
            <p class="font-mono text-4xl font-black">
              {{ answerSummary?.answeredCount ?? 0 }}
              <span class="text-xl">/ {{ answerSummary?.activePlayerCount ?? 0 }}</span>
            </p>
          </div>
        </div>
      </header>

      <QuestionTimer :question="question" />

      <div class="grid gap-3 lg:grid-cols-2">
        <AnswerOption
          v-for="(option, index) in question.options"
          :key="option.id"
          :option="option"
          :index="index"
          disabled
        />
      </div>
    </template>

    <template v-else-if="room.status === GAME_STATUS.QUESTION_RESULTS && question">
      <header class="rounded-lg border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p class="text-sm font-black uppercase tracking-[0.25em] text-emerald-200">
              Resultado {{ question.questionNumber }} / {{ question.totalQuestions }}
            </p>
            <h2 class="mt-3 text-3xl font-black leading-tight sm:text-5xl">{{ question.text }}</h2>
          </div>
          <button
            class="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-emerald-300 px-6 text-base font-black uppercase text-zinc-950 shadow-glow transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
            type="button"
            :disabled="isStartingDice"
            @click="emit('startDice')"
          >
            {{ isStartingDice ? 'Habilitando...' : 'Habilitar dados' }}
            <Dices class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div class="grid gap-3 lg:grid-cols-2">
        <AnswerOption
          v-for="(option, index) in question.options"
          :key="option.id"
          :option="option"
          :index="index"
          :correct="option.id === room.questionResults?.correctOptionId"
          :count="optionCount(option)"
          show-count
          disabled
        />
      </div>

      <QuestionResults :room="room" />
    </template>

    <AdminDicePanel
      v-else-if="room.status === GAME_STATUS.DICE_ROLL"
      :room="room"
      :is-advancing="isAdvancing"
      :next-button-label="nextButtonLabel"
      @next="emit('next')"
    />

    <section
      v-else-if="room.status === GAME_STATUS.FINISHED"
      class="rounded-lg border border-emerald-200/40 bg-emerald-300 p-6 text-zinc-950 shadow-glow"
    >
      <CheckCircle2 class="h-12 w-12" aria-hidden="true" />
      <h2 class="mt-4 text-4xl font-black">Ronda terminada</h2>
      <p class="mt-2 text-lg font-bold">
        Las posiciones finales permanecen visibles en el tablero.
      </p>
    </section>

    <section
      v-else
      class="rounded-lg border border-white/15 bg-black/25 p-6 shadow-2xl backdrop-blur"
    >
      <HelpCircle class="h-10 w-10 text-amber-200" aria-hidden="true" />
      <h2 class="mt-4 text-3xl font-black">Estado de partida en espera</h2>
    </section>
  </section>
</template>
