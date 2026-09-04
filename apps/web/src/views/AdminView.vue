<script setup lang="ts">
import {
  Clipboard,
  Gamepad2,
  Link as LinkIcon,
  PlayCircle,
  QrCode,
  Sparkles,
  Users,
} from '@lucide/vue';
import QRCode from 'qrcode';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import AdminQuestionView from '../components/AdminQuestionView.vue';
import ConnectionBadge from '../components/ConnectionBadge.vue';
import GameBoard from '../components/GameBoard.vue';
import PlayerList from '../components/PlayerList.vue';
import {
  createRoom,
  ensureSocketConnected,
  getSocket,
  nextQuestion,
  rejoinAdminRoom,
  socketConnectionStatus,
  startDicePhase,
  startGame,
} from '../services/socket';

import {
  GAME_STATUS,
  SOCKET_EVENTS,
  type BoardStatePayload,
  type GameRoom,
  type PlayerMovePayload,
  type RoomError,
} from '@embedded-snakes-live/shared';

const ADMIN_SESSION_KEY = 'embedded-snakes-live:admin-session';

interface AdminSession {
  roomCode: string;
  adminSessionToken: string;
}

const socket = getSocket();
const room = ref<GameRoom | null>(null);
const boardRef = ref<InstanceType<typeof GameBoard> | null>(null);
const errorMessage = ref('');
const copyMessage = ref('');
const isCreating = ref(false);
const isStarting = ref(false);
const isStartingDice = ref(false);
const isAdvancing = ref(false);
const isRejoining = ref(false);
const qrDataUrl = ref('');
const socketStatus = socketConnectionStatus;

const playerCount = computed(() => room.value?.players.length ?? 0);
const connectedPlayerCount = computed(
  () => room.value?.players.filter((player) => player.connected).length ?? 0,
);
const isLobby = computed(() => room.value?.status === GAME_STATUS.LOBBY);
const canStartGame = computed(
  () =>
    Boolean(room.value) &&
    isLobby.value &&
    connectedPlayerCount.value > 0 &&
    socketStatus.value === 'CONNECTED',
);
const joinUrl = computed(() => {
  if (!room.value) {
    return '';
  }

  return `${window.location.origin}/play/${room.value.code}`;
});

function parseAdminSession(value: string | null): AdminSession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (typeof record.roomCode !== 'string' || typeof record.adminSessionToken !== 'string') {
      return null;
    }

    return {
      roomCode: record.roomCode,
      adminSessionToken: record.adminSessionToken,
    };
  } catch {
    return null;
  }
}

function saveAdminSession(session: AdminSession): void {
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
}

function clearAdminSession(): void {
  window.localStorage.removeItem(ADMIN_SESSION_KEY);
}

async function attemptAdminRejoin(): Promise<void> {
  if (room.value || isRejoining.value) {
    return;
  }

  const session = parseAdminSession(window.localStorage.getItem(ADMIN_SESSION_KEY));

  if (!session) {
    return;
  }

  isRejoining.value = true;

  try {
    await ensureSocketConnected(socket);
    const response = await rejoinAdminRoom(socket, session);

    if (!response.ok) {
      clearAdminSession();
      return;
    }

    room.value = response.data.room;
    saveAdminSession({
      roomCode: response.data.room.code,
      adminSessionToken: response.data.adminSessionToken,
    });
  } catch {
    return;
  } finally {
    isRejoining.value = false;
  }
}

async function handleCreateRoom(): Promise<void> {
  errorMessage.value = '';
  copyMessage.value = '';
  isCreating.value = true;

  try {
    await ensureSocketConnected(socket);
    const response = await createRoom(socket);

    if (!response.ok) {
      errorMessage.value = response.error.message;
      return;
    }

    room.value = response.data.room;
    saveAdminSession({
      roomCode: response.data.room.code,
      adminSessionToken: response.data.adminSessionToken,
    });
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'No pudimos conectar con el servidor.';
  } finally {
    isCreating.value = false;
  }
}

