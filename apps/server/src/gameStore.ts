import { randomInt, randomUUID } from 'node:crypto';

import {
  GAME_STATUS,
  PLAYER_RESULT_STATUS,
  ROOM_ERROR_CODES,
  type AnswerAcceptedSuccess,
  type AnswerSubmitPayload,
  type CountdownState,
  type GameRoom,
  type Player,
  type PlayerAnswer,
  type PlayerQuestionResult,
  type PlayerQuestionState,
  type PublicQuestion,
  type Question,
  type QuestionAnswerSummary,
  type QuestionResults,
  type RoomError,
} from '@embedded-snakes-live/shared';

import { questions } from './data/questions.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH = 6;
const EMPTY_ROOM_GRACE_MS = 60_000;
export const COUNTDOWN_SECONDS = 3;

interface InternalPlayer extends Player {
  sessionToken: string;
  socketIds: Set<string>;
}

interface ActiveQuestion {
  question: Question;
  publicQuestion: PublicQuestion;
  startedAtMs: number;
  expiresAtMs: number;
  activePlayerIds: Set<string>;
}

interface InternalGameRoom {
  code: string;
  status: GameRoom['status'];
  players: InternalPlayer[];
  createdAt: string;
  adminSocketIds: Set<string>;
  adminSessionToken: string;
  questionOrder: Question[];
  currentQuestionIndex: number;
  answersByQuestion: Map<string, Map<string, PlayerAnswer>>;
  countdown: CountdownState | undefined;
  activeQuestion: ActiveQuestion | undefined;
  questionResults: QuestionResults | undefined;
}

type StoreResult<TData> =
  | ({
      ok: true;
    } & TData)
  | {
      ok: false;
      error: RoomError;
    };

type AddPlayerResult = StoreResult<{
  room: GameRoom;
  player: Player;
  playerState: PlayerQuestionState;
  sessionToken: string;
}>;

type RejoinPlayerResult = StoreResult<{
  room: GameRoom;
  player: Player;
  playerState: PlayerQuestionState;
  sessionToken: string;
}>;

type AdminSessionResult = StoreResult<{
  room: GameRoom;
  adminSessionToken: string;
}>;

type GameControlResult = StoreResult<{
  room: GameRoom;
}>;

type BeginQuestionResult = StoreResult<{
  room: GameRoom;
  question: PublicQuestion;
  answerSummary: QuestionAnswerSummary;
}>;

type SubmitAnswerResult = StoreResult<{
  room: GameRoom;
  accepted: AnswerAcceptedSuccess;
  shouldEndQuestion: boolean;
}>;

type EndQuestionResult = StoreResult<{
  room: GameRoom;
  results: QuestionResults;
  playerResults: PlayerQuestionResult[];
}>;

const rooms = new Map<string, InternalGameRoom>();
const cleanupTimers = new Map<string, NodeJS.Timeout>();

function roomError(code: RoomError['code'], message: string): RoomError {
  return { code, message };
}

function publicPlayer(player: InternalPlayer): Player {
  return {
    id: player.id,
    name: player.name,
    connected: player.connected,
    joinedAt: player.joinedAt,
  };
}

function answerSummary(room: InternalGameRoom): QuestionAnswerSummary | undefined {
  if (!room.activeQuestion) {
    return undefined;
  }

  const answers = room.answersByQuestion.get(room.activeQuestion.question.id);

  return {
    answeredCount: answers?.size ?? 0,
    activePlayerCount: room.activeQuestion.activePlayerIds.size,
  };
}

function publicRoom(room: InternalGameRoom): GameRoom {
  const result: GameRoom = {
    code: room.code,
    status: room.status,
    createdAt: room.createdAt,
    players: room.players.map(publicPlayer),
  };

  if (room.status === GAME_STATUS.COUNTDOWN && room.countdown) {
    result.countdown = { ...room.countdown };
  }

  if (
    (room.status === GAME_STATUS.QUESTION_ACTIVE ||
      room.status === GAME_STATUS.QUESTION_RESULTS) &&
    room.activeQuestion
  ) {
    result.currentQuestion = {
      ...room.activeQuestion.publicQuestion,
      options: room.activeQuestion.publicQuestion.options.map((option) => ({ ...option })),
    };
  }

  const summary = answerSummary(room);

  if (summary) {
    result.answerSummary = summary;
  }

  if (room.status === GAME_STATUS.QUESTION_RESULTS && room.questionResults) {
    result.questionResults = {
      ...room.questionResults,
      distribution: room.questionResults.distribution.map((item) => ({ ...item })),
    };
  }

  return result;
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
    code += CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length));
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

