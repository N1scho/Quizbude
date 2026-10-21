import { afterEach, describe, expect, it, vi } from 'vitest';
import { WIRE_CHANNEL, type ClientMessage, type QuizPayload } from '@quizbude/protocol';
import { App } from '../../apps/host-web/src/App.js';

/**
 * B-3: Die Naht zwischen Komponente und Verdrahtung.
 *
 * `verdrahte` ist am Verhalten gebunden (`wire.test.ts`), `createRoomOnce`
 * auch (`session.test.ts`). Die eine Zeile dazwischen -
 * `leitung.current = gelegt;` - war es nicht: das Nachreview hat sie
 * entfernt und den gewachten Text `verdrahte({` woertlich stehen lassen.
 * 318/318 gruen, `tsc` 0, `build` 0, Riegel 0 - und am Geraet waere die
 * Buehne tot gewesen. Kein `starte`, kein `host:create`, keine Uhr, keine
 * Meldung. Genau das, was kein Tor dieses Projekts sieht.
 *
 * Gebunden wird hier von aussen: `App` wird als Funktion gerufen, ihre
 * Effekte werden ausgefuehrt, der Rueckruf `onStart` wird aus dem
 * erzeugten Elementbaum geholt - also genau der, den der Knopf "Fragen
 * pruefen" traegt - und gerufen. Gezaehlt wird, was auf der Leitung
 * ankommt.
 *
 * Ohne DOM geht das, weil die Attrappe von `react` die Haken selbst
 * fuehrt: `useEffect` sammelt die Effekte ein, statt sie zu verwerfen.
 * `renderToStaticMarkup` fuehrt keinen Effekt aus - deshalb war diese Naht
 * bisher unerreichbar.
 */

const { sockets, effekte } = vi.hoisted(() => ({
  sockets: [] as FakeSocket[],
  effekte: [] as (() => void | (() => void))[],
}));

interface Aufzeichnung {
  readonly kanal: string;
  readonly message: ClientMessage;
}

interface FakeSocket {
  readonly gesendet: Aufzeichnung[];
  on(event: string, listener: (...args: unknown[]) => void): FakeSocket;
  emit(kanal: string, message: ClientMessage): FakeSocket;
  close(): void;
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

// Die Attrappe fuehrt die Haken so, dass ein Effekt wirklich laufen kann.
// Alles andere an React bleibt echt - der JSX-Lauf gehoert zu
// `react/jsx-runtime` und ist von dieser Attrappe nicht beruehrt.
vi.mock('react', async () => {
  const echt = await vi.importActual<Record<string, unknown>>('react');
  return {
    ...echt,
    useState: (init: unknown): unknown[] => [
      typeof init === 'function' ? (init as () => unknown)() : init,
      (): void => undefined,
    ],
    useRef: (init: unknown): { current: unknown } => ({ current: init }),
    useEffect: (fn: () => void | (() => void)): void => {
      effekte.push(fn);
    },
    useCallback: (fn: unknown): unknown => fn,
    useMemo: (fn: () => unknown): unknown => fn(),
  };
});

interface Element {
  readonly props?: Record<string, unknown>;
}

/** Den Rueckruf des Fragen-Knopfs aus dem erzeugten Elementbaum holen. */
function sucheOnStart(knoten: unknown): ((quiz: QuizPayload) => void) | null {
  if (knoten === null || typeof knoten !== 'object') return null;
  if (Array.isArray(knoten)) {
    for (const k of knoten) {
      const t = sucheOnStart(k);
      if (t !== null) return t;
    }
    return null;
  }
  const props = (knoten as Element).props;
  if (props !== undefined) {
    const kandidat = props['onStart'];
    if (typeof kandidat === 'function') return kandidat as (quiz: QuizPayload) => void;
    const t = sucheOnStart(props['children']);
    if (t !== null) return t;
  }
  return null;
}

afterEach(() => {
  vi.useRealTimers();
  sockets.length = 0;
  effekte.length = 0;
});

/**
 * `App` rufen, ihre Effekte ausfuehren, die Leitung hochfahren.
 *
 * Die beiden Effekte neben der Verdrahtung greifen auf Browserdinge zu
 * (`requestAnimationFrame`, `window`). Sie bekommen hier Attrappen, damit
 * wirklich jeder Effekt der Komponente laeuft und nicht nur der, auf den
 * es ankommt - sonst bindet der Test die Reihenfolge nicht mit.
 */
function fahreBuehneHoch(): {
  socket: FakeSocket;
  onStart: (quiz: QuizPayload) => void;
  abraeumen: () => void;
} {
  const g = globalThis as Record<string, unknown>;
  const vorherRaf = g['requestAnimationFrame'];
  const vorherCaf = g['cancelAnimationFrame'];
  const vorherWindow = g['window'];
  g['requestAnimationFrame'] = (): number => 0;
  g['cancelAnimationFrame'] = (): void => undefined;
  g['window'] = {
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
  };

  const vorher = sockets.length;
  const baum = App();
  const aufraeumer: (() => void)[] = [];
  for (const effekt of [...effekte]) {
    const zurueck = effekt();
    if (typeof zurueck === 'function') aufraeumer.push(zurueck);
  }

  const socket = sockets[vorher];
  if (socket === undefined) throw new Error('App hat keine Leitung gelegt');
  const onStart = sucheOnStart(baum);
  if (onStart === null) throw new Error('Kein onStart im Elementbaum der Buehne');

  return {
    socket,
    onStart,
    abraeumen: (): void => {
      for (const a of aufraeumer) a();
      g['requestAnimationFrame'] = vorherRaf;
      g['cancelAnimationFrame'] = vorherCaf;
      g['window'] = vorherWindow;
    },
  };
}

describe('Die Buehne haelt ihre Verdrahtung fest (B-3)', () => {
  it('ein Klick auf "Fragen pruefen" schickt wirklich einen Raumbefehl hinaus', () => {
    vi.useFakeTimers();
    const b = fahreBuehneHoch();
    b.socket.feuere('connect');

    b.onStart({ title: 'Abendrunde', questions: [] });

    const raeume = b.socket.gesendet.filter((a) => a.message.t === 'host:create');
    expect(raeume).toHaveLength(1);
    expect(raeume[0]?.kanal).toBe(WIRE_CHANNEL);
    expect((raeume[0]?.message as { quiz?: QuizPayload }).quiz?.title).toBe('Abendrunde');
    b.abraeumen();
  });

  it('nach dem Abraeumen geht kein Raumbefehl mehr hinaus', () => {
    // Die Gegenprobe zur Zeile darueber: der Aufraeumer setzt den Verweis
    // zurueck. Ohne sie wuerde der Test oben auch dann noch gruen, wenn die
    // Buehne ihre Leitung nach dem Abraeumen weiter benutzte.
    vi.useFakeTimers();
    const b = fahreBuehneHoch();
    b.socket.feuere('connect');
    b.abraeumen();

    b.onStart({ title: 'zu spaet', questions: [] });
    expect(b.socket.gesendet.filter((a) => a.message.t === 'host:create')).toHaveLength(0);
  });
});
