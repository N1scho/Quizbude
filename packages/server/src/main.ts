/**
 * Nur Verdrahtung.
 *
 * Alles, was beim Hochfahren entschieden wird - Port, Bindung, Exit-Code,
 * Browser-Adresse, vor oder nach dem `listening` -, steht in
 * `runtime/startup.ts` und ist dort gebunden. Was hier steht, ist der
 * Anschluss an den echten Prozess: echter Server, echte Konsole, echter
 * Browser.
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { makeRequestListener } from './http/requestListener.js';
import { makeStaticHandler } from './http/static.js';
import { stageBanner } from './runtime/banner.js';
import { browserCommand } from './runtime/browser.js';
import { lanAddresses } from './runtime/network.js';
import { createRuntime } from './runtime/startup.js';
import { attachGateway } from './transport/socketio/gateway.js';
import { MAX_SOCKET_MESSAGE_BYTES } from './transport/socketio/validate.js';

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
  // B3: Die Vorgabe von Socket.IO sind 1e6 Bytes - weniger, als eine
  // erlaubte Fragendatei am Draht gross werden kann. Hergeleitet wird das
  // Mass aus MAX_UPLOAD_BYTES; die Rechnung steht bei der Konstante.
  maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
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

const runtime = createRuntime(http, {
  env: process.env,
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line, detail) => {
    // Ohne diese Unterscheidung steht hinter jeder Meldung ohne Anlass
    // ein nacktes "undefined".
    if (detail === undefined) console.error(line);
    else console.error(line, detail);
  },
  exit: (code) => process.exit(code),
  openStage,
  banner: (port) =>
    stageBanner({ port, addresses: lanAddresses(networkInterfaces()), rooms: registry.size }),
});

// Zusaetzliches Netz, kein Ersatz fuer die Behandlung an der Fehlerstelle.
// Vor dem `listening` ist ein unbehandelter Wurf das Ende des Starts, danach
// darf er den Abend nicht beenden - entschieden wird das in `startup.ts`.
process.on('uncaughtException', (error: unknown) => runtime.onUncaught(error));
process.on('unhandledRejection', (reason: unknown) => runtime.onUncaught(reason));

runtime.start();
