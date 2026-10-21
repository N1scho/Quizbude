import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { MAX_SOCKET_MESSAGE_BYTES } from './validate.js';

/**
 * Der eine Ort, an dem der Socket.IO-Server der Buehne entsteht.
 *
 * Vorher stand er in `main.ts` und ein zweites Mal, von Hand nachgebaut,
 * im Testharness. Beide Fassungen mussten dieselben Masse tragen, und
 * gebunden war das nur dadurch, dass ein bestimmter Textschnipsel in
 * `main.ts` vorkam (N3). Eine einzige Zeile hinter der Konstruktion -
 * `io.engine.opts.maxHttpBufferSize = 1e6;` - stellte B3 vollstaendig
 * wieder her, waehrend alle 309 Tests gruen blieben und `tsc` schwieg.
 *
 * Seitdem baut `main.ts` den Server nicht mehr selbst, sondern nimmt den
 * hier gebauten und reicht ihn durch. Damit gibt es dort kein `io` mehr,
 * auf das sich eine solche Zeile stuetzen koennte, und die Masse stehen an
 * einer Stelle, die ein Verhaltenstest wirklich hochfahren kann
 * (`test/server/socketBuffer.test.ts`).
 */
export function createSocketServer(http: HttpServer): Server {
  return new Server(http, {
    // Harte Betriebsvorgabe aus Konzept 6.6: eingeschaltet reserviert zlib
    // je Verbindung sechsstellige Byte-Betraege.
    perMessageDeflate: false,
    // B3: Die Vorgabe von Socket.IO sind 1e6 Bytes - weniger, als eine
    // erlaubte Fragendatei am Draht gross werden kann. Hergeleitet wird das
    // Mass aus MAX_UPLOAD_BYTES; die Rechnung steht bei der Konstante.
    maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
    cors: { origin: true },
  });
}
