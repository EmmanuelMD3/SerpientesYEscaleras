<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Flag, MapPinned } from '@lucide/vue';

import type { BoardPlayer, BoardState, PlayerMove } from '@embedded-snakes-live/shared';

import BoardCell from './BoardCell.vue';
import PlayerToken from './PlayerToken.vue';

const props = defineProps<{
  board: BoardState;
}>();

const stepDurationMs = 190;
const displayPositions = reactive<Record<string, number>>({});
const moveQueue = ref<PlayerMove[]>([]);
const activeMove = ref<PlayerMove | null>(null);
const processingQueue = ref(false);
const processedMoves = new Set<string>();

const cells = computed(() => {
  const rows: number[][] = [];

  for (let row = 0; row < props.board.maxPosition / 10; row += 1) {
    const rowStart = row * 10 + 1;
    const values = Array.from({ length: 10 }, (_, index) => rowStart + index);
    rows.push(row % 2 === 0 ? values : values.reverse());
  }

  return rows.reverse().flat();
});

const visiblePlayers = computed<BoardPlayer[]>(() =>
  props.board.players.map((player) => ({
    ...player,
    position: displayPositions[player.playerId] ?? player.position,
  })),
);

const startPlayers = computed(() => visiblePlayers.value.filter((player) => player.position === 0));

const activePlayerId = computed(() => activeMove.value?.playerId);

function playersAt(position: number): BoardPlayer[] {
  return visiblePlayers.value.filter((player) => player.position === position);
}

function isPlayerQueued(playerId: string): boolean {
  return (
    activeMove.value?.playerId === playerId ||
    moveQueue.value.some((move) => move.playerId === playerId)
  );
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

async function processMoveQueue(): Promise<void> {
  if (processingQueue.value) {
    return;
  }

  processingQueue.value = true;

  while (moveQueue.value.length > 0) {
    const move = moveQueue.value.shift();

    if (!move) {
      continue;
    }

    activeMove.value = move;
    displayPositions[move.playerId] = move.fromPosition;

    if (move.fromPosition === move.toPosition) {
      await wait(stepDurationMs);
    } else {
      for (let position = move.fromPosition + 1; position <= move.toPosition; position += 1) {
        await wait(stepDurationMs);
        displayPositions[move.playerId] = position;
      }
    }

    displayPositions[move.playerId] = move.toPosition;
    activeMove.value = null;
  }

  processingQueue.value = false;
}

function enqueueMove(move: PlayerMove): void {
  const moveKey = `${move.questionId}:${move.playerId}`;

  if (processedMoves.has(moveKey)) {
    return;
  }

  processedMoves.add(moveKey);
  displayPositions[move.playerId] ??= move.fromPosition;
  moveQueue.value.push(move);
  void processMoveQueue();
}

watch(
  () => props.board,
  (board) => {
    const playerIds = new Set(board.players.map((player) => player.playerId));

    for (const player of board.players) {
      if (!isPlayerQueued(player.playerId)) {
        displayPositions[player.playerId] = player.position;
      }
    }

    for (const playerId of Object.keys(displayPositions)) {
      if (!playerIds.has(playerId)) {
        delete displayPositions[playerId];
      }
    }
  },
  { deep: true, immediate: true },
);

defineExpose({ enqueueMove });
</script>

<template>
  <section
    class="rounded-lg border border-white/15 bg-black/30 p-4 shadow-2xl backdrop-blur sm:p-5"
  >
    <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span
          class="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-300 text-zinc-950 shadow-glow"
        >
          <MapPinned class="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p class="text-sm font-black uppercase text-emerald-200">Tablero</p>
          <h2 class="text-2xl font-black text-white">Camino a la meta</h2>
        </div>
      </div>

      <p
        class="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-black text-white/75"
        aria-live="polite"
      >
        <template v-if="activeMove">
          {{ activeMove.playerName }}: {{ activeMove.fromPosition }} → {{ activeMove.toPosition }}
        </template>
        <template v-else>{{ board.players.length }} fichas</template>
      </p>
    </header>

    <div class="overflow-x-auto pb-2">
      <div class="board-grid" role="grid" aria-label="Tablero de 40 casillas">
        <BoardCell
          v-for="position in cells"
          :key="position"
          :position="position"
          :players="playersAt(position)"
          :active-player-id="activePlayerId"
        />
      </div>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
      <div class="flex items-center gap-2 text-sm font-black uppercase text-amber-100">
        <Flag class="h-5 w-5" aria-hidden="true" />
        Salida
      </div>
      <div
        class="min-h-14 rounded-lg border border-dashed border-amber-200/35 bg-amber-200/10 p-2.5"
      >
        <div v-if="startPlayers.length > 0" class="flex flex-wrap gap-2">
          <PlayerToken
            v-for="player in startPlayers"
            :key="player.playerId"
            :player="player"
            :active="player.playerId === activePlayerId"
          />
        </div>
        <p v-else class="px-2 py-1.5 text-sm font-bold text-white/45">
          Todas las fichas avanzaron.
        </p>
      </div>
    </div>
  </section>
</template>
