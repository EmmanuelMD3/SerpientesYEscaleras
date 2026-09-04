<script setup lang="ts">
import { ArrowRight, Gamepad2 } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import ConnectionBadge from '../components/ConnectionBadge.vue';
import PlayerQuestionView from '../components/PlayerQuestionView.vue';
import {
  ensureSocketConnected,
  getSocket,
  joinRoom,
  rejoinRoom,
  rollDice as rollDiceRequest,
  socketConnectionStatus,
  submitAnswer,
} from '../services/socket';

import {
  GAME_STATUS,
  SOCKET_EVENTS,
  type DicePhaseStartPayload,
  type DiceResultPayload,
  type GameRoom,
  type Player,
  type PlayerMovedPayload,
  type PlayerQuestionState,
  type QuestionResultsPayload,
  type QuestionStartedPayload,
  type RoomError,
} from '@embedded-snakes-live/shared';

interface PlayerSession {
  roomCode: string;
  name: string;
  sessionToken: string;
}

const route = useRoute();
const socket = getSocket();

const name = ref('');
const errorMessage = ref('');
const isJoining = ref(false);
const isRejoining = ref(false);
const isSubmittingAnswer = ref(false);
const isRollingDice = ref(false);
const player = ref<Player | null>(null);
const room = ref<GameRoom | null>(null);
const playerState = ref<PlayerQuestionState>({ hasSubmitted: false });
const socketStatus = socketConnectionStatus;

const roomCode = computed(() =>
  String(route.params.roomCode ?? '')
    .trim()
    .toUpperCase(),
);
const trimmedName = computed(() => name.value.trim());
const canSubmit = computed(
  () => trimmedName.value.length > 0 && trimmedName.value.length <= 25 && !isRejoining.value,
);
const playerSessionKey = computed(() => `embedded-snakes-live:player-session:${roomCode.value}`);

function parsePlayerSession(value: string | null): PlayerSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (
      typeof record.roomCode !== 'string' ||
      typeof record.name !== 'string' ||
      typeof record.sessionToken !== 'string'
    ) {
      return null;
    }

    return {
      roomCode: record.roomCode,
      name: record.name,
      sessionToken: record.sessionToken,
    };
  } catch {
    return null;
  }
}

function savePlayerSession(session: PlayerSession): void {
  window.localStorage.setItem(playerSessionKey.value, JSON.stringify(session));
}

function clearPlayerSession(): void {
  window.localStorage.removeItem(playerSessionKey.value);
}

async function attemptPlayerRejoin(): Promise<void> {
  if (player.value || isRejoining.value) {
    return;
  }

  const session = parsePlayerSession(window.localStorage.getItem(playerSessionKey.value));

  if (!session || session.roomCode !== roomCode.value) {
    return;
  }

  isRejoining.value = true;

  try {
    await ensureSocketConnected(socket);
    const response = await rejoinRoom(socket, {
      roomCode: session.roomCode,
      sessionToken: session.sessionToken,
    });

    if (!response.ok) {
      clearPlayerSession();
      return;
    }

    player.value = response.data.player;
    room.value = response.data.room;
    playerState.value = response.data.playerState;
    name.value = response.data.player.name;
    savePlayerSession({
      roomCode: response.data.room.code,
      name: response.data.player.name,
      sessionToken: response.data.sessionToken,
    });
  } catch {
    return;
  } finally {
    isRejoining.value = false;
  }
}

async function handleJoinRoom(): Promise<void> {
  errorMessage.value = '';

  if (!trimmedName.value) {
    errorMessage.value = 'Escribe tu nombre para entrar a la partida.';
    return;
  }

  if (trimmedName.value.length > 25) {
    errorMessage.value = 'Tu nombre puede tener maximo 25 caracteres.';
    return;
  }

  isJoining.value = true;

  try {
    await ensureSocketConnected(socket);
    const response = await joinRoom(socket, {
      roomCode: roomCode.value,
      name: trimmedName.value,
    });

    if (!response.ok) {
      errorMessage.value = response.error.message;
      return;
    }

    player.value = response.data.player;
    room.value = response.data.room;
    playerState.value = response.data.playerState;
    name.value = response.data.player.name;
    savePlayerSession({
      roomCode: response.data.room.code,
      name: response.data.player.name,
      sessionToken: response.data.sessionToken,
    });
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'No pudimos conectar con el servidor.';
  } finally {
    isJoining.value = false;
  }
}

async function handleSubmitAnswer(optionId: string): Promise<void> {
  if (!room.value?.currentQuestion || playerState.value.hasSubmitted) {
    return;
  }

  errorMessage.value = '';
  isSubmittingAnswer.value = true;

  try {
    await ensureSocketConnected(socket);
    const response = await submitAnswer(socket, {
      roomCode: room.value.code,
      questionId: room.value.currentQuestion.id,
      selectedOptionId: optionId,
    });

    if (!response.ok) {
      errorMessage.value = response.error.message;
      return;
    }

    playerState.value = response.data.playerState;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'No pudimos registrar tu respuesta.';
  } finally {
    isSubmittingAnswer.value = false;
  }
}