function shuffledQuestions(): Question[] {
  const pool = questions.map((question) => ({
    ...question,
    options: question.options.map((option) => ({ ...option })),
  }));

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const targetIndex = randomInt(index + 1);
    const current = pool[index]!;
    pool[index] = pool[targetIndex]!;
    pool[targetIndex] = current;
  }

  return pool;
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

function getInternalRoom(roomCode: string): InternalGameRoom | undefined {
  return rooms.get(normalizeRoomCode(roomCode));
}

function getInternalPlayer(
  room: InternalGameRoom,
  playerId: string,
): InternalPlayer | undefined {
  return room.players.find((candidate) => candidate.id === playerId);
}

function isAdminSocket(room: InternalGameRoom, socketId: string): boolean {
  return room.adminSocketIds.has(socketId);
}

function assertAdminRoom(
  roomCode: string,
  socketId: string,
): StoreResult<{ room: InternalGameRoom }> {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.ROOM_NOT_FOUND,
        'No encontramos una partida con ese codigo.',
      ),
    };
  }

  if (!isAdminSocket(room, socketId)) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.NOT_ADMIN,
        'Solo el administrador puede controlar la partida.',
      ),
    };
  }

  return { ok: true, room };
}

function makeCountdown(room: InternalGameRoom): CountdownState {
  return {
    endsAt: new Date(Date.now() + COUNTDOWN_SECONDS * 1000).toISOString(),
    nextQuestionNumber: room.currentQuestionIndex + 1,
    totalQuestions: room.questionOrder.length,
  };
}

function makePublicQuestion(
  question: Question,
  startedAtMs: number,
  questionNumber: number,
  totalQuestions: number,
): PublicQuestion {
  const expiresAtMs = startedAtMs + question.timeLimitSeconds * 1000;

  return {
    id: question.id,
    text: question.text,
    options: question.options.map((option) => ({ ...option })),
    category: question.category,
    difficulty: question.difficulty,
    timeLimitSeconds: question.timeLimitSeconds,
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    questionNumber,
    totalQuestions,
  };
}

function getAnswerMap(room: InternalGameRoom, questionId: string): Map<string, PlayerAnswer> {
  let answers = room.answersByQuestion.get(questionId);

  if (!answers) {
    answers = new Map<string, PlayerAnswer>();
    room.answersByQuestion.set(questionId, answers);
  }

  return answers;
}

function playerResultFromAnswer(
  question: Question,
  answer: PlayerAnswer | undefined,
): PlayerQuestionResult {
  const correctOption = question.options.find((option) => option.id === question.correctOptionId);
  const correctOptionText = correctOption?.text ?? '';

  if (!answer) {
    return {
      questionId: question.id,
      status: PLAYER_RESULT_STATUS.TIMEOUT,
      correctOptionId: question.correctOptionId,
      correctOptionText,
      correct: false,
    };
  }

  return {
    questionId: question.id,
    status: answer.correct ? PLAYER_RESULT_STATUS.CORRECT : PLAYER_RESULT_STATUS.INCORRECT,
    correctOptionId: question.correctOptionId,
    correctOptionText,
    correct: answer.correct,
    selectedOptionId: answer.selectedOptionId,
    answeredAt: answer.answeredAt,
    responseTimeMs: answer.responseTimeMs,
  };
}

function getPlayerQuestionStateInternal(
  room: InternalGameRoom,
  playerId: string,
): PlayerQuestionState {
  if (!room.activeQuestion) {
    return { hasSubmitted: false };
  }

  const questionId = room.activeQuestion.question.id;
  const answers = room.answersByQuestion.get(questionId);
  const answer = answers?.get(playerId);

  const state: PlayerQuestionState = {
    questionId,
    hasSubmitted: Boolean(answer),
  };

  if (answer) {
    state.selectedOptionId = answer.selectedOptionId;
    state.answeredAt = answer.answeredAt;
    state.responseTimeMs = answer.responseTimeMs;
  }

  if (room.status === GAME_STATUS.QUESTION_RESULTS) {
    state.result = playerResultFromAnswer(room.activeQuestion.question, answer);
  }

  return state;
}

function activePlayersForQuestion(room: InternalGameRoom): InternalPlayer[] {
  if (!room.activeQuestion) {
    return [];
  }

  return room.players.filter((player) => room.activeQuestion?.activePlayerIds.has(player.id));
}

