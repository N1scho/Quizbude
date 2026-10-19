import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { makeRequestListener } from './http/requestListener.js';
import { makeStaticHandler } from './http/static.js';
import { attachGateway } from './transport/socketio/gateway.js';

// Zusaetzliches Netz, kein Ersatz fuer die Behandlung an der Fehlerstelle:
// ein uebersehener Pfad darf den Abend nicht beenden.
process.on('uncaughtException', (error: unknown) => {
  console.error('[quizbude] Unbehandelter Fehler - der Server laeuft weiter:', error);
});
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[quizbude] Unbehandelte Ablehnung - der Server laeuft weiter:', reason);
});

const PORT = Number(process.env['PORT'] ?? 3000);

const hostDir = fileURLToPath(new URL('../../../apps/host-web/dist', import.meta.url));
const playerDir = fileURLToPath(new URL('../../../apps/player-web/dist', import.meta.url));

const serveStatic = makeStaticHandler([
  { prefix: '/host/', dir: hostDir },
  { prefix: '/play/', dir: playerDir },
]);

const http = createServer(makeRequestListener(serveStatic));

const io = new Server(http, {
  // Harte Betriebsvorgabe aus Konzept 6.6: eingeschaltet reserviert zlib
  // je Verbindung sechsstellige Byte-Betraege.
  perMessageDeflate: false,
  cors: { origin: true },
});

const registry = attachGateway(io);

// Das Netz oben faengt sonst auch einen Startfehler ab und der Prozess
// endete still mit 0. Ein Server, der nicht hochkommt, muss das sagen.
http.on('error', (error: unknown) => {
  console.error('[quizbude] Server kann nicht starten:', error);
  process.exit(1);
});

http.listen(PORT, () => {
  console.info(`[quizbude] Bühne      http://localhost:${PORT}/host/`);
  console.info(`[quizbude] Spielgerät http://localhost:${PORT}/play/`);
  console.info(`[quizbude] Räume im Speicher: ${registry.size}`);
});
