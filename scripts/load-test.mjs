import { io } from 'socket.io-client';

const BASE_URL = process.argv[2];
const ROOM_CODE = process.argv[3]?.trim().toUpperCase();
const BOT_COUNT = Number(process.argv[4] ?? 50);

if (!BASE_URL || !ROOM_CODE) {
  console.log(`
Uso:

node scripts/load-test.mjs <URL> <SALA> [BOTS]

Ejemplo:

node scripts/load-test.mjs https://tu-app.up.railway.app ABC123 50
`);
  process.exit(1);
}

if (!Number.isInteger(BOT_COUNT) || BOT_COUNT < 1 || BOT_COUNT > 500) {
  console.error('La cantidad de bots debe estar entre 1 y 500.');
  process.exit(1);
}

const EVENTS = {
  ROOM_JOIN: 'room:join',
  QUESTION_STARTED: 'question:started',
  ANSWER_SUBMIT: 'answer:submit',
  DICE_PHASE_START: 'dice:phase:start',
  DICE_ROLL: 'dice:roll',
  GAME_FINISHED: 'game:finished',
};

const sockets = [];

const stats = {
  connected: 0,
  joined: 0,
  joinErrors: 0,
  disconnected: 0,
  connectionErrors: 0,

  answersSent: 0,
  answersAccepted: 0,
  answersRejected: 0,

  diceAttempts: 0,
  diceSuccess: 0,
  diceRejected: 0,
};

const randomDelay = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function printStats() {
  console.clear();

  console.log('======================================');
  console.log(' EMBEDDED SNAKES LIVE - LOAD TEST');
  console.log('======================================');
  console.log(`Servidor: ${BASE_URL}`);
  console.log(`Sala:     ${ROOM_CODE}`);
  console.log(`Bots:     ${BOT_COUNT}`);
  console.log('');

  console.log('CONEXIONES');
  console.log(`Conectados Socket.IO : ${stats.connected}/${BOT_COUNT}`);
  console.log(`Entraron a la sala   : ${stats.joined}/${BOT_COUNT}`);
  console.log(`Errores al entrar    : ${stats.joinErrors}`);
  console.log(`Desconectados        : ${stats.disconnected}`);
  console.log(`Errores conexión     : ${stats.connectionErrors}`);

  console.log('');
  console.log('PREGUNTAS');
  console.log(`Respuestas enviadas  : ${stats.answersSent}`);
  console.log(`Aceptadas             : ${stats.answersAccepted}`);
  console.log(`Rechazadas            : ${stats.answersRejected}`);

  console.log('');
  console.log('DADOS');
  console.log(`Intentos              : ${stats.diceAttempts}`);
  console.log(`Dados permitidos      : ${stats.diceSuccess}`);
  console.log(`Dados rechazados      : ${stats.diceRejected}`);

  console.log('');
  console.log('Ctrl+C para cerrar todos los bots.');
}

function createBot(index) {
  const botName = `Bot${String(index + 1).padStart(3, '0')}`;

  const socket = io(BASE_URL, {
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 10000,
  });

  sockets.push(socket);

  socket.on('connect', () => {
    stats.connected += 1;

    socket.emit(
      EVENTS.ROOM_JOIN,
      {
        roomCode: ROOM_CODE,
        name: botName,
      },
      (response) => {
        if (response?.ok) {
          stats.joined += 1;
        } else {
          stats.joinErrors += 1;

          console.error(
            `[${botName}] Error al entrar:`,
            response?.error?.code,
            response?.error?.message,
          );
        }
      },
    );
  });

  socket.on('disconnect', () => {
    stats.disconnected += 1;
  });

  socket.on('connect_error', (error) => {
    stats.connectionErrors += 1;
    console.error(`[${botName}] connect_error: ${error.message}`);
  });

  // Cuando el servidor envía una pregunta,
  // el bot elige una respuesta válida al azar.
  socket.on(EVENTS.QUESTION_STARTED, (payload) => {
    const question = payload?.question;

    if (!question?.options?.length) {
      return;
    }

    const option =
      question.options[
        Math.floor(Math.random() * question.options.length)
      ];

    // Simula que cada alumno tarda diferente.
    const delay = randomDelay(500, 6000);

    setTimeout(() => {
      if (!socket.connected) return;

      stats.answersSent += 1;

      socket.emit(
        EVENTS.ANSWER_SUBMIT,
        {
          roomCode: ROOM_CODE,
          questionId: question.id,
          selectedOptionId: option.id,
        },
        (response) => {
          if (response?.ok) {
            stats.answersAccepted += 1;
          } else {
            stats.answersRejected += 1;
          }
        },
      );
    }, delay);
  });

  // Cuando tú habilitas dados,
  // todos intentan lanzar.
  //
  // Los que respondieron correctamente serán aceptados.
  // Los demás serán rechazados por el backend, que es justo
  // lo que queremos comprobar.
  socket.on(EVENTS.DICE_PHASE_START, () => {
    const delay = randomDelay(200, 2000);

    setTimeout(() => {
      if (!socket.connected) return;

      stats.diceAttempts += 1;

      socket.emit(
        EVENTS.DICE_ROLL,
        {
          roomCode: ROOM_CODE,
        },
        (response) => {
          if (response?.ok) {
            stats.diceSuccess += 1;
          } else {
            stats.diceRejected += 1;
          }
        },
      );
    }, delay);
  });

  socket.on(EVENTS.GAME_FINISHED, (payload) => {
    if (index === 0) {
      console.log('');
      console.log('🏆 Partida terminada');
      console.log(`Ganador: ${payload?.winner?.playerName ?? 'desconocido'}`);
    }
  });
}

// No conectar los 50 exactamente en el mismo milisegundo.
// 40 ms sigue siendo una entrada bastante agresiva.
for (let i = 0; i < BOT_COUNT; i += 1) {
  setTimeout(() => {
    createBot(i);
  }, i * 40);
}

const interval = setInterval(printStats, 2000);

process.on('SIGINT', () => {
  console.log('\nCerrando bots...');

  clearInterval(interval);

  for (const socket of sockets) {
    socket.disconnect();
  }

  setTimeout(() => {
    console.log('Prueba terminada.');
    process.exit(0);
  }, 500);
});