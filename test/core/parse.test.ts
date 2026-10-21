import { describe, expect, it } from 'vitest';
import {
  ANNOUNCE_MS,
  DEMO_TEXT,
  MAX_OPTION_CHARS,
  MAX_PROMPT_CHARS,
  MAX_QUESTIONS,
  MAX_TITLE_CHARS,
  ESTIMATE_REVEAL_MS,
  ESTIMATE_SCOREBOARD_MS,
  createDefaultRegistry,
  dauerText,
  dekodiereUtf8,
  escapeHtml,
  loadQuestion,
  parseQuiz,
  pruefbericht,
  readingWindowMs,
  schaetzeDauerMs,
  siehtNachJsonAus,
  type ParsedSingleChoiceSpec,
  type ParsedTrueFalseSpec,
} from '@quizbude/core';

/**
 * Der Autor einer Fragendatei ist ein Sprachmodell. Die Tests teilen sich
 * danach in zwei Haelften: was stillschweigend verdaut wird (Beiwerk des
 * Werkzeugs) und was laut auffaellt (Inhalt des Autors).
 */

function meldungen(text: string): string[] {
  return parseQuiz(text).fehler.map((f) => `Zeile ${f.zeile}: ${f.text}`);
}

const EINFACH = ['Welcher Planet ist der Sonne am naechsten? | 20', '* Merkur', 'Venus'].join('\n');

describe('Zeilenformat: der Normalfall', () => {
  it('liest die Demorunde', () => {
    const erg = parseQuiz(DEMO_TEXT);
    expect(erg.fehler).toEqual([]);
    expect(erg.ok).toBe(true);
    expect(erg.titel).toBe('Quizbude — Demorunde');
    expect(erg.questions).toHaveLength(2);
    expect(erg.questions[0]?.type).toBe('single_choice');
    expect(erg.questions[0]?.timeLimitMs).toBe(20_000);
    expect(erg.questions[1]?.type).toBe('true_false');
    expect((erg.questions[1]?.spec as ParsedTrueFalseSpec).correct).toBe(true);
  });

  it('gibt Fragen heraus, die der Kern danach ohne Murren laedt', () => {
    // Die Tuer, durch die jede Quelle muss (questions/load.ts). Ein Parser,
    // der etwas herausgibt, das `loadQuestion` ablehnt, ist kaputt - und
    // das faellt sonst erst im Spiel auf.
    const registry = createDefaultRegistry();
    const erg = parseQuiz(DEMO_TEXT);
    for (const q of erg.questions) {
      expect(() => loadQuestion(q, registry)).not.toThrow();
    }
  });

  it('nimmt ohne Zahl hinter dem Strich 20 Sekunden', () => {
    expect(parseQuiz(EINFACH.replace(' | 20', '')).questions[0]?.timeLimitMs).toBe(20_000);
  });

  it('nimmt die Erklaerung mit', () => {
    const erg = parseQuiz(`${EINFACH}\n> Weil er innen liegt.`);
    expect((erg.questions[0]?.spec as ParsedSingleChoiceSpec).explanation).toBe(
      'Weil er innen liegt.',
    );
  });
});

