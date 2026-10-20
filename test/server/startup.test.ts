import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { createServer as createNetServer, type AddressInfo, type Server as NetServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  BIND_HOST,
  STAGE_HOST,
  afterListenError,
  afterListening,
  beginStartup,
  boundPort,
  createRuntime,
  decideUncaught,
  planPorts,
  stageUrl,
  type ListenServer,
  type RuntimeDeps,
  type StartupState,
} from '../../packages/server/src/runtime/startup.js';
import { DEFAULT_PORT, portSequence } from '../../packages/server/src/runtime/ports.js';

/**
 * Die Naht zwischen den reinen Funktionen war in diesem Projekt bisher
 * immer die offene Stelle: das Review konnte in `main.ts` den Exit-Code auf
 * 0 drehen, die Portnachfuehrung entfernen (am Geraet eine Endlosschleife)
 * und die Browser-Adresse fest verdrahten - und alle 150 Tests blieben
 * gruen. Hier wird die Naht gebunden.
 */

interface Protokoll {
  readonly info: string[];
  readonly warn: string[];
  readonly error: string[];
  readonly exits: number[];
  readonly stages: string[];
  readonly banner: number[];
}

function pruefstand(
  over: Partial<RuntimeDeps> = {},
): { readonly deps: RuntimeDeps; readonly log: Protokoll } {
  const log: Protokoll = { info: [], warn: [], error: [], exits: [], stages: [], banner: [] };
  const deps: RuntimeDeps = {
    env: {},
    info: (line) => log.info.push(line),
    warn: (line) => log.warn.push(line),
    error: (line) => log.error.push(line),
    exit: (code) => log.exits.push(code),
    openStage: (url) => log.stages.push(url),
    banner: (port) => {
      log.banner.push(port);
      return [`Port ${port}`];
    },
    ...over,
  };
  return { deps, log };
}

/** Ein Server, der nichts bindet - nur mitschreibt, was verlangt wurde. */
class AttrappeServer implements ListenServer {
  readonly versuche: { port: number; host: string }[] = [];
  gebunden: number | null = null;
  wirftBeimLauschen: Error | null = null;
  private readonly handler = new Map<string, ((...args: never[]) => void)[]>();

  on(event: string, listener: (...args: never[]) => void): unknown {
    const liste = this.handler.get(event) ?? [];
    liste.push(listener);
    this.handler.set(event, liste);
    return this;
  }

  listen(port: number, host: string): unknown {
    this.versuche.push({ port, host });
    if (this.wirftBeimLauschen !== null) throw this.wirftBeimLauschen;
    return this;
  }

  address(): { port: number } | null {
    return this.gebunden === null ? null : { port: this.gebunden };
  }

  ausloesen(event: string, arg?: unknown): void {
    for (const h of this.handler.get(event) ?? []) {
      (h as unknown as (a?: unknown) => void)(arg);
    }
  }
}

function belegt(): NodeJS.ErrnoException {
  const e = new Error('listen EADDRINUSE') as NodeJS.ErrnoException;
  e.code = 'EADDRINUSE';
  return e;
}

