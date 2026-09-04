import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server, type ServerOptions } from 'socket.io';

import {
  GAME_STATUS,
  ROOM_ERROR_CODES,
  SOCKET_EVENTS,
  type AdminRejoinPayload,
  type AnswerSubmitPayload,
  type AnswerSubmitResponse,
  type ClientToServerEvents,
  type DiceRollPayload,
  type DiceRollResponse,
  type GameControlPayload,
  type GameControlResponse,
  type GameRoom,
  type InterServerEvents,
  type JoinRoomPayload,
  type PlayerMove,
  type RejoinRoomPayload,
  type RoomError,
  type ServerToClientEvents,
  type SocketAck,
  type SocketData,
} from '@embedded-snakes-live/shared';

import {
  addAdminSocket,
  addPlayer,
  beginQuestion,
  createRoom,
  endQuestion,
  getAdminSocketIds,
  getPlayerQuestionState,
  getPlayerSocketIds,
  getRoom,
  markPlayerDisconnected,
  rejoinAdmin,
  rejoinPlayer,
  removeAdminSocket,
  requestNextQuestion,
  rollDice,
  startGame,
  startDicePhase,
  submitAnswer,
} from './gameStore.js';

dotenv.config();

const DEFAULT_WEB_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const isProduction = process.env.NODE_ENV === 'production';
const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistPath = resolve(__dirname, '../../web/dist');

const countdownTimers = new Map<string, NodeJS.Timeout>();
const questionTimers = new Map<string, NodeJS.Timeout>();

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

function makeRoomError(code: RoomError['code'], message: string): RoomError {
  return { code, message };
}

function connectionAlreadyAssignedError(): RoomError {
  return makeRoomError(
    ROOM_ERROR_CODES.CONNECTION_ALREADY_ASSIGNED,
    'Esta conexion ya pertenece a una partida. Abre otra pestana para iniciar otra sala.',
  );
}

function invalidPayloadError(message = 'La solicitud esta incompleta.'): RoomError {
  return makeRoomError(ROOM_ERROR_CODES.SERVER_ERROR, message);
}

function emitRoomError(socketId: string, error: RoomError): void {
  io.to(socketId).emit(SOCKET_EVENTS.ROOM_ERROR, error);
}

function emitGameError(socketId: string, error: RoomError): void {
  io.to(socketId).emit(SOCKET_EVENTS.GAME_ERROR, error);
}

function emitAnswerRejected(socketId: string, error: RoomError): void {
  io.to(socketId).emit(SOCKET_EVENTS.ANSWER_REJECTED, error);
}

function emitDiceError(socketId: string, error: RoomError): void {
  io.to(socketId).emit(SOCKET_EVENTS.DICE_ERROR, error);
}

function failRoomAck<TData>(
  socketId: string,
  ack: ((response: SocketAck<TData>) => void) | undefined,
  error: RoomError,
): void {
  ack?.({ ok: false, error });
  emitRoomError(socketId, error);
}

function failGameAck(
  socketId: string,
  ack: ((response: GameControlResponse) => void) | undefined,
  error: RoomError,
): void {
  ack?.({ ok: false, error });
  emitGameError(socketId, error);
}

function failAnswerAck(
  socketId: string,
  ack: ((response: AnswerSubmitResponse) => void) | undefined,
  error: RoomError,
): void {
  ack?.({ ok: false, error });
  emitAnswerRejected(socketId, error);
}

function failDiceAck(
  socketId: string,
  ack: ((response: DiceRollResponse) => void) | undefined,
  error: RoomError,
): void {
  ack?.({ ok: false, error });
  emitDiceError(socketId, error);
}

function msUntil(isoDate: string): number {
  return Math.max(0, new Date(isoDate).getTime() - Date.now());
}

function clearCountdownTimer(roomCode: string): void {
  const timer = countdownTimers.get(roomCode);

  if (timer) {
    clearTimeout(timer);
    countdownTimers.delete(roomCode);
  }
}

function clearQuestionTimer(roomCode: string): void {
  const timer = questionTimers.get(roomCode);

  if (timer) {
    clearTimeout(timer);
    questionTimers.delete(roomCode);
  }
}

function emitRoomState(room: GameRoom): void {
  io.to(roomChannel(room.code)).emit(SOCKET_EVENTS.ROOM_STATE, room);
}

