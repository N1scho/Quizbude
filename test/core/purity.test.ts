import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importSpezifizierer } from '../quelltext.js';

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
 * Seiteneffekt-Importe, dynamische Importe, `import x = require(...)` und
 * `require` - und jede davon auch dann, wenn der Spezifizierer auf einer
 * anderen Zeile steht als sein Schluesselwort.
 *
 * B2: Zwei Fassungen dieses Waechters sind an ihrem eigenen Lexer
 * gescheitert. Die zeilenweise kannte keinen Zeilenumbruch; die
 * ganzdateiige kannte keine String-Grenzen - ein Kommentaranfang in einem
 * Stringliteral eroeffnete ihr einen Kommentar, der bis zum naechsten
 * Kommentarende alles verschluckte, echte Importe eingeschlossen. Beide
 * Male hat ein regulaerer Ausdruck so getan, als koenne er JavaScript
 * zerlegen. Jede Lueckenschliessung riss die naechste Lueche auf.
 *
 * Deshalb zerlegt den Quelltext jetzt der TypeScript-Parser
 * (`test/quelltext.ts`). TypeScript liegt ohnehin als
 * Entwicklungsabhaengigkeit im Projekt, laeuft ausschliesslich im Testlauf,
 * und `packages/core` bleibt unberuehrt: der Waechter liest core, er wird
 * nicht von core geladen.
 */
export function specifiersOf(source: string): string[] {
  return importSpezifizierer(source);
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
    it(`${relative(CORE_SRC, file).split(sep).join('/')} enthaelt keine Uhr, keinen Zufall, keinen Timer`, () => {
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
    expect(
      specifiersOf(`export const load = () =>
  import(
    "node:crypto"
  );`),
    ).toEqual(['node:crypto']);
    expect(
      specifiersOf(`import {
  randomUUID,
} from
  "node:crypto";`),
    ).toEqual(['node:crypto']);
    // Auch der mehrzeilige Blockkommentar bleibt ein Kommentar.
    expect(
      specifiersOf(`/*
 * import 'node:crypto';
 */`),
    ).toEqual([]);

    // B2: Ein Kommentarzeichen in einem Stringliteral ist kein Kommentar.
    // Die ganzdateiige Kommentarentfernung las hier einen Kommentar vom
    // ersten bis zum zweiten Literal und verschluckte den echten Import
    // dazwischen. Einundzwanzig von einundzwanzig blieben gruen, obwohl
    // core in der Probe wirklich node:crypto importierte.
    expect(
      specifiersOf(`const muster = '/*';
import { randomUUID } from 'node:crypto';
const ende = '*/';`),
    ).toEqual(['node:crypto']);
    // Dieselbe Falle mit dem Zeilenkommentar, Import auf derselben Zeile.
    expect(specifiersOf(`const muster = '//'; import 'node:crypto';`)).toEqual(['node:crypto']);

    // Die Gegenrichtung: ein Importsatz, der nur in einem Text steht, ist
    // kein Import - weder im String noch im Template-Literal.
    expect(specifiersOf(`const beispiel = "import 'node:crypto';";`)).toEqual([]);
    expect(specifiersOf('const beispiel = `import "node:crypto";`;')).toEqual([]);

    // Ein dynamischer Import mit Template-Literal ist dagegen einer, und
    // `import x = require(...)` ebenfalls.
    expect(specifiersOf('export const load = () => import(`node:crypto`);')).toEqual([
      'node:crypto',
    ]);
    expect(specifiersOf(`import fs = require('node:fs');`)).toEqual(['node:fs']);
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
