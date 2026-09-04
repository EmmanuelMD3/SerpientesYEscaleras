import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type ServerOptions } from 'socket.io';

import {
  ROOM_ERROR_CODES,
  SOCKET_EVENTS,
  type ClientToServerEvents,
  type CreateRoomResponse,
  type InterServerEvents,
  type JoinRoomPayload,
  type JoinRoomResponse,
  type RoomError,
  type ServerToClientEvents,
  type SocketData,
} from '@embedded-snakes-live/shared';

import {
  addAdminSocket,
  addPlayer,
  createRoom,
  getRoom,
  markPlayerDisconnected,
  removeAdminSocket,
} from './gameStore.js';

dotenv.config();

const DEFAULT_WEB_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const isProduction = process.env.NODE_ENV === 'production';
const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistPath = resolve(__dirname, '../../web/dist');

function parsePort(value: string | undefined): number {
  const parsedPort = Number(value ?? 3000);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65_535) {
    console.error(`[server] Invalid PORT value: ${value}`);
    process.exit(1);
  }

  return parsedPort;
}

const port = parsePort(process.env.PORT);
const host = process.env.HOST ?? '0.0.0.0';
const publicLogHost = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
const configuredOrigins = (process.env.CORS_ORIGINS ?? process.env.WEB_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins =
  configuredOrigins.length > 0 ? configuredOrigins : isProduction ? [] : DEFAULT_WEB_ORIGINS;

const app = express();

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
};

if (allowedOrigins.length > 0) {
  app.use(cors(corsOptions));
}

app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({ status: 'ok' });
});

app.get('/api/rooms/:roomCode', (request, response) => {
  const room = getRoom(request.params.roomCode);

  if (!room) {
    response.status(404).json({
      ok: false,
      error: {
        code: ROOM_ERROR_CODES.ROOM_NOT_FOUND,
        message: 'No encontramos una partida con ese codigo.',
      },
    });
    return;
  }

  response.json({ ok: true, data: room });
});

if (isProduction && existsSync(webDistPath)) {
  app.use(express.static(webDistPath));

  app.get(/^\/(?!api(?:\/|$)|health$|socket\.io(?:\/|$)).*/, (_request, response) => {
    response.sendFile(join(webDistPath, 'index.html'));
  });
} else if (isProduction) {
  console.warn(`[server] Frontend build not found at ${webDistPath}`);
}

const httpServer = createServer(app);
const socketOptions: Partial<ServerOptions> =
  allowedOrigins.length > 0
    ? {
        cors: {
          origin: allowedOrigins,
        },
      }
    : {};
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  httpServer,
  socketOptions,
);

function roomChannel(roomCode: string): string {
  return `room:${roomCode}`;
}

function emitRoomError(socketId: string, error: RoomError): void {
  io.to(socketId).emit(SOCKET_EVENTS.ROOM_ERROR, error);
}

function failCreateRoom(
  socketId: string,
  ack: ((response: CreateRoomResponse) => void) | undefined,
  error: RoomError,
): void {
  ack?.({ ok: false, error });
  emitRoomError(socketId, error);
}

function failJoinRoom(
  socketId: string,
  ack: ((response: JoinRoomResponse) => void) | undefined,
  error: RoomError,
): void {
  ack?.({ ok: false, error });
  emitRoomError(socketId, error);
}

function connectionAlreadyAssignedError(): RoomError {
  return {
    code: ROOM_ERROR_CODES.CONNECTION_ALREADY_ASSIGNED,
    message: 'Esta conexion ya pertenece a una partida. Abre otra pestana para iniciar otra sala.',
  };
}

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on(SOCKET_EVENTS.ROOM_CREATE, (ack) => {
    if (typeof ack !== 'function') {
      failCreateRoom(socket.id, undefined, {
        code: ROOM_ERROR_CODES.SERVER_ERROR,
        message: 'No pudimos confirmar la creacion de la partida.',
      });
      return;
    }

    if (socket.data.role || socket.data.roomCode) {
      failCreateRoom(socket.id, ack, connectionAlreadyAssignedError());
      return;
    }

    const room = createRoom();
    const activeRoom = addAdminSocket(room.code, socket.id);

    if (!activeRoom) {
      failCreateRoom(socket.id, ack, {
        code: ROOM_ERROR_CODES.SERVER_ERROR,
        message: 'No pudimos crear la partida. Intentalo de nuevo.',
      });
      return;
    }

    socket.data.role = 'admin';
    socket.data.roomCode = activeRoom.code;
    socket.join(roomChannel(activeRoom.code));

    ack({
      ok: true,
      data: {
        room: activeRoom,
        joinPath: `/play/${activeRoom.code}`,
      },
    });

    socket.emit(SOCKET_EVENTS.ROOM_STATE, activeRoom);
  });

  socket.on(SOCKET_EVENTS.ROOM_JOIN, (payload: JoinRoomPayload, ack) => {
    if (typeof ack !== 'function') {
      failJoinRoom(socket.id, undefined, {
        code: ROOM_ERROR_CODES.SERVER_ERROR,
        message: 'No pudimos confirmar tu entrada a la partida.',
      });
      return;
    }

    if (socket.data.role || socket.data.roomCode) {
      failJoinRoom(socket.id, ack, connectionAlreadyAssignedError());
      return;
    }

    if (!payload || typeof payload.roomCode !== 'string' || typeof payload.name !== 'string') {
      failJoinRoom(socket.id, ack, {
        code: ROOM_ERROR_CODES.INVALID_NAME,
        message: 'Revisa tu nombre e intentalo de nuevo.',
      });
      return;
    }

    const result = addPlayer(payload.roomCode, payload.name);

    if (!result.ok) {
      failJoinRoom(socket.id, ack, result.error);
      return;
    }

    socket.data.role = 'player';
    socket.data.roomCode = result.room.code;
    socket.data.playerId = result.player.id;
    socket.join(roomChannel(result.room.code));

    ack({
      ok: true,
      data: {
        player: result.player,
        room: result.room,
      },
    });

    socket.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.PLAYER_JOINED, {
      roomCode: result.room.code,
      player: result.player,
    });
    io.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
  });

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);

    const { playerId, role, roomCode } = socket.data;

    if (!roomCode || !role) {
      return;
    }

    if (role === 'admin') {
      const room = removeAdminSocket(roomCode, socket.id);

      if (room) {
        socket.to(roomChannel(room.code)).emit(SOCKET_EVENTS.ROOM_STATE, room);
      }

      return;
    }

    if (role === 'player' && playerId) {
      const result = markPlayerDisconnected(roomCode, playerId);

      if (!result) {
        return;
      }

      socket.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.PLAYER_LEFT, {
        roomCode: result.room.code,
        playerId: result.playerId,
      });
      socket.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    }
  });
});

httpServer.once('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[server] Port ${port} is already in use on host ${host}.`);
    console.error(`[server] Stop the process using port ${port} or start with another PORT value.`);
    process.exit(1);
  }

  console.error(`[server] Could not start HTTP server: ${error.message}`);
  process.exit(1);
});

httpServer.listen(port, host, () => {
  console.log(`[server] HTTP server listening on http://${publicLogHost}:${port}`);
  console.log('[server] Socket.IO ready');

  if (allowedOrigins.length > 0) {
    console.log(`[server] CORS allowed origins: ${allowedOrigins.join(', ')}`);
  } else {
    console.log('[server] CORS disabled; expecting same-origin production traffic.');
  }
});
