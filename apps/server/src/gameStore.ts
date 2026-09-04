import { randomInt, randomUUID } from 'node:crypto';

import {
  BOARD_MAX_POSITION,
  BOARD_SPECIALS,
  GAME_STATUS,
  PLAYER_RESULT_STATUS,
  ROOM_ERROR_CODES,
  type AnswerAcceptedSuccess,
  type AnswerSubmitPayload,
  type BoardSpecial,
  type BoardState,
  type CountdownState,
  type DicePlayerState,
  type DiceState,
  type DiceSummary,
  type DiceValue,
  type FinalLeaderboardEntry,
  type GameWinner,
  type GameRoom,
  type Player,
  type PlayerAnswer,
  type PlayerMove,
  type PlayerQuestionResult,
  type PlayerQuestionState,
  type PublicQuestion,
  type Question,
  type QuestionAnswerSummary,
  type QuestionResults,
  type RoomError,
  type RoundResult,
  type SpecialMove,
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
  id: string;
  question: Question;
  publicQuestion: PublicQuestion;
  questionNumber: number;
  cycleNumber: number;
  roundNumber: number;
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
  questionCycleNumber: number;
  currentRoundNumber: number;
  answersByQuestion: Map<string, Map<string, PlayerAnswer>>;
  diceStatesByQuestion: Map<string, Map<string, DiceState>>;
  roundResults: RoundResult[];
  countdown: CountdownState | undefined;
  activeQuestion: ActiveQuestion | undefined;
  questionResults: QuestionResults | undefined;
  winner: GameWinner | undefined;
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

type StartDicePhaseResult = StoreResult<{
  room: GameRoom;
  diceSummary: DiceSummary;
  dicePlayers: DicePlayerState[];
}>;

type RollDiceResult = StoreResult<{
  room: GameRoom;
  value: DiceValue;
  diceState: DiceState;
  playerState: PlayerQuestionState;
  move: PlayerMove;
  diceSummary: DiceSummary;
  shouldCompleteDicePhase: boolean;
  finished: boolean;
}>;

interface ResolvedBoardMove {
  rollLandingPosition: number;
  specialMove: SpecialMove | null;
  finalPosition: number;
}

export interface WinnerCandidateSnapshot {
  playerId: string;
  playerName: string;
  position: number;
  joinedAt: string;
  roundNumber: number;
  cycleNumber: number;
  responseTimeMs: number | null;
}

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
    position: player.position,
  };
}

function publicBoardSpecials(): BoardSpecial[] {
  return BOARD_SPECIALS.map((special) => ({ ...special }));
}

function boardState(room: InternalGameRoom): BoardState {
  return {
    maxPosition: BOARD_MAX_POSITION,
    players: room.players.map((player) => ({
      playerId: player.id,
      name: player.name,
      connected: player.connected,
      position: player.position,
    })),
    specials: publicBoardSpecials(),
  };
}

function finalLeaderboard(room: InternalGameRoom): FinalLeaderboardEntry[] {
  const winnerId = room.winner?.playerId;
  const orderedPlayers = [...room.players].sort((left, right) => {
    if (left.id === winnerId) {
      return -1;
    }

    if (right.id === winnerId) {
      return 1;
    }

    if (right.position !== left.position) {
      return right.position - left.position;
    }

    const joinedDelta = new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();

    if (joinedDelta !== 0) {
      return joinedDelta;
    }

    return left.id.localeCompare(right.id);
  });

  return orderedPlayers.map((player, index) => ({
    rank: index + 1,
    playerId: player.id,
    playerName: player.name,
    position: player.position,
    connected: player.connected,
  }));
}

function answerSummary(room: InternalGameRoom): QuestionAnswerSummary | undefined {
  if (!room.activeQuestion) {
    return undefined;
  }

  const answers = room.answersByQuestion.get(room.activeQuestion.id);

  return {
    answeredCount: answers?.size ?? 0,
    activePlayerCount: room.activeQuestion.activePlayerIds.size,
  };
}

