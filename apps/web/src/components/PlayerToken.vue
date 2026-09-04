<script setup lang="ts">
import { computed } from 'vue';

import type { BoardPlayer } from '@embedded-snakes-live/shared';

const props = defineProps<{
  player: BoardPlayer;
  active?: boolean | undefined;
}>();

const tokenPalette = [
  { background: '#6ee7b7', color: '#18181b' },
  { background: '#fbbf24', color: '#18181b' },
  { background: '#f0abfc', color: '#18181b' },
  { background: '#67e8f9', color: '#18181b' },
  { background: '#fb7185', color: '#ffffff' },
  { background: '#a78bfa', color: '#ffffff' },
  { background: '#fdba74', color: '#18181b' },
  { background: '#bef264', color: '#18181b' },
] as const;

function hashPlayerId(playerId: string): number {
  let hash = 0;

  for (const character of playerId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function playerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return '?';
  }

  if (words.length === 1) {
    return words[0]!.slice(0, 2).toUpperCase();
  }

  return `${words[0]!.charAt(0)}${words[words.length - 1]!.charAt(0)}`.toUpperCase();
}

const initials = computed(() => playerInitials(props.player.name));
const palette = computed(
  () => tokenPalette[hashPlayerId(props.player.playerId) % tokenPalette.length]!,
);
const tooltip = computed(() => `${props.player.name}\nPosicion: ${props.player.position}`);
</script>

<template>
  <span
    class="player-token"
    :class="{ 'player-token--active': active, 'opacity-55 saturate-50': !player.connected }"
    :style="{ backgroundColor: palette.background, color: palette.color }"
    :title="tooltip"
    :aria-label="tooltip"
  >
    {{ initials }}
  </span>
</template>
