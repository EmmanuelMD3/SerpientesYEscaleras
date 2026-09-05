<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Clock3, Flag, Hourglass, Trophy, XCircle } from '@lucide/vue';

import {
  BOARD_MAX_POSITION,
  GAME_FINISH_REASON,
  GAME_STATUS,
  PLAYER_RESULT_STATUS,
  type GameRoom,
  type Player,
  type PlayerQuestionResult,
  type PlayerQuestionState,
} from '@embedded-snakes-live/shared';

import AnswerOption from './AnswerOption.vue';
import CountdownOverlay from './CountdownOverlay.vue';
import DiceRoll from './DiceRoll.vue';
import QuestionTimer from './QuestionTimer.vue';

const props = defineProps<{
  room: GameRoom;
  player?: Player | null | undefined;
  playerState: PlayerQuestionState;
  noticeMessage?: string | undefined;
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
const winner = computed(() => props.room.winner);
const finishReason = computed(() => props.room.finishReason);
const playerWon = computed(() =>
  Boolean(winner.value && winner.value.playerId === props.player?.id),
);
const finalPosition = computed(() => props.player?.position ?? 0);
const finishedTitle = computed(() => {
  if (finishReason.value === GAME_FINISH_REASON.WINNER && playerWon.value) {
    return '¡Ganaste!';
  }

  return 'Partida terminada';
});
const finishedMessage = computed(() => {
  if (finishReason.value === GAME_FINISH_REASON.WINNER && playerWon.value) {
    return 'Llegaste a la meta.';
  }

  if (finishReason.value === GAME_FINISH_REASON.ADMIN_NEW_GAME) {
    return 'El administrador creo una nueva partida. Espera el nuevo enlace o QR.';
  }

  if (finishReason.value === GAME_FINISH_REASON.ADMIN_ENDED) {
    return 'El administrador termino la partida.';
  }

  return 'La partida finalizo.';
});

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
      class="rounded-lg border p-6 shadow-glow"
      :class="
        playerWon
          ? 'border-amber-200/50 bg-amber-200 text-zinc-950'
          : 'border-white/15 bg-black/25 text-white'
      "
    >
      <Trophy v-if="playerWon" class="h-12 w-12" aria-hidden="true" />
      <Flag v-else class="h-12 w-12 text-amber-200" aria-hidden="true" />
      <h1 class="mt-4 text-4xl font-black uppercase leading-none">
        {{ finishedTitle }}
      </h1>
      <p class="mt-3 text-lg font-bold">{{ finishedMessage }}</p>
      <template v-if="finishReason === GAME_FINISH_REASON.WINNER && !playerWon">
        <p class="mt-3 text-sm font-black uppercase tracking-wide text-white/55">Ganador</p>
        <p class="text-3xl font-black text-amber-200">
          {{ winner?.playerName ?? 'Por confirmar' }}
        </p>
      </template>
      <template v-if="!playerWon">
        <p class="mt-5 text-sm font-black uppercase tracking-wide text-white/55">
          Tu posicion final
        </p>
        <p class="font-mono text-5xl font-black text-emerald-200">{{ finalPosition }}</p>
      </template>
    </section>

    <section
      v-else
      class="rounded-lg border border-white/15 bg-black/25 p-6 text-center shadow-2xl backdrop-blur"
    >
      <Clock3 class="mx-auto h-12 w-12 text-emerald-200" aria-hidden="true" />
      <h1 class="mt-4 text-3xl font-black">Ya estas dentro</h1>
      <p class="mt-2 text-lg font-semibold text-white/70">
        {{ noticeMessage || 'Esperando a que el administrador inicie.' }}
      </p>
      <p class="mt-3 text-sm font-black uppercase tracking-wide text-white/45">
        Meta: casilla {{ BOARD_MAX_POSITION }}
      </p>
    </section>
  </section>
</template>
