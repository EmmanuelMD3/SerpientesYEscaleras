<script setup lang="ts">
import { computed } from 'vue';
import { CheckCircle2, Hourglass, XCircle } from '@lucide/vue';

import {
  PLAYER_RESULT_STATUS,
  type DiceState,
  type PlayerMove,
  type PlayerQuestionResult,
} from '@embedded-snakes-live/shared';

import DiceFace from './DiceFace.vue';

const props = defineProps<{
  result?: PlayerQuestionResult | undefined;
  dice?: DiceState | undefined;
  move?: PlayerMove | undefined;
  rolling?: boolean | undefined;
}>();

const emit = defineEmits<{
  roll: [];
}>();

const canRoll = computed(() =>
  Boolean(props.dice?.eligible && !props.dice.rolled && !props.rolling),
);
const value = computed(() => props.dice?.value ?? null);

const title = computed(() => {
  if (!props.result) {
    return 'Esperando resultado';
  }

  if (props.result.status === PLAYER_RESULT_STATUS.CORRECT) {
    return 'Acertaste';
  }

  if (props.result.status === PLAYER_RESULT_STATUS.INCORRECT) {
    return 'Respuesta incorrecta';
  }

  return 'Tiempo agotado';
});

const message = computed(() => {
  if (props.dice?.rolled && props.dice.value) {
    return 'El servidor confirmo tu movimiento.';
  }

  if (props.dice?.eligible) {
    return 'Ahora puedes lanzar tu dado.';
  }

  return 'No puedes lanzar el dado esta ronda.';
});

const statusIcon = computed(() => {
  if (!props.result || props.result.status === PLAYER_RESULT_STATUS.TIMEOUT) {
    return Hourglass;
  }

  return props.result.correct ? CheckCircle2 : XCircle;
});

const statusClass = computed(() => {
  if (props.result?.status === PLAYER_RESULT_STATUS.CORRECT) {
    return 'border-emerald-200/50 bg-emerald-300 text-zinc-950';
  }

  if (props.result?.status === PLAYER_RESULT_STATUS.INCORRECT) {
    return 'border-rose-200/50 bg-rose-400 text-white';
  }

  return 'border-amber-200/50 bg-amber-200 text-zinc-950';
});

const advancedPositions = computed(() => {
  if (!props.move) {
    return 0;
  }

  return props.move.toPosition - props.move.fromPosition;
});
</script>

<template>
  <section class="grid gap-5">
    <div class="rounded-lg border p-5 shadow-2xl" :class="statusClass">
      <component :is="statusIcon" class="h-12 w-12" aria-hidden="true" />
      <h1 class="mt-4 text-4xl font-black uppercase leading-none">{{ title }}</h1>
      <p class="mt-3 text-lg font-bold">{{ message }}</p>
    </div>

    <div
      class="grid justify-items-center rounded-lg border border-white/15 bg-black/25 p-6 text-center shadow-2xl backdrop-blur"
    >
      <DiceFace :value="value" :rolling="rolling" />
      <p v-if="dice?.rolled && dice.value" class="mt-5 font-mono text-7xl font-black text-white">
        {{ dice.value }}
      </p>
      <div
        v-if="move"
        class="mt-5 w-full rounded-lg border border-emerald-200/30 bg-emerald-300/15 p-4 text-white"
      >
        <p class="text-base font-black">Avanzaste {{ advancedPositions }} casillas.</p>
        <p class="mt-2 text-sm font-bold uppercase text-white/60">Nueva posicion</p>
        <p class="font-mono text-5xl font-black text-emerald-200">{{ move.toPosition }}</p>
      </div>
      <button
        v-if="dice?.eligible"
        class="mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-lg bg-emerald-300 px-5 text-lg font-black uppercase text-zinc-950 shadow-glow transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        type="button"
        :disabled="!canRoll"
        @click="emit('roll')"
      >
        {{ rolling ? 'Lanzando...' : dice.rolled ? 'Dado lanzado' : 'Lanzar dado' }}
      </button>
      <p class="mt-4 text-base font-black text-white/75">Esperando a los demas...</p>
    </div>
  </section>
</template>
