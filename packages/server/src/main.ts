import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { makeStaticHandler } from './http/static.js';
import { attachGateway } from './transport/socketio/gateway.js';

const PORT = Number(process.env['PORT'] ?? 3000);

const hostDir = fileURLToPath(new URL('../../../apps/host-web/dist', import.meta.url));
const playerDir = fileURLToPath(new URL('../../../apps/player-web/dist', import.meta.url));

const serveStatic = makeStaticHandler([
  { prefix: '/host/', dir: hostDir },
  { prefix: '/play/', dir: playerDir },
]);

const http = createServer((req, res) => {
  const url = req.url ?? '/';
  if (url === '/' || url === '/index.html') {
    res.writeHead(302, { location: '/play/' });
    res.end();
    return;
  }
  void serveStatic(req, res).then((handled) => {
    if (!handled) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Nicht gefunden');
    }
  });
});

const io = new Server(http, {
  // Harte Betriebsvorgabe aus Konzept 6.6: eingeschaltet reserviert zlib
  // je Verbindung sechsstellige Byte-Betraege.
  perMessageDeflate: false,
  cors: { origin: true },
});

const registry = attachGateway(io);

http.listen(PORT, () => {
  console.info(`[quizbude] Bühne      http://localhost:${PORT}/host/`);
  console.info(`[quizbude] Spielgerät http://localhost:${PORT}/play/`);
  console.info(`[quizbude] Räume im Speicher: ${registry.size}`);
});