function emitBoardState(room: GameRoom): void {
  if (!room.boardState) {
    return;
  }

  for (const socketId of getAdminSocketIds(room.code)) {
    io.to(socketId).emit(SOCKET_EVENTS.BOARD_STATE, {
      roomCode: room.code,
      board: room.boardState,
    });
  }
}

function emitPlayerMove(roomCode: string, move: PlayerMove): void {
  for (const socketId of getAdminSocketIds(roomCode)) {
    io.to(socketId).emit(SOCKET_EVENTS.PLAYER_MOVE, {
      roomCode,
      move,
    });
  }
}

function emitPlayerMoved(room: GameRoom, move: PlayerMove): void {
  if (!room.boardState) {
    return;
  }

  io.to(roomChannel(room.code)).emit(SOCKET_EVENTS.PLAYER_MOVED, {
    roomCode: room.code,
    move,
    board: room.boardState,
  });
}

function emitGameFinished(room: GameRoom): void {
  if (!room.winner || !room.finalLeaderboard || !room.boardState) {
    return;
  }

  io.to(roomChannel(room.code)).emit(SOCKET_EVENTS.GAME_FINISHED, {
    roomCode: room.code,
    room,
    winner: room.winner,
    leaderboard: room.finalLeaderboard,
    board: room.boardState,
  });
}

function emitPlayerQuestionState(roomCode: string, playerId: string): void {
  const state = getPlayerQuestionState(roomCode, playerId);

  if (!state) {
    return;
  }

  for (const socketId of getPlayerSocketIds(roomCode, playerId)) {
    io.to(socketId).emit(SOCKET_EVENTS.PLAYER_STATE, state);
  }
}

function emitAllPlayerQuestionStates(room: GameRoom): void {
  for (const player of room.players) {
    emitPlayerQuestionState(room.code, player.id);
  }
}

function emitDiceState(room: GameRoom): void {
  if (!room.diceSummary || !room.dicePlayers) {
    return;
  }

  io.to(roomChannel(room.code)).emit(SOCKET_EVENTS.DICE_STATE, {
    roomCode: room.code,
    summary: room.diceSummary,
    players: room.dicePlayers,
  });
}

function emitDicePhaseComplete(room: GameRoom): void {
  if (!room.diceSummary?.complete) {
    return;
  }

  io.to(roomChannel(room.code)).emit(SOCKET_EVENTS.DICE_PHASE_COMPLETE, {
    roomCode: room.code,
    summary: room.diceSummary,
  });
}

function emitQuestionResults(room: GameRoom): void {
  if (!room.questionResults) {
    return;
  }

  const adminPayload = {
    roomCode: room.code,
    results: room.questionResults,
  };

  for (const socketId of getAdminSocketIds(room.code)) {
    io.to(socketId).emit(SOCKET_EVENTS.QUESTION_RESULTS, adminPayload);
  }

  for (const player of room.players) {
    const playerState = getPlayerQuestionState(room.code, player.id);
    const playerPayload = playerState?.result
      ? {
          roomCode: room.code,
          results: room.questionResults,
          playerResult: playerState.result,
        }
      : adminPayload;

    for (const socketId of getPlayerSocketIds(room.code, player.id)) {
      io.to(socketId).emit(SOCKET_EVENTS.QUESTION_RESULTS, playerPayload);
    }
  }
}

function finishQuestionAndBroadcast(roomCode: string): void {
  clearQuestionTimer(roomCode);

  const result = endQuestion(roomCode);

  if (!result.ok) {
    io.to(roomChannel(roomCode)).emit(SOCKET_EVENTS.GAME_ERROR, result.error);
    return;
  }

  io.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.QUESTION_ENDED, {
    roomCode: result.room.code,
    questionId: result.results.questionId,
  });
  emitRoomState(result.room);
  emitQuestionResults(result.room);
  emitAllPlayerQuestionStates(result.room);
}

function scheduleQuestionEnd(room: GameRoom): void {
  clearQuestionTimer(room.code);

  if (room.status !== GAME_STATUS.QUESTION_ACTIVE || !room.currentQuestion) {
    return;
  }

  const timer = setTimeout(() => {
    questionTimers.delete(room.code);
    finishQuestionAndBroadcast(room.code);
  }, msUntil(room.currentQuestion.expiresAt));

  questionTimers.set(room.code, timer);
}