describe('Beiwerk des Werkzeugs wird stillschweigend verdaut', () => {
  it('Code-Zaeune, auch mit Sprachangabe', () => {
    // Nicht nur "keine Fehler": ohne das Entfernen der Zaunzeilen wird die
    // Zaunzeile selbst zum Fragetext und die echte Frage zur Antwort - und
    // ein Test, der nur Fehlerzahl und Fragenzahl prueft, bleibt dabei
    // gruen. Gebunden wird deshalb, was wirklich herauskommt.
    const erg = parseQuiz('```text\n' + EINFACH + '\n```\n');
    expect(erg.fehler).toEqual([]);
    expect(erg.questions).toHaveLength(1);
    expect(erg.questions[0]?.prompt).toBe('Welcher Planet ist der Sonne am naechsten?');
    expect((erg.questions[0]?.spec as ParsedSingleChoiceSpec).options.map((o) => o.label)).toEqual([
      'Merkur',
      'Venus',
    ]);
    expect(erg.hinweise).toEqual([]);
  });

  it('ein Vorwort der KI', () => {
    const erg = parseQuiz(`Hier sind deine 2 Fragen:\n\n${EINFACH}\n\nWas ist 2+2? | 10\n* 4\n5`);
    expect(erg.fehler).toEqual([]);
    expect(erg.questions).toHaveLength(2);
    expect(erg.hinweise.join(' ')).toContain('Vorwort');
  });

  it('ein Schlusswort der KI', () => {
    const erg = parseQuiz(`${EINFACH}\n\nWas ist 2+2? | 10\n* 4\n5\n\nViel Spass beim Quiz`);
    expect(erg.fehler).toEqual([]);
    expect(erg.questions).toHaveLength(2);
    expect(erg.hinweise.join(' ')).toContain('Schlusswort');
  });

  it('Nummerierung vor der Frage', () => {
    const erg = parseQuiz('1. Welcher Planet ist der Sonne am naechsten? | 20\n* Merkur\nVenus');
    expect(erg.fehler).toEqual([]);
    expect(erg.questions[0]?.prompt).toBe('Welcher Planet ist der Sonne am naechsten?');
  });

  it('Beschriftungen A) a) vor den Antworten', () => {
    const erg = parseQuiz('Frage? | 20\n* A) Merkur\nb) Venus\nC. Mars');
    expect(erg.fehler).toEqual([]);
    const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
    expect(spec.options.map((o) => o.label)).toEqual(['Merkur', 'Venus', 'Mars']);
  });

  it('Fettschrift und Kursivschrift', () => {
    const erg = parseQuiz('**Welcher Planet?** | 20\n* **Merkur**\n*Venus*\n`Mars`');
    expect(erg.fehler).toEqual([]);
    expect(erg.questions[0]?.prompt).toBe('Welcher Planet?');
    const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
    expect(spec.options.map((o) => o.label)).toEqual(['Merkur', 'Venus', 'Mars']);
    expect(spec.correctIndex).toBe(0);
  });

  it('Haekchen und Kreuzkasten statt Stern', () => {
    for (const marke of ['✅', '✔', '[x]', '[X]', '+']) {
      const erg = parseQuiz(`Frage? | 20\n${marke} Merkur\nVenus`);
      expect(erg.fehler, marke).toEqual([]);
      expect((erg.questions[0]?.spec as ParsedSingleChoiceSpec).correctIndex, marke).toBe(0);
    }
  });

  it('ein leerer Kasten markiert nicht', () => {
    const erg = parseQuiz('Frage? | 20\n[x] Merkur\n[ ] Venus');
    expect(erg.fehler).toEqual([]);
    const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
    expect(spec.correctIndex).toBe(0);
    expect(spec.options.map((o) => o.label)).toEqual(['Merkur', 'Venus']);
  });

  it('typografische Anfuehrungszeichen um eine Antwort', () => {
    const erg = parseQuiz('Frage? | 20\n* „Wahr“\n„Falsch“');
    expect(erg.fehler).toEqual([]);
    expect(erg.questions[0]?.type).toBe('true_false');
  });

  it('BOM, CRLF, geschuetzte Leerzeichen und Leerzeilen am Rand', () => {
    const roh = `﻿\r\n\r\nFrage? | 20\r\n* Mer kur\r\nVenus\r\n\r\n`;
    const erg = parseQuiz(roh);
    expect(erg.fehler).toEqual([]);
    expect(erg.questions[0]?.prompt).toBe('Frage?');
    // Das geschuetzte Leerzeichen steckt mitten im Antworttext. Es wegzutrimmen
    // reicht nicht - es muss ein gewoehnliches Leerzeichen werden, sonst
    // steht auf der Kachel ein Wort, das sich nicht umbrechen laesst.
    expect((erg.questions[0]?.spec as ParsedSingleChoiceSpec).options[0]?.label).toBe('Mer kur');
  });

  it('auch ein alleinstehendes Wagenruecklaufzeichen trennt Zeilen', () => {
    // Ohne diese Probe blieb die Normalisierung ungebunden: Trimmen allein
    // raeumt BOM und CRLF schon an den Zeilenraendern weg, ein einzelnes
    // \r mitten im Text aber nicht - dann ist die ganze Datei eine Zeile.
    const erg = parseQuiz('Frage? | 20\r* Merkur\rVenus');
    expect(erg.fehler).toEqual([]);
    expect(erg.questions).toHaveLength(1);
    expect(erg.questions[0]?.prompt).toBe('Frage?');
  });
});

