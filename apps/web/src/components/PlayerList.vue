<script setup lang="ts">
import { Circle, UserRoundCheck } from '@lucide/vue';

import type { Player } from '@embedded-snakes-live/shared';

defineProps<{
  players: Player[];
}>();

function formatJoinTime(joinedAt: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(joinedAt));
}
</script>

<template>
  <section class="rounded-lg border border-white/15 bg-black/20 p-5 shadow-2xl backdrop-blur">
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-black text-white">Jugadores</h2>
        <p class="text-sm font-semibold text-white/60">Aparecen aqui en tiempo real</p>
      </div>
      <div
        class="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-300 text-zinc-950 shadow-glow"
        aria-hidden="true"
      >
        <UserRoundCheck class="h-7 w-7" />
      </div>
    </div>

    <div
      v-if="players.length === 0"
      class="rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-8 text-center"
    >
      <p class="text-lg font-black text-white">Aun no hay jugadores</p>
      <p class="mt-1 text-sm font-semibold text-white/60">Comparte el enlace o el QR para empezar.</p>
    </div>

    <ul v-else class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
      <li
        v-for="player in players"
        :key="player.id"
        class="flex min-h-20 items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/10 px-4 py-3"
      >
        <div class="min-w-0">
          <p class="truncate text-lg font-black text-white">{{ player.name }}</p>
          <p class="text-xs font-bold uppercase tracking-wide text-white/50">
            Entro {{ formatJoinTime(player.joinedAt) }}
          </p>
        </div>
        <span
          class="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase"
          :class="
            player.connected
              ? 'bg-emerald-300 text-zinc-950'
              : 'bg-zinc-800 text-zinc-300 ring-1 ring-white/10'
          "
        >
          <Circle
            class="h-2.5 w-2.5"
            :class="player.connected ? 'fill-zinc-950' : 'fill-zinc-500'"
            aria-hidden="true"
          />
          {{ player.connected ? 'Listo' : 'Desconectado' }}
        </span>
      </li>
    </ul>
  </section>
</template>
