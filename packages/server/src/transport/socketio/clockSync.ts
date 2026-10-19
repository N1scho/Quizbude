import type { Socket } from 'socket.io';
import { WIRE_CHANNEL, type PlayerId, type RoomCode } from '@quizbude/protocol';
import { nowMono, serverTimeMs } from '../../runtime/clock.js';

const PING_INTERVAL_MS = 5_000;
const MAX_SAMPLES = 8;

/** Alles, was der Adapter je Verbindung mitfuehrt. Kein Spielzustand. */
export interface SocketState {
  roomCode?: RoomCode;
  playerId?: PlayerId;
  isHost?: boolean;
  /** Serverseitig gemessene Umlaufzeiten. Eine Zahl vom Client geht nie ein. */
  rttSamples: number[];
  pending: Map<number, number>;
  pingSeq: number;
}

const states = new WeakMap<Socket, SocketState>();

export function socketState(socket: Socket): SocketState {
  let s = states.get(socket);
  if (s === undefined) {
    s = { rttSamples: [], pending: new Map(), pingSeq: 0 };
    states.set(socket, s);
  }
  return s;
}

/**
 * Der Server misst die Umlaufzeit SELBST. Eine vom Client gelieferte Zahl
 * geht in die Wertung nicht ein (Architekturkonzept 5.3).
 */
export function attachClockSync(socket: Socket): void {
  const state = socketState(socket);
  const tick = (): void => {
    state.pingSeq += 1;
    const seq = state.pingSeq;
    state.pending.set(seq, nowMono());
    if (state.pending.size > 16) {
      const oldest = state.pending.keys().next();
      if (oldest.done !== true) state.pending.delete(oldest.value);
    }
    socket.emit(WIRE_CHANNEL, { t: 'clock:ping', seq, serverTimeMs: serverTimeMs() });
  };

  tick();
  const timer = setInterval(tick, PING_INTERVAL_MS);
  socket.on('disconnect', () => clearInterval(timer));
}

export function recordPong(state: SocketState, seq: number, receivedAt: number): void {
  const sentAt = state.pending.get(seq);
  if (sentAt === undefined) return;
  state.pending.delete(seq);
  state.rttSamples.push(receivedAt - sentAt);
  if (state.rttSamples.length > MAX_SAMPLES) state.rttSamples.shift();
}

/** Minimum der letzten Proben: beste Schaetzung der echten Pfadlaufzeit. */
export function rttMinOf(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  return samples.reduce((a, b) => (b < a ? b : a), samples[0] as number);
}
