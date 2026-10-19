import { io, type Socket } from 'socket.io-client';
import { WIRE_CHANNEL, type ClientMessage, type ServerMessage } from '@quizbude/protocol';

/**
 * Ein Kanal, eine Union. Der Client rechnet immer gegen die gemeinsame
 * Serveruhr, nie gegen seine eigene Wanduhr.
 */
export interface Wire {
  readonly socket: Socket;
  send(message: ClientMessage): void;
  /** Gemeinsame Serveruhr in Millisekunden. */
  serverNow(): number;
  dispose(): void;
}

const MAX_SAMPLES = 8;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return (((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2);
}

export function connect(onMessage: (message: ServerMessage) => void): Wire {
  const socket = io({ transports: ['websocket', 'polling'] });
  const offsets: number[] = [];
  let offset = 0;
  let seq = 0;

  const send = (message: ClientMessage): void => {
    socket.emit(WIRE_CHANNEL, message);
  };

  const ping = (): void => {
    seq += 1;
    send({ t: 'clock:ping', seq, clientTime: performance.now() });
  };

  socket.on('connect', () => {
    for (let i = 0; i < 3; i += 1) setTimeout(ping, i * 120);
  });

  socket.on(WIRE_CHANNEL, (message: ServerMessage) => {
    if (message.t === 'clock:pong') {
      const now = performance.now();
      const rtt = now - message.clientTime;
      // Fuer den Anzeige-Offset ist der Median richtig: ein Ausreisser
      // stoert dort in beide Richtungen (Architekturkonzept 5.3).
      offsets.push(message.serverTimeMs + rtt / 2 - now);
      if (offsets.length > MAX_SAMPLES) offsets.shift();
      offset = median(offsets);
      return;
    }
    if (message.t === 'clock:ping') {
      send({ t: 'clock:pong', seq: message.seq });
      return;
    }
    onMessage(message);
  });

  const interval = setInterval(ping, 5_000);

  return {
    socket,
    send,
    serverNow: () => performance.now() + offset,
    dispose: () => {
      clearInterval(interval);
      socket.close();
    },
  };
}
