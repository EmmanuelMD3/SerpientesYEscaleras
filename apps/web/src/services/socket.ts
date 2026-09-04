import {
  ROOM_ERROR_CODES,
  SOCKET_EVENTS,
  type ClientToServerEvents,
  type CreateRoomResponse,
  type JoinRoomPayload,
  type JoinRoomResponse,
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
