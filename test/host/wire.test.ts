import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClientMessage } from '@quizbude/protocol';
import { connect } from '../../apps/host-web/src/wire.js';
import { createRoomOnce } from '../../apps/host-web/src/session.js';

/**
 * E1 am Verhalten, nicht am Text.
 *
 * Der Textwaechter in `session.test.ts` liest Quelltext. Er haelt, solange
 * der Rueckfall so aussieht, wie der Waechter ihn sich vorstellt - und hat
 * genau daran schon zweimal versagt: erst an der Anfuehrungsart, dann am
 * Dateizuschnitt. Ein `send({ t: 'host:create' })` im bestehenden
 * `connect`-Handler von `wire.ts` stellte E1 vollstaendig wieder her, ohne
 * dass ein einziger Test rot wurde.
 *
 * Dieser Test bindet die Ursache: ueber eine ganze Sitzung der Buehne geht
 * genau EIN `host:create` auf die Leitung, egal aus welchem Modul es kaeme.
 * Er faehrt dazu die echte `connect()` aus `wire.ts` gegen einen
 * aufzeichnenden Socket und feuert `connect` mehrfach - genau das tut
 * `socket.io-client` bei jeder Wiederverbindung.
 */

const { sockets } = vi.hoisted(() => ({ sockets: [] as FakeSocket[] }));

interface Aufzeichnung {
  readonly kanal: string;
  readonly message: ClientMessage;
}

interface FakeSocket {
  readonly gesendet: Aufzeichnung[];
  on(event: string, listener: (...args: unknown[]) => void): FakeSocket;
  emit(kanal: string, message: ClientMessage): FakeSocket;
  close(): void;
  /** Was `socket.io-client` bei jedem Verbindungsaufbau selbst tut. */
  feuere(event: string, ...args: unknown[]): void;
}

vi.mock('socket.io-client', () => ({
  io: (): unknown => {
    const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    const socket: FakeSocket = {
      gesendet: [],
      on(event: string, listener: (...args: unknown[]) => void): FakeSocket {
        const fuer = listeners.get(event) ?? [];
        fuer.push(listener);
        listeners.set(event, fuer);
        return socket;
      },
      emit(kanal: string, message: ClientMessage): FakeSocket {
        socket.gesendet.push({ kanal, message });
        return socket;
      },
      close(): void {
        // Der Durchstich braucht hier nichts.
      },
      feuere(event: string, ...args: unknown[]): void {
        for (const l of [...(listeners.get(event) ?? [])]) l(...args);
      },
    };
    sockets.push(socket);
    return socket;
  },
}));


function neueLeitung(): { wire: ReturnType<typeof connect>; socket: FakeSocket } {
  const vorher = sockets.length;
  const wire = connect(() => {
    // Serverantworten spielen fuer E1 keine Rolle.
  });
  const socket = sockets[vorher];
  if (socket === undefined) throw new Error('wire.connect hat keinen Socket geoeffnet');
  return { wire, socket };
}

afterEach(() => {
  vi.useRealTimers();
  sockets.length = 0;
});

describe('Die Leitung der Buehne', () => {
  it('schickt ueber eine ganze Sitzung genau ein host:create - auch nach vier Wiederverbindungen', () => {
    vi.useFakeTimers();
    const { wire, socket } = neueLeitung();
    // Genau die Verdrahtung der Buehne: der Oeffner wird nach dem
    // Pruefbericht gerufen, die Wiederverbindungen kommen von selbst.
    const oeffne = createRoomOnce<unknown>(wire.socket, (quiz) =>
      wire.send({ t: 'host:create', quiz } as never),
    );

    socket.feuere('connect');
    oeffne({ title: 'T', questions: [] });
    vi.advanceTimersByTime(1_000);
    oeffne({ title: 'T', questions: [] });
    socket.feuere('connect');
    socket.feuere('connect');
    oeffne({ title: 'T', questions: [] });
    socket.feuere('connect');
    socket.feuere('connect');
    vi.advanceTimersByTime(30_000);

    const raeume = socket.gesendet.filter((a) => a.message.t === 'host:create');
    expect(raeume).toHaveLength(1);
    wire.dispose();
  });

  it('schickt beim Verbinden von sich aus nur Uhrproben', () => {
    // Die Ursache direkt: `send` liegt im `connect`-Handler von wire.ts im
    // Gueltigkeitsbereich. Alles ausser `clock:ping` ist dort ein Rueckfall.
    vi.useFakeTimers();
    const { wire, socket } = neueLeitung();

    socket.feuere('connect');
    vi.advanceTimersByTime(1_000);
    socket.feuere('connect');
    vi.advanceTimersByTime(1_000);

    expect(socket.gesendet.length).toBeGreaterThan(0);
    expect([...new Set(socket.gesendet.map((a) => a.message.t))]).toEqual(['clock:ping']);
    wire.dispose();
  });
});