describe('Vorwort und Titelzeile zusammen (B5)', () => {
  /**
   * Jede Nachsicht einzeln war getestet: "Titel allein" gruen, "Vorwort
   * allein" gruen. Zusammen fiel es - das Vorwort gab die Titelzeile auf,
   * `# Abendrunde` wurde als Fragetext gelesen, blieb ohne Antworten und
   * erzeugte zwei Fehler. Der Nutzer las "Diese Frage hat keine Antwort"
   * ueber einer Zeile, die keine Frage ist.
   */
  const EINE = 'Welcher Planet? | 20\n* Merkur\nVenus';

  it('Vorwort und Titelzeile, mit und ohne Leerzeile dazwischen', () => {
    for (const trenner of ['\n\n', '\n']) {
      const erg = parseQuiz(`Hier sind deine Fragen:${trenner}# Abendrunde${trenner}${EINE}`);
      expect(erg.fehler, trenner).toEqual([]);
      expect(erg.ok, trenner).toBe(true);
      expect(erg.titel, trenner).toBe('Abendrunde');
      expect(erg.questions.map((q) => q.prompt), trenner).toEqual(['Welcher Planet?']);
      expect(erg.hinweise.join(' '), trenner).toContain('Vorwort');
    }
  });

  it('ein mehrzeiliges Vorwort, auch vor der Titelzeile', () => {
    // Zweite Zeile des Vorworts wird sonst zur einzigen Antwort einer
    // Frage, die gar keine ist.
    const ohne = parseQuiz(`Klar!\nHier sind deine Fragen:\n\n${EINE}`);
    expect(ohne.fehler).toEqual([]);
    expect(ohne.questions.map((q) => q.prompt)).toEqual(['Welcher Planet?']);

    const mit = parseQuiz(`Klar!\nHier sind deine Fragen:\n\n# Abendrunde\n\n${EINE}`);
    expect(mit.fehler).toEqual([]);
    expect(mit.titel).toBe('Abendrunde');
    expect(mit.questions.map((q) => q.prompt)).toEqual(['Welcher Planet?']);
  });

  it('eine Ueberschrift nach einer echten Frage ist kein Titel mehr', () => {
    // Die Gegenprobe zur Lockerung: sobald etwas gelesen wurde, das eine
    // Frage sein koennte, ist die Titelzeile vorbei.
    const erg = parseQuiz(`${EINE}\n\n# Spaeter`);
    expect(erg.titel).toBe('Quizbude');
    expect(erg.questions.map((q) => q.prompt)).toEqual(['Welcher Planet?']);
  });

  it('JSON im Code-Zaun wird auch unter einem Vorwort als JSON gelesen', () => {
    // Die Erkennung lief auf dem Text ohne Zaun, aber mit Vorwort - und
    // fiel deshalb ins Zeilenformat zurueck.
    const text = [
      'Klar, hier ist die Datei:',
      '',
      '```json',
      '{"titel":"Abendrunde","fragen":[{"frage":"F?","antworten":["*A","B"]}]}',
      '```',
      '',
      'Viel Spass!',
    ].join('\n');
    const erg = parseQuiz(text);
    expect(erg.fehler).toEqual([]);
    expect(erg.quelle).toBe('json');
    expect(erg.titel).toBe('Abendrunde');
    expect(erg.questions).toHaveLength(1);
    expect(erg.hinweise.join(' ')).toContain('Vorwort');
  });

  it('kaputtes JSON unter einem Vorwort wird nicht zu JSON erklaert', () => {
    // Verschoben wird nur, was sich wirklich als JSON lesen laesst.
    const erg = parseQuiz('Klar:\n\n{ "fragen": [ ');
    expect(erg.quelle).toBe('zeilen');
  });

  it('der Leitfall des Reviews, alle Nachsichten in EINER Eingabe', () => {
    // Vorwort + Code-Zaun + Nummerierung + A)-Beschriftung + Fett im
    // Fragetext + Haekchen als Markierung + Schlusswort. Jede Nachsicht
    // fuer sich war getestet; genau diese Kombination fiel.
    const text = [
      'Hier sind deine Fragen:',
      '',
      '```text',
      '# Abendrunde',
      '',
      '1. **Welcher Planet ist der Sonne am naechsten?** | 20',
      '* A) ✅ Merkur',
      'B) Venus',
      'C) Mars',
      '```',
      '',
      'Viel Spass!',
    ].join('\n');
    const erg = parseQuiz(text);
    expect(erg.fehler).toEqual([]);
    expect(erg.ok).toBe(true);
    expect(erg.titel).toBe('Abendrunde');
    expect(erg.questions).toHaveLength(1);
    expect(erg.questions[0]?.prompt).toBe('Welcher Planet ist der Sonne am naechsten?');
    expect(erg.questions[0]?.timeLimitMs).toBe(20_000);
    const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
    expect(spec.options.map((o) => o.label)).toEqual(['Merkur', 'Venus', 'Mars']);
    expect(spec.correctIndex).toBe(0);
    // Und der Kern nimmt an, was dabei herauskommt.
    const registry = createDefaultRegistry();
    for (const q of erg.questions) expect(() => loadQuestion(q, registry)).not.toThrow();
  });

  it('die Zeilennummern zeigen die Originaleingabe, auch hinter Vorwort und Zaun', () => {
    // Gemessen und richtig - und darf durch die Lockerung oben nicht
    // kaputtgehen: der Nutzer sucht sonst in seiner Datei an der falschen
    // Stelle. Zeile 6 ist die zweite markierte Antwort IM ORIGINAL.
    const text = [
      'Hier sind deine Fragen:',
      '',
      '```',
      'F? | 20',
      '* Merkur',
      '* Venus',
      '```',
      '',
      'Viel Spass',
    ].join('\n');
    expect(meldungen(text)).toEqual(['Zeile 6: 2 Antworten markiert, genau eine darf es sein.']);
    expect(parseQuiz(text).hinweise).toEqual([
      'Zeile 1: als Vorwort uebersprungen.',
      'Zeile 9: als Schlusswort uebersprungen.',
    ]);
  });
});

