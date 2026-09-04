<script setup lang="ts">
import { ArrowRight, CheckCircle2, Gamepad2 } from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import ConnectionBadge from '../components/ConnectionBadge.vue';
import {
  ensureSocketConnected,
  getSocket,
  joinRoom,
  socketConnectionStatus,
} from '../services/socket';

import { SOCKET_EVENTS, type GameRoom, type Player, type RoomError } from '@embedded-snakes-live/shared';

const route = useRoute();
const socket = getSocket();

const name = ref('');
const errorMessage = ref('');
const isJoining = ref(false);
const player = ref<Player | null>(null);
const room = ref<GameRoom | null>(null);
const socketStatus = socketConnectionStatus;

const roomCode = computed(() => String(route.params.roomCode ?? '').trim().toUpperCase());
const trimmedName = computed(() => name.value.trim());
const canSubmit = computed(() => trimmedName.value.length > 0 && trimmedName.value.length <= 25);

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
    name.value = response.data.player.name;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'No pudimos conectar con el servidor.';
  } finally {
    isJoining.value = false;
  }
}

function handleRoomState(nextRoom: GameRoom): void {
  if (nextRoom.code === roomCode.value) {
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
</script>

<template>
  <main class="min-h-screen bg-game px-4 py-6 text-white">
    <section class="mx-auto flex min-h-[calc(100vh-3rem)] max-w-xl items-center">
      <div class="w-full rounded-lg border border-white/15 bg-black/25 p-5 shadow-2xl backdrop-blur sm:p-7">
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
              {{ isJoining ? 'Entrando...' : 'Entrar a la partida' }}
              <ArrowRight class="h-5 w-5" aria-hidden="true" />
            </button>
          </form>
        </template>

        <template v-else>
          <div class="rounded-lg bg-emerald-300 p-5 text-zinc-950">
            <CheckCircle2 class="h-12 w-12" aria-hidden="true" />
            <h1 class="mt-4 text-4xl font-black">Hola, {{ player.name }}</h1>
          </div>

          <div class="mt-6 space-y-4">
            <p class="text-2xl font-black">Ya estas dentro de la partida.</p>
            <p class="text-lg font-semibold text-white/70">Esperando a que el administrador inicie...</p>
            <div class="rounded-lg border border-white/10 bg-white/10 px-4 py-4">
              <p class="text-xs font-black uppercase tracking-wide text-white/50">Sala</p>
              <p class="mt-1 font-mono text-3xl font-black tracking-[0.16em]">{{ room?.code ?? roomCode }}</p>
            </div>
          </div>

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