function getDiceMap(
  room: InternalGameRoom,
  questionId: string,
): Map<string, DiceState> | undefined {
  return room.diceStatesByQuestion.get(questionId);
}

function diceStateForPlayer(room: InternalGameRoom, playerId: string): DiceState | undefined {
  if (
    !room.activeQuestion ||
    (room.status !== GAME_STATUS.DICE_ROLL && room.status !== GAME_STATUS.FINISHED)
  ) {
    return undefined;
  }

  const diceState = getDiceMap(room, room.activeQuestion.id)?.get(playerId);

  return diceState ? { ...diceState } : undefined;
}

function diceSummary(room: InternalGameRoom): DiceSummary | undefined {
  if (
    !room.activeQuestion ||
    (room.status !== GAME_STATUS.DICE_ROLL && room.status !== GAME_STATUS.FINISHED)
  ) {
    return undefined;
  }

  const diceStates = getDiceMap(room, room.activeQuestion.id);

  if (!diceStates) {
    return undefined;
  }

  const states = Array.from(diceStates.values());
  const eligibleCount = states.filter((state) => state.eligible).length;
  const rolledCount = states.filter((state) => state.eligible && state.rolled).length;

  return {
    eligibleCount,
    rolledCount,
    complete: rolledCount >= eligibleCount,
  };
}

function publicDicePlayers(room: InternalGameRoom): DicePlayerState[] | undefined {
  if (
    !room.activeQuestion ||
    (room.status !== GAME_STATUS.DICE_ROLL && room.status !== GAME_STATUS.FINISHED)
  ) {
    return undefined;
  }

  const activeQuestion = room.activeQuestion;
  const { question } = activeQuestion;
  const questionId = room.activeQuestion.id;
  const diceStates = getDiceMap(room, questionId);
  const answers = room.answersByQuestion.get(questionId);

  if (!diceStates) {
    return undefined;
  }

  return room.players.map((player) => {
    const diceState =
      diceStates.get(player.id) ??
      ({
        eligible: false,
        rolled: false,
        value: null,
      } satisfies DiceState);
    const result = playerResultFromAnswer(question, questionId, answers?.get(player.id));

    return {
      playerId: player.id,
      playerName: player.name,
      connected: player.connected,
      resultStatus: result.status,
      eligible: diceState.eligible,
      rolled: diceState.rolled,
      value: diceState.value,
    };
  });
}

