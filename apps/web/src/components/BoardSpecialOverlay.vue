<script setup lang="ts">
import { computed } from 'vue';

import { BOARD_SPECIAL_TYPE, type BoardSpecial } from '@embedded-snakes-live/shared';

interface BoardPoint {
  x: number;
  y: number;
}

interface LadderShape {
  special: BoardSpecial;
  centerStart: BoardPoint;
  centerEnd: BoardPoint;
  railAStart: BoardPoint;
  railAEnd: BoardPoint;
  railBStart: BoardPoint;
  railBEnd: BoardPoint;
  rungs: Array<{
    start: BoardPoint;
    end: BoardPoint;
  }>;
}

interface SnakeShape {
  special: BoardSpecial;
  path: string;
  headTransform: string;
  tailTransform: string;
  className: string;
}

const props = defineProps<{
  specials: BoardSpecial[];
  maxPosition: number;
}>();

const ladders = computed(() =>
  props.specials.filter((special) => special.type === BOARD_SPECIAL_TYPE.LADDER),
);
const snakes = computed(() =>
  props.specials.filter((special) => special.type === BOARD_SPECIAL_TYPE.SNAKE),
);
const rowCount = computed(() => Math.ceil(props.maxPosition / 10));
const viewBox = computed(() => `0 0 10 ${rowCount.value}`);

function pointForPosition(position: number): BoardPoint {
  const rowFromBottom = Math.floor((position - 1) / 10);
  const column = rowFromBottom % 2 === 0 ? (position - 1) % 10 : 9 - ((position - 1) % 10);

  return {
    x: column + 0.5,
    y: rowCount.value - 1 - rowFromBottom + 0.5,
  };
}

function vector(from: BoardPoint, to: BoardPoint): { dx: number; dy: number; length: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return {
    dx,
    dy,
    length: Math.hypot(dx, dy) || 1,
  };
}

function interpolate(from: BoardPoint, to: BoardPoint, progress: number): BoardPoint {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function offsetPoint(
  point: BoardPoint,
  from: BoardPoint,
  to: BoardPoint,
  offset: number,
): BoardPoint {
  const { dx, dy, length } = vector(from, to);

  return {
    x: point.x + (-dy / length) * offset,
    y: point.y + (dx / length) * offset,
  };
}

function offsetAlongNormal(
  point: BoardPoint,
  normal: BoardPoint,
  offset: number,
): BoardPoint {
  return {
    x: point.x + normal.x * offset,
    y: point.y + normal.y * offset,
  };
}

function formatPoint(point: BoardPoint): string {
  return `${Number(point.x.toFixed(3))} ${Number(point.y.toFixed(3))}`;
}

function ladderShape(special: BoardSpecial): LadderShape {
  const from = pointForPosition(special.from);
  const to = pointForPosition(special.to);
  const railOffset = 0.17;
  const rungProgress = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1];

  return {
    special,
    centerStart: from,
    centerEnd: to,
    railAStart: offsetPoint(from, from, to, -railOffset),
    railAEnd: offsetPoint(to, from, to, -railOffset),
    railBStart: offsetPoint(from, from, to, railOffset),
    railBEnd: offsetPoint(to, from, to, railOffset),
    rungs: rungProgress.map((progress) => {
      const center = interpolate(from, to, progress);

      return {
        start: offsetPoint(center, from, to, -railOffset),
        end: offsetPoint(center, from, to, railOffset),
      };
    }),
  };
}

function snakeShape(special: BoardSpecial, index: number): SnakeShape {
  const from = pointForPosition(special.from);
  const to = pointForPosition(special.to);
  const { dx, dy, length } = vector(from, to);
  const curveDirection = index % 2 === 0 ? 1 : -1;
  const normal = { x: -dy / length, y: dx / length };
  const wave = Math.min(0.72, Math.max(0.32, length * 0.18)) * curveDirection;
  const middle = offsetAlongNormal(interpolate(from, to, 0.5), normal, -wave * 0.65);
  const c1 = offsetAlongNormal(interpolate(from, to, 0.18), normal, wave);
  const c2 = offsetAlongNormal(interpolate(from, to, 0.34), normal, wave * 0.95);
  const c3 = offsetAlongNormal(interpolate(from, to, 0.62), normal, -wave);
  const c4 = offsetAlongNormal(interpolate(from, to, 0.82), normal, wave * 0.72);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  return {
    special,
    path: `M ${formatPoint(from)} C ${formatPoint(c1)}, ${formatPoint(c2)}, ${formatPoint(
      middle,
    )} C ${formatPoint(c3)}, ${formatPoint(c4)}, ${formatPoint(to)}`,
    headTransform: `translate(${from.x} ${from.y}) rotate(${angle})`,
    tailTransform: `translate(${to.x} ${to.y}) rotate(${angle})`,
    className: `board-snake board-snake--${index % 5}`,
  };
}