describe('Die Nachsichten gekreuzt, nicht aufgezaehlt (B1/B6)', () => {
  /**
   * Jede Nachsicht fuer sich war getestet und funktionierte; die
   * Kombination brach. `* ✅ Merkur` ging gruen durch und schrieb das
   * Haekchen auf die Kachel - jeder im Raum sah die richtige Antwort,
   * bevor er tippte. `A) ✅ Merkur` und `Merkur ✅` verloren die
   * Markierung ganz und meldeten "keine Antwort markiert".
   */
  const kreuze: readonly (readonly [string, string])[] = [
    ['Stern und Haekchen', '* ✅ Merkur\nVenus'],
    ['Beschriftung und Haekchen', 'A) ✅ Merkur\nB) Venus'],
    ['Aufzaehlung und Haekchen', '- ✅ Merkur\n- Venus'],
    ['Haekchen am Zeilenende', 'Merkur ✅\nVenus'],
    ['Beschriftung, Fett und Haekchen', 'A) ✅ **Merkur**\nb) Venus'],
    ['Aufzaehlung, Beschriftung und Haekchen', '- A) ✅ Merkur\n- B) Venus'],
    ['Doppeltes Haekchen vorn', '✅✅ Merkur\nVenus'],
    ['Doppeltes Haekchen hinten', 'Merkur ✅✅\nVenus'],
    ['Stern vorn, Haekchen hinten', '* Merkur ✅\nVenus'],
    ['Kreuzkasten und Aufzaehlung', '- [x] Merkur\n- [ ] Venus'],
    ['Haken und Kreuz gemischt', '✔ Merkur\nVenus ✗'],
  ];

  it('liest in jeder Mischform genau eine Markierung - und laesst den Text sauber', () => {
    for (const paar of kreuze) {
      const erg = parseQuiz(`Frage? | 20\n${paar[1]}`);
      expect(erg.fehler, paar[0]).toEqual([]);
      expect(erg.ok, paar[0]).toBe(true);
      const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
      expect(spec.options.map((o) => o.label), paar[0]).toEqual(['Merkur', 'Venus']);
      expect(spec.correctIndex, paar[0]).toBe(0);
    }
  });

  it('kein Markierungszeichen bleibt in einer Beschriftung stehen', () => {
    // Die Falsch-Gruen-Probe. Der Test oben prueft gegen 'Merkur' und
    // 'Venus' und faellt schon, wenn ein Haekchen stehen bleibt - dieser
    // hier faellt auch dann noch, wenn die erwarteten Woerter einmal
    // angepasst werden. Der Schaden ist die sichtbare Antwort auf der
    // Leinwand, nicht der abweichende String.
    const VERRAETERISCH = /[✅✔✓☑☐❌✗]/u;
    for (const paar of kreuze) {
      const erg = parseQuiz(`Frage? | 20\n${paar[1]}`);
      const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
      for (const o of spec.options) {
        expect(VERRAETERISCH.test(o.label), `${paar[0]}: ${o.label}`).toBe(false);
      }
      expect(erg.questions[0]?.prompt, paar[0]).toBe('Frage?');
    }
  });

  /**
   * N1: Die Abtrag-Schleife hatte einen Deckel von acht Runden, und der
   * fiel nach oben offen aus. Ab der neunten Markierung in derselben Zeile
   * blieb das Haekchen im sichtbaren Label stehen - bei `ok=true`, ohne
   * eine einzige Meldung. Das ist genau der Schaden von B1: die richtige
   * Antwort steht auf der Kachel, bevor jemand tippt. Die Kreuzproben oben
   * fahren hoechstens zwei Markierungen und erreichen die achte Runde nie.
   */
  const vieleMarkierungen = (n: number): readonly (readonly [string, string])[] => [
    [`${n} Haekchen vorn`, `${'✅'.repeat(n)} Merkur\nVenus`],
    [`Stern und ${n} Haekchen`, `* ${'✅'.repeat(n)} Merkur\nVenus`],
    [`${n} Kreuzkaesten`, `${'[x]'.repeat(n)} Merkur\nVenus`],
    [
      `${n} Haekchen im JSON`,
      JSON.stringify({ fragen: [{ frage: 'F?', antworten: [`${'✅'.repeat(n)} Merkur`, 'Venus'] }] }),
    ],
  ];

  it('die neunte, die zwanzigste und die zweihundertste Markierung werden ebenso abgetragen (N1)', () => {
    for (const n of [8, 9, 12, 20, 200]) {
      for (const paar of vieleMarkierungen(n)) {
        const text = paar[1].startsWith('{') ? paar[1] : `Frage? | 20\n${paar[1]}`;
        const erg = parseQuiz(text);
        expect(erg.fehler, paar[0]).toEqual([]);
        expect(erg.ok, paar[0]).toBe(true);
        const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
        expect(spec.options.map((o) => o.label), paar[0]).toEqual(['Merkur', 'Venus']);
        expect(spec.correctIndex, paar[0]).toBe(0);
      }
    }
  });

  it('nichts Gruenes traegt ein Markierungszeichen im Label - fuer jede Zahl von Markierungen (N1)', () => {
    // Die Zusicherung selbst, nicht der Einzelfall: schafft der Parser den
    // Abtrag fuer eine Eingabe einmal nicht, muss er `ok=false` liefern.
    // Gruen UND ein Markierungszeichen auf der Kachel darf es nicht geben.
    const VERRAETERISCH = /[✅✔✓☑☐❌✗]/u;
    for (let n = 1; n <= 40; n += 1) {
      for (const paar of vieleMarkierungen(n)) {
        const text = paar[1].startsWith('{') ? paar[1] : `Frage? | 20\n${paar[1]}`;
        const erg = parseQuiz(text);
        const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec | undefined;
        for (const o of spec?.options ?? []) {
          expect(erg.ok && VERRAETERISCH.test(o.label), `${paar[0]}: ${o.label}`).toBe(false);
        }
      }
    }
  });

  it(
    'der Abtrag bleibt auch am Dateideckel bezahlbar (N1)',
    () => {
      // Der unguenstigste Fall, den MAX_UPLOAD_BYTES zulaesst: ein Haekchen
      // sind drei Bytes in UTF-8, 333 333 davon fuellen die ganze erlaubte
      // Datei mit einer einzigen Antwortzeile.
      //
      // Die Zahl steht hier nicht aus Sportsgeist. Mit dem Deckel von acht
      // Runden blieb der Rest der Haekchen stehen, und `MARKIERUNG_ENDE`
      // suchte ihn von jeder Zeichenstelle aus neu ab - quadratisch:
      // gemessen 0,6 s bei 16 000 Haekchen, 9,1 s bei 64 000, hochgerechnet
      // Minuten am Dateideckel. Ohne den Deckel traegt die Schleife den
      // Lauf vorn ab, und `MARKIERUNG_ENDE` sieht nur noch "Merkur".
      const t0 = performance.now();
      const erg = parseQuiz(`Frage? | 20\n${'✅'.repeat(333_333)} Merkur\nVenus`);
      const ms = performance.now() - t0;
      expect(erg.ok).toBe(true);
      const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
      expect(spec.options.map((o) => o.label)).toEqual(['Merkur', 'Venus']);
      expect(ms, `${ms.toFixed(0)} ms`).toBeLessThan(5_000);
    },
    20_000,
  );

  it('ein leerer Kasten markiert auch am Zeilenende nicht', () => {
    // Ruling 4: `[ ]`, ☐, ❌ und ✗ sind keine Markierung - vorn nicht und
    // hinten nicht. Auf die Kachel gehoeren sie trotzdem nicht.
    for (const leer of ['☐', '❌', '✗']) {
      const erg = parseQuiz(`Frage? | 20\nMerkur ${leer}\nVenus ${leer}`);
      expect(erg.ok, leer).toBe(false);
      expect(erg.fehler[0]?.text, leer).toContain('keine Antwort markiert');
      const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
      expect(spec.options.map((o) => o.label), leer).toEqual(['Merkur', 'Venus']);
    }
  });

  it('Stern und Plus am Zeilenende sind Auszeichnung, keine Markierung', () => {
    // Ruling 3: `**Merkur**` endet auf `*`. Wuerde ein Stern hinten als
    // Markierung gelesen, markierte jede unvollstaendig geschlossene
    // Fettschrift eine Antwort - und zwar die falsche.
    for (const schwanz of ['*', '+']) {
      const erg = parseQuiz(`Frage? | 20\n* Merkur\nVenus ${schwanz}`);
      expect(erg.fehler, schwanz).toEqual([]);
      const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
      expect(spec.correctIndex, schwanz).toBe(0);
    }
  });

  it('der Fluchtweg ueberlebt die neue Reihenfolge', () => {
    // Ruling 5: Beschriftung und Aufzaehlung werden jetzt VOR dem
    // Markierungstest abgetragen. Der Fluchtweg wird davor geprueft und
    // nach jedem abgetragenen Markierungszeichen noch einmal - beide
    // Faelle des Auftrags bleiben, wie sie waren.
    const a = parseQuiz('Frage? | 20\n* Merkur\n\\* Venus');
    expect(a.fehler).toEqual([]);
    expect((a.questions[0]?.spec as ParsedSingleChoiceSpec).options.map((o) => o.label)).toEqual([
      'Merkur',
      '* Venus',
    ]);
    const b = parseQuiz('Frage? | 20\n*\\* Merkur\nVenus');
    expect(b.fehler).toEqual([]);
    const specB = b.questions[0]?.spec as ParsedSingleChoiceSpec;
    expect(specB.options.map((o) => o.label)).toEqual(['* Merkur', 'Venus']);
    expect(specB.correctIndex).toBe(0);
  });

  it('dieselbe Mischform im JSON, nicht eine zweite Fassung davon', () => {
    const erg = parseQuiz(
      JSON.stringify({ fragen: [{ frage: 'F?', antworten: ['* ✅ Merkur', 'B) Venus'] }] }),
    );
    expect(erg.fehler).toEqual([]);
    const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
    expect(spec.options.map((o) => o.label)).toEqual(['Merkur', 'Venus']);
    expect(spec.correctIndex).toBe(0);
  });
});

