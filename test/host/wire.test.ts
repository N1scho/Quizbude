import { afterEach, describe, expect, it, vi } from 'vitest';
import { WIRE_CHANNEL, type ClientMessage, type QuizPayload } from '@quizbude/protocol';
import { connect } from '../../apps/host-web/src/wire.js';
import { createRoomOnce } from '../../apps/host-web/src/session.js';
import { verdrahte, type Buehnenleitung, type Stage } from '../../apps/host-web/src/App.js';

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

/** Die abgesetzten Raumbefehle, in der Reihenfolge ihres Absendens. */
function raeume(socket: FakeSocket): Aufzeichnung[] {
  return socket.gesendet.filter((a) => a.message.t === 'host:create');
}

/** Genau die Verdrahtung der Buehne, nur ohne React darum herum. */
function neueBuehne(): {
  leitung: Buehnenleitung;
  socket: FakeSocket;
  stufen: Stage['k'][];
  fehler: (string | null)[];
  bereit: () => number;
} {
  const vorher = sockets.length;
  const stufen: Stage['k'][] = [];
  const fehler: (string | null)[] = [];
  let bereit = 0;
  const leitung = verdrahte({
    stage: (stage) => stufen.push(stage.k),
    code: () => undefined,
    roster: () => undefined,
    antworten: () => undefined,
    serverfehler: (meldung) => fehler.push(meldung),
    bereit: () => {
      bereit += 1;
    },
  });
  const socket = sockets[vorher];
  if (socket === undefined) throw new Error('verdrahte hat keinen Socket geoeffnet');
  return { leitung, socket, stufen, fehler, bereit: () => bereit };
}

/**
 * N3: Die Verdrahtung selbst, nicht ihre Bausteine.
 *
 * `createRoomOnce` ist einzeln gebunden (`session.test.ts`), die Leitung
 * auch (oben). Die WIRKUNG von B2 hing aber an einer Zeile dazwischen - und
 * die war nur dadurch gebunden, dass ein Textschnipsel in `App.tsx`
 * vorkam. Das Nachreview hat die Zeile woertlich stehen lassen und tot
 * gemacht (`if (message.code === 'niemals') oeffne.current?.abgelehnt();`):
 * 309/309 gruen, `tsc` Exit 0, `room:error`-Pfad wieder folgenlos.
 *
 * Gemessen wird hier deshalb von aussen: der Server schickt wirklich
 * `room:error` ueber den Kanal, der Nutzer schickt wirklich noch einmal ab,
 * und gezaehlt wird, was auf die Leitung geht.
 */
describe('Die verdrahtete Buehne (B2/N3)', () => {
  it('nach einer Ablehnung des Servers geht ein zweiter Raumbefehl wirklich hinaus', () => {
    vi.useFakeTimers();
    const b = neueBuehne();
    b.socket.feuere('connect');
    b.leitung.starte({ title: 'erste Fassung', questions: [] });
    expect(raeume(b.socket)).toHaveLength(1);

    // Die Nachricht des Servers, nicht ein Aufruf von `abgelehnt()`.
    b.socket.feuere(WIRE_CHANNEL, {
      t: 'room:error',
      code: 'quiz_invalid',
      message: 'Die Sammlung taugt nicht.',
    });
    expect(b.stufen).toEqual(['connecting', 'upload']);
    expect(b.fehler).toEqual([null, 'Die Sammlung taugt nicht.']);

    b.leitung.starte({ title: 'korrigierte Fassung', questions: [] });
    const gesendet = raeume(b.socket);
    expect(gesendet).toHaveLength(2);
    expect((gesendet[1]?.message as { quiz?: QuizPayload }).quiz?.title).toBe(
      'korrigierte Fassung',
    );
    b.leitung.dispose();
  });

  it('ohne die Ablehnung bleibt es bei einem Raum - der Riegel haengt an genau dieser Nachricht', () => {
    // Die Gegenprobe. Ohne sie wuerde der Test oben auch dann noch gruen,
    // wenn der Doppelklick-Schutz ganz verschwaende.
    vi.useFakeTimers();
    const b = neueBuehne();
    b.socket.feuere('connect');
    b.leitung.starte({ title: 'erste Fassung', questions: [] });
    b.leitung.starte({ title: 'zweiter Klick', questions: [] });
    b.socket.feuere('connect');
    b.leitung.starte({ title: 'dritter Klick', questions: [] });
    expect(raeume(b.socket)).toHaveLength(1);
    b.leitung.dispose();
  });

  it('gibt den Oeffnen-Knopf erst frei, wenn die Leitung steht', () => {
    vi.useFakeTimers();
    const b = neueBuehne();
    expect(b.bereit()).toBe(0);
    b.socket.feuere('connect');
    expect(b.bereit()).toBe(1);
    b.leitung.dispose();
  });
});

describe('Die Leitung der Buehne', () => {
  it('schickt ueber eine ganze Sitzung genau ein host:create - auch nach vier Wiederverbindungen', () => {
    vi.useFakeTimers();
    const { wire, socket } = neueLeitung();
    // Genau die Verdrahtung der Buehne: der Oeffner wird nach dem
    // Pruefbericht gerufen, die Wiederverbindungen kommen von selbst.
    const sitzung = createRoomOnce<unknown>(wire.socket, (quiz) =>
      wire.send({ t: 'host:create', quiz } as never),
    );

    socket.feuere('connect');
    sitzung.oeffne({ title: 'T', questions: [] });
    vi.advanceTimersByTime(1_000);
    sitzung.oeffne({ title: 'T', questions: [] });
    socket.feuere('connect');
    socket.feuere('connect');
    sitzung.oeffne({ title: 'T', questions: [] });
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