async function handleRollDice(): Promise<void> {
  if (!room.value || isRollingDice.value || playerState.value.dice?.rolled) {
    return;
  }

  errorMessage.value = '';
  isRollingDice.value = true;
  const startedAt = performance.now();

  try {
    await ensureSocketConnected(socket);
    const response = await rollDiceRequest(socket, {
      roomCode: room.value.code,
    });
    const elapsedMs = performance.now() - startedAt;

    if (elapsedMs < 900) {
      await new Promise((resolve) => {
        window.setTimeout(resolve, 900 - elapsedMs);
      });
    }

    if (!response.ok) {
      errorMessage.value = response.error.message;
      return;
    }

    room.value = response.data.room;
    playerState.value = response.data.playerState;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No pudimos lanzar tu dado.';
  } finally {
    isRollingDice.value = false;
  }
}

function handleRoomState(nextRoom: GameRoom): void {
  if (nextRoom.code !== roomCode.value) {
    return;
  }

  room.value = nextRoom;
  const currentPlayer = nextRoom.players.find((candidate) => candidate.id === player.value?.id);

  if (currentPlayer) {
    player.value = currentPlayer;
  }

  syncDiceStateFromRoom(nextRoom);

  if (nextRoom.status === GAME_STATUS.COUNTDOWN) {
    playerState.value = { hasSubmitted: false };
  }

  if (
    nextRoom.status === GAME_STATUS.QUESTION_ACTIVE &&
    nextRoom.currentQuestion &&
    playerState.value.questionId !== nextRoom.currentQuestion.id
  ) {
    playerState.value = {
      questionId: nextRoom.currentQuestion.id,
      hasSubmitted: false,
    };
  }
}

function syncDiceStateFromRoom(nextRoom: GameRoom): void {
  const currentPlayerId = player.value?.id;

  if (!currentPlayerId) {
    return;
  }

  const dicePlayer = nextRoom.dicePlayers?.find(
    (candidate) => candidate.playerId === currentPlayerId,
  );

  if (!dicePlayer) {
    return;
  }

  playerState.value = {
    ...playerState.value,
    dice: {
      eligible: dicePlayer.eligible,
      rolled: dicePlayer.rolled,
      value: dicePlayer.value,
    },
  };
}

function handleQuestionStarted(payload: QuestionStartedPayload): void {
  if (payload.roomCode !== roomCode.value || !room.value) {
    return;
  }

  room.value = {
    ...room.value,
    status: GAME_STATUS.QUESTION_ACTIVE,
    currentQuestion: payload.question,
    answerSummary: payload.answerSummary,
  };
  playerState.value = {
    questionId: payload.question.id,
    hasSubmitted: false,
  };
}

function handleQuestionResults(payload: QuestionResultsPayload): void {
  if (payload.roomCode !== roomCode.value || !room.value) {
    return;
  }

  room.value = {
    ...room.value,
    status: GAME_STATUS.QUESTION_RESULTS,
    questionResults: payload.results,
  };

  if (payload.playerResult) {
    const nextPlayerState: PlayerQuestionState = {
      ...playerState.value,
      questionId: payload.playerResult.questionId,
      hasSubmitted: Boolean(payload.playerResult.selectedOptionId),
      result: payload.playerResult,
    };

    if (payload.playerResult.selectedOptionId) {
      nextPlayerState.selectedOptionId = payload.playerResult.selectedOptionId;
    }

    if (payload.playerResult.answeredAt) {
      nextPlayerState.answeredAt = payload.playerResult.answeredAt;
    }

    if (payload.playerResult.responseTimeMs !== undefined) {
      nextPlayerState.responseTimeMs = payload.playerResult.responseTimeMs;
    }

    playerState.value = nextPlayerState;
  }
}

function handleDicePhaseStart(payload: DicePhaseStartPayload): void {
  if (payload.roomCode !== roomCode.value) {
    return;
  }

  room.value = payload.room;
  syncDiceStateFromRoom(payload.room);
}

function handleDiceResult(payload: DiceResultPayload): void {
  if (payload.roomCode !== roomCode.value || payload.playerId !== player.value?.id) {
    return;
  }

  playerState.value = {
    ...playerState.value,
    dice: payload.diceState,
    move: payload.move,
  };
}

function handlePlayerMoved(payload: PlayerMovedPayload): void {
  if (payload.roomCode !== roomCode.value || !room.value) {
    return;
  }

  room.value = {
    ...room.value,
    boardState: payload.board,
    players: room.value.players.map((candidate) =>
      candidate.id === payload.move.playerId
        ? { ...candidate, position: payload.move.toPosition }
        : candidate,
    ),
  };

  if (payload.move.playerId === player.value?.id) {
    player.value = {
      ...player.value,
      position: payload.move.toPosition,
    };
    playerState.value = {
      ...playerState.value,
      move: payload.move,
    };
  }
}

function handlePlayerState(nextState: PlayerQuestionState): void {
  playerState.value = nextState;
}

function handleRoomError(error: RoomError): void {
  errorMessage.value = error.message;
}

