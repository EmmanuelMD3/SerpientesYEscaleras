export const GAME_STATUS = {
  LOBBY: 'LOBBY',
  COUNTDOWN: 'COUNTDOWN',
  QUESTION_ACTIVE: 'QUESTION_ACTIVE',
  QUESTION_RESULTS: 'QUESTION_RESULTS',
  DICE_ROLL: 'DICE_ROLL',
  FINISHED: 'FINISHED',
} as const;

export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

export const QUESTION_DIFFICULTY = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;

export type QuestionDifficulty =
  (typeof QUESTION_DIFFICULTY)[keyof typeof QUESTION_DIFFICULTY];

export const PLAYER_RESULT_STATUS = {
  CORRECT: 'CORRECT',
  INCORRECT: 'INCORRECT',
  TIMEOUT: 'TIMEOUT',
} as const;

export type PlayerResultStatus =
  (typeof PLAYER_RESULT_STATUS)[keyof typeof PLAYER_RESULT_STATUS];

export type DiceValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: string;
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
  correctOptionId: string;
  category: string;
  difficulty: QuestionDifficulty;
  timeLimitSeconds: number;
}

export interface PublicQuestion {
  id: string;
  text: string;
  options: QuestionOption[];
  category: string;
  difficulty: QuestionDifficulty;
  timeLimitSeconds: number;
  startedAt: string;
  expiresAt: string;
  questionNumber: number;
  totalQuestions: number;
}

export interface CountdownState {
  endsAt: string;
  nextQuestionNumber: number;
  totalQuestions: number;
}

export interface QuestionAnswerSummary {
  answeredCount: number;
  activePlayerCount: number;
}

export interface QuestionOptionResult {
  optionId: string;
  count: number;
}

export interface QuestionResults {
  questionId: string;
  questionNumber: number;
  totalQuestions: number;
  correctOptionId: string;
  correctOptionText: string;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  accuracyPercent: number;
  distribution: QuestionOptionResult[];
}

export interface PlayerAnswer {
  playerId: string;
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
  answeredAt: string;
  responseTimeMs: number;
}

export interface PlayerQuestionResult {
  questionId: string;
  status: PlayerResultStatus;
  correctOptionId: string;
  correctOptionText: string;
  correct: boolean;
  selectedOptionId?: string;
  answeredAt?: string;
  responseTimeMs?: number;
}

export interface DiceState {
  eligible: boolean;
  rolled: boolean;
  value: DiceValue | null;
}

export interface DicePlayerState extends DiceState {
  playerId: string;
  playerName: string;
  connected: boolean;
  resultStatus: PlayerResultStatus;
}

export interface DiceSummary {
  eligibleCount: number;
  rolledCount: number;
  complete: boolean;
}

export interface RoundResult {
  questionId: string;
  playerId: string;
  resultStatus: PlayerResultStatus;
  correct: boolean;
  responseTimeMs: number | null;
  diceValue: DiceValue | null;
}

export interface PlayerQuestionState {
  questionId?: string;
  hasSubmitted: boolean;
  selectedOptionId?: string;
  answeredAt?: string;
  responseTimeMs?: number;
  result?: PlayerQuestionResult;
  dice?: DiceState;
}

export interface GameRoom {
  code: string;
  status: GameStatus;
  players: Player[];
  createdAt: string;
  currentQuestion?: PublicQuestion;
  countdown?: CountdownState;
  answerSummary?: QuestionAnswerSummary;
  questionResults?: QuestionResults;
  diceSummary?: DiceSummary;
  dicePlayers?: DicePlayerState[];
}

export const SOCKET_EVENTS = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_REJOIN: 'room:rejoin',
  ROOM_ADMIN_REJOIN: 'room:admin-rejoin',
  ROOM_STATE: 'room:state',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  PLAYER_STATE: 'player:state',
  ROOM_ERROR: 'room:error',
  GAME_START: 'game:start',
  GAME_ERROR: 'game:error',
  QUESTION_STARTED: 'question:started',
  QUESTION_ENDED: 'question:ended',
  QUESTION_RESULTS: 'question:results',
  QUESTION_NEXT: 'question:next',
  ANSWER_SUBMIT: 'answer:submit',
  ANSWER_ACCEPTED: 'answer:accepted',
  ANSWER_REJECTED: 'answer:rejected',
  DICE_PHASE_START: 'dice:phase:start',
  DICE_ROLL: 'dice:roll',
  DICE_RESULT: 'dice:result',
  DICE_STATE: 'dice:state',
  DICE_ERROR: 'dice:error',
  DICE_PHASE_COMPLETE: 'dice:phase:complete',
} as const;

