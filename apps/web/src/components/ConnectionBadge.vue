<script setup lang="ts">
import { computed } from 'vue';
import { LoaderCircle, Wifi, WifiOff } from '@lucide/vue';

import type { SocketConnectionStatus } from '../services/socket';

const props = defineProps<{
  status: SocketConnectionStatus;
  connectedText?: string;
  connectingText?: string;
  disconnectedText?: string;
}>();

const label = computed(() => {
  if (props.status === 'CONNECTED') {
    return props.connectedText ?? 'Conectado';
  }

  if (props.status === 'CONNECTING') {
    return props.connectingText ?? 'Conectando';
  }

  return props.disconnectedText ?? 'Sin conexion';
});

const badgeClass = computed(() => {
  if (props.status === 'CONNECTED') {
    return 'border-emerald-300/60 bg-emerald-400/15 text-emerald-100';
  }

  if (props.status === 'CONNECTING') {
    return 'border-amber-300/60 bg-amber-400/15 text-amber-100';
  }

  return 'border-rose-300/60 bg-rose-400/15 text-rose-100';
});
</script>

<template>
  <span
    class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold"
    :class="badgeClass"
  >
    <Wifi v-if="status === 'CONNECTED'" class="h-4 w-4" aria-hidden="true" />
    <LoaderCircle
      v-else-if="status === 'CONNECTING'"
      class="h-4 w-4 animate-spin"
      aria-hidden="true"
    />
    <WifiOff v-else class="h-4 w-4" aria-hidden="true" />
    {{ label }}
  </span>
</template>