describe('Inhaltsfehler werden laut, mit Zeilennummer', () => {
  it('zwei markierte Antworten - die Meldung aus dem Auftrag', () => {
    const text = ['Frage? | 20', '* Merkur', '* Venus'].join('\n');
    expect(meldungen(text)).toEqual([
      'Zeile 3: 2 Antworten markiert, genau eine darf es sein.',
    ]);
  });

  it('keine markierte Antwort', () => {
    const text = ['Frage? | 20', 'Merkur', 'Venus'].join('\n');
    expect(meldungen(text)).toEqual([
      'Zeile 1: keine Antwort markiert, genau eine muss es sein. Setz ein * vor die richtige.',
    ]);
  });

  it('Fragetext ueber 200 Zeichen', () => {
    const lang = `${'A'.repeat(MAX_PROMPT_CHARS + 7)}?`;
    const meldung = meldungen(`${lang} | 20\n* Merkur\nVenus`)[0] ?? '';
    expect(meldung).toContain('Zeile 1:');
    expect(meldung).toContain(`${MAX_PROMPT_CHARS + 8} Zeichen`);
    expect(meldung).toContain(`erlaubt sind ${MAX_PROMPT_CHARS}`);
  });

  it('Antwort ueber 100 Zeichen - an der Zeile der Antwort', () => {
    const meldung = meldungen(`Frage? | 20\n* Merkur\n${'B'.repeat(MAX_OPTION_CHARS + 1)}`)[0] ?? '';
    expect(meldung).toContain('Zeile 3:');
    expect(meldung).toContain(`erlaubt sind ${MAX_OPTION_CHARS}`);
  });

  it('weniger als zwei Antworten', () => {
    expect(meldungen('Frage? | 20\n* Merkur')[0]).toContain('nur eine Antwort');
  });

  it('mehr als vier Antworten', () => {
    const text = ['Frage? | 20', '* A', 'B', 'C', 'D', 'E'].join('\n');
    expect(meldungen(text)[0]).toContain('5 Antworten, erlaubt sind zwei bis vier');
  });

  it('Antwortzeit ausserhalb 5 bis 300 Sekunden', () => {
    expect(meldungen('Frage? | 4\n* A\nB')[0]).toContain('Erlaubt sind 5 bis 300');
    expect(meldungen('Frage? | 301\n* A\nB')[0]).toContain('Erlaubt sind 5 bis 300');
    expect(parseQuiz('Frage? | 5\n* A\nB').fehler).toEqual([]);
    expect(parseQuiz('Frage? | 300\n* A\nB').fehler).toEqual([]);
  });

  it('eine leere Antwortzeile', () => {
    expect(meldungen('Frage? | 20\n*\nVenus')[0]).toBe('Zeile 2: Diese Antwort ist leer.');
  });

  it('nummeriert die Zeilen der Originaldatei, auch hinter einem Code-Zaun', () => {
    // Wuerden die Zaunzeilen einfach entfernt, zeigte jede Meldung
    // danach auf die falsche Zeile - und der Nutzer sucht umsonst.
    const text = ['```', 'Frage? | 20', '* Merkur', '* Venus', '```'].join('\n');
    expect(meldungen(text)).toEqual(['Zeile 4: 2 Antworten markiert, genau eine darf es sein.']);
  });

  it('mehr als 200 Fragen', () => {
    const block = 'Frage? | 20\n* A\nB';
    const viele = Array.from({ length: MAX_QUESTIONS + 1 }, () => block).join('\n\n');
    expect(meldungen(viele)[0]).toContain(`Mehr als ${MAX_QUESTIONS}`);
  });

  it('ein zu langer Titel, mit Zeilennummer (B4)', () => {
    // Vorher gruen geprueft und danach stillschweigend verworfen: der
    // Transportrand nimmt hoechstens MAX_TITLE_CHARS Zeichen, meldet das
    // aber nicht zurueck - die Buehne hing in "verbindet sich ...".
    const lang = 'A'.repeat(MAX_TITLE_CHARS + 44);
    const erg = parseQuiz(`# ${lang}\n\nFrage? | 20\n* A\nB`);
    expect(erg.ok).toBe(false);
    expect(erg.fehler[0]?.zeile).toBe(1);
    expect(erg.fehler[0]?.text).toContain(`${MAX_TITLE_CHARS + 44} Zeichen`);
    expect(erg.fehler[0]?.text).toContain(`erlaubt sind ${MAX_TITLE_CHARS}`);
    expect(erg.fehler[0]?.text).toContain('Kuerz ihn um 44');
  });

  it('genau MAX_TITLE_CHARS Zeichen Titel gehen noch durch', () => {
    const erg = parseQuiz(`# ${'A'.repeat(MAX_TITLE_CHARS)}\n\nFrage? | 20\n* A\nB`);
    expect(erg.fehler).toEqual([]);
    expect(erg.titel).toHaveLength(MAX_TITLE_CHARS);
  });

  it('die Titelgrenze gilt auch im JSON', () => {
    const lang = 'A'.repeat(MAX_TITLE_CHARS + 1);
    const erg = parseQuiz(
      JSON.stringify({ titel: lang, fragen: [{ frage: 'F?', antworten: ['*A', 'B'] }] }),
    );
    expect(erg.ok).toBe(false);
    expect(erg.fehler.map((f) => f.text).join(' ')).toContain(`erlaubt sind ${MAX_TITLE_CHARS}`);
  });

  it('leerer Text', () => {
    expect(meldungen('   \n\n  ')[0]).toContain('noch keine Frage');
  });
});

