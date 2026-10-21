import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';
import { importSpezifizierer } from '../quelltext.js';
import { WIRE_CHANNEL } from '@quizbude/protocol';
import { MAX_UPLOAD_BYTES, parseQuiz } from '@quizbude/core';
import { createSocketServer } from '../../packages/server/src/transport/socketio/server.js';
import {
  MAX_SOCKET_MESSAGE_BYTES,
  WIRE_ESCAPE_FACTOR,
} from '../../packages/server/src/transport/socketio/validate.js';

/**
 * B3: Der Deckel der Datei und der Puffer am Draht muessen zusammenpassen.
 *
 * Eine Datei unter dem angekuendigten Deckel wurde gruen geprueft, war am
 * Draht aber groesser als die Vorgabe von Socket.IO (1e6 Bytes), und die
 * Verbindung riss ab - ohne Meldung, ohne Raumcode, ohne alles. Gemessen
 * wird hier deshalb die NUTZLAST, nicht die Dateigroesse.
 */

/** Eine Datei knapp unter dem Deckel, deren Inhalt aus `fuell` besteht. */
function dateiNahAmDeckel(fuell: string): string {
  const kopf = '# Abendrunde\n\n';
  const geruest = 40; // Frage, zwei Antworten, Marker der Erklaerung
  const proZeichen = new TextEncoder().encode(fuell).length;
  const rest = MAX_UPLOAD_BYTES - new TextEncoder().encode(kopf).length - 200 * geruest;
  const proErklaerung = Math.floor(rest / 200 / proZeichen);
  let out = kopf;
  for (let i = 1; i <= 200; i += 1) {
    out += `Frage ${i}? | 20\n* A\nB\n> ${fuell.repeat(proErklaerung)}\n\n`;
  }
  return out;
}

function nutzlastBytes(text: string): { datei: number; draht: number; ok: boolean } {
  const datei = new TextEncoder().encode(text).length;
  const erg = parseQuiz(text);
  const draht = new TextEncoder().encode(
    JSON.stringify({ t: 'host:create', quiz: { title: erg.titel, questions: erg.questions } }),
  ).length;
  return { datei, draht, ok: erg.ok };
}

describe('Der Puffer am Draht traegt jede erlaubte Datei (B3)', () => {
  /**
   * Die Faelle, die beim JSON-Escapen am staerksten wachsen: ein
   * Anfuehrungszeichen und ein umgekehrter Schraegstrich werden zu zwei
   * Zeichen, ein Steuerzeichen zu sechs (`\uXXXX`), ein Zeichen ausserhalb
   * von ASCII zu gar keinem mehr - es steht schon in der Datei als
   * mehrere UTF-8-Bytes.
   */
  const fuellungen: readonly (readonly [string, string])[] = [
    ['gewoehnlicher Text', 'a'],
    ['Anfuehrungszeichen', '"'],
    ['umgekehrter Schraegstrich', '\\'],
    ['beides gemischt', '"\\'],
    ['ausserhalb von ASCII', 'ä'],
    ['Haekchen', '✅'],
    ['Steuerzeichen', '\u0001'],
  ];

  it('eine Datei knapp unter dem Deckel bleibt am Draht unter dem Puffer', () => {
    for (const paar of fuellungen) {
      const text = dateiNahAmDeckel(paar[1]);
      const mass = nutzlastBytes(text);
      expect(mass.datei, paar[0]).toBeLessThanOrEqual(MAX_UPLOAD_BYTES);
      expect(mass.ok, paar[0]).toBe(true);
      expect(mass.draht, `${paar[0]}: ${mass.draht} B am Draht`).toBeLessThanOrEqual(
        MAX_SOCKET_MESSAGE_BYTES,
      );
    }
  });

  it('der ungueltige Fall waere ohne das Mass durchgefallen', () => {
    // Die Gegenprobe zur Zahl: mit der Vorgabe von Socket.IO (1e6) reisst
    // schon gewoehnlicher Text ab. Ohne diese Zusicherung koennte der
    // Puffer stillschweigend wieder auf die Vorgabe zurueckfallen.
    const mass = nutzlastBytes(dateiNahAmDeckel('a'));
    expect(mass.draht).toBeGreaterThan(1e6);
    expect(MAX_SOCKET_MESSAGE_BYTES).toBeGreaterThan(1e6);
  });

  it('der Faktor deckt die laengste Ersetzung, die JSON kennt', () => {
    // Sechs ist nicht geschaetzt: `\u0001` ist sechs Zeichen fuer ein Byte,
    // und etwas Laengeres gibt es in JSON nicht.
    expect(WIRE_ESCAPE_FACTOR).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify('\u0001')).toHaveLength('"\\u0001"'.length);
  });

  it('main.ts kommt an keinen eigenen Socket-Server heran (B-4)', () => {
    // N3: Der Waechter stand frueher auf dem Wortlaut
    // `maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES` in `main.ts`. Er hielt
    // genau so lange, wie der Text dort stand - EINE Zeile dahinter
    // (`io.engine.opts.maxHttpBufferSize = 1e6;`) stellte B3 vollstaendig
    // wieder her, bei 309/309 gruen und `tsc` Exit 0.
    //
    // B-4: Sein Nachfolger las `not.toContain('new Server(')` und war damit
    // genauso umgehbar. `import { Server as S } from 'socket.io'` plus
    // `new S(http, …)` liess den gewachten Text woertlich in einem toten
    // Zweig stehen - 318/318 gruen, `tsc` 0, `build` 0, und B3 waere am
    // Abend zurueck gewesen.
    //
    // Gezaehlt wird deshalb nicht mehr Text, sondern die Modulkante, und
    // zwar mit dem TypeScript-Parser statt mit einem regulaeren Ausdruck -
    // dieselbe Lehre wie bei der Importpruefung in `test/quelltext.ts`.
    // `main.ts` bindet `socket.io` ueberhaupt nicht ein: weder statisch,
    // noch per `require`, noch dynamisch, und unter keinem Aliasnamen. Ohne
    // diesen Import gibt es dort kein `Server`, aus dem sich ein zweiter,
    // ungebundener Socket-Server bauen liesse; was `main.ts` hochfaehrt,
    // kann nur aus der gebundenen Fabrik kommen.
    const quelle = readFileSync(
      fileURLToPath(new URL('../../packages/server/src/main.ts', import.meta.url)),
      'utf8',
    );
    const importe = importSpezifizierer(quelle, 'main.ts');
    expect(importe).not.toContain('socket.io');
    expect(importe).toContain('./transport/socketio/server.js');
  });
});

