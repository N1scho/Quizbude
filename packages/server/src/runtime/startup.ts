/**
 * Die Entscheidungen beim Hochfahren - an einer Stelle und pruefbar.
 *
 * `main.ts` hat diese Entscheidungen frueher selbst getroffen und war von
 * keinem Test beruehrt: der Exit-Code liess sich auf 0 drehen, die
 * Portnachfuehrung entfernen und die Browser-Adresse fest verdrahten, ohne
 * dass ein einziger Test rot wurde. Deshalb steht hier alles, was
 * entschieden wird, und `main.ts` verdrahtet nur noch.
 *
 * Vier Fragen muessen von aussen pruefbar sein:
 *   1. Welcher Port gilt - auch nach dem `listening`, wenn das
 *      Betriebssystem einen anderen vergeben hat (PORT=0)?
 *   2. Welcher Exit-Code faellt bei welchem Fehler?
 *   3. Welche Adresse bekommt der Browser?
 *   4. Kam der Fehler vor oder nach dem `listening`?
 *
 * Bewusst ohne Umlaute: die Konsole startet unter Windows je nach Codepage.
 */

import { OPEN_FLAG, shouldOpenBrowser } from './browser.js';
import { decideAfterListenError, portSequence } from './ports.js';

/**
 * Gebunden wird ausdruecklich auf IPv4, nicht im Dual-Stack.
 *
 * Ohne Hostangabe bindet Node `::` und Windows laesst das neben einem
 * fremden Programm zu, das `0.0.0.0:3000` haelt - ohne `EADDRINUSE`. Der
 * Gastgeber sieht dann eine funktionierende Buehne ueber `::1`, waehrend
 * jedes Gasthandy ueber IPv4 beim fremden Programm landet. Das Gasthandy
 * im Heim-WLAN kommt ueber IPv4; also wird dort gebunden, damit ein
 * Konflikt gesehen wird und das Ausweichen greift.
 */
export const BIND_HOST = '0.0.0.0';

/**
 * Die Buehne bekommt `127.0.0.1`, nicht `localhost`: unter Windows loest
 * `localhost` zuerst nach `::1` auf, und dort lauscht nach der Bindung
 * oben niemand mehr.
 */
export const STAGE_HOST = '127.0.0.1';

/** Die Adresse, die der Browser des Gastgebers bekommt. */
export function stageUrl(port: number): string {
  return `http://${STAGE_HOST}:${port}/host/`;
}

/** Die hoechste Portnummer, die es gibt. */
const MAX_PORT = 65535;

export type PortPlan =
  | {
      readonly kind: 'folge';
      readonly sequence: readonly number[];
      /** Hat ein Mensch PORT gesetzt? Dann wird nicht ausgewichen. */
      readonly chosenByUser: boolean;
    }
  | { readonly kind: 'unbrauchbar'; readonly reason: string };

/**
 * Was PORT bedeutet - und was nicht.
 *
 * `Number('abc')` ist `NaN`, und `listen(NaN)` wirft synchron. Frueher fing
 * das Prozessnetz diesen Wurf ab, behauptete "der Server laeuft weiter" und
 * der Prozess endete still mit 0. Eine Portnummer wird deshalb hier
 * geprueft, bevor irgendjemand sie an `listen` weiterreicht.
 */
export function planPorts(
  rawPort: string | undefined,
  fallback: readonly number[] = portSequence(),
): PortPlan {
  const text = rawPort?.trim() ?? '';
  if (text === '') return { kind: 'folge', sequence: fallback, chosenByUser: false };
  if (!/^\d+$/.test(text)) {
    return { kind: 'unbrauchbar', reason: `PORT ist keine Portnummer: "${rawPort}".` };
  }
  const port = Number(text);
  if (!Number.isInteger(port) || port > MAX_PORT) {
    return {
      kind: 'unbrauchbar',
      reason: `PORT liegt ausserhalb von 0 bis ${MAX_PORT}: "${rawPort}".`,
    };
  }
  return { kind: 'folge', sequence: [port], chosenByUser: true };
}

