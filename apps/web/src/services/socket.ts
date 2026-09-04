import {
  ROOM_ERROR_CODES,
  SOCKET_EVENTS,
  type AdminRejoinPayload,
  type AdminRejoinResponse,
  type AnswerSubmitPayload,
  type AnswerSubmitResponse,
  type ClientToServerEvents,
  type CreateRoomResponse,
  type DiceRollPayload,
  type DiceRollResponse,
  type GameControlPayload,
  type GameControlResponse,
  type JoinRoomPayload,
  type JoinRoomResponse,
  type RejoinRoomPayload,
  type RejoinRoomResponse,
  type ServerToClientEvents,
} from '@embedded-snakes-live/shared';
import { io, type Socket } from 'socket.io-client';
import { readonly, ref } from 'vue';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type SocketConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED';

const configuredServerUrl = String(import.meta.env.VITE_SERVER_URL ?? '').trim();
const defaultServerUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
const serverUrl = configuredServerUrl || defaultServerUrl;
const socketStatus = ref<SocketConnectionStatus>('CONNECTING');
const socket: AppSocket = io(serverUrl, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  socketStatus.value = 'CONNECTED';
});

socket.on('disconnect', () => {
  socketStatus.value = 'DISCONNECTED';
});

socket.on('connect_error', () => {
  socketStatus.value = 'DISCONNECTED';
});

socket.io.on('reconnect_attempt', () => {
  socketStatus.value = 'CONNECTING';
});

socket.io.on('reconnect', () => {
  socketStatus.value = 'CONNECTED';
});

socket.io.on('reconnect_error', () => {
  socketStatus.value = 'DISCONNECTED';
});

socket.io.on('reconnect_failed', () => {
  socketStatus.value = 'DISCONNECTED';
});

export const socketConnectionStatus = readonly(socketStatus);

export function getSocket(): AppSocket {
  return socket;
}

export function getServerUrl(): string {
  return serverUrl;
}

export function ensureSocketConnected(socketInstance: AppSocket): Promise<void> {
  if (socketInstance.connected) {
    return Promise.resolve();
  }

  socketStatus.value = 'CONNECTING';

  if (socketInstance.disconnected) {
    socketInstance.connect();
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('No pudimos conectar con el servidor.'));
    }, 4_000);

    const cleanup = (): void => {
      window.clearTimeout(timeout);
      socketInstance.off('connect', handleConnect);
      socketInstance.off('connect_error', handleConnectError);
    };

    const handleConnect = (): void => {
      cleanup();
      resolve();
    };

    const handleConnectError = (): void => {
      cleanup();
      reject(new Error('El servidor no esta disponible en este momento.'));
    };

    socketInstance.once('connect', handleConnect);
    socketInstance.once('connect_error', handleConnectError);
  });
}

export function createRoom(socketInstance: AppSocket): Promise<CreateRoomResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.SERVER_ERROR,
          message: 'El servidor tardo demasiado en crear la partida.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.ROOM_CREATE, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function joinRoom(
  socketInstance: AppSocket,
  payload: JoinRoomPayload,
): Promise<JoinRoomResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.SERVER_ERROR,
          message: 'El servidor tardo demasiado en responder.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.ROOM_JOIN, payload, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function rejoinRoom(
  socketInstance: AppSocket,
  payload: RejoinRoomPayload,
): Promise<RejoinRoomResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.REJOIN_FAILED,
          message: 'No pudimos recuperar tu entrada a la partida.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.ROOM_REJOIN, payload, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function rejoinAdminRoom(
  socketInstance: AppSocket,
  payload: AdminRejoinPayload,
): Promise<AdminRejoinResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.REJOIN_FAILED,
          message: 'No pudimos recuperar la sala del administrador.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.ROOM_ADMIN_REJOIN, payload, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function startGame(
  socketInstance: AppSocket,
  payload: GameControlPayload,
): Promise<GameControlResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.SERVER_ERROR,
          message: 'El servidor tardo demasiado en iniciar la partida.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.GAME_START, payload, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function nextQuestion(
  socketInstance: AppSocket,
  payload: GameControlPayload,
): Promise<GameControlResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.SERVER_ERROR,
          message: 'El servidor tardo demasiado en preparar la siguiente pregunta.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.QUESTION_NEXT, payload, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function submitAnswer(
  socketInstance: AppSocket,
  payload: AnswerSubmitPayload,
): Promise<AnswerSubmitResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.SERVER_ERROR,
          message: 'El servidor tardo demasiado en registrar tu respuesta.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.ANSWER_SUBMIT, payload, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function startDicePhase(
  socketInstance: AppSocket,
  payload: GameControlPayload,
): Promise<GameControlResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.SERVER_ERROR,
          message: 'El servidor tardo demasiado en habilitar los dados.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.DICE_PHASE_START, payload, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function rollDice(
  socketInstance: AppSocket,
  payload: DiceRollPayload,
): Promise<DiceRollResponse> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      resolve({
        ok: false,
        error: {
          code: ROOM_ERROR_CODES.SERVER_ERROR,
          message: 'El servidor tardo demasiado en lanzar el dado.',
        },
      });
    }, 4_000);

    socketInstance.emit(SOCKET_EVENTS.DICE_ROLL, payload, (response) => {
      window.clearTimeout(timeout);
      resolve(response);
    });
  });
}
