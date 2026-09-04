<script setup lang="ts">
import { computed } from 'vue';
import { Dices, HelpCircle, Trophy, Users } from '@lucide/vue';

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
  hasMoreQuestions.value ? 'Siguiente pregunta' : 'Nuevo ciclo',
);
const winner = computed(() => props.room.winner);
const leaderboard = computed(() => props.room.finalLeaderboard ?? []);
const winnerResponseSeconds = computed(() => {
  if (winner.value?.responseTimeMs === null || winner.value?.responseTimeMs === undefined) {
    return null;
  }

  return Math.round(winner.value.responseTimeMs / 10) / 100;
});

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
      class="rounded-lg border border-amber-200/50 bg-amber-200 p-6 text-zinc-950 shadow-glow"
    >
      <Trophy class="h-12 w-12" aria-hidden="true" />
      <p class="mt-4 text-sm font-black uppercase tracking-[0.25em]">Tenemos ganador</p>
      <h2 class="mt-2 text-5xl font-black uppercase leading-none">
        {{ winner?.playerName ?? 'Partida terminada' }}
      </h2>
      <p class="mt-3 text-lg font-bold">Llego a la casilla 40.</p>
      <div v-if="winner" class="mt-5 grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg bg-zinc-950 px-4 py-3 text-white">
          <p class="text-xs font-black uppercase tracking-wide text-white/50">Ronda</p>
          <p class="font-mono text-3xl font-black">{{ winner.roundNumber }}</p>
        </div>
        <div class="rounded-lg bg-zinc-950 px-4 py-3 text-white">
          <p class="text-xs font-black uppercase tracking-wide text-white/50">Tiempo final</p>
          <p class="font-mono text-3xl font-black">
            {{ winnerResponseSeconds === null ? 'N/D' : `${winnerResponseSeconds}s` }}
          </p>
        </div>
      </div>

      <section v-if="leaderboard.length > 0" class="mt-5 rounded-lg bg-zinc-950 p-4 text-white">
        <h3 class="text-sm font-black uppercase tracking-wide text-amber-100">
          Clasificacion final
        </h3>
        <ol class="mt-3 grid gap-2">
          <li
            v-for="entry in leaderboard"
            :key="entry.playerId"
            class="flex items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2"
          >
            <span class="min-w-0 truncate font-black">
              {{ entry.rank }}. {{ entry.playerName }}
            </span>
            <span class="shrink-0 font-mono font-black">{{ entry.position }}</span>
          </li>
        </ol>
      </section>
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