export const ROOM_ERROR_CODES = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  INVALID_NAME: 'INVALID_NAME',
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  ROOM_NOT_JOINABLE: 'ROOM_NOT_JOINABLE',
  CONNECTION_ALREADY_ASSIGNED: 'CONNECTION_ALREADY_ASSIGNED',
  NOT_ADMIN: 'NOT_ADMIN',
  NO_PLAYERS: 'NO_PLAYERS',
  GAME_ALREADY_STARTED: 'GAME_ALREADY_STARTED',
  QUESTION_NOT_ACTIVE: 'QUESTION_NOT_ACTIVE',
  QUESTION_NOT_FOUND: 'QUESTION_NOT_FOUND',
  QUESTION_EXPIRED: 'QUESTION_EXPIRED',
  QUESTION_RESULTS_NOT_READY: 'QUESTION_RESULTS_NOT_READY',
  ANSWER_ALREADY_SUBMITTED: 'ANSWER_ALREADY_SUBMITTED',
  INVALID_OPTION: 'INVALID_OPTION',
  REJOIN_FAILED: 'REJOIN_FAILED',
  NO_MORE_QUESTIONS: 'NO_MORE_QUESTIONS',
  DICE_NOT_ALLOWED: 'DICE_NOT_ALLOWED',
  ALREADY_ROLLED: 'ALREADY_ROLLED',
  INVALID_PHASE: 'INVALID_PHASE',
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  DICE_PHASE_NOT_COMPLETE: 'DICE_PHASE_NOT_COMPLETE',
  SERVER_ERROR: 'SERVER_ERROR',
} as const;

export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[keyof typeof ROOM_ERROR_CODES];

export interface RoomError {
  code: RoomErrorCode;
  message: string;
}

export type SocketAck<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: RoomError;
    };

export interface CreateRoomSuccess {
  room: GameRoom;
  joinPath: string;
  adminSessionToken: string;
}

export type CreateRoomResponse = SocketAck<CreateRoomSuccess>;

export interface JoinRoomPayload {
  roomCode: string;
  name: string;
}

export interface JoinRoomSuccess {
  player: Player;
  room: GameRoom;
  playerState: PlayerQuestionState;
  sessionToken: string;
}

export type JoinRoomResponse = SocketAck<JoinRoomSuccess>;

export interface RejoinRoomPayload {
  roomCode: string;
  sessionToken: string;
}

export interface RejoinRoomSuccess {
  player: Player;
  room: GameRoom;
  playerState: PlayerQuestionState;
  sessionToken: string;
}

export type RejoinRoomResponse = SocketAck<RejoinRoomSuccess>;

export interface AdminRejoinPayload {
  roomCode: string;
  adminSessionToken: string;
}

export interface AdminRejoinSuccess {
  room: GameRoom;
  adminSessionToken: string;
}

export type AdminRejoinResponse = SocketAck<AdminRejoinSuccess>;

export interface GameControlPayload {
  roomCode: string;
}

export interface GameControlSuccess {
  room: GameRoom;
}

export type GameControlResponse = SocketAck<GameControlSuccess>;

export interface AnswerSubmitPayload {
  roomCode: string;
  questionId: string;
  selectedOptionId: string;
}

export interface AnswerAcceptedSuccess {
  questionId: string;
  selectedOptionId: string;
  answeredAt: string;
  responseTimeMs: number;
  playerState: PlayerQuestionState;
}

export type AnswerSubmitResponse = SocketAck<AnswerAcceptedSuccess>;

export interface DiceRollPayload {
  roomCode: string;
}

export interface DiceRollSuccess {
  value: DiceValue;
  diceState: DiceState;
  playerState: PlayerQuestionState;
  room: GameRoom;
}

export type DiceRollResponse = SocketAck<DiceRollSuccess>;

export interface PlayerEventPayload {
  roomCode: string;
  player: Player;
}

export interface PlayerLeftPayload {
  roomCode: string;
  playerId: string;
}

