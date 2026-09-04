export const GAME_STATUS = {
  LOBBY: 'LOBBY',
  PLAYING: 'PLAYING',
  FINISHED: 'FINISHED',
} as const;

export type GameStatus = (typeof GAME_STATUS)[keyof typeof GAME_STATUS];

export interface Player {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: string;
}

export interface GameRoom {
  code: string;
  status: GameStatus;
  players: Player[];
  createdAt: string;
}

export const SOCKET_EVENTS = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_STATE: 'room:state',
  PLAYER_JOINED: 'player:joined',
  PLAYER_LEFT: 'player:left',
  ROOM_ERROR: 'room:error',
} as const;

export const ROOM_ERROR_CODES = {
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  INVALID_NAME: 'INVALID_NAME',
  DUPLICATE_NAME: 'DUPLICATE_NAME',
  ROOM_NOT_JOINABLE: 'ROOM_NOT_JOINABLE',
  CONNECTION_ALREADY_ASSIGNED: 'CONNECTION_ALREADY_ASSIGNED',
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
}

export type CreateRoomResponse = SocketAck<CreateRoomSuccess>;

export interface JoinRoomPayload {
  roomCode: string;
  name: string;
}

export interface JoinRoomSuccess {
  player: Player;
  room: GameRoom;
}

export type JoinRoomResponse = SocketAck<JoinRoomSuccess>;

export interface PlayerEventPayload {
  roomCode: string;
  player: Player;
}

export interface PlayerLeftPayload {
  roomCode: string;
  playerId: string;
}

export interface ServerToClientEvents {
  [SOCKET_EVENTS.ROOM_STATE]: (room: GameRoom) => void;
  [SOCKET_EVENTS.PLAYER_JOINED]: (payload: PlayerEventPayload) => void;
  [SOCKET_EVENTS.PLAYER_LEFT]: (payload: PlayerLeftPayload) => void;
  [SOCKET_EVENTS.ROOM_ERROR]: (error: RoomError) => void;
}

export interface ClientToServerEvents {
  [SOCKET_EVENTS.ROOM_CREATE]: (ack: (response: CreateRoomResponse) => void) => void;
  [SOCKET_EVENTS.ROOM_JOIN]: (
    payload: JoinRoomPayload,
    ack: (response: JoinRoomResponse) => void,
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
}