export function createRoom(): { room: GameRoom; adminSessionToken: string } {
  const code = uniqueRoomCode();
  const adminSessionToken = randomUUID();
  const room: InternalGameRoom = {
    code,
    status: GAME_STATUS.LOBBY,
    players: [],
    createdAt: new Date().toISOString(),
    adminSocketIds: new Set<string>(),
    adminSessionToken,
    questionOrder: [],
    currentQuestionIndex: -1,
    answersByQuestion: new Map<string, Map<string, PlayerAnswer>>(),
    countdown: undefined,
    activeQuestion: undefined,
    questionResults: undefined,
  };

  rooms.set(code, room);

  return {
    room: publicRoom(room),
    adminSessionToken,
  };
}

export function getRoom(roomCode: string): GameRoom | undefined {
  const room = getInternalRoom(roomCode);

  return room ? publicRoom(room) : undefined;
}

export function addAdminSocket(roomCode: string, socketId: string): GameRoom | undefined {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return undefined;
  }

  clearCleanupTimer(room.code);
  room.adminSocketIds.add(socketId);

  return publicRoom(room);
}

export function rejoinAdmin(
  roomCode: string,
  adminSessionToken: string,
  socketId: string,
): AdminSessionResult {
  const room = getInternalRoom(roomCode);

  if (!room || room.adminSessionToken !== adminSessionToken) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.REJOIN_FAILED, 'No pudimos recuperar la sala.'),
    };
  }

  clearCleanupTimer(room.code);
  room.adminSocketIds.add(socketId);

  return {
    ok: true,
    room: publicRoom(room),
    adminSessionToken: room.adminSessionToken,
  };
}

export function removeAdminSocket(roomCode: string, socketId: string): GameRoom | undefined {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return undefined;
  }

  room.adminSocketIds.delete(socketId);
  scheduleCleanupIfEmpty(room);

  return publicRoom(room);
}

export function addPlayer(
  roomCode: string,
  rawName: string,
  socketId: string,
): AddPlayerResult {
  const code = normalizeRoomCode(roomCode);
  const room = rooms.get(code);

  if (!room) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.ROOM_NOT_FOUND,
        'No encontramos una partida con ese codigo.',
      ),
    };
  }

  if (room.status !== GAME_STATUS.LOBBY) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.ROOM_NOT_JOINABLE,
        'Esta partida ya no acepta nuevos jugadores.',
      ),
    };
  }

  const name = normalizeName(rawName);

  if (!name) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.INVALID_NAME,
        'Escribe tu nombre para entrar a la partida.',
      ),
    };
  }

  if (name.length > 25) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.INVALID_NAME,
        'Tu nombre puede tener maximo 25 caracteres.',
      ),
    };
  }

  const nameAlreadyExists = room.players.some((player) => namesMatch(player.name, name));

  if (nameAlreadyExists) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.DUPLICATE_NAME,
        'Ese nombre ya esta dentro de la partida. Prueba con otro.',
      ),
    };
  }

  clearCleanupTimer(room.code);

  const player: InternalPlayer = {
    id: randomUUID(),
    name,
    connected: true,
    joinedAt: new Date().toISOString(),
    sessionToken: randomUUID(),
    socketIds: new Set<string>([socketId]),
  };

  room.players.push(player);

  return {
    ok: true,
    room: publicRoom(room),
    player: publicPlayer(player),
    playerState: getPlayerQuestionStateInternal(room, player.id),
    sessionToken: player.sessionToken,
  };
}

export function rejoinPlayer(
  roomCode: string,
  sessionToken: string,
  socketId: string,
): RejoinPlayerResult {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.ROOM_NOT_FOUND,
        'No encontramos una partida con ese codigo.',
      ),
    };
  }

  const player = room.players.find((candidate) => candidate.sessionToken === sessionToken);

  if (!player) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.REJOIN_FAILED, 'No pudimos recuperar tu entrada.'),
    };
  }

  clearCleanupTimer(room.code);
  player.socketIds.add(socketId);
  player.connected = true;

  return {
    ok: true,
    room: publicRoom(room),
    player: publicPlayer(player),
    playerState: getPlayerQuestionStateInternal(room, player.id),
    sessionToken: player.sessionToken,
  };
}

export function markPlayerDisconnected(
  roomCode: string,
  playerId: string,
  socketId: string,
): { room: GameRoom; playerId: string; disconnected: boolean } | undefined {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return undefined;
  }

  const player = getInternalPlayer(room, playerId);

  if (!player) {
    return undefined;
  }

  player.socketIds.delete(socketId);
  player.connected = player.socketIds.size > 0;
  scheduleCleanupIfEmpty(room);

  return {
    room: publicRoom(room),
    playerId: player.id,
    disconnected: !player.connected,
  };
}

