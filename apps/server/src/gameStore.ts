import { randomInt, randomUUID } from 'node:crypto';

import {
  GAME_STATUS,
  ROOM_ERROR_CODES,
  type GameRoom,
  type Player,
  type RoomError,
} from '@embedded-snakes-live/shared';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const EMPTY_ROOM_GRACE_MS = 30_000;

interface InternalGameRoom extends GameRoom {
  adminSocketIds: Set<string>;
}

type AddPlayerResult =
  | {
      ok: true;
      room: GameRoom;
      player: Player;
    }
  | {
      ok: false;
      error: RoomError;
    };

const rooms = new Map<string, InternalGameRoom>();
const cleanupTimers = new Map<string, NodeJS.Timeout>();

function publicRoom(room: InternalGameRoom): GameRoom {
  return {
    code: room.code,
    status: room.status,
    createdAt: room.createdAt,
    players: room.players.map((player) => ({ ...player })),
  };
}

function normalizeRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase();
}

function normalizeName(name: string): string {
  return name.trim();
}

function namesMatch(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

function randomRoomCode(): string {
  let code = '';

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }

  return code;
}

function uniqueRoomCode(): string {
  let code = randomRoomCode();

  while (rooms.has(code)) {
    code = randomRoomCode();
  }

  return code;
}

function clearCleanupTimer(roomCode: string): void {
  const timer = cleanupTimers.get(roomCode);

  if (timer) {
    clearTimeout(timer);
    cleanupTimers.delete(roomCode);
  }
}

function hasLiveSockets(room: InternalGameRoom): boolean {
  return room.adminSocketIds.size > 0 || room.players.some((player) => player.connected);
}

function scheduleCleanupIfEmpty(room: InternalGameRoom): void {
  if (hasLiveSockets(room) || cleanupTimers.has(room.code)) {
    return;
  }

  const timer = setTimeout(() => {
    const currentRoom = rooms.get(room.code);

    if (currentRoom && !hasLiveSockets(currentRoom)) {
      rooms.delete(room.code);
    }

    cleanupTimers.delete(room.code);
  }, EMPTY_ROOM_GRACE_MS);

  cleanupTimers.set(room.code, timer);
}

export function createRoom(): GameRoom {
  const code = uniqueRoomCode();
  const room: InternalGameRoom = {
    code,
    status: GAME_STATUS.LOBBY,
    players: [],
    createdAt: new Date().toISOString(),
    adminSocketIds: new Set<string>(),
  };

  rooms.set(code, room);

  return publicRoom(room);
}

export function getRoom(roomCode: string): GameRoom | undefined {
  const room = rooms.get(normalizeRoomCode(roomCode));

  return room ? publicRoom(room) : undefined;
}

export function addAdminSocket(roomCode: string, socketId: string): GameRoom | undefined {
  const room = rooms.get(normalizeRoomCode(roomCode));

  if (!room) {
    return undefined;
  }

  clearCleanupTimer(room.code);
  room.adminSocketIds.add(socketId);

  return publicRoom(room);
}

export function removeAdminSocket(roomCode: string, socketId: string): GameRoom | undefined {
  const room = rooms.get(normalizeRoomCode(roomCode));

  if (!room) {
    return undefined;
  }

  room.adminSocketIds.delete(socketId);
  scheduleCleanupIfEmpty(room);

  return publicRoom(room);
}

export function addPlayer(roomCode: string, rawName: string): AddPlayerResult {
  const code = normalizeRoomCode(roomCode);
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: {
        code: ROOM_ERROR_CODES.ROOM_NOT_FOUND,
        message: 'No encontramos una partida con ese codigo.',
      },
    };
  }

  if (room.status !== GAME_STATUS.LOBBY) {
    return {
      ok: false,
      error: {
        code: ROOM_ERROR_CODES.ROOM_NOT_JOINABLE,
        message: 'Esta partida ya no acepta nuevos jugadores.',
      },
    };
  }

  const name = normalizeName(rawName);

  if (!name) {
    return {
      ok: false,
      error: {
        code: ROOM_ERROR_CODES.INVALID_NAME,
        message: 'Escribe tu nombre para entrar a la partida.',
      },
    };
  }

  if (name.length > 25) {
    return {
      ok: false,
      error: {
        code: ROOM_ERROR_CODES.INVALID_NAME,
        message: 'Tu nombre puede tener maximo 25 caracteres.',
      },
    };
  }

  const nameAlreadyExists = room.players.some((player) => namesMatch(player.name, name));

  if (nameAlreadyExists) {
    return {
      ok: false,
      error: {
        code: ROOM_ERROR_CODES.DUPLICATE_NAME,
        message: 'Ese nombre ya esta dentro de la partida. Prueba con otro.',
      },
    };
  }

  clearCleanupTimer(room.code);

  const player: Player = {
    id: randomUUID(),
    name,
    connected: true,
    joinedAt: new Date().toISOString(),
  };

  room.players.push(player);

  return {
    ok: true,
    room: publicRoom(room),
    player: { ...player },
  };
}

export function markPlayerDisconnected(
  roomCode: string,
  playerId: string,
): { room: GameRoom; playerId: string } | undefined {
  const room = rooms.get(normalizeRoomCode(roomCode));

  if (!room) {
    return undefined;
  }

  const player = room.players.find((candidate) => candidate.id === playerId);

  if (!player) {
    return undefined;
  }

  player.connected = false;
  scheduleCleanupIfEmpty(room);

  return {
    room: publicRoom(room),
    playerId: player.id,
  };
}