const ladderShapes = computed(() => ladders.value.map(ladderShape));
const snakeShapes = computed(() => snakes.value.map(snakeShape));
</script>

<template>
  <svg
    class="board-special-overlay"
    :viewBox="viewBox"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <g class="board-ladders">
      <g v-for="ladder in ladderShapes" :key="`ladder-${ladder.special.from}`">
        <line
          class="board-ladder__centerline"
          :x1="ladder.centerStart.x"
          :y1="ladder.centerStart.y"
          :x2="ladder.centerEnd.x"
          :y2="ladder.centerEnd.y"
        />
        <line
          class="board-ladder__rail-outline"
          :x1="ladder.railAStart.x"
          :y1="ladder.railAStart.y"
          :x2="ladder.railAEnd.x"
          :y2="ladder.railAEnd.y"
        />
        <line
          class="board-ladder__rail-outline"
          :x1="ladder.railBStart.x"
          :y1="ladder.railBStart.y"
          :x2="ladder.railBEnd.x"
          :y2="ladder.railBEnd.y"
        />
        <line
          v-for="(rung, index) in ladder.rungs"
          :key="`ladder-${ladder.special.from}-rung-outline-${index}`"
          class="board-ladder__rung-outline"
          :x1="rung.start.x"
          :y1="rung.start.y"
          :x2="rung.end.x"
          :y2="rung.end.y"
        />
        <line
          class="board-ladder__rail"
          :x1="ladder.railAStart.x"
          :y1="ladder.railAStart.y"
          :x2="ladder.railAEnd.x"
          :y2="ladder.railAEnd.y"
        />
        <line
          class="board-ladder__rail"
          :x1="ladder.railBStart.x"
          :y1="ladder.railBStart.y"
          :x2="ladder.railBEnd.x"
          :y2="ladder.railBEnd.y"
        />
        <line
          v-for="(rung, index) in ladder.rungs"
          :key="`ladder-${ladder.special.from}-rung-${index}`"
          class="board-ladder__rung"
          :x1="rung.start.x"
          :y1="rung.start.y"
          :x2="rung.end.x"
          :y2="rung.end.y"
        />
        <line
          class="board-ladder__rail-highlight"
          :x1="ladder.railAStart.x"
          :y1="ladder.railAStart.y"
          :x2="ladder.railAEnd.x"
          :y2="ladder.railAEnd.y"
        />
        <line
          class="board-ladder__rail-highlight"
          :x1="ladder.railBStart.x"
          :y1="ladder.railBStart.y"
          :x2="ladder.railBEnd.x"
          :y2="ladder.railBEnd.y"
        />
      </g>
    </g>

    <g class="board-snakes">
      <g v-for="snake in snakeShapes" :key="`snake-${snake.special.from}`" :class="snake.className">
        <path class="board-snake__outline" :d="snake.path" />
        <path class="board-snake__body" :d="snake.path" />
        <path class="board-snake__belly" :d="snake.path" pathLength="1" />

        <g class="board-snake__tail" :transform="snake.tailTransform">
          <path d="M -0.16 -0.08 C -0.03 -0.03, 0.03 0.03, 0.2 0 L -0.16 0.08 Z" />
        </g>

        <g class="board-snake__head" :transform="snake.headTransform">
          <ellipse class="board-snake__head-fill" cx="0" cy="0" rx="0.23" ry="0.17" />
          <circle class="board-snake__eye" cx="0.08" cy="-0.055" r="0.032" />
          <circle class="board-snake__eye" cx="0.08" cy="0.055" r="0.032" />
          <path class="board-snake__tongue" d="M 0.2 0 L 0.34 0 M 0.34 0 L 0.43 -0.045 M 0.34 0 L 0.43 0.045" />
        </g>
      </g>
    </g>
  </svg>
</template>
