/**
 * Muss vor dem Start neu gebaut werden?
 *
 * Ein Abend soll nicht mit einem Minutenbau beginnen. Gebaut wird deshalb
 * nur, wenn ein `dist` fehlt oder aelter ist als die Quellen.
 *
 * Rueckgabe, bewusst herum:
 *   Exit 0  - alles aktuell, der Bau kann entfallen
 *   Exit 1  - neu bauen
 *
 * Im Zweifel wird gebaut. Jeder Fehler in dieser Datei endet deshalb mit
 * Exit 1: ein ueberfluessiger Bau kostet eine Minute, ein ausgelassener
 * kostet den Abend.
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const DIST_DIRS = [
  'packages/protocol/dist',
  'packages/core/dist',
  'packages/server/dist',
  'apps/host-web/dist',
  'apps/player-web/dist',
];

const SOURCE_DIRS = [
  'packages/protocol/src',
  'packages/core/src',
  'packages/server/src',
  'apps/host-web/src',
  'apps/player-web/src',
];

const SOURCE_FILES = [
  'package.json',
  'package-lock.json',
  'tsconfig.base.json',
  'tsconfig.json',
  'packages/protocol/package.json',
  'packages/core/package.json',
  'packages/server/package.json',
  'apps/host-web/package.json',
  'apps/host-web/index.html',
  'apps/host-web/vite.config.ts',
  'apps/player-web/package.json',
  'apps/player-web/index.html',
  'apps/player-web/vite.config.ts',
];

/** Juengste Aenderung unter einem Pfad - 0, wenn es ihn nicht gibt. */
function newest(path) {
  if (!existsSync(path)) return 0;
  const s = statSync(path);
  if (!s.isDirectory()) return s.mtimeMs;
  let max = s.mtimeMs;
  for (const entry of readdirSync(path)) {
    const t = newest(join(path, entry));
    if (t > max) max = t;
  }
  return max;
}

/** Aelteste Datei unter einem Pfad - Infinity, wenn er leer ist. */
function oldest(path) {
  if (!existsSync(path)) return 0;
  const s = statSync(path);
  if (!s.isDirectory()) return s.mtimeMs;
  let min = Infinity;
  for (const entry of readdirSync(path)) {
    const t = oldest(join(path, entry));
    if (t < min) min = t;
  }
  return min === Infinity ? 0 : min;
}

try {
  for (const d of DIST_DIRS) {
    const full = join(ROOT, d);
    if (!existsSync(full) || oldest(full) === 0) {
      console.log(`Neu bauen: ${d} fehlt.`);
      process.exit(1);
    }
  }

  let aeltestesErgebnis = Infinity;
  for (const d of DIST_DIRS) {
    const t = oldest(join(ROOT, d));
    if (t < aeltestesErgebnis) aeltestesErgebnis = t;
  }

  let juengsteQuelle = 0;
  for (const d of [...SOURCE_DIRS, ...SOURCE_FILES]) {
    const t = newest(join(ROOT, d));
    if (t > juengsteQuelle) juengsteQuelle = t;
  }

  if (juengsteQuelle > aeltestesErgebnis) {
    console.log('Neu bauen: die Quellen sind neuer als das letzte Ergebnis.');
    process.exit(1);
  }

  console.log('Der letzte Bau ist noch aktuell.');
  process.exit(0);
} catch (error) {
  console.log('Neu bauen: der Stand liess sich nicht pruefen -', String(error));
  process.exit(1);
}
