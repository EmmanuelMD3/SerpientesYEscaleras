<script setup lang="ts">
import {
  BOARD_MAX_POSITION,
  BOARD_SPECIAL_TYPE,
  type BoardPlayer,
  type BoardSpecial,
} from '@embedded-snakes-live/shared';

import PlayerToken from './PlayerToken.vue';

defineProps<{
  position: number;
  players: BoardPlayer[];
  special?: BoardSpecial | undefined;
  activePlayerId?: string | undefined;
}>();
</script>

<template>
  <article
    class="board-cell"
    :class="{
      'board-cell--goal': position === BOARD_MAX_POSITION,
      'board-cell--occupied': players.length > 0,
    }"
  >
    <div class="flex items-start justify-between gap-1">
      <span class="board-cell__number">{{ position }}</span>
      <span v-if="position === BOARD_MAX_POSITION" class="board-cell__goal">Meta</span>
      <span v-else-if="special" class="board-cell__special">
        {{ special.type === BOARD_SPECIAL_TYPE.LADDER ? '🪜' : '🐍' }}
      </span>
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
