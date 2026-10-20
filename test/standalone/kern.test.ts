import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { DEMO_TEXT, parseQuiz, pruefbericht } from '@quizbude/core';
// @ts-expect-error - das Werkzeug ist bewusst reines JavaScript ohne Typen.
import {
  ANFANG,
  ENDE,
  erzeugeBlock,
  lesBlock,
  schreibeBlock,
  SEITE,
} from '../../tools/standalone-parser.mjs';

/**
 * Der Riegel gegen Auseinanderlaufen (Ruling 1a).
 *
 * `packages/core` ist TypeScript mit Bauschritt, `standalone/quizbude.html`
 * ist eine Datei ohne jeden Bauschritt. "Ein Parser" haelt nur, wenn
 * irgendetwas rot wird, sobald die ausgelieferte Datei nicht mehr aus dem
 * heutigen Kern stammt. Genau das tut die erste Pruefung hier.
 *
 * Die uebrigen Pruefungen fahren den ausgelieferten Block wirklich aus -
 * nicht den Kern daneben. Ein Uebersetzungsschritt, der etwas verliert,
 * waere sonst unsichtbar.
 */

const seite = (): string => readFileSync(SEITE as string, 'utf8');

function blockAusSeite(): string {
  const block = lesBlock(seite()) as string | null;
  if (block === null) throw new Error('In der Seite fehlen die Marker KERN ANFANG / KERN ENDE.');
  return block;
}

/** Genau der Code, der ausgeliefert wird - ausgefuehrt, nicht gelesen. */
function kernAusSeite(): Record<string, (...args: never[]) => unknown> {
  const rumpf = blockAusSeite().slice((ANFANG as string).length, -(ENDE as string).length);
  return new Function(`${rumpf}\nreturn Kern;`)() as Record<string, (...args: never[]) => unknown>;
}

/**
 * Eine Funktion aus der ausgelieferten Seite herausschneiden und
 * ausfuehren. Ein Waechter, der nur `innerHTML` und `esc` im Text sucht,
 * bindet die Schreibweise; dieser hier bindet das Verhalten der Fassung,
 * die beim Nutzer laeuft.
 */
function stueckeAusSeite(namen: readonly string[], kern: unknown): Record<string, unknown> {
  const html = seite();
  const von = html.indexOf('<script>') + '<script>'.length;
  const bis = html.lastIndexOf('</script>');
  const js = html.slice(von, bis);
  const sf = ts.createSourceFile('seite.js', js, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const gefunden = new Map<string, string>();
  for (const stmt of sf.statements) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name !== undefined && namen.includes(stmt.name.text)) {
      gefunden.set(stmt.name.text, stmt.getText(sf));
    } else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && namen.includes(d.name.text)) {
          gefunden.set(d.name.text, stmt.getText(sf));
        }
      }
    }
  }
  const fehlend = namen.filter((n) => !gefunden.has(n));
  if (fehlend.length > 0) {
    throw new Error(`In der Seite fehlen: ${fehlend.join(', ')}`);
  }
  const quelle = [...new Set(gefunden.values())].join('\n');
  return new Function(
    'Kern',
    `${quelle}\nreturn { ${namen.map((n) => `${n}: ${n}`).join(', ')} };`,
  )(kern) as Record<string, unknown>;
}

function funktionAusSeite(name: string, kern: unknown, mit: readonly string[] = []): unknown {
  return stueckeAusSeite([name, ...mit], kern)[name];
}