function publicRoom(room: InternalGameRoom): GameRoom {
  const result: GameRoom = {
    code: room.code,
    status: room.status,
    createdAt: room.createdAt,
    players: room.players.map(publicPlayer),
  };
  const questionVisibleStatuses = new Set<GameRoom['status']>([
    GAME_STATUS.QUESTION_ACTIVE,
    GAME_STATUS.QUESTION_RESULTS,
    GAME_STATUS.DICE_ROLL,
    GAME_STATUS.FINISHED,
  ]);
  const resultsVisibleStatuses = new Set<GameRoom['status']>([
    GAME_STATUS.QUESTION_RESULTS,
    GAME_STATUS.DICE_ROLL,
    GAME_STATUS.FINISHED,
  ]);

  if (room.status === GAME_STATUS.COUNTDOWN && room.countdown) {
    result.countdown = { ...room.countdown };
  }

  if (questionVisibleStatuses.has(room.status) && room.activeQuestion) {
    result.currentQuestion = {
      ...room.activeQuestion.publicQuestion,
      options: room.activeQuestion.publicQuestion.options.map((option) => ({ ...option })),
    };
  }

  const summary = answerSummary(room);

  if (summary) {
    result.answerSummary = summary;
  }

  if (resultsVisibleStatuses.has(room.status) && room.questionResults) {
    result.questionResults = {
      ...room.questionResults,
      distribution: room.questionResults.distribution.map((item) => ({ ...item })),
    };
  }

  const currentDiceSummary = diceSummary(room);
  const currentDicePlayers = publicDicePlayers(room);

  if (currentDiceSummary) {
    result.diceSummary = currentDiceSummary;
  }

  if (currentDicePlayers) {
    result.dicePlayers = currentDicePlayers;
  }

  if (room.status !== GAME_STATUS.LOBBY) {
    result.boardState = boardState(room);
  }

  if (room.winner) {
    result.winner = { ...room.winner };
    result.finalLeaderboard = finalLeaderboard(room);
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

function shuffledQuestions(previousLastQuestionId?: string): Question[] {
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

  if (previousLastQuestionId && pool.length > 1 && pool[0]?.id === previousLastQuestionId) {
    const replacementIndex = pool.findIndex((question) => question.id !== previousLastQuestionId);

    if (replacementIndex > 0) {
      const first = pool[0]!;
      pool[0] = pool[replacementIndex]!;
      pool[replacementIndex] = first;
    }
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

function getInternalPlayer(room: InternalGameRoom, playerId: string): InternalPlayer | undefined {
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
    cycleNumber: room.questionCycleNumber,
    roundNumber: room.currentRoundNumber,
  };
}

function makePublicQuestion(
  question: Question,
  questionId: string,
  startedAtMs: number,
  questionNumber: number,
  totalQuestions: number,
  cycleNumber: number,
  roundNumber: number,
): PublicQuestion {
  const expiresAtMs = startedAtMs + question.timeLimitSeconds * 1000;

  return {
    id: questionId,
    text: question.text,
    options: question.options.map((option) => ({ ...option })),
    category: question.category,
    difficulty: question.difficulty,
    timeLimitSeconds: question.timeLimitSeconds,
    startedAt: new Date(startedAtMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString(),
    questionNumber,
    totalQuestions,
    cycleNumber,
    roundNumber,
  };
}

function roundQuestionId(question: Question, cycleNumber: number, roundNumber: number): string {
  return `${question.id}:cycle-${cycleNumber}:round-${roundNumber}`;
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
  questionId: string,
  answer: PlayerAnswer | undefined,
): PlayerQuestionResult {
  const correctOption = question.options.find((option) => option.id === question.correctOptionId);
  const correctOptionText = correctOption?.text ?? '';

  if (!answer) {
    return {
      questionId,
      status: PLAYER_RESULT_STATUS.TIMEOUT,
      correctOptionId: question.correctOptionId,
      correctOptionText,
      correct: false,
    };
  }

  return {
    questionId,
    status: answer.correct ? PLAYER_RESULT_STATUS.CORRECT : PLAYER_RESULT_STATUS.INCORRECT,
    correctOptionId: question.correctOptionId,
    correctOptionText,
    correct: answer.correct,
    selectedOptionId: answer.selectedOptionId,
    answeredAt: answer.answeredAt,
    responseTimeMs: answer.responseTimeMs,
  };
}

function randomDiceValue(): DiceValue {
  return randomInt(1, 7) as DiceValue;
}

export function calculateNextPosition(currentPosition: number, diceValue: DiceValue): number {
  return Math.min(currentPosition + diceValue, BOARD_MAX_POSITION);
}

export function resolveBoardMove(currentPosition: number, diceValue: DiceValue): ResolvedBoardMove {
  const rollLandingPosition = calculateNextPosition(currentPosition, diceValue);
  const special = BOARD_SPECIALS.find((candidate) => candidate.from === rollLandingPosition);
  const specialMove = special ? { ...special } : null;

  return {
    rollLandingPosition,
    specialMove,
    finalPosition: specialMove?.to ?? rollLandingPosition,
  };
}

function candidateReachedGoal(result: RoundResult): boolean {
  return (
    result.diceValue !== null &&
    result.positionBefore < BOARD_MAX_POSITION &&
    result.positionAfter === BOARD_MAX_POSITION
  );
}

function compareWinnerCandidateSnapshots(
  left: WinnerCandidateSnapshot,
  right: WinnerCandidateSnapshot,
): number {
  const leftResponseTime = left.responseTimeMs ?? Number.POSITIVE_INFINITY;
  const rightResponseTime = right.responseTimeMs ?? Number.POSITIVE_INFINITY;

  if (leftResponseTime !== rightResponseTime) {
    return leftResponseTime - rightResponseTime;
  }

  const joinedDelta = new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();

  if (Number.isFinite(joinedDelta) && joinedDelta !== 0) {
    return joinedDelta;
  }

  return left.playerId.localeCompare(right.playerId);
}

export function selectGameWinner(
  candidates: readonly WinnerCandidateSnapshot[],
): GameWinner | undefined {
  const winner = [...candidates].sort(compareWinnerCandidateSnapshots)[0];

  if (!winner) {
    return undefined;
  }

  return {
    playerId: winner.playerId,
    playerName: winner.playerName,
    position: winner.position,
    roundNumber: winner.roundNumber,
    cycleNumber: winner.cycleNumber,
    responseTimeMs: winner.responseTimeMs,
  };
}

function finishGameIfWinner(room: InternalGameRoom): boolean {
  if (!room.activeQuestion || room.winner) {
    return Boolean(room.winner);
  }

  const candidates = room.roundResults.flatMap((result) => {
    if (result.questionId !== room.activeQuestion?.id || !candidateReachedGoal(result)) {
      return [];
    }

    const player = getInternalPlayer(room, result.playerId);

    if (!player) {
      return [];
    }

    return [
      {
        playerId: player.id,
        playerName: player.name,
        position: player.position,
        joinedAt: player.joinedAt,
        roundNumber: result.roundNumber,
        cycleNumber: result.cycleNumber,
        responseTimeMs: result.responseTimeMs,
      },
    ];
  });
  const winner = selectGameWinner(candidates);

  if (!winner) {
    return false;
  }

  room.status = GAME_STATUS.FINISHED;
  room.countdown = undefined;
  room.winner = winner;

  return true;
}

function upsertRoundResult(
  room: InternalGameRoom,
  activeQuestion: ActiveQuestion,
  playerId: string,
  result: PlayerQuestionResult,
): RoundResult {
  let roundResult = room.roundResults.find(
    (candidate) => candidate.questionId === activeQuestion.id && candidate.playerId === playerId,
  );

  if (!roundResult) {
    const position = getInternalPlayer(room, playerId)?.position ?? 0;

    roundResult = {
      questionId: activeQuestion.id,
      baseQuestionId: activeQuestion.question.id,
      cycleNumber: activeQuestion.cycleNumber,
      roundNumber: activeQuestion.roundNumber,
      playerId,
      resultStatus: result.status,
      correct: result.correct,
      responseTimeMs: result.responseTimeMs ?? null,
      diceValue: null,
      rollLandingPosition: null,
      specialMove: null,
      positionBefore: position,
      positionAfter: position,
    };
    room.roundResults.push(roundResult);
    return roundResult;
  }

  roundResult.resultStatus = result.status;
  roundResult.correct = result.correct;
  roundResult.responseTimeMs = result.responseTimeMs ?? null;

  return roundResult;
}

function getPlayerQuestionStateInternal(
  room: InternalGameRoom,
  playerId: string,
): PlayerQuestionState {
  if (!room.activeQuestion) {
    return { hasSubmitted: false };
  }

  const questionId = room.activeQuestion.id;
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

  if (
    room.status === GAME_STATUS.QUESTION_RESULTS ||
    room.status === GAME_STATUS.DICE_ROLL ||
    room.status === GAME_STATUS.FINISHED
  ) {
    state.result = playerResultFromAnswer(room.activeQuestion.question, questionId, answer);
  }

  const diceState = diceStateForPlayer(room, playerId);

  if (diceState) {
    state.dice = diceState;
  }

  const roundResult = room.roundResults.find(
    (candidate) => candidate.questionId === questionId && candidate.playerId === playerId,
  );

  if (roundResult?.diceValue !== null && roundResult?.diceValue !== undefined) {
    const player = getInternalPlayer(room, playerId);

    if (player) {
      state.move = {
        playerId,
        playerName: player.name,
        fromPosition: roundResult.positionBefore,
        diceValue: roundResult.diceValue,
        rollLandingPosition: roundResult.rollLandingPosition ?? roundResult.positionAfter,
        specialMove: roundResult.specialMove,
        finalPosition: roundResult.positionAfter,
        questionId,
        cycleNumber: room.activeQuestion.cycleNumber,
        roundNumber: room.activeQuestion.roundNumber,
      };
    }
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
    questionCycleNumber: 0,
    currentRoundNumber: 0,
    answersByQuestion: new Map<string, Map<string, PlayerAnswer>>(),
    diceStatesByQuestion: new Map<string, Map<string, DiceState>>(),
    roundResults: [],
    countdown: undefined,
    activeQuestion: undefined,
    questionResults: undefined,
    winner: undefined,
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

export function getBoardState(roomCode: string): BoardState | undefined {
  const room = getInternalRoom(roomCode);

  return room ? boardState(room) : undefined;
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

export function addPlayer(roomCode: string, rawName: string, socketId: string): AddPlayerResult {
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
    position: 0,
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
      error: roomError(ROOM_ERROR_CODES.GAME_ALREADY_STARTED, 'La partida ya salio del lobby.'),
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

  room.questionCycleNumber = 1;
  room.currentRoundNumber = 1;
  room.questionOrder = shuffledQuestions();
  room.currentQuestionIndex = 0;
  room.answersByQuestion.clear();
  room.diceStatesByQuestion.clear();
  room.roundResults = [];
  room.status = GAME_STATUS.COUNTDOWN;
  room.countdown = makeCountdown(room);
  room.activeQuestion = undefined;
  room.questionResults = undefined;
  room.winner = undefined;

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
  const questionNumber = room.currentQuestionIndex + 1;
  const totalQuestions = room.questionOrder.length;
  const questionId = roundQuestionId(question, room.questionCycleNumber, room.currentRoundNumber);

  room.status = GAME_STATUS.QUESTION_ACTIVE;
  room.countdown = undefined;
  room.questionResults = undefined;
  room.activeQuestion = {
    id: questionId,
    question,
    questionNumber,
    cycleNumber: room.questionCycleNumber,
    roundNumber: room.currentRoundNumber,
    publicQuestion: makePublicQuestion(
      question,
      questionId,
      startedAtMs,
      questionNumber,
      totalQuestions,
      room.questionCycleNumber,
      room.currentRoundNumber,
    ),
    startedAtMs,
    expiresAtMs: startedAtMs + question.timeLimitSeconds * 1000,
    activePlayerIds,
  };
  room.answersByQuestion.set(questionId, new Map<string, PlayerAnswer>());

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

  const activeQuestion = room.activeQuestion;
  const { question, activePlayerIds, expiresAtMs, startedAtMs } = activeQuestion;

  if (!activePlayerIds.has(player.id)) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.QUESTION_NOT_ACTIVE,
        'No estabas activo al iniciar esta pregunta.',
      ),
    };
  }

  if (
    payload.roomCode.trim().toUpperCase() !== room.code ||
    payload.questionId !== activeQuestion.id
  ) {
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

  const selectedOption = question.options.find((option) => option.id === payload.selectedOptionId);

  if (!selectedOption) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.INVALID_OPTION, 'Esa opcion no existe.'),
    };
  }

  const answers = getAnswerMap(room, activeQuestion.id);

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
    questionId: activeQuestion.id,
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
      questionId: activeQuestion.id,
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
      playerResults: activePlayersForQuestion(room).map(
        (player) => getPlayerQuestionStateInternal(room, player.id).result!,
      ),
    };
  }

  const activeQuestion = room.activeQuestion;
  const { question, activePlayerIds } = activeQuestion;
  const answers = getAnswerMap(room, activeQuestion.id);
  const distribution = question.options.map((option) => ({
    optionId: option.id,
    count: Array.from(answers.values()).filter(
      (answer) => activePlayerIds.has(answer.playerId) && answer.selectedOptionId === option.id,
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
    questionId: activeQuestion.id,
    questionNumber: activeQuestion.questionNumber,
    totalQuestions: room.questionOrder.length,
    cycleNumber: activeQuestion.cycleNumber,
    roundNumber: activeQuestion.roundNumber,
    correctOptionId: question.correctOptionId,
    correctOptionText: correctOption?.text ?? '',
    correctCount,
    incorrectCount,
    unansweredCount,
    accuracyPercent:
      activePlayerIds.size > 0 ? Math.round((correctCount / activePlayerIds.size) * 100) : 0,
    distribution,
  };

  for (const player of activePlayersForQuestion(room)) {
    const result = playerResultFromAnswer(question, activeQuestion.id, answers.get(player.id));
    upsertRoundResult(room, activeQuestion, player.id, result);
  }

  return {
    ok: true,
    room: publicRoom(room),
    results: room.questionResults,
    playerResults: activePlayersForQuestion(room).map(
      (player) => getPlayerQuestionStateInternal(room, player.id).result!,
    ),
  };
}

export function startDicePhase(roomCode: string, socketId: string): StartDicePhaseResult {
  const adminResult = assertAdminRoom(roomCode, socketId);

  if (!adminResult.ok) {
    return adminResult;
  }

  const { room } = adminResult;

  if (room.status === GAME_STATUS.FINISHED || room.winner) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.INVALID_PHASE, 'La partida ya termino.'),
    };
  }

  if (room.status === GAME_STATUS.DICE_ROLL) {
    const currentDiceSummary = diceSummary(room);
    const currentDicePlayers = publicDicePlayers(room);

    if (currentDiceSummary && currentDicePlayers) {
      return {
        ok: true,
        room: publicRoom(room),
        diceSummary: currentDiceSummary,
        dicePlayers: currentDicePlayers,
      };
    }
  }

  if (
    room.status !== GAME_STATUS.QUESTION_RESULTS ||
    !room.activeQuestion ||
    !room.questionResults
  ) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.INVALID_PHASE,
        'Primero deben mostrarse los resultados de la pregunta.',
      ),
    };
  }

  const activeQuestion = room.activeQuestion;
  const { question } = activeQuestion;
  const answers = room.answersByQuestion.get(activeQuestion.id);
  const diceStates = new Map<string, DiceState>();

  for (const player of activePlayersForQuestion(room)) {
    const result = playerResultFromAnswer(question, activeQuestion.id, answers?.get(player.id));
    upsertRoundResult(room, activeQuestion, player.id, result);
    diceStates.set(player.id, {
      eligible: result.status === PLAYER_RESULT_STATUS.CORRECT,
      rolled: false,
      value: null,
    });
  }

  room.status = GAME_STATUS.DICE_ROLL;
  room.diceStatesByQuestion.set(activeQuestion.id, diceStates);

  return {
    ok: true,
    room: publicRoom(room),
    diceSummary: diceSummary(room) ?? { eligibleCount: 0, rolledCount: 0, complete: true },
    dicePlayers: publicDicePlayers(room) ?? [],
  };
}

