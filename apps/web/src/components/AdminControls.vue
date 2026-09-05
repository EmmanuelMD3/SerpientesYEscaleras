<script setup lang="ts">
import { computed, ref } from 'vue';
import { OctagonX, PlusCircle, RotateCcw, SlidersHorizontal, X } from '@lucide/vue';

type AdminAction = 'reset' | 'end' | 'new';

const props = defineProps<{
  disabled?: boolean | undefined;
  isResetting?: boolean | undefined;
  isEnding?: boolean | undefined;
  isCreatingNew?: boolean | undefined;
}>();

const emit = defineEmits<{
  reset: [];
  end: [];
  newGame: [];
}>();

const controlsOpen = ref(false);
const pendingAction = ref<AdminAction | null>(null);

const actionCopy = {
  reset: {
    title: 'Reiniciar partida',
    body: 'Conserva la sala y los jugadores, pero reinicia todo el progreso.',
  },
  end: {
    title: 'Terminar partida',
    body: 'Finaliza inmediatamente la partida actual.',
  },
  new: {
    title: 'Nueva partida',
    body: 'Finaliza la sala actual y crea una nueva con otro codigo.',
  },
} as const;

const confirmationCopy = {
  reset: {
    ...actionCopy.reset,
    body: 'Se conserva la sala y los jugadores, pero se limpian posiciones, preguntas, dados e historial.',
    confirm: 'Reiniciar',
  },
  end: {
    ...actionCopy.end,
    body: 'La sala quedara finalizada sin ganador y los jugadores conservaran su posicion final.',
    confirm: 'Terminar',
  },
  new: {
    ...actionCopy.new,
    body: 'La sala actual terminara y se creara un codigo nuevo con cero jugadores.',
    confirm: 'Crear nueva',
  },
} as const;

const controlActions = computed(() => [
  {
    action: 'reset' as const,
    icon: RotateCcw,
    tone: 'border-emerald-200/25 bg-emerald-300/10 text-emerald-100 hover:border-emerald-200/45 hover:bg-emerald-300/15',
    ...actionCopy.reset,
  },
  {
    action: 'end' as const,
    icon: OctagonX,
    tone: 'border-rose-200/25 bg-rose-300/10 text-rose-100 hover:border-rose-200/45 hover:bg-rose-300/15',
    ...actionCopy.end,
  },
  {
    action: 'new' as const,
    icon: PlusCircle,
    tone: 'border-amber-200/25 bg-amber-300/10 text-amber-100 hover:border-amber-200/45 hover:bg-amber-300/15',
    ...actionCopy.new,
  },
]);

const isBusy = computed(() => Boolean(props.isResetting || props.isEnding || props.isCreatingNew));
const controlsDisabled = computed(() => Boolean(props.disabled || isBusy.value));
const modalCopy = computed(() => (pendingAction.value ? confirmationCopy[pendingAction.value] : null));

function openControls(): void {
  if (controlsDisabled.value) {
    return;
  }

  controlsOpen.value = true;
}

function closeControls(): void {
  if (isBusy.value) {
    return;
  }

  controlsOpen.value = false;
}

function openConfirm(action: AdminAction): void {
  controlsOpen.value = false;
  pendingAction.value = action;
}

function closeConfirm(): void {
  if (isBusy.value) {
    return;
  }

  pendingAction.value = null;
}

function confirmAction(): void {
  if (!pendingAction.value || isBusy.value) {
    return;
  }

  const action = pendingAction.value;
  pendingAction.value = null;

  if (action === 'reset') {
    emit('reset');
    return;
  }

  if (action === 'end') {
    emit('end');
    return;
  }

  emit('newGame');
}
</script>

<template>
  <div class="relative">
    <button
      class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-black uppercase text-white/80 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
      type="button"
      :disabled="controlsDisabled"
      @click="openControls"
    >
      <SlidersHorizontal class="h-4 w-4" aria-hidden="true" />
      Controles
    </button>

    <Teleport to="body">
      <div
        v-if="controlsOpen"
        class="fixed inset-0 z-[80] overflow-y-auto bg-black/75 px-4 py-6 text-white backdrop-blur-sm sm:py-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-controls-title"
        data-admin-controls-modal="true"
      >
        <div class="mx-auto flex min-h-full w-full max-w-4xl items-center justify-center">
          <section class="w-full rounded-lg border border-white/15 bg-zinc-950 p-5 shadow-2xl sm:p-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-sm font-black uppercase tracking-[0.22em] text-emerald-200">
                  Panel admin
                </p>
                <h2 id="admin-controls-title" class="mt-2 text-3xl font-black sm:text-4xl">
                  Controles
                </h2>
              </div>
              <button
                class="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/10 text-white/75 transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-50"
                type="button"
                :disabled="isBusy"
                aria-label="Cerrar"
                @click="closeControls"
              >
                <X class="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-3">
              <button
                v-for="action in controlActions"
                :key="action.action"
                class="flex min-h-36 flex-col items-start gap-3 rounded-lg border p-4 text-left transition disabled:cursor-wait disabled:opacity-50"
                :class="action.tone"
                type="button"
                :disabled="isBusy"
                @click="openConfirm(action.action)"
              >
                <span class="grid h-12 w-12 place-items-center rounded-lg border border-current/25 bg-black/20">
                  <component :is="action.icon" class="h-6 w-6" aria-hidden="true" />
                </span>
                <span class="text-lg font-black uppercase leading-tight">{{ action.title }}</span>
                <span class="text-sm font-semibold leading-6 text-white/72">{{ action.body }}</span>
              </button>
            </div>

            <div class="mt-5 flex justify-end">
              <button
                class="min-h-12 rounded-lg border border-white/15 bg-white/10 px-5 text-sm font-black uppercase text-white/75 transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-50"
                type="button"
                :disabled="isBusy"
                @click="closeControls"
              >
                Cerrar
              </button>
            </div>
          </section>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="modalCopy"
        class="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/80 px-4 py-8 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        data-admin-confirm-modal="true"
      >
        <section class="w-full max-w-md rounded-lg border border-white/15 bg-zinc-950 p-5 text-white shadow-2xl">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-black uppercase tracking-[0.22em] text-emerald-200">
                Confirmacion
              </p>
              <h2 class="mt-2 text-3xl font-black">{{ modalCopy.title }}</h2>
            </div>
            <button
              class="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/10 text-white/75 transition hover:bg-white/15"
              type="button"
              :disabled="isBusy"
              aria-label="Cerrar"
              @click="closeConfirm"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <p class="mt-4 text-base font-semibold leading-7 text-white/72">{{ modalCopy.body }}</p>

          <div class="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              class="min-h-12 rounded-lg border border-white/15 bg-white/10 px-4 font-black uppercase text-white/75 transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-50"
              type="button"
              :disabled="isBusy"
              @click="closeConfirm"
            >
              Cancelar
            </button>
            <button
              class="min-h-12 rounded-lg bg-emerald-300 px-4 font-black uppercase text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
              type="button"
              :disabled="isBusy"
              @click="confirmAction"
            >
              {{ isBusy ? 'Procesando...' : modalCopy.confirm }}
            </button>
          </div>
        </section>
      </div>
    </Teleport>
  </div>
</template>
