<script setup lang="ts">
import type { BoardPlayer } from '@embedded-snakes-live/shared';

import PlayerToken from './PlayerToken.vue';

defineProps<{
  position: number;
  players: BoardPlayer[];
  activePlayerId?: string | undefined;
}>();
</script>

<template>
  <article
    class="board-cell"
    :class="{
      'board-cell--goal': position === 40,
      'board-cell--occupied': players.length > 0,
    }"
  >
    <div class="flex items-start justify-between gap-1">
      <span class="board-cell__number">{{ position }}</span>
      <span v-if="position === 40" class="board-cell__goal">Meta</span>
    </div>

    <div class="board-cell__tokens">
      <PlayerToken
        v-for="player in players"
        :key="player.playerId"
        :player="player"
        :active="player.playerId === activePlayerId"
      />
    </div>
  </article>
</template>