export function rollDice(roomCode: string, playerId: string, socketId: string): RollDiceResult {
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

  if (room.status === GAME_STATUS.FINISHED || room.winner) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.INVALID_PHASE, 'La partida ya termino.'),
    };
  }

  const player = getInternalPlayer(room, playerId);

  if (!player || !player.socketIds.has(socketId)) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.PLAYER_NOT_FOUND, 'No pudimos validar tu jugador.'),
    };
  }

  if (room.status !== GAME_STATUS.DICE_ROLL || !room.activeQuestion) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.INVALID_PHASE, 'El dado no esta habilitado ahora.'),
    };
  }

  const activeQuestion = room.activeQuestion;
  const { question } = activeQuestion;
  const diceStates = getDiceMap(room, activeQuestion.id);
  const diceState = diceStates?.get(player.id);

  if (!diceStates || !diceState || !diceState.eligible) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.DICE_NOT_ALLOWED, 'No puedes lanzar el dado esta ronda.'),
    };
  }

  if (diceState.rolled) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.ALREADY_ROLLED, 'Ya lanzaste tu dado esta ronda.'),
    };
  }

  const value = randomDiceValue();
  diceState.rolled = true;
  diceState.value = value;

  const fromPosition = player.position;
  const { rollLandingPosition, specialMove, finalPosition } = resolveBoardMove(fromPosition, value);
  player.position = finalPosition;

  const answer = room.answersByQuestion.get(activeQuestion.id)?.get(player.id);
  const questionResult = playerResultFromAnswer(question, activeQuestion.id, answer);
  const roundResult = upsertRoundResult(room, activeQuestion, player.id, questionResult);
  roundResult.diceValue = value;
  roundResult.rollLandingPosition = rollLandingPosition;
  roundResult.specialMove = specialMove;
  roundResult.positionBefore = fromPosition;
  roundResult.positionAfter = finalPosition;

  const move: PlayerMove = {
    playerId: player.id,
    playerName: player.name,
    fromPosition,
    diceValue: value,
    rollLandingPosition,
    specialMove,
    finalPosition,
    questionId: activeQuestion.id,
    cycleNumber: activeQuestion.cycleNumber,
    roundNumber: activeQuestion.roundNumber,
  };

  const currentDiceSummary = diceSummary(room) ?? {
    eligibleCount: 0,
    rolledCount: 0,
    complete: true,
  };
  const finished = currentDiceSummary.complete ? finishGameIfWinner(room) : false;
  const playerState = getPlayerQuestionStateInternal(room, player.id);

  return {
    ok: true,
    room: publicRoom(room),
    value,
    diceState: { ...diceState },
    playerState,
    move,
    diceSummary: currentDiceSummary,
    shouldCompleteDicePhase: currentDiceSummary.complete,
    finished,
  };
}

