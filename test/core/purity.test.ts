import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Die Architekturregel aus Abschnitt 1.4: core ist rein. Eine Regel, die nur
 * in einem Dokument steht, haelt drei Wochen - diese hier faellt beim Testlauf.
 */

const CORE_SRC = fileURLToPath(new URL('../../packages/core/src', import.meta.url));

const FORBIDDEN: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  { pattern: /\bDate\.now\b/, why: 'Uhr' },
  { pattern: /\bnew Date\b/, why: 'Uhr' },
  { pattern: /\bperformance\.now\b/, why: 'Uhr' },
  { pattern: /\bMath\.random\b/, why: 'Zufall' },
  { pattern: /\bsetTimeout\b/, why: 'Timer' },
  { pattern: /\bsetInterval\b/, why: 'Timer' },
  { pattern: /\bqueueMicrotask\b/, why: 'Timer' },
  { pattern: /\bprocess\./, why: 'Laufzeitumgebung' },
  { pattern: /\brequire\(/, why: 'CommonJS-Ladepfad' },
];

/**
 * Jede Importform, nicht nur `from '...'`: beide Anfuehrungszeichen,
 * Seiteneffekt-Importe, dynamische Importe und require - und jede davon
 * auch dann, wenn der Spezifizierer auf einer anderen Zeile steht als sein
 * Schluesselwort. `\s*` im Muster deckt den Umbruch mit ab, sobald das
 * Muster ueber der ganzen Datei laeuft statt Zeile fuer Zeile (NR3).
 */
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*|\brequire\s*)\(?\s*['"]([^'"]+)['"]/g;

/**
 * Kommentare raus, Zeilenstruktur bleibt stehen: ein Kommentar darf einen
 * Import nennen, ohne einer zu sein.
 */
function ohneKommentare(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

export function specifiersOf(source: string): string[] {
  const code = ohneKommentare(source);
  const out: string[] = [];
  SPECIFIER_RE.lastIndex = 0;
  let m: RegExpExecArray | null = SPECIFIER_RE.exec(code);
  while (m !== null) {
    out.push(m[1] as string);
    m = SPECIFIER_RE.exec(code);
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('Purity von core', () => {
  const files = walk(CORE_SRC);

  it('findet ueberhaupt Dateien (sonst prueft der Test nichts)', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    it(`${file.slice(CORE_SRC.length + 1).replace(/\\/g, '/')} enthaelt keine Uhr, keinen Zufall, keinen Timer`, () => {
      const source = readFileSync(file, 'utf8');
      const hits: string[] = [];
      source.split('\n').forEach((line, i) => {
        // Kommentarzeilen duerfen die verbotenen Namen nennen.
        const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '');
        for (const f of FORBIDDEN) {
          if (f.pattern.test(code)) hits.push(`${i + 1}: ${f.why} -> ${line.trim()}`);
        }
      });
      expect(hits).toEqual([]);
    });
  }

  it('die Importpruefung erkennt jede Schreibweise', () => {
    // Ein Muster, das nur `from '...'` kennt, laesst doppelte
    // Anfuehrungszeichen, Seiteneffekt-Importe und dynamische Importe
    // unentdeckt durch - und damit genau die Erosion, gegen die es steht.
    expect(specifiersOf(`import "node:crypto";`)).toEqual(['node:crypto']);
    expect(specifiersOf(`import { randomUUID } from "node:crypto";`)).toEqual(['node:crypto']);
    expect(specifiersOf(`import 'node:crypto';`)).toEqual(['node:crypto']);
    expect(specifiersOf(`export const load = () => import('node:crypto');`)).toEqual([
      'node:crypto',
    ]);
    expect(specifiersOf(`export const load = () => import("node:crypto");`)).toEqual([
      'node:crypto',
    ]);
    expect(specifiersOf(`export * from './x.js';`)).toEqual(['./x.js']);
    expect(specifiersOf(`export type { A } from "@quizbude/protocol";`)).toEqual([
      '@quizbude/protocol',
    ]);
    expect(specifiersOf(`const fs = require("node:fs");`)).toEqual(['node:fs']);
    expect(specifiersOf(`// import 'node:crypto';`)).toEqual([]);

    // NR3: Ein Umbruch zwischen Schluesselwort und Spezifizierer ist eine
    // Schreibweise wie jede andere. Zeilenweise Erkennung lief hier durch.
    expect(specifiersOf('export const load = () => import(\n  "node:crypto"\n);')).toEqual([
      'node:crypto',
    ]);
    expect(specifiersOf('import {\n  randomUUID,\n} from\n  "node:crypto";')).toEqual([
      'node:crypto',
    ]);
    // Auch der mehrzeilige Blockkommentar bleibt ein Kommentar.
    expect(specifiersOf("/*\n * import 'node:crypto';\n */")).toEqual([]);
  });

  it('die Importpruefung findet in core ueberhaupt Importe', () => {
    // Ohne diese Zusicherung waere ein kaputtes Muster still gruen.
    const all = files.flatMap((file) => specifiersOf(readFileSync(file, 'utf8')));
    expect(all.length).toBeGreaterThan(20);
    expect(all).toContain('@quizbude/protocol');
  });

  it('importiert ausser protocol kein weiteres Paket', () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const spec of specifiersOf(readFileSync(file, 'utf8'))) {
        const isRelative = spec.startsWith('.');
        if (!isRelative && spec !== '@quizbude/protocol') {
          offenders.push(`${file}: ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
