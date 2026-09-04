# Embedded Snakes Live

Aplicacion web multijugador en tiempo real para una actividad universitaria de Software Embebido.

La fase actual implementa arquitectura base, lobby, preguntas simultaneas tipo Kahoot y dado individual por ronda: un administrador crea una sala, comparte el codigo o QR, inicia la partida, todos los jugadores responden la misma pregunta desde `/play/:roomCode` y quienes aciertan pueden lanzar un dado generado por el servidor.

## Arquitectura

- `apps/web`: frontend Vue 3, TypeScript, Vite, Vue Router y Tailwind CSS.
- `apps/server`: backend Node.js, TypeScript, Express y Socket.IO.
- `packages/shared`: modelos y contratos compartidos entre frontend y backend.

El servidor es la autoridad de la partida. El cliente solo solicita acciones como crear sala, entrar con un nombre, iniciar preguntas, enviar una respuesta o pedir un lanzamiento de dado; nunca envia ni modifica listas completas de jugadores, preguntas completas, resultados, valores de dado ni estado global.

## Requisitos

- Node.js 22 o superior recomendado.
- npm 11 o superior recomendado.

## Instalacion

```bash
npm install
```

## Ejecucion en desarrollo

Desde la raiz del repositorio:

```bash
npm run dev
```

Puertos por defecto:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

Variables de entorno principales:

- `PORT`: puerto HTTP del backend. Por defecto `3000`.
- `HOST`: host de escucha del backend. Por defecto `0.0.0.0`.
- `NODE_ENV`: usa `development` en desarrollo y `production` en despliegue.
- `CORS_ORIGINS`: origenes permitidos para desarrollo separados por coma.
- `VITE_SERVER_URL`: URL del backend usada por el frontend. En desarrollo: `http://localhost:3000`.
  En produccion normalmente se omite para que Socket.IO use el mismo origen.

Archivos de ejemplo:

- Raiz: `.env.example`
- Backend: `apps/server/.env.example`
- Frontend: `apps/web/.env.example`

## Salud del backend

Con el proyecto en desarrollo:

```bash
curl http://localhost:3000/health
```

Respuesta esperada:

```json
{
  "status": "ok"
}
```

## Diagnostico de puertos

Para comprobar si `3000` o `5173` estan ocupados:

```bash
npm run ports
```

En Windows, para identificar manualmente procesos que escuchan en esos puertos:

```powershell
Get-NetTCPConnection -LocalPort 3000,5173 -State Listen
Get-Process -Id <PID>
```

No hay scripts que cierren procesos automaticamente.

## Como probar lobby y preguntas

1. Ejecuta `npm run dev`.
2. Abre `http://localhost:5173/admin`.
3. Pulsa `CREAR PARTIDA`.
4. Copia el enlace de entrada o escanea el QR.
5. Abre `/play/CODIGO` en otra pestana o navegador.
6. Escribe `Emmanuel` y entra.
7. Verifica que `Emmanuel` aparece al instante en el panel del administrador.
8. Abre otra pestana o navegador con el mismo enlace.
9. Entra como `Michelle`.
10. Intenta entrar otra vez como `Emmanuel`; el servidor respondera que el nombre ya existe.
11. Pulsa `INICIAR PARTIDA` desde admin.
12. Confirma el countdown `3, 2, 1` y que ambos jugadores ven la misma pregunta.
13. Responde una vez desde cada jugador; el admin debe actualizar el contador de respuestas.
14. Al responder todos, o al acabarse el tiempo, el servidor cierra la pregunta y muestra resultados.
15. Pulsa `HABILITAR DADOS` desde admin.
16. Los jugadores correctos veran `LANZAR DADO`; incorrectos y timeout no tendran boton funcional.
17. Lanza desde cada jugador elegible y verifica el progreso en admin.
18. Cuando todos los elegibles hayan lanzado, pulsa `SIGUIENTE PREGUNTA`.
19. Cierra la pestana de `Michelle`; el panel del administrador marcara su desconexion.

## Produccion local

El build de produccion compila primero `packages/shared`, despues `apps/web` y al final `apps/server`.

```bash
npm run build
npm start
```

`npm start` arranca Express en modo produccion y sirve el frontend compilado por Vite desde `apps/web/dist`.

Despues de iniciar, prueba:

