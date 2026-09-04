<script setup lang="ts">
import { computed } from 'vue';
import { ArrowRight, CheckCircle2, Dices, XCircle } from '@lucide/vue';

import {
  PLAYER_RESULT_STATUS,
  type DicePlayerState,
  type GameRoom,
} from '@embedded-snakes-live/shared';

const props = defineProps<{
  room: GameRoom;
  isAdvancing?: boolean | undefined;
  nextButtonLabel?: string | undefined;
}>();

const emit = defineEmits<{
  next: [];
}>();

const dicePlayers = computed(() => props.room.dicePlayers ?? []);
const summary = computed(() => props.room.diceSummary);
const eligiblePlayers = computed(() => dicePlayers.value.filter((player) => player.eligible));
const ineligiblePlayers = computed(() => dicePlayers.value.filter((player) => !player.eligible));
const hasEligiblePlayers = computed(() => (summary.value?.eligibleCount ?? 0) > 0);

function statusText(player: DicePlayerState): string {
  if (player.eligible && player.rolled && player.value) {
    return `Dado ${player.value}`;
  }

  if (player.eligible) {
    return 'Esperando';
  }

  if (player.resultStatus === PLAYER_RESULT_STATUS.TIMEOUT) {
    return 'Tiempo agotado';
  }

  return 'Sin derecho';
}
</script>

<template>
  <section class="grid gap-5">
    <header class="rounded-lg border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p class="text-sm font-black uppercase tracking-[0.25em] text-emerald-200">Dados</p>
          <h2 class="mt-3 text-4xl font-black leading-tight sm:text-6xl">
            {{ summary?.complete ? 'Dados completados' : 'Lanzamientos activos' }}
          </h2>
        </div>
        <div class="rounded-lg bg-emerald-300 p-4 text-zinc-950">
          <Dices class="h-8 w-8" aria-hidden="true" />
          <p class="mt-2 text-sm font-black uppercase tracking-wide">Han lanzado</p>
          <p class="font-mono text-4xl font-black">
            {{ summary?.rolledCount ?? 0 }}
            <span class="text-xl">/ {{ summary?.eligibleCount ?? 0 }}</span>
          </p>
        </div>
      </div>
    </header>

    <section
      v-if="summary?.complete"
      class="rounded-lg border border-emerald-200/40 bg-emerald-300 p-5 text-zinc-950 shadow-glow"
    >
      <CheckCircle2 class="h-11 w-11" aria-hidden="true" />
      <h3 class="mt-3 text-3xl font-black">
        {{ hasEligiblePlayers ? 'Todos los dados fueron lanzados' : 'Nadie obtuvo derecho a lanzar' }}
      </h3>
      <p class="mt-2 text-base font-bold">
        {{ hasEligiblePlayers ? 'Puedes avanzar cuando estes listo.' : 'Puedes pasar a la siguiente pregunta.' }}
      </p>
      <button
        class="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-zinc-950 px-6 text-base font-black uppercase text-white transition hover:-translate-y-0.5 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
        type="button"
        :disabled="isAdvancing"
        @click="emit('next')"
      >
        {{ isAdvancing ? 'Preparando...' : (nextButtonLabel ?? 'Siguiente pregunta') }}
        <ArrowRight class="h-5 w-5" aria-hidden="true" />
      </button>
    </section>

    <section class="grid gap-3">
      <article
        v-for="player in eligiblePlayers"
        :key="player.playerId"
        class="grid min-h-20 grid-cols-[1fr_auto] items-center gap-4 rounded-lg border border-white/10 bg-white/10 px-4 py-3"
      >
        <div class="min-w-0">
          <p class="truncate text-xl font-black text-white">{{ player.playerName }}</p>
          <p class="text-sm font-bold text-emerald-100">
            {{ player.connected ? statusText(player) : `${statusText(player)} - desconectado` }}
          </p>
        </div>
        <div
          class="flex h-14 w-14 items-center justify-center rounded-lg text-3xl font-black"
          :class="player.rolled ? 'bg-emerald-300 text-zinc-950' : 'bg-white/10 text-white'"
        >
          {{ player.value ?? '...' }}
        </div>
      </article>
    </section>

    <section v-if="ineligiblePlayers.length > 0" class="rounded-lg border border-white/10 bg-black/20 p-5">
      <div class="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white/55">
        <XCircle class="h-4 w-4" aria-hidden="true" />
        Sin lanzamiento
      </div>
      <ul class="grid gap-2 sm:grid-cols-2">
        <li
          v-for="player in ineligiblePlayers"
          :key="player.playerId"
          class="flex items-center justify-between gap-3 rounded-lg bg-white/10 px-3 py-2"
        >
          <span class="truncate font-black text-white">{{ player.playerName }}</span>
          <span class="shrink-0 text-sm font-bold text-white/60">{{ statusText(player) }}</span>
        </li>
      </ul>
    </section>
  </section>
</template>
