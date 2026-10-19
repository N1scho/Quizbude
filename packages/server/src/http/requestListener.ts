import type { IncomingMessage, ServerResponse } from 'node:http';

export type StaticHandler = (req: IncomingMessage, res: ServerResponse) => Promise<boolean>;

/**
 * Der gesamte HTTP-Pfad an einer Stelle - und zwar so, dass keine Anfrage
 * den Prozess beenden kann.
 *
 * Ohne das `.catch` wird jeder Wurf im Auslieferungspfad zur unbehandelten
 * Ablehnung, und Node 22 beendet darauf den Prozess. Weil der gesamte
 * Spielzustand im Prozessspeicher liegt, ist damit jede laufende Runde weg.
 */
export function makeRequestListener(serveStatic: StaticHandler) {
  return function onRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? '/';
    if (url === '/' || url === '/index.html') {
      res.writeHead(302, { location: '/play/' });
      res.end();
      return;
    }

    void serveStatic(req, res)
      .then((handled) => {
        if (!handled) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
        }
      })
      .catch((error: unknown) => {
        console.error('[quizbude] Anfrage abgebrochen:', error);
        if (res.writableEnded) return;
        if (!res.headersSent) {
          res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        }
        res.end('Interner Fehler');
      });
  };
}