describe('Ein Parser, zwei Fassungen', () => {
  it('die ausgelieferte Seite traegt genau den heutigen Kern', () => {
    // Wird dieser Test rot, ist nichts kaputt - es fehlt ein Lauf:
    //   node tools/standalone-parser.mjs --schreiben
    expect(blockAusSeite()).toBe(erzeugeBlock() as string);
  });

  it('der Riegel haengt nicht an den Zeilenenden der Arbeitskopie', () => {
    // Git schreibt die Seite auf Windows mit CRLF aus. Ein Riegel, der
    // allein deshalb nach jedem frischen Klon rot ist, wird abgeschaltet -
    // und dann faellt auch das Auseinanderlaufen nicht mehr auf.
    const alsCrlf = seite().split('\n').join('\r\n').split('\r\r\n').join('\r\n');
    expect(lesBlock(alsCrlf)).toBe(erzeugeBlock() as string);
    // Und umgekehrt: ein Schreibvorgang laesst die Zeilenenden, wie sie sind.
    const geschrieben = schreibeBlock(alsCrlf, erzeugeBlock()) as string;
    expect(geschrieben.includes('\r\n')).toBe(true);
    expect(lesBlock(geschrieben)).toBe(erzeugeBlock() as string);
  });

  it('die Seite haelt keine zweite Fassung des Parsers', () => {
    const html = seite();
    const rumpf = html.slice(html.indexOf(ENDE as string));
    expect(rumpf).not.toMatch(/function\s+parseQuiz\s*\(/u);
    expect(rumpf).toContain('const parseQuiz = Kern.parseQuiz;');
    expect(rumpf).toContain('const DEMO_TEXT = Kern.DEMO_TEXT;');
  });

  it('der ausgelieferte Block laeuft und liest die Demorunde', () => {
    const kern = kernAusSeite();
    const erg = (kern['parseQuiz'] as (t: string) => { ok: boolean; questions: unknown[] })(
      (kern['DEMO_TEXT'] as unknown as string),
    );
    expect(erg.ok).toBe(true);
    expect(erg.questions).toHaveLength(2);
  });

  it('der ausgelieferte Block antwortet auf jede Probe wie der Kern', () => {
    const kern = kernAusSeite();
    const ausSeite = kern['parseQuiz'] as (t: string) => unknown;
    const proben: readonly string[] = [
      DEMO_TEXT,
      'Frage? | 20\n* Merkur\n* Venus',
      '```json\n{"fragen":[{"frage":"F?","antworten":["*A","B"]}]}\n```',
      'Hier sind deine Fragen:\n\n1. **Frage?** | 7\n* A) ✅ Ja\nb) Nein\n\nViel Spass',
      'Frage? | 20\n*\\* Stern\nVenus',
      'Frage? | 400\n* A\nB',
      '   ',
    ];
    for (const probe of proben) {
      expect(JSON.stringify(ausSeite(probe)), probe).toBe(JSON.stringify(parseQuiz(probe)));
    }
  });

  it('der ausgelieferte Block rechnet dieselbe Spieldauer', () => {
    const kern = kernAusSeite();
    const ausSeite = kern['pruefbericht'] as (e: unknown) => { dauerMs: number };
    const erg = (kern['parseQuiz'] as (t: string) => unknown)(DEMO_TEXT);
    expect(ausSeite(erg).dauerMs).toBe(pruefbericht(parseQuiz(DEMO_TEXT)).dauerMs);
  });

  it('die Anweisung fuer die KI steht in der Oberflaeche, nicht nur im Kern', () => {
    const html = seite();
    expect(html).toContain('id="ki-anweisung"');
    expect(html).toContain('id="btn-anweisung-kopieren"');
    expect(html).toContain("$('ki-anweisung').textContent = Kern.KI_ANWEISUNG;");
    // Der Rueckfall, wenn navigator.clipboard abgelehnt wird.
    expect(html).toContain('selectNodeContents');
  });

  it('die Oberflaeche nimmt Datei, Ablegen und Einfuegen', () => {
    const html = seite();
    expect(html).toContain('id="dateifeld"');
    expect(html).toContain('id="ablage"');
    expect(html).toContain('id="editorfeld"');
    expect(html).toContain('new FileReader()');
    expect(html).toMatch(/zone\.addEventListener\('drop'/u);
  });
});

describe('Sicherheitsnaht der ausgelieferten Seite', () => {
  const boese =
    '<img src=x onerror=alert(1)> "Anfuehrung" \'einfach\' & <script>alert(1)</script>';

  it('berichtHtml entschaerft Titel, Dauer und jede Meldung', () => {
    const kern = kernAusSeite();
    const berichtHtml = funktionAusSeite('berichtHtml', kern) as (b: unknown) => string;
    const html = berichtHtml({
      ok: false,
      titel: boese,
      fragenzahl: 1,
      dauerText: boese,
      hinweise: [boese],
      fehler: [{ zeile: 7, text: boese }],
    });
    // Kein rohes spitzes Klammerpaar aus der Fremdeingabe darf stehen bleiben.
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&quot;Anfuehrung&quot;');
    expect(html).toContain('&#39;einfach&#39;');
    expect(html).toContain('&amp;');
    expect(html).toContain('<b>Zeile 7:</b>');
  });

  it('berichtHtml entschaerft auch den guten Fall', () => {
    const kern = kernAusSeite();
    const berichtHtml = funktionAusSeite('berichtHtml', kern) as (b: unknown) => string;
    const html = berichtHtml({
      ok: true,
      titel: boese,
      fragenzahl: 2,
      dauerText: 'etwa 2 Minuten',
      hinweise: [],
      fehler: [],
    });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('eine Frage mit spitzen Klammern kommt entschaerft auf die Kachel', () => {
    // setzeKachel ist die eine Stelle, an der Antworttexte in die Seite
    // gehen. Sie wird hier mit einem nachgebauten Element ausgefuehrt -
    // der Quelltext ist der ausgelieferte.
    const kern = kernAusSeite();
    const setzeKachel = funktionAusSeite('setzeKachel', kern, [
      'esc',
      'tileColorIndex',
      'FARBEN',
      'FORMEN',
    ]) as (
      el: unknown,
      display: number,
      anzahl: number,
      label: string | null,
      interaktiv: boolean,
    ) => void;
    const el = {
      dataset: {} as Record<string, string>,
      innerHTML: '',
      classList: { toggle: (): void => undefined },
    };
    setzeKachel(el, 0, 4, boese, false);
    expect(el.innerHTML).not.toContain('<img');
    expect(el.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });
});