describe('Fluchtweg fuer das Markierungszeichen (Ruling 4a)', () => {
  it('\\* macht aus dem Stern Text statt Markierung', () => {
    const erg = parseQuiz('Frage? | 20\n* Merkur\n\\* Venus');
    expect(erg.fehler).toEqual([]);
    const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
    expect(spec.options.map((o) => o.label)).toEqual(['Merkur', '* Venus']);
    expect(spec.correctIndex).toBe(0);
  });

  it('die richtige Antwort darf selbst mit einem Stern beginnen', () => {
    const erg = parseQuiz('Frage? | 20\n*\\* Merkur\nVenus');
    expect(erg.fehler).toEqual([]);
    const spec = erg.questions[0]?.spec as ParsedSingleChoiceSpec;
    expect(spec.options.map((o) => o.label)).toEqual(['* Merkur', 'Venus']);
    expect(spec.correctIndex).toBe(0);
  });
});

describe('JSON wird zusaetzlich erkannt (Ruling 3)', () => {
  it('erkennt JSON ohne Zutun des Nutzers', () => {
    expect(siehtNachJsonAus('{"fragen":[]}')).toBe(true);
    expect(siehtNachJsonAus('Frage? | 20')).toBe(false);
  });

  it('liest deutsche Feldnamen', () => {
    const erg = parseQuiz(
      JSON.stringify({
        titel: 'Abendrunde',
        fragen: [
          {
            frage: 'Welcher Planet?',
            antworten: ['Merkur', 'Venus'],
            richtig: 0,
            sekunden: 25,
            erklaerung: 'Innen.',
          },
        ],
      }),
    );
    expect(erg.fehler).toEqual([]);
    expect(erg.quelle).toBe('json');
    expect(erg.titel).toBe('Abendrunde');
    expect(erg.questions[0]?.timeLimitMs).toBe(25_000);
    expect((erg.questions[0]?.spec as ParsedSingleChoiceSpec).correctIndex).toBe(0);
  });

  it('liest englische Feldnamen und Antwortobjekte', () => {
    const erg = parseQuiz(
      JSON.stringify({
        title: 'Evening',
        questions: [
          {
            question: 'Which planet?',
            answers: [
              { text: 'Mercury', correct: true },
              { text: 'Venus', correct: false },
            ],
            timeLimitMs: 15_000,
          },
        ],
      }),
    );
    expect(erg.fehler).toEqual([]);
    expect(erg.questions[0]?.timeLimitMs).toBe(15_000);
    expect((erg.questions[0]?.spec as ParsedSingleChoiceSpec).correctIndex).toBe(0);
  });

  it('eine blanke Liste ist auch JSON', () => {
    const erg = parseQuiz(JSON.stringify([{ frage: 'F?', antworten: ['*A', 'B'] }]));
    expect(erg.fehler).toEqual([]);
    expect(erg.questions).toHaveLength(1);
  });

  it('haelt die Inhaltsgrenzen auch im JSON', () => {
    const erg = parseQuiz(
      JSON.stringify({ fragen: [{ frage: 'F?', antworten: ['A', 'B'] }] }),
    );
    expect(erg.ok).toBe(false);
    expect(erg.fehler[0]?.text).toContain('keine Antwort markiert');
  });

  it('kaputtes JSON wird nicht als Zeilenformat verbogen', () => {
    const erg = parseQuiz('{ "fragen": [ ');
    expect(erg.ok).toBe(false);
    expect(erg.quelle).toBe('json');
    expect(erg.fehler[0]?.text).toContain('laesst sich aber nicht lesen');
  });
});

