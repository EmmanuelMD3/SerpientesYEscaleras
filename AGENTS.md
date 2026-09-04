# AGENTS.md

## Proyecto

`embedded-snakes-live` es un monorepo npm para un juego web multijugador en tiempo real tipo Kahoot, basado en Serpientes y Escaleras para una actividad de Software Embebido.

## Arquitectura

- `apps/web`: Vue 3 + TypeScript + Vite + Vue Router + Tailwind CSS.
- `apps/server`: Node.js + TypeScript + Express + Socket.IO.
- `packages/shared`: tipos, modelos y contratos de eventos Socket.IO compartidos.

En desarrollo, Vite corre en `5173` y Express/Socket.IO en `3000`. En produccion, Express sirve `apps/web/dist` para usar un solo dominio y reducir problemas de CORS.

## Convenciones

- Mantener TypeScript estricto siempre que sea razonable.
- Evitar `any`.
- No duplicar modelos entre frontend y backend; mover contratos compartidos a `packages/shared`.
- Centralizar nombres y tipos de eventos Socket.IO en `packages/shared`.
- Centralizar la conexion Socket.IO del frontend en `apps/web/src/services/socket.ts`.
- Mantener componentes Vue pequenos y orientados a flujo de usuario.
- Preferir validaciones del lado del servidor aunque exista validacion en el cliente.
- No permitir que una misma conexion Socket.IO cambie de rol entre jugador y administrador.

## Autoridad del servidor

El servidor siempre debe ser la autoridad de la partida.

Los clientes pueden solicitar acciones como crear sala o unirse con un nombre, pero no deben enviar listas completas de jugadores, estados completos de sala, puntuaciones, posiciones ni cambios directos del juego.

## Datos

No introducir bases de datos sin pedirlo explicitamente. En esta etapa las salas viven en memoria en `apps/server`.

## Comandos

Desde la raiz:

```bash
npm install
npm run dev
npm run ports
npm run lint
npm run typecheck
npm run build
npm start
```

`npm run ports` solo diagnostica si `3000` o `5173` estan ocupados. No agregar scripts que maten procesos arbitrarios del usuario.

## Verificacion esperada

Despues de cambios importantes ejecutar:

```bash
npm run lint
npm run typecheck
npm run build
```

Para probar manualmente:

1. Abrir `/admin`.
2. Crear una partida.
3. Abrir `/play/CODIGO` en otra pestana.
4. Entrar con nombres distintos.
5. Confirmar que el panel admin actualiza jugadores y desconexiones sin refrescar.
6. Iniciar partida desde admin.
7. Confirmar countdown, pregunta simultanea, una sola respuesta por jugador y resultados.
8. Avanzar con `SIGUIENTE PREGUNTA`.

## Alcance actual

Fase 2 cubre preguntas simultaneas tipo Kahoot, countdown, temporizador del servidor, resultados por pregunta y reconexion conservadora.

No avanzar todavia a dado, tablero, serpientes, escaleras, movimiento, ranking por posicion, ganador ni GSAP salvo que el usuario lo pida.

## Railway

Desplegar como un solo servicio desde la raiz del monorepo:

- Build Command: `npm run build`
- Start Command: `npm start`
- Health Check Path: `/health`

No agregar `railway.toml` o `railway.json` sin revisar primero la documentacion actual de Railway, porque Config as Code esta deprecated para servicios nuevos. Preferir dashboard o Railway Infrastructure as Code si el usuario pide versionar infraestructura.