export function requestNextQuestion(roomCode: string, socketId: string): GameControlResult {
  const adminResult = assertAdminRoom(roomCode, socketId);

  if (!adminResult.ok) {
    return adminResult;
  }

  const { room } = adminResult;

  if (room.status === GAME_STATUS.FINISHED || room.winner) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.INVALID_PHASE, 'La partida ya termino.'),
    };
  }

  if (room.status !== GAME_STATUS.DICE_ROLL) {
    return {
      ok: false,
      error: roomError(
        ROOM_ERROR_CODES.DICE_PHASE_NOT_COMPLETE,
        'Primero habilita y completa la fase de dados.',
      ),
    };
  }

  const currentDiceSummary = diceSummary(room);

  if (!currentDiceSummary?.complete) {
    return {
      ok: false,
      error: roomError(ROOM_ERROR_CODES.DICE_PHASE_NOT_COMPLETE, 'Aun faltan dados por lanzar.'),
    };
  }

  const nextIndex = room.currentQuestionIndex + 1;

  if (nextIndex >= room.questionOrder.length) {
    const previousLastQuestionId =
      room.activeQuestion?.question.id ?? room.questionOrder[room.currentQuestionIndex]?.id;

    room.questionCycleNumber += 1;
    room.questionOrder = shuffledQuestions(previousLastQuestionId);
    room.currentQuestionIndex = 0;
  } else {
    room.currentQuestionIndex = nextIndex;
  }

  room.currentRoundNumber += 1;
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