/** Vor dem `listening` oder danach - daran haengt, ob ein Fehler toetet. */
export type Phase = 'startet' | 'laeuft';

export interface StartupState {
  readonly phase: Phase;
  /** Der Port, auf dem gerade gelauscht wird oder werden soll. */
  readonly port: number;
  readonly sequence: readonly number[];
  readonly chosenByUser: boolean;
}

export type StartupStep =
  | {
      readonly kind: 'listen';
      readonly port: number;
      readonly host: string;
      /** Steht nur beim Ausweichen - beim ersten Versuch sagt niemand etwas. */
      readonly message?: string;
    }
  | { readonly kind: 'fatal'; readonly reason: string; readonly exitCode: number }
  | { readonly kind: 'weiter'; readonly message: string };

export interface Transition {
  readonly state: StartupState;
  readonly step: StartupStep;
}

/** Ein Start, der nicht gelingt, endet laut und mit 1. */
const EXIT_START_GESCHEITERT = 1;

export function beginStartup(
  rawPort: string | undefined,
  fallback?: readonly number[],
): Transition {
  const plan = planPorts(rawPort, fallback);
  if (plan.kind === 'unbrauchbar') {
    return {
      state: { phase: 'startet', port: 0, sequence: [], chosenByUser: false },
      step: { kind: 'fatal', reason: plan.reason, exitCode: EXIT_START_GESCHEITERT },
    };
  }
  const port = plan.sequence[0] ?? 0;
  return {
    state: {
      phase: 'startet',
      port,
      sequence: plan.sequence,
      chosenByUser: plan.chosenByUser,
    },
    step: { kind: 'listen', port, host: BIND_HOST },
  };
}

/**
 * Ein `error` des Servers.
 *
 * Vor dem `listening` ist das ein Startfehler: entweder wird auf den
 * naechsten Port ausgewichen oder der Start ist gescheitert. **Nach** dem
 * `listening` darf derselbe Fehler den Abend nicht mehr beenden - er wird
 * gemeldet, und das Spiel laeuft weiter.
 *
 * Der neue Zustand fuehrt den Port nach. Genau diese Zuweisung ist das
 * Abbruchkriterium der Ausweichmechanik: ohne sie wird endlos derselbe
 * belegte Port probiert.
 */
export function afterListenError(state: StartupState, code: string | undefined): Transition {
  if (state.phase === 'laeuft') {
    return {
      state,
      step: {
        kind: 'weiter',
        message: 'Fehler im laufenden Betrieb - der Server laeuft weiter:',
      },
    };
  }
  const decision = decideAfterListenError({
    code,
    current: state.port,
    portWasChosenByUser: state.chosenByUser,
    sequence: state.sequence,
  });
  if (decision.kind === 'retry') {
    return {
      state: { ...state, port: decision.port },
      step: {
        kind: 'listen',
        port: decision.port,
        host: BIND_HOST,
        message: `Port ${state.port} ist belegt - ich nehme ${decision.port}.`,
      },
    };
  }
  return {
    state,
    step: { kind: 'fatal', reason: decision.reason, exitCode: EXIT_START_GESCHEITERT },
  };
}

export interface ListeningResult {
  readonly state: StartupState;
  /** Der Port, auf dem wirklich gelauscht wird. */
  readonly port: number;
  readonly stageUrl: string;
}

/**
 * Der Server lauscht. Ab hier gilt der Port, den das Betriebssystem
 * vergeben hat - bei `PORT=0` ist das ein ganz anderer als der geplante,
 * und Banner wie Browser-Adresse muessen ihn nennen.
 */
export function afterListening(state: StartupState, bound: number | null): ListeningResult {
  const port = bound ?? state.port;
  return {
    state: { ...state, phase: 'laeuft', port },
    port,
    stageUrl: stageUrl(port),
  };
}