- `http://localhost:3000/`
- `http://localhost:3000/admin`
- `http://localhost:3000/play/ABC123`
- `http://localhost:3000/health`

Las rutas `/admin` y `/play/ABC123` devuelven `index.html` para que Vue Router funcione en history mode. El fallback SPA no captura `/health`, `/socket.io/` ni rutas bajo `/api`.

## Eventos Socket.IO

Los nombres y tipos viven en `packages/shared/src/index.ts`.

- `room:create`: el administrador solicita una sala nueva.
- `room:join`: un jugador solicita entrar a una sala con su nombre.
- `room:rejoin`: un jugador recupera su sesion con token local.
- `room:admin-rejoin`: el administrador recupera su sala con token local.
- `room:state`: el servidor publica el estado actual de la sala.
- `player:joined`: el servidor notifica que entro un jugador.
- `player:left`: el servidor notifica que un jugador se desconecto.
- `player:state`: el servidor envia el estado individual de pregunta a un jugador.
- `room:error`: el servidor envia errores amigables y tipados.
- `game:start`: el administrador inicia la ronda de preguntas.
- `question:started`: el servidor publica una pregunta sin `correctOptionId`.
- `answer:submit`: un jugador envia una respuesta.
- `answer:accepted`: el servidor confirma una respuesta aceptada.
- `answer:rejected`: el servidor rechaza una respuesta duplicada, tardia o invalida.
- `question:results`: el servidor publica resultados solo despues del cierre.
- `question:next`: el administrador avanza a la siguiente pregunta.
- `dice:phase:start`: el administrador habilita dados despues de resultados.
- `dice:roll`: un jugador elegible solicita lanzar; no envia valor ni `playerId`.
- `dice:result`: el servidor publica el valor generado.
- `dice:state`: el servidor publica progreso agregado de dados.
- `dice:error`: el servidor rechaza lanzamientos invalidos.
- `dice:phase:complete`: el servidor avisa que todos los elegibles lanzaron.

## Modelos principales

- `Player`: `id`, `name`, `connected`, `joinedAt`.
- `GameRoom`: `code`, `status`, `players`, `createdAt`, pregunta publica, countdown, resumen de respuestas y resultados cuando aplica.
- `PublicQuestion`: pregunta visible para clientes, sin `correctOptionId`.
- `Question`: pregunta interna del servidor, con `correctOptionId`.
- `DiceState`: `eligible`, `rolled`, `value`.
- `DiceSummary`: total elegible, total lanzado y si la fase esta completa.
- `RoundResult`: historial interno por pregunta/jugador con resultado de pregunta y valor de dado.
- `GameStatus`: `LOBBY`, `COUNTDOWN`, `QUESTION_ACTIVE`, `QUESTION_RESULTS`, `DICE_ROLL`, `FINISHED`.

## Comandos

```bash
npm run dev
npm run ports
npm run lint
npm run typecheck
npm run build
npm start
```

## Despliegue en Railway

El modo de desarrollo mantiene frontend y backend separados: Vite en `5173` y Express en `3000`.

Para Railway, despliega este repositorio como un solo servicio desde la raiz del monorepo.

Configura el servicio asi:

- Build Command: `npm run build`
- Start Command: `npm start`
- Health Check Path: `/health`

Variables recomendadas en Railway:

- `NODE_ENV=production`

Railway proporciona `PORT` automaticamente. No configures `VITE_SERVER_URL` en Railway salvo que necesites apuntar a otro backend; si se omite, el frontend usa el mismo dominio desde el que fue cargado.

Con esta arquitectura, un solo dominio expone:

- `/`
- `/admin`
- `/play/CODIGO`
- `/socket.io/`
- `/health`

No se incluye `railway.toml` ni `railway.json`: Railway marco Config as Code como deprecated para servicios nuevos. La configuracion recomendada es hacerla desde el dashboard o mediante Railway Infrastructure as Code si mas adelante se quiere versionar la infraestructura completa.

## Alcance de esta fase

Incluye preguntas simultaneas, countdown, temporizador validado por servidor, una respuesta por jugador, resultados individuales, reconexion conservadora y dado individual para jugadores correctos.

No incluye tablero, serpientes, escaleras, movimiento, ranking por posicion, ganador ni GSAP. Esos elementos quedan listos para crecer sobre la base de preguntas y dados.
