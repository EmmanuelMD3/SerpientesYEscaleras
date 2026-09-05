<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { Flag, MapPinned } from '@lucide/vue';

import {
  BOARD_SPECIAL_TYPE,
  type BoardPlayer,
  type BoardSpecial,
  type BoardState,
  type PlayerMove,
} from '@embedded-snakes-live/shared';

import BoardCell from './BoardCell.vue';
import BoardSpecialOverlay from './BoardSpecialOverlay.vue';
import PlayerToken from './PlayerToken.vue';

const props = defineProps<{
  board: BoardState;
}>();

const stepDurationMs = 190;
const specialPauseMs = 300;
const specialMoveDurationMs = 780;
const displayPositions = reactive<Record<string, number>>({});
const moveQueue = ref<PlayerMove[]>([]);
const activeMove = ref<PlayerMove | null>(null);
const specialTransit = ref<{ move: PlayerMove; phase: 'from' | 'to' } | null>(null);
const specialNotice = ref<PlayerMove | null>(null);
const processingQueue = ref(false);
const processedMoves = new Set<string>();
let specialNoticeTimeout: number | undefined;

const rowCount = computed(() => Math.ceil(props.board.maxPosition / 10));
const boardGridStyle = computed(() => ({
  gridTemplateRows: `repeat(${rowCount.value}, minmax(82px, 1fr))`,
}));
const cells = computed(() => {
  const rows: number[][] = [];

  for (let row = 0; row < rowCount.value; row += 1) {
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

const activePlayerId = computed(
  () => activeMove.value?.playerId ?? specialTransit.value?.move.playerId,
);

const specialTransitPlayer = computed<BoardPlayer | null>(() => {
  const transit = specialTransit.value;

  if (!transit) {
    return null;
  }

  const player = props.board.players.find(
    (candidate) => candidate.playerId === transit.move.playerId,
  );

  if (!player) {
    return null;
  }

  return {
    ...player,
    position:
      transit.phase === 'from' ? transit.move.rollLandingPosition : transit.move.finalPosition,
  };
});

const specialTokenStyle = computed(() => {
  const player = specialTransitPlayer.value;

  if (!player) {
    return {};
  }

  const point = pointForPosition(player.position);

  return {
    left: `${(point.x / 10) * 100}%`,
    top: `${(point.y / rowCount.value) * 100}%`,
  };
});

const specialTokenClass = computed(() => {
  const type = specialTransit.value?.move.specialMove?.type;

  if (type === BOARD_SPECIAL_TYPE.LADDER) {
    return 'board-special-token--ladder';
  }

  if (type === BOARD_SPECIAL_TYPE.SNAKE) {
    return 'board-special-token--snake';
  }

  return '';
});

const activeMoveText = computed(() => {
  const move = activeMove.value;

  if (!move) {
    return `${props.board.players.length} fichas`;
  }

  if (move.specialMove) {
    return `${move.playerName}: ${move.fromPosition} → ${move.rollLandingPosition} → ${move.finalPosition}`;
  }

  return `${move.playerName}: ${move.fromPosition} → ${move.finalPosition}`;
});

function playersAt(position: number): BoardPlayer[] {
  const movingPlayerId = specialTransit.value?.move.playerId;

  return visiblePlayers.value.filter(
    (player) => player.position === position && player.playerId !== movingPlayerId,
  );
}

function isPlayerQueued(playerId: string): boolean {
  return (
    activeMove.value?.playerId === playerId ||
    specialTransit.value?.move.playerId === playerId ||
    moveQueue.value.some((move) => move.playerId === playerId)
  );
}

function pointForPosition(position: number): { x: number; y: number } {
  const rowFromBottom = Math.floor((position - 1) / 10);
  const column = rowFromBottom % 2 === 0 ? (position - 1) % 10 : 9 - ((position - 1) % 10);

  return {
    x: column + 0.5,
    y: rowCount.value - 1 - rowFromBottom + 0.5,
  };
}

function specialForPosition(position: number): BoardSpecial | undefined {
  return props.board.specials.find((special) => special.from === position);
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function showSpecialNotice(move: PlayerMove): void {
  if (!move.specialMove) {
    return;
  }

  specialNotice.value = move;

  if (specialNoticeTimeout) {
    window.clearTimeout(specialNoticeTimeout);
  }

  specialNoticeTimeout = window.setTimeout(() => {
    specialNotice.value = null;
  }, 2_400);
}

function specialName(special: BoardSpecial): string {
  return special.type === BOARD_SPECIAL_TYPE.LADDER ? 'ESCALERA' : 'SERPIENTE';
}

function specialIcon(special: BoardSpecial): string {
  return special.type === BOARD_SPECIAL_TYPE.LADDER ? '🪜' : '🐍';
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

    if (move.fromPosition === move.rollLandingPosition) {
      await wait(stepDurationMs);
    } else {
      for (
        let position = move.fromPosition + 1;
        position <= move.rollLandingPosition;
        position += 1
      ) {
        await wait(stepDurationMs);
        displayPositions[move.playerId] = position;
      }
    }

    displayPositions[move.playerId] = move.rollLandingPosition;

    if (move.specialMove) {
      showSpecialNotice(move);
      await wait(specialPauseMs);
      specialTransit.value = { move, phase: 'from' };
      await nextTick();
      await wait(40);
      specialTransit.value = { move, phase: 'to' };
      await wait(specialMoveDurationMs);
      specialTransit.value = null;
    }

    displayPositions[move.playerId] = move.finalPosition;
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

onBeforeUnmount(() => {
  if (specialNoticeTimeout) {
    window.clearTimeout(specialNoticeTimeout);
  }
});

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
        {{ activeMoveText }}
      </p>
    </header>

    <div
      v-if="specialNotice?.specialMove"
      class="board-special-toast"
      :class="
        specialNotice.specialMove.type === BOARD_SPECIAL_TYPE.LADDER
          ? 'board-special-toast--ladder'
          : 'board-special-toast--snake'
      "
      aria-live="polite"
    >
      <span class="text-3xl" aria-hidden="true">{{ specialIcon(specialNotice.specialMove) }}</span>
      <div>
        <p class="text-sm font-black uppercase tracking-wide">
          {{ specialName(specialNotice.specialMove) }}
        </p>
        <p class="text-lg font-black">
          {{ specialNotice.playerName }}: {{ specialNotice.specialMove.from }} →
          {{ specialNotice.specialMove.to }}
        </p>
      </div>
    </div>

    <div class="overflow-x-auto pb-2">
      <div class="board-stage">
        <div
          class="board-grid"
          role="grid"
          :aria-label="`Tablero de ${board.maxPosition} casillas`"
          :style="boardGridStyle"
        >
          <BoardSpecialOverlay :specials="board.specials" :max-position="board.maxPosition" />
          <BoardCell
            v-for="position in cells"
            :key="position"
            :position="position"
            :special="specialForPosition(position)"
            :players="playersAt(position)"
            :active-player-id="activePlayerId"
          />
        </div>
        <div
          v-if="specialTransitPlayer"
          class="board-special-token"
          :class="specialTokenClass"
          :style="specialTokenStyle"
        >
          <PlayerToken :player="specialTransitPlayer" active />
        </div>
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
