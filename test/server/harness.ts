import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { WIRE_CHANNEL, type ServerMessage } from '@quizbude/protocol';
import { attachGateway } from '../../packages/server/src/transport/socketio/gateway.js';
import { createSocketServer } from '../../packages/server/src/transport/socketio/server.js';
import type { RoomRegistry } from '../../packages/server/src/runtime/roomRegistry.js';

/**
 * Ein echter Server fuer die Transporttests: echtes HTTP, echtes Socket.IO,
 * echte Clients. Nur so laesst sich belegen, dass eine einzelne fremde
 * Nachricht den Prozess nicht beendet.
 */

export interface Harness {
  readonly url: string;
  readonly io: Server;
  readonly registry: RoomRegistry;
  client(): Promise<Client>;
  close(): Promise<void>;
}

export interface Client {
  readonly socket: ClientSocket;
  /** Schickt eine beliebige Nutzlast - auch eine, die kein ClientMessage ist. */
  sendRaw(payload: unknown): void;
  /** Wartet auf die naechste Nachricht des gegebenen Typs. */
  await<K extends ServerMessage['t']>(
    type: K,
    timeoutMs?: number,
  ): Promise<Extract<ServerMessage, { t: K }>>;
  close(): void;
}

const DEFAULT_TIMEOUT_MS = 4_000;

export async function startHarness(): Promise<Harness> {
  const http: HttpServer = createServer();
  // Genau der Server, den `main.ts` hochfaehrt - nicht ein von Hand
  // nachgebauter mit denselben Zahlen. Ein Harness, das groessere
  // Nachrichten annimmt als der echte Server oder kleinere, misst nicht den
  // Betrieb; und von Hand nachgebaute Masse laufen auseinander, sobald
  // jemand nur eine Seite aendert.
  const io: Server = createSocketServer(http);
  const registry = attachGateway(io);
  await new Promise<void>((resolve) => {
    http.listen(0, '127.0.0.1', resolve);
  });
  const address = http.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;
  const clients: Client[] = [];

  return {
    url,
    io,
    registry,
    async client(): Promise<Client> {
      const c = await connectClient(url);
      clients.push(c);
      return c;
    },
    async close(): Promise<void> {
      for (const c of clients) c.close();
      await io.close();
      await new Promise<void>((resolve) => {
        http.close(() => resolve());
      });
    },
  };
}

async function connectClient(url: string): Promise<Client> {
  const socket = ioClient(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });
  const inbox: ServerMessage[] = [];
  const waiters: { type: string; resolve: (m: ServerMessage) => void }[] = [];

  socket.on(WIRE_CHANNEL, (message: ServerMessage) => {
    const index = waiters.findIndex((w) => w.type === message.t);
    if (index >= 0) {
      const waiter = waiters.splice(index, 1)[0];
      waiter?.resolve(message);
      return;
    }
    inbox.push(message);
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Verbindung kam nicht zustande')), DEFAULT_TIMEOUT_MS);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on('connect_error', (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  return {
    socket,
    sendRaw(payload: unknown): void {
      socket.emit(WIRE_CHANNEL, payload);
    },
    await<K extends ServerMessage['t']>(
      type: K,
      timeoutMs = DEFAULT_TIMEOUT_MS,
    ): Promise<Extract<ServerMessage, { t: K }>> {
      const index = inbox.findIndex((m) => m.t === type);
      if (index >= 0) {
        const [found] = inbox.splice(index, 1);
        return Promise.resolve(found as Extract<ServerMessage, { t: K }>);
      }
      return new Promise<Extract<ServerMessage, { t: K }>>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Nachricht ${type} blieb aus - der Server antwortet nicht mehr`)),
          timeoutMs,
        );
        waiters.push({
          type,
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m as Extract<ServerMessage, { t: K }>);
          },
        });
      });
    },
    close(): void {
      socket.close();
    },
  };
}