export function startGame(roomCode: string, socketId: string): GameControlResult {
  const adminResult = assertAdminRoom(roomCode, socketId);

  if (!adminResult.ok) {
    return adminResult;
  }

  const { room } = adminResult;

  if (room.status !== GAME_STATUS.LOBBY) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.GAME_ALREADY_STARTED,
        'La partida ya salio del lobby.',
      ),
    };
  }

  const connectedPlayers = room.players.filter((player) => player.connected);

  if (connectedPlayers.length === 0) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.NO_PLAYERS,
        'Necesitas al menos un jugador conectado para iniciar.',
      ),
    };
  }

  room.questionOrder = shuffledQuestions();
  room.currentQuestionIndex = 0;
  room.status = GAME_STATUS.COUNTDOWN;
  room.countdown = makeCountdown(room);
  room.activeQuestion = undefined;
  room.questionResults = undefined;

  return {
    ok: true,
    room: publicRoom(room),
  };
}

export function beginQuestion(roomCode: string): BeginQuestionResult {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.ROOM_NOT_FOUND,
        'No encontramos una partida con ese codigo.',
      ),
    };
  }

  if (room.status !== GAME_STATUS.COUNTDOWN) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.QUESTION_NOT_ACTIVE, 'La pregunta aun no esta lista.'),
    };
  }

  const question = room.questionOrder[room.currentQuestionIndex];

  if (!question) {
    room.status = GAME_STATUS.FINISHED;
    room.countdown = undefined;
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.NO_MORE_QUESTIONS, 'Ya no hay mas preguntas.'),
    };
  }

  const startedAtMs = Date.now();
  const activePlayerIds = new Set(
    room.players.filter((player) => player.connected).map((player) => player.id),
  );

  room.status = GAME_STATUS.QUESTION_ACTIVE;
  room.countdown = undefined;
  room.questionResults = undefined;
  room.activeQuestion = {
    question,
    publicQuestion: makePublicQuestion(
      question,
      startedAtMs,
      room.currentQuestionIndex + 1,
      room.questionOrder.length,
    ),
    startedAtMs,
    expiresAtMs: startedAtMs + question.timeLimitSeconds * 1000,
    activePlayerIds,
  };
  room.answersByQuestion.set(question.id, new Map<string, PlayerAnswer>());

  return {
    ok: true,
    room: publicRoom(room),
    question: room.activeQuestion.publicQuestion,
    answerSummary: answerSummary(room) ?? { answeredCount: 0, activePlayerCount: 0 },
  };
}

export function submitAnswer(
  roomCode: string,
  playerId: string,
  socketId: string,
  payload: AnswerSubmitPayload,
): SubmitAnswerResult {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.ROOM_NOT_FOUND,
        'No encontramos una partida con ese codigo.',
      ),
    };
  }

  const player = getInternalPlayer(room, playerId);

  if (!player || !player.connected || !player.socketIds.has(socketId)) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.REJOIN_FAILED, 'No pudimos validar tu conexion.'),
    };
  }

  if (!room.activeQuestion || room.status !== GAME_STATUS.QUESTION_ACTIVE) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.QUESTION_NOT_ACTIVE, 'No hay una pregunta activa.'),
    };
  }

  const { question, activePlayerIds, expiresAtMs, startedAtMs } = room.activeQuestion;

  if (!activePlayerIds.has(player.id)) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.QUESTION_NOT_ACTIVE,
        'No estabas activo al iniciar esta pregunta.',
      ),
    };
  }

  if (payload.roomCode.trim().toUpperCase() !== room.code || payload.questionId !== question.id) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.QUESTION_NOT_FOUND, 'La pregunta ya cambio.'),
    };
  }

  const now = Date.now();

  if (now > expiresAtMs) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.QUESTION_EXPIRED, 'El tiempo de respuesta termino.'),
    };
  }

  const selectedOption = question.options.find(
    (option) => option.id === payload.selectedOptionId,
  );

  if (!selectedOption) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.INVALID_OPTION, 'Esa opcion no existe.'),
    };
  }

  const answers = getAnswerMap(room, question.id);

  if (answers.has(player.id)) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.ANSWER_ALREADY_SUBMITTED,
        'Tu respuesta ya estaba registrada.',
      ),
    };
  }

  const answer: PlayerAnswer = {
    playerId: player.id,
    questionId: question.id,
    selectedOptionId: selectedOption.id,
    correct: selectedOption.id === question.correctOptionId,
    answeredAt: new Date(now).toISOString(),
    responseTimeMs: Math.max(0, now - startedAtMs),
  };

  answers.set(player.id, answer);

  const playerState = getPlayerQuestionStateInternal(room, player.id);

  return {
    ok: true,
    room: publicRoom(room),
    accepted: {
      questionId: question.id,
      selectedOptionId: selectedOption.id,
      answeredAt: answer.answeredAt,
      responseTimeMs: answer.responseTimeMs,
      playerState,
    },
    shouldEndQuestion: answers.size >= activePlayerIds.size,
  };
}