function scheduleCountdown(room: GameRoom): void {
  clearCountdownTimer(room.code);

  if (room.status !== GAME_STATUS.COUNTDOWN || !room.countdown) {
    return;
  }

  const timer = setTimeout(() => {
    countdownTimers.delete(room.code);

    const result = beginQuestion(room.code);

    if (!result.ok) {
      io.to(roomChannel(room.code)).emit(SOCKET_EVENTS.GAME_ERROR, result.error);

      const latestRoom = getRoom(room.code);
      if (latestRoom) {
        emitRoomState(latestRoom);
      }

      return;
    }

    io.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.QUESTION_STARTED, {
      roomCode: result.room.code,
      question: result.question,
      answerSummary: result.answerSummary,
    });
    emitRoomState(result.room);
    emitAllPlayerQuestionStates(result.room);

    if (result.answerSummary.activePlayerCount === 0) {
      finishQuestionAndBroadcast(result.room.code);
      return;
    }

    scheduleQuestionEnd(result.room);
  }, msUntil(room.countdown.endsAt));

  countdownTimers.set(room.code, timer);
}

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);

  socket.on(SOCKET_EVENTS.ROOM_CREATE, (ack) => {
    if (typeof ack !== 'function') {
      failRoomAck<never>(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar la creacion de la partida.'),
      );
      return;
    }

    if (socket.data.role || socket.data.roomCode) {
      failRoomAck(socket.id, ack, connectionAlreadyAssignedError());
      return;
    }

    const created = createRoom();
    const activeRoom = addAdminSocket(created.room.code, socket.id);

    if (!activeRoom) {
      failRoomAck(socket.id, ack, {
        code: ROOM_ERROR_CODES.SERVER_ERROR,
        message: 'No pudimos crear la partida. Intentalo de nuevo.',
      });
      return;
    }

    socket.data.role = 'admin';
    socket.data.roomCode = activeRoom.code;
    socket.data.sessionToken = created.adminSessionToken;
    socket.join(roomChannel(activeRoom.code));

    ack({
      ok: true,
      data: {
        room: activeRoom,
        joinPath: `/play/${activeRoom.code}`,
        adminSessionToken: created.adminSessionToken,
      },
    });

    socket.emit(SOCKET_EVENTS.ROOM_STATE, activeRoom);
  });

  socket.on(SOCKET_EVENTS.ROOM_ADMIN_REJOIN, (payload: AdminRejoinPayload, ack) => {
    if (typeof ack !== 'function') {
      failRoomAck<never>(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar la reconexion del administrador.'),
      );
      return;
    }

    if (socket.data.role || socket.data.roomCode) {
      failRoomAck(socket.id, ack, connectionAlreadyAssignedError());
      return;
    }

    if (
      !payload ||
      typeof payload.roomCode !== 'string' ||
      typeof payload.adminSessionToken !== 'string'
    ) {
      failRoomAck(
        socket.id,
        ack,
        invalidPayloadError('No pudimos validar la sesion del administrador.'),
      );
      return;
    }

    const result = rejoinAdmin(payload.roomCode, payload.adminSessionToken, socket.id);

    if (!result.ok) {
      failRoomAck(socket.id, ack, result.error);
      return;
    }

    socket.data.role = 'admin';
    socket.data.roomCode = result.room.code;
    socket.data.sessionToken = result.adminSessionToken;
    socket.join(roomChannel(result.room.code));

    ack({
      ok: true,
      data: {
        room: result.room,
        adminSessionToken: result.adminSessionToken,
      },
    });
    socket.emit(SOCKET_EVENTS.ROOM_STATE, result.room);
    emitBoardState(result.room);
  });

  socket.on(SOCKET_EVENTS.ROOM_JOIN, (payload: JoinRoomPayload, ack) => {
    if (typeof ack !== 'function') {
      failRoomAck<never>(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar tu entrada a la partida.'),
      );
      return;
    }

    if (socket.data.role || socket.data.roomCode) {
      failRoomAck(socket.id, ack, connectionAlreadyAssignedError());
      return;
    }

    if (!payload || typeof payload.roomCode !== 'string' || typeof payload.name !== 'string') {
      failRoomAck(socket.id, ack, {
        code: ROOM_ERROR_CODES.INVALID_NAME,
        message: 'Revisa tu nombre e intentalo de nuevo.',
      });
      return;
    }

    const result = addPlayer(payload.roomCode, payload.name, socket.id);

    if (!result.ok) {
      failRoomAck(socket.id, ack, result.error);
      return;
    }

    socket.data.role = 'player';
    socket.data.roomCode = result.room.code;
    socket.data.playerId = result.player.id;
    socket.data.sessionToken = result.sessionToken;
    socket.join(roomChannel(result.room.code));

    ack({
      ok: true,
      data: {
        player: result.player,
        room: result.room,
        playerState: result.playerState,
        sessionToken: result.sessionToken,
      },
    });

    socket.emit(SOCKET_EVENTS.PLAYER_STATE, result.playerState);
    socket.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.PLAYER_JOINED, {
      roomCode: result.room.code,
      player: result.player,
    });
    emitRoomState(result.room);
  });

  socket.on(SOCKET_EVENTS.ROOM_REJOIN, (payload: RejoinRoomPayload, ack) => {
    if (typeof ack !== 'function') {
      failRoomAck<never>(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar tu reconexion a la partida.'),
      );
      return;
    }

    if (socket.data.role || socket.data.roomCode) {
      failRoomAck(socket.id, ack, connectionAlreadyAssignedError());
      return;
    }

    if (
      !payload ||
      typeof payload.roomCode !== 'string' ||
      typeof payload.sessionToken !== 'string'
    ) {
      failRoomAck(socket.id, ack, invalidPayloadError('No pudimos validar tu sesion.'));
      return;
    }

    const result = rejoinPlayer(payload.roomCode, payload.sessionToken, socket.id);

    if (!result.ok) {
      failRoomAck(socket.id, ack, result.error);
      return;
    }

    socket.data.role = 'player';
    socket.data.roomCode = result.room.code;
    socket.data.playerId = result.player.id;
    socket.data.sessionToken = result.sessionToken;
    socket.join(roomChannel(result.room.code));

    ack({
      ok: true,
      data: {
        player: result.player,
        room: result.room,
        playerState: result.playerState,
        sessionToken: result.sessionToken,
      },
    });

    socket.emit(SOCKET_EVENTS.PLAYER_STATE, result.playerState);
    emitRoomState(result.room);
  });

  socket.on(SOCKET_EVENTS.GAME_START, (payload: GameControlPayload, ack) => {
    if (typeof ack !== 'function') {
      failGameAck(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar el inicio de la partida.'),
      );
      return;
    }

    if (!payload || typeof payload.roomCode !== 'string') {
      failGameAck(socket.id, ack, invalidPayloadError('No pudimos validar la sala.'));
      return;
    }

    const result = startGame(payload.roomCode, socket.id);

    if (!result.ok) {
      failGameAck(socket.id, ack, result.error);
      return;
    }

    ack({
      ok: true,
      data: {
        room: result.room,
      },
    });
    emitRoomState(result.room);
    emitBoardState(result.room);
    scheduleCountdown(result.room);
  });

  socket.on(SOCKET_EVENTS.DICE_PHASE_START, (payload: GameControlPayload, ack) => {
    if (typeof ack !== 'function') {
      failGameAck(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar la fase de dados.'),
      );
      return;
    }

    if (!payload || typeof payload.roomCode !== 'string') {
      failGameAck(socket.id, ack, invalidPayloadError('No pudimos validar la sala.'));
      return;
    }

    const result = startDicePhase(payload.roomCode, socket.id);

    if (!result.ok) {
      failGameAck(socket.id, ack, result.error);
      return;
    }

    ack({
      ok: true,
      data: {
        room: result.room,
      },
    });
    io.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.DICE_PHASE_START, {
      roomCode: result.room.code,
      room: result.room,
    });
    emitRoomState(result.room);
    emitDiceState(result.room);
    emitAllPlayerQuestionStates(result.room);
    emitDicePhaseComplete(result.room);
  });

  socket.on(SOCKET_EVENTS.QUESTION_NEXT, (payload: GameControlPayload, ack) => {
    if (typeof ack !== 'function') {
      failGameAck(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar la siguiente pregunta.'),
      );
      return;
    }

    if (!payload || typeof payload.roomCode !== 'string') {
      failGameAck(socket.id, ack, invalidPayloadError('No pudimos validar la sala.'));
      return;
    }

    const result = requestNextQuestion(payload.roomCode, socket.id);

    if (!result.ok) {
      failGameAck(socket.id, ack, result.error);
      return;
    }

    ack({
      ok: true,
      data: {
        room: result.room,
      },
    });
    emitRoomState(result.room);
    scheduleCountdown(result.room);
  });

  socket.on(SOCKET_EVENTS.DICE_ROLL, (payload: DiceRollPayload, ack) => {
    if (typeof ack !== 'function') {
      failDiceAck(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar tu lanzamiento.'),
      );
      return;
    }

    const { playerId, role, roomCode } = socket.data;

    if (role !== 'player' || !roomCode || !playerId) {
      failDiceAck(
        socket.id,
        ack,
        makeRoomError(ROOM_ERROR_CODES.PLAYER_NOT_FOUND, 'No pudimos validar tu jugador.'),
      );
      return;
    }

    if (!payload || typeof payload.roomCode !== 'string') {
      failDiceAck(socket.id, ack, invalidPayloadError('No pudimos validar la sala.'));
      return;
    }

    if (payload.roomCode.trim().toUpperCase() !== roomCode) {
      failDiceAck(
        socket.id,
        ack,
        makeRoomError(ROOM_ERROR_CODES.ROOM_NOT_FOUND, 'La sala de esta conexion no coincide.'),
      );
      return;
    }

    const result = rollDice(roomCode, playerId, socket.id);

    if (!result.ok) {
      failDiceAck(socket.id, ack, result.error);
      return;
    }

    ack({
      ok: true,
      data: {
        value: result.value,
        diceState: result.diceState,
        playerState: result.playerState,
        move: result.move,
        room: result.room,
      },
    });
    emitPlayerMove(result.room.code, result.move);
    io.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.DICE_RESULT, {
      roomCode: result.room.code,
      playerId,
      value: result.value,
      diceState: result.diceState,
      summary: result.diceSummary,
      move: result.move,
    });
    emitPlayerMoved(result.room, result.move);
    emitPlayerQuestionState(result.room.code, playerId);
    emitRoomState(result.room);
    emitBoardState(result.room);
    emitDiceState(result.room);

    if (result.shouldCompleteDicePhase) {
      emitDicePhaseComplete(result.room);
    }

    if (result.finished) {
      emitGameFinished(result.room);
    }
  });

  socket.on(SOCKET_EVENTS.ANSWER_SUBMIT, (payload: AnswerSubmitPayload, ack) => {
    if (typeof ack !== 'function') {
      failAnswerAck(
        socket.id,
        undefined,
        invalidPayloadError('No pudimos confirmar tu respuesta.'),
      );
      return;
    }

    const { playerId, role, roomCode } = socket.data;

    if (role !== 'player' || !roomCode || !playerId) {
      failAnswerAck(
        socket.id,
        ack,
        makeRoomError(ROOM_ERROR_CODES.REJOIN_FAILED, 'No pudimos validar tu conexion.'),
      );
      return;
    }

    if (
      !payload ||
      typeof payload.roomCode !== 'string' ||
      typeof payload.questionId !== 'string' ||
      typeof payload.selectedOptionId !== 'string'
    ) {
      failAnswerAck(socket.id, ack, invalidPayloadError('No pudimos validar tu respuesta.'));
      return;
    }

    const result = submitAnswer(roomCode, playerId, socket.id, payload);

    if (!result.ok) {
      failAnswerAck(socket.id, ack, result.error);
      return;
    }

    ack({
      ok: true,
      data: result.accepted,
    });
    socket.emit(SOCKET_EVENTS.ANSWER_ACCEPTED, result.accepted);
    emitPlayerQuestionState(result.room.code, playerId);
    emitRoomState(result.room);

    if (result.shouldEndQuestion) {
      finishQuestionAndBroadcast(result.room.code);
    }
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
        emitRoomState(room);
      }

      return;
    }

    if (role === 'player' && playerId) {
      const result = markPlayerDisconnected(roomCode, playerId, socket.id);

      if (!result) {
        return;
      }

      if (result.disconnected) {
        socket.to(roomChannel(result.room.code)).emit(SOCKET_EVENTS.PLAYER_LEFT, {
          roomCode: result.room.code,
          playerId: result.playerId,
        });
      }

      emitRoomState(result.room);
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