async function handleStartGame(): Promise<void> {
  if (!room.value) {
    return;
  }

  errorMessage.value = '';
  isStarting.value = true;

  try {
    await ensureSocketConnected(socket);
    const response = await startGame(socket, { roomCode: room.value.code });

    if (!response.ok) {
      errorMessage.value = response.error.message;
      return;
    }

    room.value = response.data.room;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No pudimos iniciar la partida.';
  } finally {
    isStarting.value = false;
  }
}

async function handleNextQuestion(): Promise<void> {
  if (!room.value) {
    return;
  }

  errorMessage.value = '';
  isAdvancing.value = true;

  try {
    await ensureSocketConnected(socket);
    const response = await nextQuestion(socket, { roomCode: room.value.code });

    if (!response.ok) {
      errorMessage.value = response.error.message;
      return;
    }

    room.value = response.data.room;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'No pudimos preparar la siguiente pregunta.';
  } finally {
    isAdvancing.value = false;
  }
}

async function handleStartDicePhase(): Promise<void> {
  if (!room.value) {
    return;
  }

  errorMessage.value = '';
  isStartingDice.value = true;

  try {
    await ensureSocketConnected(socket);
    const response = await startDicePhase(socket, { roomCode: room.value.code });

    if (!response.ok) {
      errorMessage.value = response.error.message;
      return;
    }

    room.value = response.data.room;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'No pudimos habilitar los dados.';
  } finally {
    isStartingDice.value = false;
  }
}

async function copyJoinUrl(): Promise<void> {
  if (!joinUrl.value) {
    return;
  }

  await navigator.clipboard.writeText(joinUrl.value);
  copyMessage.value = 'Enlace copiado';
  window.setTimeout(() => {
    copyMessage.value = '';
  }, 2_000);
}

function handleRoomState(nextRoom: GameRoom): void {
  if (!room.value || room.value.code === nextRoom.code) {
    room.value = nextRoom;
  }
}

function handleRoomError(error: RoomError): void {
  errorMessage.value = error.message;
}

function handleBoardState(payload: BoardStatePayload): void {
  if (!room.value || payload.roomCode !== room.value.code) {
    return;
  }

  room.value = {
    ...room.value,
    boardState: payload.board,
  };
}

function handlePlayerMove(payload: PlayerMovePayload): void {
  if (!room.value || payload.roomCode !== room.value.code) {
    return;
  }

  boardRef.value?.enqueueMove(payload.move);
}

function handleSocketReconnect(): void {
  void attemptAdminRejoin();
}

