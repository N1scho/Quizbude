import { describe, expect, it } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { makeStaticHandler } from '../../packages/server/src/http/static.js';
import { makeRequestListener } from '../../packages/server/src/http/requestListener.js';

/**
 * B1: Eine einzelne HTTP-Anfrage darf den Prozess nicht beenden.
 *
 * `GET /play/%` liess `decodeURIComponent` werfen, der Wurf wurde zur
 * abgelehnten Promise, und Node 22 beendet darauf den Prozess.
 */

interface FakeResponse {
  statusCode: number | null;
  headers: Record<string, string>;
  body: string;
  headersSent: boolean;
  writableEnded: boolean;
  writeHead(code: number, headers?: Record<string, string>): FakeResponse;
  end(chunk?: string): void;
  readonly done: Promise<void>;
}

function fakeResponse(): FakeResponse {
  let finish: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const res: FakeResponse = {
    statusCode: null,
    headers: {},
    body: '',
    headersSent: false,
    writableEnded: false,
    done,
    writeHead(code: number, headers?: Record<string, string>): FakeResponse {
      res.statusCode = code;
      res.headersSent = true;
      if (headers !== undefined) Object.assign(res.headers, headers);
      return res;
    },
    end(chunk?: string): void {
      if (chunk !== undefined) res.body += chunk;
      res.writableEnded = true;
      finish();
    },
  };
  return res;
}

const asRes = (res: FakeResponse): ServerResponse => res as unknown as ServerResponse;
const asReq = (url: string): IncomingMessage => ({ url }) as IncomingMessage;

/** Bewusst ein Verzeichnis, das es nicht gibt: der Fehler liegt vor dem Dateisystem. */
const NICHT_GEBAUT = join(tmpdir(), 'quizbude-gibt-es-nicht');
const serve = makeStaticHandler([{ prefix: '/play/', dir: NICHT_GEBAUT }]);

describe('Auslieferung statischer Dateien', () => {
  it.each(['/play/%', '/play/%zz', '/play/abc%', '/play/%E0%A4%A', '/host/%'])(
    'beantwortet %s mit 400, statt zu werfen',
    async (url) => {
      const res = fakeResponse();
      // Kein rejects: der Wurf darf hier gar nicht erst entstehen.
      await expect(serve(asReq(url), asRes(res))).resolves.toBe(true);
      expect(res.statusCode).toBe(400);
      expect(res.body).toBe('Ungültiger Pfad');
    },
  );

  it('liefert einen gueltigen Pfad weiterhin aus dem Mount aus', async () => {
    const res = fakeResponse();
    await expect(serve(asReq('/play/index.html'), asRes(res))).resolves.toBe(true);
    // Verzeichnis fehlt, also 503 - entscheidend ist: keine Ablehnung.
    expect(res.statusCode).toBe(503);
  });

  it('laesst einen fremden Pfad unbehandelt', async () => {
    const res = fakeResponse();
    await expect(serve(asReq('/etwas/anderes'), asRes(res))).resolves.toBe(false);
  });
});

describe('HTTP-Einstieg', () => {
  it('beantwortet eine abgelehnte Auslieferung mit 500, statt den Prozess zu beenden', async () => {
    const listener = makeRequestListener(() => Promise.reject(new Error('Probe: kaputt')));
    const res = fakeResponse();
    expect(() => listener(asReq('/play/%'), asRes(res))).not.toThrow();
    await res.done;
    expect(res.statusCode).toBe(500);
  });

  it('beantwortet einen unbekannten Pfad mit 404', async () => {
    const listener = makeRequestListener(() => Promise.resolve(false));
    const res = fakeResponse();
    listener(asReq('/gibt-es-nicht'), asRes(res));
    await res.done;
    expect(res.statusCode).toBe(404);
  });

  it('leitet die Wurzel auf das Spielgeraet um', () => {
    const listener = makeRequestListener(() => Promise.reject(new Error('darf nicht laufen')));
    const res = fakeResponse();
    listener(asReq('/'), asRes(res));
    expect(res.statusCode).toBe(302);
    expect(res.headers['location']).toBe('/play/');
  });
});