interface Probe {
  readonly ergebnis: Promise<'angekommen' | 'getrennt'>;
  close(): Promise<void>;
}

/** Der wirksame Puffer eines laufenden Servers, nicht die Konstante dahinter. */
function wirksamerPuffer(io: Server): number {
  return (io.engine as unknown as { opts: { maxHttpBufferSize: number } }).opts
    .maxHttpBufferSize;
}

/** Ein echter Socket.IO-Server, gebaut wie angegeben - mehr nicht. */
async function schicke(
  bauen: (http: HttpServer) => Server,
  nutzlast: unknown,
): Promise<Probe & { readonly puffer: number }> {
  const http: HttpServer = createServer();
  const io = bauen(http);
  io.on('connection', (socket) => {
    socket.on(WIRE_CHANNEL, () => socket.emit(WIRE_CHANNEL, { t: 'angekommen' }));
  });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as AddressInfo).port;
  const client = ioClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });

  const ergebnis = new Promise<'angekommen' | 'getrennt'>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('weder Antwort noch Abbruch')), 8_000);
    client.on('connect', () => client.emit(WIRE_CHANNEL, nutzlast));
    client.on(WIRE_CHANNEL, () => {
      clearTimeout(timer);
      resolve('angekommen');
    });
    client.on('disconnect', () => {
      clearTimeout(timer);
      resolve('getrennt');
    });
    client.on('connect_error', (e: Error) => {
      clearTimeout(timer);
      reject(e);
    });
  });

  return {
    ergebnis,
    puffer: wirksamerPuffer(io),
    async close(): Promise<void> {
      client.close();
      await io.close();
      await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}

let offen: Probe | null = null;

afterEach(async () => {
  if (offen !== null) {
    await offen.close();
    offen = null;
  }
});

describe('Am echten Draht gemessen', () => {
  const erg = parseQuiz(dateiNahAmDeckel('a'));
  const nutzlast = { t: 'host:create', quiz: { title: erg.titel, questions: erg.questions } };

  it('mit der Vorgabe von Socket.IO reisst eine erlaubte Datei die Verbindung ab', async () => {
    const probe = await schicke((h) => new Server(h, { perMessageDeflate: false }), nutzlast);
    offen = probe;
    expect(await probe.ergebnis).toBe('getrennt');
  }, 15_000);

  it('mit dem gesetzten Puffer kommt dieselbe Datei an', async () => {
    const probe = await schicke(
      (h) => new Server(h, { perMessageDeflate: false, maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES }),
      nutzlast,
    );
    offen = probe;
    expect(await probe.ergebnis).toBe('angekommen');
  }, 15_000);
});

/**
 * N3: Die beiden Proben oben bauen ihren Server selbst. Sie belegen, dass
 * die ZAHL taugt - nicht, dass der Server, den der Abend wirklich
 * hochfaehrt, sie auch traegt. Das hing bis hierher an einem Textschnipsel
 * in `main.ts`: eine Zeile dahinter, und der Puffer stand wieder auf der
 * Vorgabe von Socket.IO, waehrend alle Tore schwiegen.
 *
 * Gemessen wird deshalb der Server aus `createSocketServer` - derselbe, den
 * `main.ts` nimmt und den das Harness aller Transporttests nimmt - und
 * zwar nicht an seiner Konstanten, sondern an dem, was engine.io daraus
 * gemacht hat, plus einer echten Nachricht ueber einen echten Draht.
 */
/**
 * Was ein Server beim Handschlag aushandelt - gemessen, nicht abgelesen.
 *
 * Ein roher Upgrade-Versuch mit `node:http`: der Client bietet
 * `permessage-deflate` an, und die Antwort sagt, ob der Server es nimmt.
 * Mehr braucht es dafuer nicht, und vor allem keine weitere Abhaengigkeit.
 */
async function ausgehandelteErweiterungen(bauen: (http: HttpServer) => Server): Promise<string> {
  const http: HttpServer = createServer();
  const io = bauen(http);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const port = (http.address() as AddressInfo).port;
  try {
    return await new Promise<string>((resolve, reject) => {
      const req = request({
        host: '127.0.0.1',
        port,
        path: '/socket.io/?EIO=4&transport=websocket',
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
          'Sec-WebSocket-Version': '13',
          'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
          'Sec-WebSocket-Extensions': 'permessage-deflate; client_max_window_bits',
        },
      });
      req.on('upgrade', (res, socket) => {
        socket.destroy();
        resolve(String(res.headers['sec-websocket-extensions'] ?? ''));
      });
      req.on('response', (res) =>
        reject(new Error(`kein Upgrade, Status ${res.statusCode ?? 0}`)),
      );
      req.on('error', reject);
      req.end();
    });
  } finally {
    io.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
}

/**
 * B-5: `perMessageDeflate: false` ist eine harte Betriebsvorgabe
 * (Konzept 6.6) - eingeschaltet reserviert zlib je Verbindung
 * sechsstellige Byte-Betraege, und der Abend rechnet mit bis zu 5000
 * Spielern. Die Zeile trug diese Vorgabe und war von keinem Test
 * gebunden: `false` auf `true` zu drehen liess 318/318 gruen und `tsc`
 * schweigen.
 *
 * Gebunden wird sie am Handschlag des laufenden Servers, nicht an der
 * abgelesenen Option und nicht am Quelltext.
 */
describe('Der Server handelt keine Kompression aus (B-5)', () => {
  it('bietet der Client permessage-deflate an, nimmt der Abend es nicht', async () => {
    expect(await ausgehandelteErweiterungen(createSocketServer)).toBe('');
  }, 20_000);

  it('und der Handschlag wuerde es merken - eingeschaltet steht es in der Antwort', async () => {
    // Die Gegenprobe zur Messung selbst. Ohne sie bliebe die Zusage oben
    // auch dann gruen, wenn der Handschlag die Erweiterung ueberhaupt nie
    // meldete - und die Vorgabe waere wieder ungebunden.
    const mit = await ausgehandelteErweiterungen(
      (h) => new Server(h, { perMessageDeflate: true, cors: { origin: true } }),
    );
    expect(mit).toContain('permessage-deflate');
  }, 20_000);
});

describe('Der Server, den der Abend hochfaehrt (N3)', () => {
  // Die unguenstigste erlaubte Datei, nicht die freundliche: ein
  // Steuerzeichen ist ein Byte in der Datei und sechs am Draht.
  const erg = parseQuiz(dateiNahAmDeckel(''));
  const nutzlast = { t: 'host:create', quiz: { title: erg.titel, questions: erg.questions } };

  it('traegt den Puffer wirklich - gemessen an engine.io, nicht an der Konstante', async () => {
    const probe = await schicke(createSocketServer, nutzlast);
    offen = probe;
    // Erst das Verhalten: eine echte Nachricht ueber einen echten Draht.
    expect(await probe.ergebnis).toBe('angekommen');
    expect(probe.puffer).toBe(MAX_SOCKET_MESSAGE_BYTES);
  }, 20_000);

  it('und die Messung wuerde es merken, wenn ihn jemand hinter dem Aufbau herunterdreht', async () => {
    // Die Gegenprobe zur Messung selbst: genau die Zeile, die beim
    // Nachreview 309/309 gruen liess. Sie darf hier nicht durchgehen -
    // weder am abgelesenen Puffer noch am echten Draht.
    const probe = await schicke((h) => {
      const io = createSocketServer(h);
      (io.engine as unknown as { opts: { maxHttpBufferSize: number } }).opts.maxHttpBufferSize = 1e6;
      return io;
    }, nutzlast);
    offen = probe;
    expect(await probe.ergebnis).toBe('getrennt');
    expect(probe.puffer).toBe(1e6);
  }, 20_000);
});
