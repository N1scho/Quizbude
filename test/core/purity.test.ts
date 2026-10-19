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

  it('importiert ausser protocol kein weiteres Paket', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const re = /from\s+'([^']+)'/g;
      let m: RegExpExecArray | null = re.exec(source);
      while (m !== null) {
        const spec = m[1] as string;
        const isRelative = spec.startsWith('.');
        if (!isRelative && spec !== '@quizbude/protocol') {
          offenders.push(`${file}: ${spec}`);
        }
        m = re.exec(source);
      }
    }
    expect(offenders).toEqual([]);
  });
});
