import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface Mount {
  /** URL-Praefix mit fuehrendem und abschliessendem Schraegstrich, z. B. /host/ */
  readonly prefix: string;
  /** Verzeichnis mit dem gebauten Frontend. */
  readonly dir: string;
}

async function tryFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/**
 * Minimale Auslieferung der beiden gebauten Oberflaechen. Kein Framework:
 * der Durchstich braucht genau zwei statische Verzeichnisse und sonst nichts.
 */
export function makeStaticHandler(mounts: readonly Mount[]) {
  return async function serve(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    for (const mount of mounts) {
      if (pathname + '/' === mount.prefix) {
        res.writeHead(302, { location: mount.prefix });
        res.end();
        return true;
      }
      if (!pathname.startsWith(mount.prefix)) continue;

      const relative = pathname.slice(mount.prefix.length) || 'index.html';
      const safe = normalize(relative).replace(/^(\.\.[/\\])+/, '');
      if (safe.startsWith('..') || safe.includes(`..${sep}`)) {
        res.writeHead(400).end('Ungültiger Pfad');
        return true;
      }

      let file = join(mount.dir, safe);
      if (!(await tryFile(file))) file = join(mount.dir, 'index.html');
      if (!(await tryFile(file))) {
        res
          .writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
          .end('Oberfläche ist nicht gebaut. Bitte "npm run build" ausführen.');
        return true;
      }

      res.writeHead(200, {
        'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
        'cache-control': 'no-cache',
      });
      createReadStream(file).pipe(res);
      return true;
    }

    return false;
  };
}