describe('Pruefbericht (Ruling 2)', () => {
  it('rechnet die Spieldauer aus den Zeiten des Kerns', () => {
    const erg = parseQuiz(DEMO_TEXT);
    const q0 = erg.questions[0];
    const q1 = erg.questions[1];
    if (q0 === undefined || q1 === undefined) throw new Error('Demorunde fehlt');
    const erwartet =
      ANNOUNCE_MS +
      readingWindowMs(q0.prompt, ['Merkur', 'Venus', 'Mars', 'Jupiter']) +
      q0.timeLimitMs +
      ESTIMATE_REVEAL_MS +
      ESTIMATE_SCOREBOARD_MS +
      ANNOUNCE_MS +
      readingWindowMs(q1.prompt, ['Wahr', 'Falsch']) +
      q1.timeLimitMs +
      ESTIMATE_REVEAL_MS;
    expect(schaetzeDauerMs(erg.questions)).toBe(erwartet);
  });

  it('nennt Titel, Fragenzahl und Dauer', () => {
    const bericht = pruefbericht(parseQuiz(DEMO_TEXT));
    expect(bericht.ok).toBe(true);
    expect(bericht.titel).toBe('Quizbude — Demorunde');
    expect(bericht.fragenzahl).toBe(2);
    expect(bericht.dauerMs).toBeGreaterThan(0);
    expect(bericht.dauerText).toMatch(/^etwa \d+ (Sekunden|Minuten)$/u);
  });

  it('formuliert die Dauer ohne falsche Genauigkeit', () => {
    expect(dauerText(42_000)).toBe('etwa 42 Sekunden');
    expect(dauerText(600_000)).toBe('etwa 10 Minuten');
  });
});