/** Was `server.address()` liefert - string bei einem Unix-Socket. */
export type BoundAddress = string | { readonly port?: number } | null;

export function boundPort(address: BoundAddress): number | null {
  if (address === null || typeof address === 'string') return null;
  return typeof address.port === 'number' ? address.port : null;
}

/**
 * Das Prozessnetz darf einen **Startfehler** nicht verschlucken. Vor dem
 * `listening` ist ein unbehandelter Wurf das Ende des Starts, danach ist
 * er ein Zwischenfall.
 */
export function decideUncaught(phase: Phase): StartupStep {
  if (phase === 'startet') {
    return {
      kind: 'fatal',
      reason: 'Der Server ist nicht hochgekommen.',
      exitCode: EXIT_START_GESCHEITERT,
    };
  }
  return { kind: 'weiter', message: 'Unbehandelter Fehler - der Server laeuft weiter:' };
}

/** So viel von einem HTTP-Server braucht das Hochfahren - mehr nicht. */
export interface ListenServer {
  on(event: string, listener: (...args: never[]) => void): unknown;
  listen(port: number, host: string): unknown;
  address(): BoundAddress;
}

export interface RuntimeDeps {
  readonly env: Readonly<Partial<Record<string, string>>>;
  readonly info: (line: string) => void;
  readonly warn: (line: string) => void;
  readonly error: (line: string, detail?: unknown) => void;
  readonly exit: (code: number) => void;
  readonly openStage: (url: string) => void;
  readonly banner: (port: number) => readonly string[];
  /** Nur fuer Tests: die Portfolge, damit kein Test die echte 3000 braucht. */
  readonly sequence?: readonly number[];
}

export interface Runtime {
  start(): void;
  onUncaught(error: unknown): void;
  phase(): Phase;
  port(): number;
}

/**
 * Die Verdrahtung. Sie trifft keine Entscheidung mehr - sie fuehrt nur
 * aus, was die Funktionen oben entschieden haben.
 */
export function createRuntime(server: ListenServer, deps: RuntimeDeps): Runtime {
  let state: StartupState = {
    phase: 'startet',
    port: 0,
    sequence: [],
    chosenByUser: false,
  };

  const apply = (step: StartupStep, detail?: unknown): void => {
    if (step.kind === 'listen') {
      if (step.message !== undefined) deps.warn(`[quizbude] ${step.message}`);
      try {
        server.listen(step.port, step.host);
      } catch (error: unknown) {
        apply(
          {
            kind: 'fatal',
            reason: `Der Server kann auf ${step.host}:${step.port} nicht lauschen.`,
            exitCode: EXIT_START_GESCHEITERT,
          },
          error,
        );
      }
      return;
    }
    if (step.kind === 'fatal') {
      deps.error(`[quizbude] ${step.reason}`, detail);
      deps.exit(step.exitCode);
      return;
    }
    deps.error(`[quizbude] ${step.message}`, detail);
  };

  const onError = (error: unknown): void => {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    const t = afterListenError(state, code);
    state = t.state;
    apply(t.step, error);
  };

  const onListening = (): void => {
    const result = afterListening(state, boundPort(server.address()));
    state = result.state;
    for (const line of deps.banner(result.port)) deps.info(line);
    if (shouldOpenBrowser(deps.env[OPEN_FLAG])) deps.openStage(result.stageUrl);
  };

  return {
    start(): void {
      const t = beginStartup(deps.env['PORT'], deps.sequence);
      state = t.state;
      server.on('error', onError as (...args: never[]) => void);
      server.on('listening', onListening as (...args: never[]) => void);
      apply(t.step);
    },
    onUncaught(error: unknown): void {
      apply(decideUncaught(state.phase), error);
    },
    phase(): Phase {
      return state.phase;
    },
    port(): number {
      return state.port;
    },
  };
}