export interface QuestionStartedPayload {
  roomCode: string;
  question: PublicQuestion;
  answerSummary: QuestionAnswerSummary;
}

export interface QuestionEndedPayload {
  roomCode: string;
  questionId: string;
}

export interface QuestionResultsPayload {
  roomCode: string;
  results: QuestionResults;
  playerResult?: PlayerQuestionResult;
}

export interface DicePhaseStartPayload {
  roomCode: string;
  room: GameRoom;
}

export interface DiceStatePayload {
  roomCode: string;
  summary: DiceSummary;
  players: DicePlayerState[];
}

export interface DiceResultPayload {
  roomCode: string;
  playerId: string;
  value: DiceValue;
  diceState: DiceState;
  summary: DiceSummary;
}

export interface DicePhaseCompletePayload {
  roomCode: string;
  summary: DiceSummary;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.ROOM_STATE]: (room: GameRoom) => void;
  [SOCKET_EVENTS.PLAYER_JOINED]: (payload: PlayerEventPayload) => void;
  [SOCKET_EVENTS.PLAYER_LEFT]: (payload: PlayerLeftPayload) => void;
  [SOCKET_EVENTS.PLAYER_STATE]: (state: PlayerQuestionState) => void;
  [SOCKET_EVENTS.ROOM_ERROR]: (error: RoomError) => void;
  [SOCKET_EVENTS.GAME_ERROR]: (error: RoomError) => void;
  [SOCKET_EVENTS.QUESTION_STARTED]: (payload: QuestionStartedPayload) => void;
  [SOCKET_EVENTS.QUESTION_ENDED]: (payload: QuestionEndedPayload) => void;
  [SOCKET_EVENTS.QUESTION_RESULTS]: (payload: QuestionResultsPayload) => void;
  [SOCKET_EVENTS.ANSWER_ACCEPTED]: (payload: AnswerAcceptedSuccess) => void;
  [SOCKET_EVENTS.ANSWER_REJECTED]: (error: RoomError) => void;
  [SOCKET_EVENTS.DICE_PHASE_START]: (payload: DicePhaseStartPayload) => void;
  [SOCKET_EVENTS.DICE_RESULT]: (payload: DiceResultPayload) => void;
  [SOCKET_EVENTS.DICE_STATE]: (payload: DiceStatePayload) => void;
  [SOCKET_EVENTS.DICE_ERROR]: (error: RoomError) => void;
  [SOCKET_EVENTS.DICE_PHASE_COMPLETE]: (payload: DicePhaseCompletePayload) => void;
}

export interface ClientToServerEvents {
  [SOCKET_EVENTS.ROOM_CREATE]: (ack: (response: CreateRoomResponse) => void) => void;
  [SOCKET_EVENTS.ROOM_JOIN]: (
    payload: JoinRoomPayload,
    ack: (response: JoinRoomResponse) => void,
  ) => void;
  [SOCKET_EVENTS.ROOM_REJOIN]: (
    payload: RejoinRoomPayload,
    ack: (response: RejoinRoomResponse) => void,
  ) => void;
  [SOCKET_EVENTS.ROOM_ADMIN_REJOIN]: (
    payload: AdminRejoinPayload,
    ack: (response: AdminRejoinResponse) => void,
  ) => void;
  [SOCKET_EVENTS.GAME_START]: (
    payload: GameControlPayload,
    ack: (response: GameControlResponse) => void,
  ) => void;
  [SOCKET_EVENTS.QUESTION_NEXT]: (
    payload: GameControlPayload,
    ack: (response: GameControlResponse) => void,
  ) => void;
  [SOCKET_EVENTS.ANSWER_SUBMIT]: (
    payload: AnswerSubmitPayload,
    ack: (response: AnswerSubmitResponse) => void,
  ) => void;
  [SOCKET_EVENTS.DICE_PHASE_START]: (
    payload: GameControlPayload,
    ack: (response: GameControlResponse) => void,
  ) => void;
  [SOCKET_EVENTS.DICE_ROLL]: (
    payload: DiceRollPayload,
    ack: (response: DiceRollResponse) => void,
  ) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export type SocketRole = 'admin' | 'player';

export interface SocketData {
  role?: SocketRole;
  roomCode?: string;
  playerId?: string;
  sessionToken?: string;
}