describe('PORT lesen', () => {
  it('nimmt ohne PORT die ganze Folge und weicht aus', () => {
    const plan = planPorts(undefined);
    expect(plan).toEqual({ kind: 'folge', sequence: portSequence(), chosenByUser: false });
    expect(plan.kind === 'folge' && plan.sequence[0]).toBe(DEFAULT_PORT);
  });

  it('behandelt leeren und reinen Leerraum wie nicht gesetzt', () => {
    expect(planPorts('', [3000])).toEqual({ kind: 'folge', sequence: [3000], chosenByUser: false });
    expect(planPorts('   ', [3000])).toEqual({
      kind: 'folge',
      sequence: [3000],
      chosenByUser: false,
    });
  });

  it('nimmt ein gesetztes PORT als Ansage - eine Zahl, kein Ausweichen', () => {
    expect(planPorts('8080')).toEqual({ kind: 'folge', sequence: [8080], chosenByUser: true });
  });

  it('laesst PORT=0 gelten - das heisst "nimm irgendeinen freien"', () => {
    expect(planPorts('0')).toEqual({ kind: 'folge', sequence: [0], chosenByUser: true });
  });

  /**
   * Der Kern von B2: `Number('abc')` ist `NaN`, und `listen(NaN)` wirft
   * synchron. Frueher fing das Prozessnetz den Wurf ab, behauptete "der
   * Server laeuft weiter" und der Prozess endete mit 0.
   */
  it('weist alles zurueck, was keine Portnummer ist', () => {
    for (const roh of ['abc', '3e3', '0x10', '-1', '3.5', '30 00', '3000abc']) {
      expect(planPorts(roh).kind, roh).toBe('unbrauchbar');
    }
  });

  it('weist Zahlen ausserhalb des Bereichs zurueck', () => {
    expect(planPorts('65536').kind).toBe('unbrauchbar');
    expect(planPorts('99999').kind).toBe('unbrauchbar');
    expect(planPorts('65535')).toEqual({ kind: 'folge', sequence: [65535], chosenByUser: true });
  });
});

describe('Der Zustand beim Hochfahren', () => {
  /**
   * B1: ohne Hostangabe bindet Node `::` im Dual-Stack, und Windows laesst
   * das neben einem fremden Programm auf `0.0.0.0:3000` zu - ohne
   * `EADDRINUSE`. Das Gasthandy kommt ueber IPv4; also wird dort gebunden.
   */
  it('bindet ausdruecklich auf IPv4, nicht im Dual-Stack', () => {
    expect(BIND_HOST).toBe('0.0.0.0');
    expect(beginStartup(undefined, [3000]).step).toEqual({
      kind: 'listen',
      port: 3000,
      host: '0.0.0.0',
    });
  });

  it('endet bei unbrauchbarem PORT mit Exit 1, statt still zu lauschen', () => {
    const t = beginStartup('abc');
    expect(t.step.kind).toBe('fatal');
    if (t.step.kind === 'fatal') {
      expect(t.step.exitCode).toBe(1);
      expect(t.step.reason).toContain('abc');
    }
  });

  /**
   * Die gefaehrlichste Mutation des Reviews: ohne die Nachfuehrung des
   * Ports wird endlos derselbe belegte Port probiert (am Geraet 97711
   * Durchlaeufe in 6 Sekunden). Hier wird die ganze Folge abgefahren -
   * eine fehlende Nachfuehrung tritt auf der Stelle.
   */
  it('fuehrt den Port nach und laeuft die Folge genau einmal ab', () => {
    let t = beginStartup(undefined, [3000, 3001, 3002]);
    const versuche: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      if (t.step.kind === 'fatal') break;
      expect(t.step.kind).toBe('listen');
      if (t.step.kind === 'listen') versuche.push(t.step.port);
      t = afterListenError(t.state, 'EADDRINUSE');
    }
    expect(versuche).toEqual([3000, 3001, 3002]);
    expect(t.step.kind).toBe('fatal');
    if (t.step.kind === 'fatal') {
      expect(t.step.exitCode).toBe(1);
      expect(t.step.reason).toContain('3000 bis 3002');
    }
  });

  it('nennt den alten und den neuen Port, wenn es ausweicht', () => {
    const t = afterListenError(beginStartup(undefined, [3000, 3001]).state, 'EADDRINUSE');
    expect(t.step.kind).toBe('listen');
    if (t.step.kind === 'listen') expect(t.step.message).toBe('Port 3000 ist belegt - ich nehme 3001.');
  });

  it('weicht bei gesetztem PORT nicht aus, sondern endet mit Exit 1', () => {
    const t = afterListenError(beginStartup('3000').state, 'EADDRINUSE');
    expect(t.step.kind).toBe('fatal');
    if (t.step.kind === 'fatal') {
      expect(t.step.exitCode).toBe(1);
      expect(t.step.reason).toContain('ausdruecklich');
    }
  });

  it('endet bei jedem anderen Startfehler mit Exit 1', () => {
    const t = afterListenError(beginStartup(undefined, [3000, 3001]).state, 'EACCES');
    expect(t.step.kind).toBe('fatal');
    if (t.step.kind === 'fatal') expect(t.step.exitCode).toBe(1);
  });

  /**
   * B5: derselbe Fehler, andere Phase. Mitten im Spiel darf er den Abend
   * nicht beenden.
   */
  it('toetet den Server nach dem listening nicht mehr', () => {
    const laeuft: StartupState = afterListening(beginStartup(undefined, [3000]).state, 3000).state;
    expect(laeuft.phase).toBe('laeuft');
    const t = afterListenError(laeuft, 'ECONNRESET');
    expect(t.step.kind).toBe('weiter');
    expect(t.state.phase).toBe('laeuft');
  });

  /** B4: bei PORT=0 vergibt das Betriebssystem den Port, nicht wir. */
  it('fuehrt den Port aus der tatsaechlichen Bindung nach', () => {
    const r = afterListening(beginStartup('0').state, 54321);
    expect(r.port).toBe(54321);
    expect(r.state.port).toBe(54321);
    expect(r.stageUrl).toBe('http://127.0.0.1:54321/host/');
  });

  it('bleibt beim geplanten Port, wenn die Bindung nichts hergibt', () => {
    expect(afterListening(beginStartup(undefined, [3000]).state, null).port).toBe(3000);
    expect(boundPort(null)).toBe(null);
    expect(boundPort('/tmp/sock')).toBe(null);
    expect(boundPort({ port: 3005 })).toBe(3005);
  });

  it('gibt dem Browser die Schleife dieses Rechners, nicht localhost', () => {
    expect(STAGE_HOST).toBe('127.0.0.1');
    expect(stageUrl(3003)).toBe('http://127.0.0.1:3003/host/');
  });

  /** Das Schutznetz darf einen Startfehler nicht verschlucken. */
  it('macht aus einem unbehandelten Wurf vor dem listening einen Exit 1', () => {
    const step = decideUncaught('startet');
    expect(step.kind).toBe('fatal');
    if (step.kind === 'fatal') expect(step.exitCode).toBe(1);
  });

  it('laesst einen unbehandelten Wurf im Betrieb den Abend nicht beenden', () => {
    expect(decideUncaught('laeuft').kind).toBe('weiter');
  });
});