describe('Kodierung', () => {
  it('nimmt UTF-8 an', () => {
    const bytes = new TextEncoder().encode('Frage? | 20\n* Ä\nÖ');
    const erg = dekodiereUtf8(bytes);
    expect(erg.ok).toBe(true);
    if (erg.ok) expect(erg.text).toContain('Ä');
  });

  it('lehnt eine Datei ab, die erkennbar kein UTF-8 ist, und sagt was zu tun ist', () => {
    // Latin-1: Ä ist 0xC4, danach ein gewoehnlicher Buchstabe. Als UTF-8
    // gelesen ist das eine ungueltige Folge.
    const erg = dekodiereUtf8(new Uint8Array([0xc4, 0x6e, 0x64, 0x65, 0x72, 0x6e]));
    expect(erg.ok).toBe(false);
    if (!erg.ok) {
      expect(erg.meldung).toContain('nicht UTF-8');
      expect(erg.meldung).toContain('UTF-8');
    }
  });

  it('lehnt eine zu grosse Datei mit verstaendlicher Meldung ab', () => {
    const erg = dekodiereUtf8(new Uint8Array(1_000_001));
    expect(erg.ok).toBe(false);
    if (!erg.ok) expect(erg.meldung).toContain('kB');
  });
});

describe('Escaping (Sicherheitsnaht)', () => {
  it('entschaerft jedes gefaehrliche Zeichen', () => {
    expect(escapeHtml(`<script>alert("x")</script>&'`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;&#39;',
    );
  });

  it('der Parser reicht spitze Klammern unveraendert durch - entschaerft wird erst bei der Ausgabe', () => {
    const erg = parseQuiz('<img src=x onerror=alert(1)>? | 20\n* "A" <b>\nB');
    expect(erg.fehler).toEqual([]);
    expect(erg.questions[0]?.prompt).toBe('<img src=x onerror=alert(1)>?');
  });
});