function handleSocketReconnect(): void {
  void attemptPlayerRejoin();
}

onMounted(() => {
  socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
  socket.on(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
  socket.on(SOCKET_EVENTS.PLAYER_STATE, handlePlayerState);
  socket.on(SOCKET_EVENTS.QUESTION_STARTED, handleQuestionStarted);
  socket.on(SOCKET_EVENTS.QUESTION_RESULTS, handleQuestionResults);
  socket.on(SOCKET_EVENTS.ANSWER_REJECTED, handleRoomError);
  socket.on(SOCKET_EVENTS.DICE_PHASE_START, handleDicePhaseStart);
  socket.on(SOCKET_EVENTS.DICE_RESULT, handleDiceResult);
  socket.on(SOCKET_EVENTS.DICE_ERROR, handleRoomError);
  socket.on(SOCKET_EVENTS.PLAYER_MOVED, handlePlayerMoved);
  socket.on('connect', handleSocketReconnect);
  void attemptPlayerRejoin();
});

onBeforeUnmount(() => {
  socket.off(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
  socket.off(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
  socket.off(SOCKET_EVENTS.PLAYER_STATE, handlePlayerState);
  socket.off(SOCKET_EVENTS.QUESTION_STARTED, handleQuestionStarted);
  socket.off(SOCKET_EVENTS.QUESTION_RESULTS, handleQuestionResults);
  socket.off(SOCKET_EVENTS.ANSWER_REJECTED, handleRoomError);
  socket.off(SOCKET_EVENTS.DICE_PHASE_START, handleDicePhaseStart);
  socket.off(SOCKET_EVENTS.DICE_RESULT, handleDiceResult);
  socket.off(SOCKET_EVENTS.DICE_ERROR, handleRoomError);
  socket.off(SOCKET_EVENTS.PLAYER_MOVED, handlePlayerMoved);
  socket.off('connect', handleSocketReconnect);
});
</script>

<template>
  <main class="min-h-screen bg-game px-4 py-6 text-white">
    <section class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center">
      <div
        class="w-full rounded-lg border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur sm:p-7"
      >
        <div class="mb-7 flex items-center justify-between gap-4">
          <div
            class="flex h-14 w-14 items-center justify-center rounded-lg bg-emerald-300 text-zinc-950 shadow-glow"
            aria-hidden="true"
          >
            <Gamepad2 class="h-8 w-8" />
          </div>
          <ConnectionBadge
            :status="socketStatus"
            connected-text="Conectado"
            connecting-text="Conectando"
            disconnected-text="Sin conexion"
          />
        </div>

        <template v-if="!player">
          <p class="text-sm font-black uppercase tracking-[0.25em] text-emerald-200">
            Embedded Snakes Live
          </p>
          <h1 class="mt-3 text-4xl font-black leading-tight">Entra a la partida</h1>

          <div class="mt-6 rounded-lg bg-emerald-200 px-4 py-4 text-zinc-950">
            <p class="text-xs font-black uppercase tracking-wide">Codigo</p>
            <p class="mt-1 font-mono text-4xl font-black tracking-[0.16em]">{{ roomCode }}</p>
          </div>

          <form class="mt-7 space-y-5" @submit.prevent="handleJoinRoom">
            <label class="block">
              <span class="text-base font-black">Escribe tu nombre:</span>
              <input
                v-model="name"
                class="mt-3 min-h-14 w-full rounded-lg border border-white/15 bg-white px-4 text-lg font-bold text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-emerald-200 focus:ring-4 focus:ring-emerald-200/30"
                maxlength="25"
                autocomplete="name"
                placeholder="Emmanuel"
                type="text"
              />
            </label>

            <p
              v-if="errorMessage"
              class="rounded-lg border border-rose-300/50 bg-rose-500/15 px-4 py-3 font-semibold text-rose-100"
              role="alert"
            >
              {{ errorMessage }}
            </p>

            <button
              class="inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-emerald-300 px-5 text-base font-black uppercase text-zinc-950 shadow-glow transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              :disabled="isJoining || !canSubmit"
            >
              {{
                isJoining ? 'Entrando...' : isRejoining ? 'Recuperando...' : 'Entrar a la partida'
              }}
              <ArrowRight class="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </template>

        <template v-else>
          <div class="mb-5 rounded-lg bg-emerald-300 p-4 text-zinc-950">
            <p class="text-sm font-black uppercase tracking-wide">Jugador</p>
            <h1 class="mt-1 text-3xl font-black">Hola, {{ player.name }}</h1>
          </div>

          <PlayerQuestionView
            v-if="room"
            :room="room"
            :player-state="playerState"
            :is-submitting="isSubmittingAnswer"
            :is-rolling-dice="isRollingDice"
            @answer="handleSubmitAnswer"
            @roll-dice="handleRollDice"
          />

          <p
            v-if="errorMessage"
            class="mt-5 rounded-lg border border-rose-300/50 bg-rose-500/15 px-4 py-3 font-semibold text-rose-100"
            role="alert"
          >
            {{ errorMessage }}
          </p>
        </template>
      </div>
    </section>
  </main>
</template>