onMounted(() => {
  socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
  socket.on(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
  socket.on(SOCKET_EVENTS.GAME_ERROR, handleRoomError);
  socket.on(SOCKET_EVENTS.DICE_ERROR, handleRoomError);
  socket.on(SOCKET_EVENTS.BOARD_STATE, handleBoardState);
  socket.on(SOCKET_EVENTS.PLAYER_MOVE, handlePlayerMove);
  socket.on('connect', handleSocketReconnect);
  void attemptAdminRejoin();
});

onBeforeUnmount(() => {
  socket.off(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
  socket.off(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
  socket.off(SOCKET_EVENTS.GAME_ERROR, handleRoomError);
  socket.off(SOCKET_EVENTS.DICE_ERROR, handleRoomError);
  socket.off(SOCKET_EVENTS.BOARD_STATE, handleBoardState);
  socket.off(SOCKET_EVENTS.PLAYER_MOVE, handlePlayerMove);
  socket.off('connect', handleSocketReconnect);
});

watch(joinUrl, async (nextUrl) => {
  if (!nextUrl) {
    qrDataUrl.value = '';
    return;
  }

  qrDataUrl.value = await QRCode.toDataURL(nextUrl, {
    width: 240,
    margin: 1,
    color: {
      dark: '#18181b',
      light: '#ffffff',
    },
  });
});
</script>

<template>
  <main class="min-h-screen overflow-hidden bg-game px-4 py-6 text-white sm:px-6 lg:px-10">
    <section v-if="!room" class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center">
      <div class="grid w-full items-center gap-8 lg:grid-cols-[1fr_0.75fr]">
        <div class="space-y-7">
          <div
            class="inline-flex items-center gap-2 rounded-full border border-amber-200/40 bg-amber-200/15 px-4 py-2 text-sm font-black uppercase tracking-wide text-amber-100"
          >
            <Sparkles class="h-4 w-4" aria-hidden="true" />
            Fase 4A
          </div>
          <div>
            <p class="mb-3 text-lg font-black uppercase tracking-[0.25em] text-emerald-200">
              Software Embebido
            </p>
            <h1 class="max-w-4xl text-5xl font-black leading-none sm:text-7xl lg:text-8xl">
              Embedded Snakes Live
            </h1>
            <p class="mt-5 max-w-2xl text-xl font-semibold leading-8 text-white/72">
              Crea una sala, comparte el codigo y lleva las fichas hasta la meta.
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              class="inline-flex min-h-16 items-center justify-center gap-3 rounded-lg bg-emerald-300 px-7 text-lg font-black uppercase text-zinc-950 shadow-glow transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
              type="button"
              :disabled="isCreating || isRejoining"
              @click="handleCreateRoom"
            >
              <Gamepad2 class="h-6 w-6" aria-hidden="true" />
              {{ isCreating ? 'Creando...' : isRejoining ? 'Recuperando...' : 'Crear partida' }}
            </button>
            <ConnectionBadge
              :status="socketStatus"
              connected-text="Servidor conectado"
              connecting-text="Conectando servidor"
              disconnected-text="Servidor desconectado"
            />
          </div>
          <p
            v-if="errorMessage"
            class="max-w-xl rounded-lg border border-rose-300/50 bg-rose-500/15 px-4 py-3 font-semibold text-rose-100"
            role="alert"
          >
            {{ errorMessage }}
          </p>
        </div>

        <aside class="rounded-lg border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur">
          <div class="grid gap-4">
            <div class="rounded-lg bg-white/10 p-5">
              <p class="text-sm font-black uppercase tracking-wide text-white/50">Flujo</p>
              <p class="mt-2 text-2xl font-black">Admin en PC, jugadores en celular.</p>
            </div>
            <div class="rounded-lg bg-emerald-300 p-5 text-zinc-950">
              <p class="text-sm font-black uppercase tracking-wide">Preguntas</p>
              <p class="mt-2 text-2xl font-black">Todos responden al mismo tiempo.</p>
            </div>
            <div class="rounded-lg bg-fuchsia-300 p-5 text-zinc-950">
              <p class="text-sm font-black uppercase tracking-wide">Servidor</p>
              <p class="mt-2 text-2xl font-black">El backend mide el tiempo y valida respuestas.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section
      v-else-if="isLobby"
      class="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 xl:grid-cols-[1fr_420px]"
    >
      <div class="flex flex-col gap-6">
        <header
          class="rounded-lg border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur sm:p-7"
        >
          <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p class="text-base font-black uppercase tracking-[0.25em] text-emerald-200">
                Embedded Snakes Live
              </p>
              <h1 class="mt-3 text-4xl font-black leading-tight sm:text-6xl">Lobby de partida</h1>
            </div>
            <ConnectionBadge
              :status="socketStatus"
              connected-text="Servidor conectado"
              connecting-text="Conectando servidor"
              disconnected-text="Servidor desconectado"
            />
          </div>
        </header>

        <section class="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <article
            class="rounded-lg border border-emerald-200/30 bg-emerald-200 p-6 text-zinc-950 shadow-glow"
          >
            <div class="flex items-center justify-between gap-4">
              <p class="text-sm font-black uppercase tracking-[0.25em]">Codigo de sala</p>
              <QrCode class="h-9 w-9" aria-hidden="true" />
            </div>
            <p
              class="mt-5 break-all text-center font-mono text-6xl font-black tracking-[0.18em] sm:text-8xl"
            >
              {{ room.code }}
            </p>
          </article>

          <article
            class="rounded-lg border border-white/15 bg-black/25 p-6 shadow-2xl backdrop-blur"
          >
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-black uppercase tracking-wide text-white/50">
                  Jugadores conectados
                </p>
                <p class="mt-2 text-6xl font-black">
                  {{ connectedPlayerCount }}
                  <span class="text-2xl text-white/45">/ {{ playerCount }}</span>
                </p>
              </div>
              <div class="rounded-lg bg-white p-3 text-zinc-950" aria-hidden="true">
                <Users class="h-10 w-10" />
              </div>
            </div>
            <div class="mt-6 rounded-lg border border-white/10 bg-white/10 p-4">
              <div
                class="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white/60"
              >
                <LinkIcon class="h-4 w-4" aria-hidden="true" />
                Enlace de entrada
              </div>
              <p class="break-all text-base font-bold text-white">{{ joinUrl }}</p>
              <button
                class="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-5 font-black uppercase text-zinc-950 transition hover:bg-amber-100"
                type="button"
                @click="copyJoinUrl"
              >
                <Clipboard class="h-5 w-5" aria-hidden="true" />
                {{ copyMessage || 'Copiar enlace' }}
              </button>
            </div>
            <button
              class="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-lg bg-emerald-300 px-5 text-base font-black uppercase text-zinc-950 shadow-glow transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-55"
              type="button"
              :disabled="!canStartGame || isStarting"
              @click="handleStartGame"
            >
              <PlayCircle class="h-6 w-6" aria-hidden="true" />
              {{ isStarting ? 'Iniciando...' : 'Iniciar partida' }}
            </button>
          </article>
        </section>

        <p
          v-if="errorMessage"
          class="rounded-lg border border-rose-300/50 bg-rose-500/15 px-4 py-3 font-semibold text-rose-100"
          role="alert"
        >
          {{ errorMessage }}
        </p>
      </div>

      <aside class="grid gap-6 xl:grid-rows-[auto_1fr]">
        <section
          class="rounded-lg border border-white/15 bg-black/25 p-5 text-center shadow-2xl backdrop-blur"
        >
          <p class="text-sm font-black uppercase tracking-wide text-white/50">QR para celulares</p>
          <div class="mt-4 inline-flex rounded-lg bg-white p-3">
            <img v-if="qrDataUrl" class="h-52 w-52" :src="qrDataUrl" alt="Codigo QR de entrada" />
          </div>
        </section>

        <PlayerList :players="room.players" />
      </aside>
    </section>

    <section v-else class="mx-auto min-h-[calc(100vh-3rem)] max-w-[1800px] space-y-5">
      <header
        class="rounded-lg border border-white/15 bg-black/25 p-4 shadow-2xl backdrop-blur sm:px-6 sm:py-5"
      >
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-sm font-black uppercase text-emerald-200">Embedded Snakes Live</p>
            <h1 class="mt-1 text-3xl font-black sm:text-4xl">Partida en vivo</h1>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <div class="rounded-lg bg-emerald-200 px-4 py-2 text-zinc-950">
              <span class="text-xs font-black uppercase">Sala</span>
              <span class="ml-3 font-mono text-2xl font-black">{{ room.code }}</span>
            </div>
            <ConnectionBadge
              :status="socketStatus"
              connected-text="Servidor conectado"
              connecting-text="Conectando servidor"
              disconnected-text="Servidor desconectado"
            />
          </div>
        </div>
      </header>

      <div class="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(420px,0.65fr)] xl:items-start">
        <GameBoard v-if="room.boardState" ref="boardRef" :board="room.boardState" />
        <AdminQuestionView
          :room="room"
          :is-advancing="isAdvancing"
          :is-starting-dice="isStartingDice"
          @next="handleNextQuestion"
          @start-dice="handleStartDicePhase"
        />
      </div>

      <p
        v-if="errorMessage"
        class="rounded-lg border border-rose-300/50 bg-rose-500/15 px-4 py-3 font-semibold text-rose-100"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <PlayerList :players="room.players" wide />
    </section>
  </main>
</template>