export function endQuestion(roomCode: string): EndQuestionResult {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.ROOM_NOT_FOUND,
        'No encontramos una partida con ese codigo.',
      ),
    };
  }

  if (!room.activeQuestion) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.QUESTION_NOT_ACTIVE, 'No hay una pregunta activa.'),
    };
  }

  if (room.status === GAME_STATUS.QUESTION_RESULTS && room.questionResults) {
    return {
      ok: true,
      room: publicRoom(room),
      results: room.questionResults,
      playerResults: activePlayersForQuestion(room).map((player) =>
        getPlayerQuestionStateInternal(room, player.id).result!,
      ),
    };
  }

  const { question, activePlayerIds } = room.activeQuestion;
  const answers = getAnswerMap(room, question.id);
  const distribution = question.options.map((option) => ({
    optionId: option.id,
    count: Array.from(answers.values()).filter(
      (answer) =>
        activePlayerIds.has(answer.playerId) && answer.selectedOptionId === option.id,
    ).length,
  }));
  const correctCount = Array.from(answers.values()).filter(
    (answer) => activePlayerIds.has(answer.playerId) && answer.correct,
  ).length;
  const answeredCount = Array.from(answers.values()).filter((answer) =>
    activePlayerIds.has(answer.playerId),
  ).length;
  const incorrectCount = answeredCount - correctCount;
  const unansweredCount = Math.max(0, activePlayerIds.size - answeredCount);
  const correctOption = question.options.find((option) => option.id === question.correctOptionId);

  room.status = GAME_STATUS.QUESTION_RESULTS;
  room.countdown = undefined;
  room.questionResults = {
    questionId: question.id,
    questionNumber: room.currentQuestionIndex + 1,
    totalQuestions: room.questionOrder.length,
    correctOptionId: question.correctOptionId,
    correctOptionText: correctOption?.text ?? '',
    correctCount,
    incorrectCount,
    unansweredCount,
    accuracyPercent:
      activePlayerIds.size > 0 ? Math.round((correctCount / activePlayerIds.size) * 100) : 0,
    distribution,
  };

  return {
    ok: true,
    room: publicRoom(room),
    results: room.questionResults,
    playerResults: activePlayersForQuestion(room).map((player) =>
      getPlayerQuestionStateInternal(room, player.id).result!,
    ),
  };
}

export function requestNextQuestion(roomCode: string, socketId: string): GameControlResult {
  const adminResult = assertAdminRoom(roomCode, socketId);

  if (!adminResult.ok) {
    return adminResult;
  }

  const { room } = adminResult;

  if (room.status !== GAME_STATUS.QUESTION_RESULTS) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.QUESTION_RESULTS_NOT_READY,
        'Primero deben mostrarse los resultados de la pregunta actual.',
      ),
    };
  }

  const nextIndex = room.currentQuestionIndex + 1;

  if (nextIndex >= room.questionOrder.length) {
    room.status = GAME_STATUS.FINISHED;
    room.countdown = undefined;
    room.activeQuestion = undefined;

    return {
      ok: true,
      room: publicRoom(room),
    };
  }

  room.currentQuestionIndex = nextIndex;
  room.status = GAME_STATUS.COUNTDOWN;
  room.countdown = makeCountdown(room);
  room.activeQuestion = undefined;
  room.questionResults = undefined;

  return {
    ok: true,
    room: publicRoom(room),
  };
}

export function getPlayerSocketIds(roomCode: string, playerId: string): string[] {
  const room = getInternalRoom(roomCode);

  if (!room) {
    return [];
  }

  const player = getInternalPlayer(room, playerId);

  return player ? Array.from(player.socketIds) : [];
}

export function getAdminSocketIds(roomCode: string): string[] {
  const room = getInternalRoom(roomCode);

  return room ? Array.from(room.adminSocketIds) : [];
}

export function getPlayerQuestionState(
  roomCode: string,
  playerId: string,
): PlayerQuestionState | undefined {
  const room = getInternalRoom(roomCode);

  if (!room || !getInternalPlayer(room, playerId)) {
    return undefined;
  }

  return getPlayerQuestionStateInternal(room, playerId);
}
