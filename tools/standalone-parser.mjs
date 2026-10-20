/**
 * Ein Parser, zwei Fassungen.
 *
 * `packages/core` ist TypeScript mit einem Bauschritt, `standalone/quizbude.html`
 * ist eine einzige Datei ohne jeden Bauschritt. "Ein Parser" heisst deshalb
 * nicht "zweimal dasselbe sorgfaeltig abgeschrieben" - das haelt drei Monate.
 * Es heisst: der Kern wird uebersetzt und in die Seite geschrieben, und ein
 * Test bindet, dass die ausgelieferte Datei aktuell ist.
 *
 * Aufruf:
 *   node tools/standalone-parser.mjs            - nur pruefen (Exit 1 bei Drift)
 *   node tools/standalone-parser.mjs --schreiben - Block in die Seite schreiben
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Die Seite ist eine Datei ohne Bauschritt. Der Pfad steht hier, nicht im Test. */
export const SEITE = join(ROOT, 'standalone', 'quizbude.html');

/**
 * Reihenfolge zaehlt: `parse.ts` benutzt Konstanten und Lesefenster.
 * Mehr als diese drei Dateien darf der Block nicht brauchen - sonst zieht
 * er `@quizbude/protocol` und die halbe Engine hinterher.
 */
export const QUELLEN = [
  'packages/core/src/engine/constants.ts',
  'packages/core/src/engine/reading.ts',
  'packages/core/src/questions/parse.ts',
];

export const ANFANG = '/* === KERN ANFANG - erzeugt aus packages/core/src, nicht von Hand aendern === */';
export const ENDE = '/* === KERN ENDE === */';

function sourceFile(text, name) {
  return ts.createSourceFile(name, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS);
}

/**
 * Importe und das Schluesselwort `export` entfernen - mehr nicht. Der
 * uebrige Quelltext bleibt Zeichen fuer Zeichen stehen, damit der Block
 * lesbar bleibt und ein Diff zeigt, was sich wirklich geaendert hat.
 */
function entferneModulgeruest(text, name) {
  const sf = sourceFile(text, name);
  const schnitte = [];
  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) || ts.isImportEqualsDeclaration(stmt)) {
      schnitte.push([stmt.getStart(sf), stmt.end]);
      continue;
    }
    const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    if (modifiers === undefined) continue;
    for (const m of modifiers) {
      if (m.kind === ts.SyntaxKind.ExportKeyword) schnitte.push([m.getStart(sf), m.end + 1]);
    }
  }
  schnitte.sort((a, b) => b[0] - a[0]);
  let out = text;
  for (const [von, bis] of schnitte) out = out.slice(0, von) + out.slice(bis);
  return out;
}

/**
 * Jeder exportierte Wert - Funktion oder Konstante. Typen und Schnittstellen
 * bleiben draussen, die gibt es im uebersetzten Code nicht mehr. Die Liste
 * entsteht aus dem Quelltext, damit ein neuer Export nicht von Hand
 * nachgetragen werden muss und dabei vergessen wird.
 */
function exportierteWerte(text, name) {
  const sf = sourceFile(text, name);
  const namen = [];
  for (const stmt of sf.statements) {
    const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
    const exportiert = (modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exportiert) continue;
    if (ts.isFunctionDeclaration(stmt) && stmt.name !== undefined) {
      namen.push(stmt.name.text);
    } else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) namen.push(d.name.text);
      }
    }
  }
  return namen;
}

/** Der fertige Block, so wie er in der Seite steht - ohne die Marker. */
export function erzeugeRumpf() {
  const stuecke = [];
  const namen = [];
  for (const rel of QUELLEN) {
    const text = readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n?/g, '\n');
    stuecke.push(`// ---- ${rel} ----\n${entferneModulgeruest(text, rel)}`);
    namen.push(...exportierteWerte(text, rel));
  }

  const ts_quelle = `${stuecke.join('\n')}\n`;
  const uebersetzt = ts.transpileModule(ts_quelle, {
    fileName: 'kern.ts',
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.None,
      newLine: ts.NewLineKind.LineFeed,
      removeComments: true,
      isolatedModules: false,
    },
  }).outputText;

  const rueckgabe = [...new Set(namen)].sort().map((n) => `    ${n}: ${n},`);

  return [
    'const Kern = (function () {',
    "  'use strict';",
    uebersetzt.replace(/\n+$/, ''),
    '  return {',
    ...rueckgabe,
    '  };',
    '})();',
  ].join('\n');
}

export function erzeugeBlock() {
  return `${ANFANG}\n${erzeugeRumpf()}\n${ENDE}`;
}

/** Was heute in der Seite steht. `null`, wenn die Marker fehlen. */
export function lesBlock(html) {
  const von = html.indexOf(ANFANG);
  const bis = html.indexOf(ENDE);
  if (von < 0 || bis < 0 || bis < von) return null;
  return html.slice(von, bis + ENDE.length);
}

export function schreibeBlock(html, block) {
  const von = html.indexOf(ANFANG);
  const bis = html.indexOf(ENDE);
  if (von < 0 || bis < 0 || bis < von) {
    throw new Error('In der Seite fehlen die Marker KERN ANFANG / KERN ENDE.');
  }
  return html.slice(0, von) + block + html.slice(bis + ENDE.length);
}

function main() {
  const html = readFileSync(SEITE, 'utf8');
  const soll = erzeugeBlock();
  const ist = lesBlock(html);
  if (process.argv.includes('--schreiben')) {
    writeFileSync(SEITE, schreibeBlock(html, soll), 'utf8');
    console.log('[quizbude] Kern-Block in standalone/quizbude.html geschrieben.');
    return;
  }
  if (ist === soll) {
    console.log('[quizbude] standalone/quizbude.html ist aktuell.');
    return;
  }
  console.error(
    '[quizbude] standalone/quizbude.html ist NICHT aktuell. ' +
      'Lauf: node tools/standalone-parser.mjs --schreiben',
  );
  process.exit(1);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) main();
