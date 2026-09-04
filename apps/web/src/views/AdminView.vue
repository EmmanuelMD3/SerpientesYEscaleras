<script setup lang="ts">
import { Clipboard, Gamepad2, Link as LinkIcon, QrCode, Sparkles, Users } from '@lucide/vue';
import QRCode from 'qrcode';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import ConnectionBadge from '../components/ConnectionBadge.vue';
import PlayerList from '../components/PlayerList.vue';
import {
  createRoom,
  ensureSocketConnected,
  getSocket,
  socketConnectionStatus,
} from '../services/socket';

import { SOCKET_EVENTS, type GameRoom, type RoomError } from '@embedded-snakes-live/shared';

const socket = getSocket();
const room = ref<GameRoom | null>(null);
const errorMessage = ref('');
const copyMessage = ref('');
const isCreating = ref(false);
const qrDataUrl = ref('');
const socketStatus = socketConnectionStatus;

const playerCount = computed(() => room.value?.players.length ?? 0);
const connectedPlayerCount = computed(
  () => room.value?.players.filter((player) => player.connected).length ?? 0,
);
const joinUrl = computed(() => {
  if (!room.value) {
    return '';
  }

  return `${window.location.origin}/play/${room.value.code}`;
});

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
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'No pudimos conectar con el servidor.';
  } finally {
    isCreating.value = false;
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

onMounted(() => {
  socket.on(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
  socket.on(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
});

onBeforeUnmount(() => {
  socket.off(SOCKET_EVENTS.ROOM_STATE, handleRoomState);
  socket.off(SOCKET_EVENTS.ROOM_ERROR, handleRoomError);
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
            Lobby fase 1
          </div>
          <div>
            <p class="mb-3 text-lg font-black uppercase tracking-[0.25em] text-emerald-200">
              Software Embebido
            </p>
            <h1 class="max-w-4xl text-5xl font-black leading-none sm:text-7xl lg:text-8xl">
              Embedded Snakes Live
            </h1>
            <p class="mt-5 max-w-2xl text-xl font-semibold leading-8 text-white/72">
              Crea una sala, comparte el codigo en Teams y deja que todos entren desde su celular.
            </p>
          </div>
          <div class="flex flex-col gap-3 sm:flex-row">
            <button
              class="inline-flex min-h-16 items-center justify-center gap-3 rounded-lg bg-emerald-300 px-7 text-lg font-black uppercase text-zinc-950 shadow-glow transition hover:-translate-y-0.5 hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
              type="button"
              :disabled="isCreating"
              @click="handleCreateRoom"
            >
              <Gamepad2 class="h-6 w-6" aria-hidden="true" />
              {{ isCreating ? 'Creando...' : 'Crear partida' }}
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
              <p class="text-sm font-black uppercase tracking-wide">Sin cuentas</p>
              <p class="mt-2 text-2xl font-black">Solo nombre y codigo de sala.</p>
            </div>
            <div class="rounded-lg bg-fuchsia-300 p-5 text-zinc-950">
              <p class="text-sm font-black uppercase tracking-wide">Tiempo real</p>
              <p class="mt-2 text-2xl font-black">Socket.IO mantiene el lobby vivo.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>

    <section v-else class="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl gap-6 xl:grid-cols-[1fr_420px]">
      <div class="flex flex-col gap-6">
        <header class="rounded-lg border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur sm:p-7">
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
          <article class="rounded-lg border border-emerald-200/30 bg-emerald-200 p-6 text-zinc-950 shadow-glow">
            <div class="flex items-center justify-between gap-4">
              <p class="text-sm font-black uppercase tracking-[0.25em]">Codigo de sala</p>
              <QrCode class="h-9 w-9" aria-hidden="true" />
            </div>
            <p class="mt-5 break-all text-center font-mono text-6xl font-black tracking-[0.18em] sm:text-8xl">
              {{ room.code }}
            </p>
          </article>

          <article class="rounded-lg border border-white/15 bg-black/25 p-6 shadow-2xl backdrop-blur">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-black uppercase tracking-wide text-white/50">Jugadores conectados</p>
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
              <div class="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white/60">
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
        <section class="rounded-lg border border-white/15 bg-black/25 p-5 text-center shadow-2xl backdrop-blur">
          <p class="text-sm font-black uppercase tracking-wide text-white/50">QR para celulares</p>
          <div class="mt-4 inline-flex rounded-lg bg-white p-3">
            <img v-if="qrDataUrl" class="h-52 w-52" :src="qrDataUrl" alt="Codigo QR de entrada" />
          </div>
        </section>

        <PlayerList :players="room.players" />
      </aside>
    </section>
  </main>
</template>