describe('Die Verdrahtung', () => {
  it('lauscht beim Start auf dem ersten Port der Folge, auf IPv4', () => {
    const server = new AttrappeServer();
    const { deps } = pruefstand({ sequence: [3000, 3001] });
    createRuntime(server, deps).start();
    expect(server.versuche).toEqual([{ port: 3000, host: '0.0.0.0' }]);
  });

  it('weicht aus, meldet es und lauscht auf dem naechsten Port', () => {
    const server = new AttrappeServer();
    const { deps, log } = pruefstand({ sequence: [3000, 3001] });
    createRuntime(server, deps).start();
    server.ausloesen('error', belegt());
    expect(server.versuche).toEqual([
      { port: 3000, host: '0.0.0.0' },
      { port: 3001, host: '0.0.0.0' },
    ]);
    expect(log.warn.join('\n')).toContain('Port 3000 ist belegt - ich nehme 3001.');
    expect(log.exits).toEqual([]);
  });

  it('endet mit Exit 1, wenn die Folge abgelaufen ist', () => {
    const server = new AttrappeServer();
    const { deps, log } = pruefstand({ sequence: [3000] });
    createRuntime(server, deps).start();
    server.ausloesen('error', belegt());
    expect(log.exits).toEqual([1]);
  });

  it('versucht bei unbrauchbarem PORT gar nicht erst zu lauschen', () => {
    const server = new AttrappeServer();
    const { deps, log } = pruefstand({ env: { PORT: 'abc' } });
    createRuntime(server, deps).start();
    expect(server.versuche).toEqual([]);
    expect(log.exits).toEqual([1]);
    expect(log.error.join('\n')).toContain('abc');
  });

  /** Auch ein synchroner Wurf aus `listen` ist ein gescheiterter Start. */
  it('faengt einen synchronen Wurf aus listen ab und endet mit Exit 1', () => {
    const server = new AttrappeServer();
    server.wirftBeimLauschen = new Error('kaputt');
    const { deps, log } = pruefstand({ sequence: [3000] });
    createRuntime(server, deps).start();
    expect(log.exits).toEqual([1]);
  });

  it('nennt Banner und Browser denselben, tatsaechlich gebundenen Port', () => {
    const server = new AttrappeServer();
    server.gebunden = 49711;
    const { deps, log } = pruefstand({
      sequence: [0],
      env: { QUIZBUDE_BUEHNE_OEFFNEN: '1' },
    });
    createRuntime(server, deps).start();
    server.ausloesen('listening');
    expect(log.banner).toEqual([49711]);
    expect(log.stages).toEqual(['http://127.0.0.1:49711/host/']);
    expect(log.info).toEqual(['Port 49711']);
  });

  it('oeffnet den Browser nur, wenn der Doppelklick-Start es verlangt', () => {
    const server = new AttrappeServer();
    server.gebunden = 3000;
    const { deps, log } = pruefstand({ sequence: [3000] });
    createRuntime(server, deps).start();
    server.ausloesen('listening');
    expect(log.stages).toEqual([]);
  });

  it('beendet den Prozess bei einem Fehler nach dem listening nicht', () => {
    const server = new AttrappeServer();
    server.gebunden = 3000;
    const { deps, log } = pruefstand({ sequence: [3000, 3001] });
    const runtime = createRuntime(server, deps);
    runtime.start();
    server.ausloesen('listening');
    server.ausloesen('error', belegt());
    expect(log.exits).toEqual([]);
    expect(server.versuche).toEqual([{ port: 3000, host: '0.0.0.0' }]);
    expect(runtime.phase()).toBe('laeuft');
  });

  it('macht aus einem unbehandelten Wurf vor dem listening Exit 1, danach nicht', () => {
    const server = new AttrappeServer();
    server.gebunden = 3000;
    const { deps, log } = pruefstand({ sequence: [3000] });
    const runtime = createRuntime(server, deps);
    runtime.start();
    runtime.onUncaught(new Error('frueh'));
    expect(log.exits).toEqual([1]);
    server.ausloesen('listening');
    runtime.onUncaught(new Error('spaet'));
    expect(log.exits).toEqual([1]);
  });
});

