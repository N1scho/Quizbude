import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { makeRequestListener } from './http/requestListener.js';
import { makeStaticHandler } from './http/static.js';
import { stageBanner } from './runtime/banner.js';
import { OPEN_FLAG, browserCommand, shouldOpenBrowser } from './runtime/browser.js';
import { lanAddresses } from './runtime/network.js';
import { DEFAULT_PORT, decideAfterListenError, portSequence } from './runtime/ports.js';
import { attachGateway } from './transport/socketio/gateway.js';

// Zusaetzliches Netz, kein Ersatz fuer die Behandlung an der Fehlerstelle:
// ein uebersehener Pfad darf den Abend nicht beenden.
process.on('uncaughtException', (error: unknown) => {
  console.error('[quizbude] Unbehandelter Fehler - der Server laeuft weiter:', error);
});
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[quizbude] Unbehandelte Ablehnung - der Server laeuft weiter:', reason);
});

// Ein ausdruecklich gesetzter PORT ist eine Ansage, keine Vorliebe: dann
// wird nicht ausgewichen. Ohne ihn sucht der Server sich einen freien.
const rawPort = process.env['PORT'];
const portWasChosenByUser = rawPort !== undefined && rawPort.trim() !== '';
const sequence = portWasChosenByUser ? [Number(rawPort)] : portSequence();
let port = sequence[0] ?? DEFAULT_PORT;

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

function openStage(url: string): void {
  const { command, args } = browserCommand(process.platform, url);
  try {
    const child = spawn(command, [...args], { detached: true, stdio: 'ignore' });
    // Ein fehlender Browserbefehl darf den laufenden Server nicht stoeren.
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // Dann oeffnet der Gastgeber die Seite eben selbst.
  }
}

// Das Netz oben faengt sonst auch einen Startfehler ab und der Prozess
// endete still mit 0. Ein Server, der nicht hochkommt, muss das sagen.
http.on('error', (error: unknown) => {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const decision = decideAfterListenError({ code, current: port, portWasChosenByUser, sequence });
  if (decision.kind === 'retry') {
    console.warn(`[quizbude] Port ${port} ist belegt - ich nehme ${decision.port}.`);
    port = decision.port;
    http.listen(port);
    return;
  }
  console.error('[quizbude] Server kann nicht starten:', error);
  console.error(`[quizbude] ${decision.reason}`);
  process.exit(1);
});

http.on('listening', () => {
  for (const line of stageBanner({ port, addresses: lanAddresses(networkInterfaces()), rooms: registry.size })) {
    console.info(line);
  }
  if (shouldOpenBrowser(process.env[OPEN_FLAG])) openStage(`http://localhost:${port}/host/`);
});

http.listen(port);
