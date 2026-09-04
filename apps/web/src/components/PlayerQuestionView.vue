<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Clock3, Hourglass, XCircle } from '@lucide/vue';

import {
  GAME_STATUS,
  PLAYER_RESULT_STATUS,
  type GameRoom,
  type PlayerQuestionResult,
  type PlayerQuestionState,
} from '@embedded-snakes-live/shared';

import AnswerOption from './AnswerOption.vue';
import CountdownOverlay from './CountdownOverlay.vue';
import DiceRoll from './DiceRoll.vue';
import QuestionTimer from './QuestionTimer.vue';

const props = defineProps<{
  room: GameRoom;
  playerState: PlayerQuestionState;
  isSubmitting?: boolean | undefined;
  isRollingDice?: boolean | undefined;
}>();

const emit = defineEmits<{
  answer: [optionId: string];
  rollDice: [];
}>();

const question = computed(() => props.room.currentQuestion);
const result = computed(() => props.playerState.result);
const selectedOptionId = computed(() => props.playerState.selectedOptionId);
const answerLocked = computed(() => props.isSubmitting || props.playerState.hasSubmitted);

const resultTitle = computed(() => {
  if (!result.value) {
    return 'Resultado pendiente';
  }

  if (result.value.status === PLAYER_RESULT_STATUS.CORRECT) {
    return 'Correcto';
  }

  if (result.value.status === PLAYER_RESULT_STATUS.INCORRECT) {
    return 'Incorrecto';
  }

  return 'Tiempo agotado';
});

const resultIcon = computed(() => {
  if (!result.value || result.value.status === PLAYER_RESULT_STATUS.TIMEOUT) {
    return Hourglass;
  }

  return result.value.correct ? CheckCircle2 : XCircle;
});

const resultClass = computed(() => {
  if (!result.value) {
    return 'border-white/15 bg-white/10 text-white';
  }

  if (result.value.status === PLAYER_RESULT_STATUS.CORRECT) {
    return 'border-emerald-200 bg-emerald-300 text-zinc-950';
  }

  if (result.value.status === PLAYER_RESULT_STATUS.INCORRECT) {
    return 'border-rose-200 bg-rose-400 text-white';
  }

  return 'border-amber-200 bg-amber-200 text-zinc-950';
});

function isSelected(optionId: string): boolean {
  return selectedOptionId.value === optionId;
}

function isCorrect(optionId: string, currentResult: PlayerQuestionResult | undefined): boolean {
  return currentResult?.correctOptionId === optionId;
}

function isIncorrectSelection(
  optionId: string,
  currentResult: PlayerQuestionResult | undefined,
): boolean {
  return Boolean(currentResult && isSelected(optionId) && !isCorrect(optionId, currentResult));
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
        <p class="text-sm font-black uppercase tracking-[0.25em] text-emerald-200">
          Pregunta {{ question.questionNumber }} / {{ question.totalQuestions }}
        </p>
        <h1 class="mt-3 text-3xl font-black leading-tight">{{ question.text }}</h1>
        <p class="mt-3 text-sm font-black uppercase tracking-wide text-white/55">
          {{ question.category }} - {{ question.difficulty }}
        </p>
      </header>

      <QuestionTimer :question="question" />

      <div class="grid gap-3">
        <AnswerOption
          v-for="(option, index) in question.options"
          :key="option.id"
          :option="option"
          :index="index"
          :selected="isSelected(option.id)"
          :disabled="answerLocked"
          @select="emit('answer', $event)"
        />
      </div>

      <p
        v-if="playerState.hasSubmitted"
        class="rounded-lg border border-emerald-200/40 bg-emerald-400/15 px-4 py-3 text-center font-black text-emerald-100"
      >
        Respuesta registrada
      </p>
    </template>

    <template v-else-if="room.status === GAME_STATUS.QUESTION_RESULTS && question">
      <section class="rounded-lg border p-5 shadow-2xl" :class="resultClass">
        <component :is="resultIcon" class="h-12 w-12" aria-hidden="true" />
        <h1 class="mt-4 text-4xl font-black">{{ resultTitle }}</h1>
        <p v-if="result?.responseTimeMs" class="mt-2 font-mono text-xl font-black">
          {{ Math.round(result.responseTimeMs / 100) / 10 }}s
        </p>
        <p class="mt-3 text-base font-bold">
          Respuesta correcta:
          {{ result?.correctOptionText ?? room.questionResults?.correctOptionText }}
        </p>
      </section>

      <div class="grid gap-3">
        <AnswerOption
          v-for="(option, index) in question.options"
          :key="option.id"
          :option="option"
          :index="index"
          :selected="isSelected(option.id)"
          :correct="isCorrect(option.id, result)"
          :incorrect="isIncorrectSelection(option.id, result)"
          disabled
        />
      </div>

      <p
        class="rounded-lg border border-white/10 bg-white/10 px-4 py-4 text-center text-lg font-black"
      >
        Esperando al administrador
      </p>
    </template>

    <DiceRoll
      v-else-if="room.status === GAME_STATUS.DICE_ROLL"
      :result="playerState.result"
      :dice="playerState.dice"
      :move="playerState.move"
      :rolling="isRollingDice"
      @roll="emit('rollDice')"
    />

    <section
      v-else-if="room.status === GAME_STATUS.FINISHED"
      class="rounded-lg border border-emerald-200/40 bg-emerald-300 p-6 text-zinc-950 shadow-glow"
    >
      <CheckCircle2 class="h-12 w-12" aria-hidden="true" />
      <h1 class="mt-4 text-4xl font-black">Ronda terminada</h1>
      <p class="mt-2 text-lg font-bold">Gracias por participar.</p>
    </section>

    <section
      v-else
      class="rounded-lg border border-white/15 bg-black/25 p-6 text-center shadow-2xl backdrop-blur"
    >
      <Clock3 class="mx-auto h-12 w-12 text-emerald-200" aria-hidden="true" />
      <h1 class="mt-4 text-3xl font-black">Ya estas dentro</h1>
      <p class="mt-2 text-lg font-semibold text-white/70">
        Esperando a que el administrador inicie.
      </p>
    </section>
  </section>
</template>