/**
 * Mit echten Sockets, denn genau hier lag B1: eine Attrappe kann nicht
 * zeigen, ob die Bindung einen fremden IPv4-Server bemerkt.
 */
describe('Am echten Socket', () => {
  const offen: (NetServer | HttpServer)[] = [];

  afterEach(async () => {
    while (offen.length > 0) {
      const s = offen.pop();
      if (s === undefined) continue;
      await new Promise<void>((res) => {
        s.close(() => res());
      });
    }
  });

  async function freierPort(): Promise<number> {
    const s = createNetServer();
    await new Promise<void>((res) => {
      s.listen(0, '0.0.0.0', res);
    });
    const port = (s.address() as AddressInfo).port;
    await new Promise<void>((res) => {
      s.close(() => res());
    });
    return port;
  }

  async function warteAuf(pruefe: () => boolean, was: string, ms = 4000): Promise<void> {
    const ende = Date.now() + ms;
    while (!pruefe()) {
      if (Date.now() > ende) throw new Error(`Zeit abgelaufen: ${was}`);
      await new Promise((res) => setTimeout(res, 10));
    }
  }

  /**
   * Der Befund selbst: ein fremdes Programm haelt `0.0.0.0:P1` - nur IPv4,
   * so binden `python -m http.server`, Docker-Port-Forwarder und viele
   * Java- und .NET-Dienste. Ohne ausdrueckliche Bindung bindet die
   * Quizbude daneben `::` im Dual-Stack, merkt nichts und liest den
   * belegten Port vor; die Gaeste landen beim fremden Programm.
   *
   * Dieser Test bindet die Bindungsadresse, nicht nur "irgendein Server
   * kommt hoch": faellt der Host weg, bleibt die Quizbude auf P1 und der
   * erwartete Wechsel auf P2 bleibt aus.
   */
  it('bemerkt einen fremden IPv4-Server auf dem Port und weicht aus', async () => {
    const p1 = await freierPort();
    const p2 = await freierPort();
    expect(p2).not.toBe(p1);

    const fremd = createNetServer();
    offen.push(fremd);
    await new Promise<void>((res) => {
      fremd.listen(p1, '0.0.0.0', res);
    });

    const server = createHttpServer();
    offen.push(server);
    const { deps, log } = pruefstand({ sequence: [p1, p2] });
    createRuntime(server, deps).start();

    await warteAuf(() => log.banner.length > 0, 'die Quizbude lauscht');
    expect(log.banner).toEqual([p2]);
    expect((server.address() as AddressInfo).port).toBe(p2);
    expect(log.warn.join('\n')).toContain(`Port ${p1} ist belegt - ich nehme ${p2}.`);
    expect(log.exits).toEqual([]);
  });

  it('nimmt den freien Port, wenn ihn niemand haelt', async () => {
    const p1 = await freierPort();
    const server = createHttpServer();
    offen.push(server);
    const { deps, log } = pruefstand({
      sequence: [p1],
      env: { QUIZBUDE_BUEHNE_OEFFNEN: '1' },
    });
    createRuntime(server, deps).start();

    await warteAuf(() => log.banner.length > 0, 'die Quizbude lauscht');
    expect(log.banner).toEqual([p1]);
    expect(log.stages).toEqual([`http://127.0.0.1:${p1}/host/`]);
  });

  /** B4 am echten Socket: bei PORT=0 vergibt das Betriebssystem den Port. */
  it('nennt bei PORT=0 den vergebenen Port, nicht die 0', async () => {
    const server = createHttpServer();
    offen.push(server);
    const { deps, log } = pruefstand({
      env: { PORT: '0', QUIZBUDE_BUEHNE_OEFFNEN: '1' },
    });
    createRuntime(server, deps).start();

    await warteAuf(() => log.banner.length > 0, 'die Quizbude lauscht');
    const echt = (server.address() as AddressInfo).port;
    expect(echt).toBeGreaterThan(0);
    expect(log.banner).toEqual([echt]);
    expect(log.stages).toEqual([`http://127.0.0.1:${echt}/host/`]);
  });

  /**
   * Die Buehne muss ueber die genannte Adresse wirklich erreichbar sein -
   * `localhost` waere es nach der IPv4-Bindung unter Windows nicht
   * zuverlaessig.
   */
  it('ist unter der Adresse erreichbar, die der Gastgeber vorgelesen bekommt', async () => {
    const server = createHttpServer((_req, res) => {
      res.statusCode = 200;
      res.end('da');
    });
    offen.push(server);
    const { deps, log } = pruefstand({ env: { PORT: '0', QUIZBUDE_BUEHNE_OEFFNEN: '1' } });
    createRuntime(server, deps).start();
    await warteAuf(() => log.stages.length > 0, 'die Buehne steht');

    const url = log.stages[0] ?? '';
    const antwort = await fetch(url);
    expect(antwort.status).toBe(200);
    expect(await antwort.text()).toBe('da');
  });
});
