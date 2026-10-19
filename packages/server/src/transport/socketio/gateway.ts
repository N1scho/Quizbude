import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  ANNOUNCE_MS,
  LATE_GRACE_MS,
  PLAYER_HARD_CAP,
  classicRewardLayer,
  createDefaultRegistry,
  createGame,
  createRng,
  type EngineDeps,
  type RoomConfig,
} from '@quizbude/core';
import {
  WIRE_CHANNEL,
  asPlayerId,
  type ClientMessage,
  type PlayerId,
  type RoomCode,
  type ServerMessage,
} from '@quizbude/protocol';
import { loadDemoQuiz } from '../../demoQuiz.js';
import { nowMono, serverTimeMs } from '../../runtime/clock.js';
import { drawFreeCode, normalizeCode } from '../../runtime/codes.js';
import { RoomHandle } from '../../runtime/roomHandle.js';
import { RoomRegistry } from '../../runtime/roomRegistry.js';
import { newToken } from '../../runtime/tokens.js';
import { makeEffectSink } from './outbound.js';
import { attachClockSync, recordPong, rttMinOf, socketState } from './clockSync.js';

const send = (socket: Socket, message: ServerMessage): void => {
  socket.emit(WIRE_CHANNEL, message);
};

export function attachGateway(io: Server): RoomRegistry {
  const registry = new RoomRegistry();
  const questionRegistry = createDefaultRegistry();

  io.on('connection', (socket: Socket) => {
    socketState(socket);
    attachClockSync(socket);

    socket.on(WIRE_CHANNEL, (raw: unknown) => {
      // Der Zeitstempel entsteht als ERSTE Anweisung im Handler - vor jeder
      // Validierung, jedem await, jeder Protokollierung (Konzept 5.2).
      const receivedAt = nowMono();
      handle(io, registry, questionRegistry, socket, raw, receivedAt);
    });

    socket.on('disconnect', () => {
      const st = socketState(socket);
      if (st.roomCode === undefined || st.playerId === undefined) return;
      const room = registry.byCode(st.roomCode);
      if (room === undefined) return;
      // Mehrere Tabs: erst wenn der letzte weg ist, gilt der Spieler als getrennt.
      const remaining = io.sockets.adapter.rooms.get(playerRoom(st.roomCode, st.playerId));
      if (remaining !== undefined && remaining.size > 0) return;
      room.dispatch({ kind: 'PlayerDisconnected', playerId: st.playerId });
    });
  });

  return registry;
}

const hostRoom = (code: RoomCode): string => `${code}#host`;
const playersRoom = (code: RoomCode): string => `${code}#players`;
const playerRoom = (code: RoomCode, playerId: PlayerId): string => `${code}#p#${playerId}`;

function handle(
  io: Server,
  registry: RoomRegistry,
  questionRegistry: ReturnType<typeof createDefaultRegistry>,
  socket: Socket,
  raw: unknown,
  receivedAt: ReturnType<typeof nowMono>,
): void {
  const msg = raw as ClientMessage;
  if (typeof msg !== 'object' || msg === null || typeof msg.t !== 'string') return;
  const st = socketState(socket);

  switch (msg.t) {
    case 'clock:ping':
      send(socket, {
        t: 'clock:pong',
        seq: msg.seq,
        clientTime: msg.clientTime,
        serverTimeMs: serverTimeMs(),
      });
      return;

    case 'clock:pong':
      recordPong(st, msg.seq, receivedAt);
      return;

    case 'host:create': {
      const code = drawFreeCode((c) => registry.has(c));
      const quiz = loadDemoQuiz(questionRegistry);
      const config: RoomConfig = {
        roomCode: code,
        hostToken: newToken(),
        quizTitle: quiz.title,
        scoringMode: 'timed',
        shuffleOptions: true,
        rewardLayerId: classicRewardLayer.id,
        playerHardCap: PLAYER_HARD_CAP,
        announceMs: ANNOUNCE_MS,
        lateGraceMs: LATE_GRACE_MS,
      };
      const deps: EngineDeps = {
        registry: questionRegistry,
        rng: createRng(Date.now() & 0x7fffffff),
        reward: classicRewardLayer,
      };
      const initial = createGame(config, quiz.questions, receivedAt, deps);
      const handleRoom = new RoomHandle(
        code,
        initial,
        deps,
        makeEffectSink(io, code, {
          host: hostRoom(code),
          players: playersRoom(code),
          player: (pid) => playerRoom(code, pid),
        }),
      );
      registry.add(handleRoom);

      st.roomCode = code;
      st.isHost = true;
      void socket.join(hostRoom(code));

      send(socket, {
        t: 'room:created',
        roomCode: code,
        hostToken: config.hostToken,
        quizTitle: quiz.title,
        questionCount: quiz.questions.length,
        serverTimeMs: serverTimeMs(),
      });
      send(socket, {
        t: 'room:roster',
        players: [],
        count: 0,
        softWarn: false,
      });
      return;
    }

    case 'player:join': {
      const code = normalizeCode(msg.roomCode);
      const room = registry.byCode(code);
      if (room === undefined) {
        send(socket, { t: 'player:join_rejected', reason: 'unknown_room' });
        return;
      }
      const playerId = asPlayerId(randomUUID());
      // Erst beitreten, dann melden: sonst erreicht die Antwort den Spieler nicht.
      void socket.join(playerRoom(code, playerId));
      const before = room.state.players.size;
      room.dispatch(
        {
          kind: 'PlayerJoinRequested',
          playerId,
          displayName: typeof msg.displayName === 'string' ? msg.displayName : '',
          origin: 'web',
          resumeToken: newToken(),
        },
        receivedAt,
      );
      if (room.state.players.size > before) {
        st.roomCode = code;
        st.playerId = playerId;
        void socket.join(playersRoom(code));
      } else {
        void socket.leave(playerRoom(code, playerId));
      }
      return;
    }

    case 'player:answer': {
      if (st.roomCode === undefined || st.playerId === undefined) return;
      const room = registry.byCode(st.roomCode);
      if (room === undefined) return;
      room.dispatch(
        {
          kind: 'AnswerSubmitted',
          playerId: st.playerId,
          questionSeq: msg.questionSeq,
          raw: { index: msg.optionIndex },
          rttMinMs: rttMinOf(st.rttSamples),
        },
        receivedAt,
      );
      return;
    }

    case 'host:start':
    case 'host:advance': {
      if (st.roomCode === undefined || st.isHost !== true) return;
      const room = registry.byCode(st.roomCode);
      if (room === undefined) return;
      room.dispatch(
        msg.t === 'host:start'
          ? { kind: 'HostStartedGame', expectedPhase: msg.expectedPhase }
          : { kind: 'HostAdvanced', expectedPhase: msg.expectedPhase },
        receivedAt,
      );
      return;
    }

    default:
      return;
  }
}
