import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as ioClient } from 'socket.io-client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WIRE_CHANNEL } from '@quizbude/protocol';
import { MAX_UPLOAD_BYTES, parseQuiz } from '@quizbude/core';
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

  it('main.ts setzt den Puffer wirklich, und zwar aus dieser Konstante', () => {
    // `main.ts` ist reine Verdrahtung und von keinem Verhaltenstest
    // beruehrt - genau dort ist in diesem Projekt schon einmal eine
    // Entscheidung unbemerkt verschwunden.
    const quelle = readFileSync(
      fileURLToPath(new URL('../../packages/server/src/main.ts', import.meta.url)),
      'utf8',
    );
    expect(quelle).toContain('maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES');
    expect(quelle).toContain("from './transport/socketio/validate.js'");
  });
});

interface Probe {
  readonly ergebnis: Promise<'angekommen' | 'getrennt'>;
  close(): Promise<void>;
}

/** Ein echter Socket.IO-Server mit genau diesem Puffer - mehr nicht. */
async function schicke(puffer: number | undefined, nutzlast: unknown): Promise<Probe> {
  const http: HttpServer = createServer();
  const io = new Server(http, {
    perMessageDeflate: false,
    ...(puffer === undefined ? {} : { maxHttpBufferSize: puffer }),
  });
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
    const probe = await schicke(undefined, nutzlast);
    offen = probe;
    expect(await probe.ergebnis).toBe('getrennt');
  }, 15_000);

  it('mit dem gesetzten Puffer kommt dieselbe Datei an', async () => {
    const probe = await schicke(MAX_SOCKET_MESSAGE_BYTES, nutzlast);
    offen = probe;
    expect(await probe.ergebnis).toBe('angekommen');
  }, 15_000);
});
