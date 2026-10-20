import {
  ANNOUNCE_MS,
  MAX_OPTION_CHARS,
  MAX_PROMPT_CHARS,
} from '../engine/constants.js';
import { readingWindowMs } from '../engine/reading.js';

/**
 * Der eine Parser fuer hochgeladene Fragen.
 *
 * Der Autor einer Fragendatei ist ein Sprachmodell, kein tippender Mensch.
 * Daraus folgt die Haltung dieses Moduls: nachsichtig gegen alles, was das
 * Werkzeug beilegt (Code-Zaeune, Vorwort, Nummerierung, Fettschrift,
 * Haekchen statt Stern), streng gegen alles, was der Autor zu verantworten
 * hat (zwei markierte Antworten, kein Zeitlimit im erlaubten Bereich,
 * zu langer Text). Auszeichnung ist Rauschen des Werkzeugs, Inhalt ist
 * Sache des Autors.
 *
 * Jede Meldung traegt die Zeilennummer der Originaldatei und ist so
 * formuliert, dass sie zurueck in die KI gekippt werden kann.
 *
 * Reinheit: keine Uhr, kein Zufall, kein Timer, keine Umgebung. Dieses
 * Modul laeuft unveraendert im Node-Server, in der Buehne und - uebersetzt
 * durch `tools/standalone-parser.mjs` - in der Browser-Fassung.
 */

// --- Grenzen ---------------------------------------------------------------

/** Antwortzeit je Frage, in Sekunden. */
export const MIN_ANSWER_SECONDS = 5;
export const MAX_ANSWER_SECONDS = 300;

/** Antwortzeit, wenn hinter der Frage keine Zahl steht. */
export const DEFAULT_ANSWER_SECONDS = 20;

/** Obergrenze fuer eine Sammlung. Jenseits davon haengt die Oberflaeche. */
export const MAX_QUESTIONS = 200;

/** Obergrenze fuer eine hochgeladene Datei in Bytes. */
export const MAX_UPLOAD_BYTES = 1_000_000;

// --- Schaetzung der Spieldauer --------------------------------------------

/**
 * Aufloesung und Zwischenstand haben keinen Timer - der Host schaltet
 * weiter. Fuer die Schaetzung im Pruefbericht braucht es trotzdem eine
 * Zahl. Das sind Erfahrungswerte, keine Engine-Konstanten; sie stehen
 * deshalb hier und nicht in `engine/constants.ts`.
 */
export const ESTIMATE_REVEAL_MS = 8000;
export const ESTIMATE_SCOREBOARD_MS = 7000;

// --- Ergebnisformen --------------------------------------------------------

export interface ParseFehler {
  /** Zeile der Originaldatei, 1-basiert. 0, wenn keine zuzuordnen ist. */
  readonly zeile: number;
  readonly text: string;
}

export interface ParsedSingleChoiceSpec {
  readonly options: readonly { readonly label: string }[];
  readonly correctIndex: number;
  readonly explanation: string | null;
}

export interface ParsedTrueFalseSpec {
  readonly correct: boolean;
  readonly explanation: string | null;
}

export interface ParsedQuestion {
  readonly id: string;
  readonly type: 'single_choice' | 'true_false';
  readonly prompt: string;
  readonly timeLimitMs: number;
  readonly pointsFactor: number;
  readonly spec: ParsedSingleChoiceSpec | ParsedTrueFalseSpec;
}

export type Quellform = 'zeilen' | 'json';

export interface ParseErgebnis {
  readonly ok: boolean;
  readonly titel: string;
  readonly questions: readonly ParsedQuestion[];
  readonly fehler: readonly ParseFehler[];
  /** Was stillschweigend verdaut wurde, aber sichtbar bleiben soll. */
  readonly hinweise: readonly string[];
  readonly quelle: Quellform;
}

export interface Pruefbericht {
  readonly ok: boolean;
  readonly titel: string;
  readonly fragenzahl: number;
  readonly dauerMs: number;
  readonly dauerText: string;
  readonly fehler: readonly ParseFehler[];
  readonly hinweise: readonly string[];
  readonly quelle: Quellform;
}

// --- Kleine reine Helfer ---------------------------------------------------

/**
 * Fremdeingabe landet in HTML. An jeder Ausgabestelle, in beiden Fassungen.
 * Die Funktion steht hier, weil der Text hier entsteht - und weil beide
 * Fassungen denselben Riegel brauchen.
 */
export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c: string) => {
    if (c === '&') return '&amp;';
    if (c === '<') return '&lt;';
    if (c === '>') return '&gt;';
    if (c === '"') return '&quot;';
    return '&#39;';
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** BOM, CRLF und geschuetzte Leerzeichen sind Rauschen, kein Inhalt. */
export function normalisiereText(raw: string): string {
  return String(raw)
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ');
}

/** Typografische Anfuehrungszeichen zu geraden - nur dort, wo sie stoeren. */
function geradeAnfuehrung(value: string): string {
  return value
    .replace(/[“”„‟«»]/g, '"')
    .replace(/[‘’‚‛]/g, "'");
}

/**
 * `**fett**`, `*kursiv*`, `__fett__`, `_kursiv_` und `` `code` `` sind
 * Auszeichnung des Werkzeugs. Der Text darunter ist der Inhalt.
 */
export function entferneAuszeichnung(value: string): string {
  let out = value;
  for (let runde = 0; runde < 3; runde += 1) {
    out = out
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
  }
  // Einfache Sternchen nur als vollstaendige Klammer: ein Sternchen mitten
  // im Text kann Inhalt sein (Fussnote, Rechenzeichen).
  const kursiv = /^\*([^*]+)\*$/.exec(out.trim());
  if (kursiv !== null && kursiv[1] !== undefined) out = kursiv[1];
  const unterstrich = /^_([^_]+)_$/.exec(out.trim());
  if (unterstrich !== null && unterstrich[1] !== undefined) out = unterstrich[1];
  return out;
}

/** Eine vollstaendig in Anfuehrungszeichen gesetzte Beschriftung auspacken. */
function entpackeAnfuehrung(value: string): string {
  const t = value.trim();
  const paare: readonly (readonly [string, string])[] = [
    ['"', '"'],
    ["'", "'"],
    ['“', '”'],
    ['„', '“'],
    ['„', '”'],
    ['«', '»'],
    ['‘', '’'],
  ];
  for (const paar of paare) {
    const auf = paar[0];
    const zu = paar[1];
    if (t.length >= auf.length + zu.length + 1 && t.startsWith(auf) && t.endsWith(zu)) {
      return t.slice(auf.length, t.length - zu.length).trim();
    }
  }
  return t;
}

/** Wort und Zahl fuer eine Dauer, ohne falsche Genauigkeit. */
export function dauerText(ms: number): string {
  const sekunden = Math.max(0, Math.round(ms / 1000));
  if (sekunden < 90) return `etwa ${sekunden} Sekunden`;
  const minuten = Math.round(sekunden / 60);
  return `etwa ${minuten} Minuten`;
}

function labelsVon(frage: ParsedQuestion): readonly string[] {
  if (frage.type === 'true_false') return ['Wahr', 'Falsch'];
  const spec = frage.spec as ParsedSingleChoiceSpec;
  return spec.options.map((o) => o.label);
}

/**
 * Geschaetzte Spieldauer aus den Zeiten des Kerns: Ankuendigung,
 * Lesefenster (dieselbe Formel wie im Spiel), Antwortzeit, dazu
 * Aufloesung und Zwischenstand als Erfahrungswerte.
 */
export function schaetzeDauerMs(questions: readonly ParsedQuestion[]): number {
  let summe = 0;
  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    if (q === undefined) continue;
    summe += ANNOUNCE_MS;
    summe += readingWindowMs(q.prompt, labelsVon(q));
    summe += q.timeLimitMs;
    summe += ESTIMATE_REVEAL_MS;
    if (i < questions.length - 1) summe += ESTIMATE_SCOREBOARD_MS;
  }
  return summe;
}

export function pruefbericht(erg: ParseErgebnis): Pruefbericht {
  const dauerMs = schaetzeDauerMs(erg.questions);
  return {
    ok: erg.ok,
    titel: erg.titel,
    fragenzahl: erg.questions.length,
    dauerMs,
    dauerText: dauerText(dauerMs),
    fehler: erg.fehler,
    hinweise: erg.hinweise,
    quelle: erg.quelle,
  };
}

// --- Kodierung -------------------------------------------------------------

export type DekodierErgebnis =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly meldung: string };

/**
 * UTF-8 ist der Normalfall. Eine Datei, die erkennbar etwas anderes ist,
 * wird abgelehnt - nicht stillschweigend in Fragezeichen verwandelt.
 * `TextDecoder` ist in beiden Laufzeiten vorhanden und deterministisch.
 */
export function dekodiereUtf8(bytes: Uint8Array): DekodierErgebnis {
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      meldung:
        `Die Datei ist ${Math.round(bytes.length / 1024)} kB gross. ` +
        `Mehr als ${Math.round(MAX_UPLOAD_BYTES / 1024)} kB nimmt die Seite nicht an. ` +
        'Teil die Fragen auf mehrere Dateien auf.',
    };
  }
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    return { ok: true, text: decoder.decode(bytes) };
  } catch {
    return {
      ok: false,
      meldung:
        'Die Datei ist nicht UTF-8 kodiert. Speicher sie noch einmal als ' +
        '"UTF-8" (im Editor unter "Speichern unter" oder "Kodierung") und ' +
        'lad sie dann erneut hoch.',
    };
  }
}

// --- Die Anweisung fuer die KI (Ruling 5) ----------------------------------

/**
 * Der Textblock, den der Nutzer seiner KI vorlegt. Er gehoert in die
 * Oberflaeche beider Fassungen, nicht in ein Dokument - sonst findet ihn
 * niemand in dem Moment, in dem er gebraucht wird.
 */
export const KI_ANWEISUNG = [
  'Schreib mir Quizfragen in genau diesem Format:',
  '',
  '# Titel der Runde',
  '',
  'Welcher Planet ist der Sonne am naechsten? | 20',
  '* Merkur',
  'Venus',
  'Mars',
  'Jupiter',
  '> Merkur umkreist die Sonne in 58 Millionen Kilometern Abstand.',
  '',
  'Ein Oktopus hat drei Herzen. | 15',
  '* Wahr',
  'Falsch',
  '',
  'Regeln:',
  '- Jede Frage ist ein Block. Blöcke werden durch eine Leerzeile getrennt.',
  '- Erste Zeile des Blocks ist die Frage, höchstens 200 Zeichen.',
  '- Darunter zwei bis vier Antworten, je höchstens 100 Zeichen.',
  '- Genau eine Antwort beginnt mit einem Stern (*). Nur eine.',
  '- Die Zahl hinter dem senkrechten Strich (|) ist die Antwortzeit in',
  '  Sekunden, erlaubt sind 5 bis 300. Ohne Angabe gilt 20.',
  '- Eine Zeile mit > ist eine optionale Erklärung zur Frage.',
  '- Heißen die beiden Antworten "Wahr" und "Falsch", wird daraus',
  '  automatisch eine Wahr/Falsch-Frage.',
  '- Soll eine Antwort selbst mit einem Stern beginnen, schreib einen',
  '  umgekehrten Schrägstrich davor: \\* so geht das.',
  '',
  'Wichtig:',
  '- Keine Nummerierung der Fragen.',
  '- Keine Überschriften außer der einen Titelzeile mit #.',
  '- Kein Code-Block, keine Backticks.',
  '- Kein Vorwort und kein Schlusswort, nur die Fragen.',
].join('\n');

// --- Zeilenformat ----------------------------------------------------------

interface Zeile {
  readonly nr: number;
  readonly text: string;
}

interface RohAntwort {
  readonly nr: number;
  readonly label: string;
  readonly markiert: boolean;
}

interface RohBlock {
  readonly nr: number;
  readonly promptRoh: string;
  readonly sekunden: number;
  readonly sekundenAngegeben: boolean;
  readonly antworten: RohAntwort[];
  erklaerung: string | null;
  readonly zeilen: number;
}

const ZAUN = /^\s*(```|~~~)/;

/** Markierung einer richtigen Antwort - Stern, Plus, Haekchen, Kreuzkasten. */
const MARKIERUNG = /^(\*|\+|✅|✔|✓|☑|\[\s*[xX]\s*\])\s*/;
/** Eine leere Kastenmarkierung ist ausdruecklich keine Markierung. */
const LEERKASTEN = /^(\[\s*\]|☐|❌|✗)\s*/;
/** Aufzaehlungszeichen ohne Aussage. */
const PUNKT = /^(-|–|•|·|●|■)\s+/;
/** `A)` `a.` `B:` `1)` vor einer Antwort. */
const BESCHRIFTUNG = /^([A-Za-z]|\d{1,2})[).:]\s+/;
/** Nummerierung vor einer Frage. */
const NUMMERIERUNG = /^\d{1,3}[).]\s+/;

function istMarkiert(zeile: string): boolean {
  if (zeile.startsWith('**')) return false;
  // `*Merkur*` ist Kursivschrift, keine Markierung. Eine markierte Antwort
  // endet nicht auf dem Zeichen, mit dem sie markiert wurde.
  if (/^\*[^*]+\*$/.test(zeile)) return false;
  if (LEERKASTEN.test(zeile)) return false;
  return MARKIERUNG.test(zeile);
}

/**
 * Fluchtweg (Ruling 4a): ein umgekehrter Schraegstrich am Anfang nimmt dem
 * naechsten Zeichen jede Bedeutung. `\* Sternchen` ist eine gewoehnliche
 * Antwort, deren Text mit einem Stern beginnt.
 */
function fluchtweg(rest: string): string | null {
  if (!rest.startsWith('\\')) return null;
  return rest.slice(1);
}

function leseAntwort(zeile: Zeile): RohAntwort {
  const roh = zeile.text.trim();

  const direkt = fluchtweg(roh);
  if (direkt !== null) {
    return { nr: zeile.nr, label: direkt.trim(), markiert: false };
  }

  let rest = roh;
  let markiert = false;
  if (istMarkiert(rest)) {
    markiert = true;
    rest = rest.replace(MARKIERUNG, '');
    const entkommen = fluchtweg(rest);
    if (entkommen !== null) {
      return { nr: zeile.nr, label: entkommen.trim(), markiert: true };
    }
  } else {
    rest = rest.replace(LEERKASTEN, '').replace(PUNKT, '');
  }

  rest = rest.replace(BESCHRIFTUNG, '');
  rest = entferneAuszeichnung(rest);
  rest = entpackeAnfuehrung(rest);
  return { nr: zeile.nr, label: rest.trim(), markiert };
}

const ZEIT = /\s*[|｜]\s*(\d{1,5})\s*(?:s|sek|sek\.|sekunden|sec)?\s*$/i;

function leseFrage(text: string): {
  prompt: string;
  sekunden: number;
  angegeben: boolean;
} {
  let rest = text.trim().replace(NUMMERIERUNG, '');
  let sekunden = DEFAULT_ANSWER_SECONDS;
  let angegeben = false;
  const treffer = ZEIT.exec(rest);
  if (treffer !== null && treffer[1] !== undefined && treffer.index !== undefined) {
    sekunden = Number.parseInt(treffer[1], 10);
    angegeben = true;
    rest = rest.slice(0, treffer.index).trim();
  }
  rest = entferneAuszeichnung(rest);
  rest = entpackeAnfuehrung(rest);
  return { prompt: rest.trim(), sekunden, angegeben };
}

/** Sieht die Zeile aus wie ein Fragetext und nicht wie Beiwerk? */
function wirktWieFrage(text: string): boolean {
  const t = text.trim();
  return t.endsWith('?') || ZEIT.test(t);
}

function zuBloecken(zeilen: readonly Zeile[]): {
  bloecke: RohBlock[];
  titel: string;
  fehler: ParseFehler[];
} {
  const bloecke: RohBlock[] = [];
  const fehler: ParseFehler[] = [];
  let titel = '';
  let titelErlaubt = true;
  let aktuell: RohBlock | null = null;

  const schliessen = (): void => {
    if (aktuell !== null) bloecke.push(aktuell);
    aktuell = null;
  };

  for (const zeile of zeilen) {
    const text = zeile.text.trim();
    if (text === '') {
      schliessen();
      continue;
    }

    if (titelErlaubt && text.startsWith('#')) {
      const t = entferneAuszeichnung(text.replace(/^#+\s*/, '')).trim();
      if (t !== '') titel = t;
      titelErlaubt = false;
      continue;
    }

    if (aktuell === null) {
      titelErlaubt = false;
      if (text.startsWith('>')) {
        fehler.push({
          zeile: zeile.nr,
          text: 'Eine Erklaerung mit > steht ueber keiner Frage. Setz sie unter die Frage, zu der sie gehoert.',
        });
        continue;
      }
      const gelesen = leseFrage(text);
      aktuell = {
        nr: zeile.nr,
        promptRoh: gelesen.prompt,
        sekunden: gelesen.sekunden,
        sekundenAngegeben: gelesen.angegeben,
        antworten: [],
        erklaerung: null,
        zeilen: 1,
      };
      continue;
    }

    if (text.startsWith('>')) {
      const e = entferneAuszeichnung(text.replace(/^>+\s*/, '')).trim();
      aktuell.erklaerung = aktuell.erklaerung === null ? e : `${aktuell.erklaerung} ${e}`;
      continue;
    }

    aktuell.antworten.push(leseAntwort(zeile));
  }
  schliessen();

  return { bloecke, titel, fehler };
}

interface Beiwerk {
  readonly bloecke: RohBlock[];
  readonly hinweise: string[];
}

/**
 * Vorwort und Schlusswort einer KI-Antwort sind Beiwerk, keine Frage -
 * aber nur, wenn sie am Rand stehen, aus einer einzigen Zeile bestehen und
 * nicht wie eine Frage aussehen. Eine Frage, die der Autor ohne Antworten
 * gelassen hat, faellt weiterhin laut auf.
 */
function trenneBeiwerk(bloecke: RohBlock[]): Beiwerk {
  const hinweise: string[] = [];
  const rest = bloecke.slice();

  const erste = rest[0];
  if (
    rest.length > 1 &&
    erste !== undefined &&
    erste.antworten.length === 0 &&
    !wirktWieFrage(erste.promptRoh)
  ) {
    hinweise.push(`Zeile ${erste.nr}: als Vorwort uebersprungen.`);
    rest.shift();
  }

  const letzte = rest[rest.length - 1];
  if (
    rest.length > 1 &&
    letzte !== undefined &&
    letzte.antworten.length === 0 &&
    !wirktWieFrage(letzte.promptRoh)
  ) {
    hinweise.push(`Zeile ${letzte.nr}: als Schlusswort uebersprungen.`);
    rest.pop();
  }

  return { bloecke: rest, hinweise };
}

function istWahrFalsch(labels: readonly string[]): boolean {
  if (labels.length !== 2) return false;
  const a = (labels[0] ?? '').toLocaleLowerCase('de');
  const b = (labels[1] ?? '').toLocaleLowerCase('de');
  return a === 'wahr' && b === 'falsch';
}

function pruefeUndBaue(
  bloecke: readonly RohBlock[],
  fehler: ParseFehler[],
): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];

  bloecke.forEach((b, idx) => {
    const nr = idx + 1;

    if (b.promptRoh.length === 0) {
      fehler.push({ zeile: b.nr, text: 'Der Fragetext fehlt.' });
    } else if (b.promptRoh.length > MAX_PROMPT_CHARS) {
      fehler.push({
        zeile: b.nr,
        text:
          `Der Fragetext hat ${b.promptRoh.length} Zeichen, erlaubt sind ${MAX_PROMPT_CHARS}. ` +
          `Kuerz ihn um ${b.promptRoh.length - MAX_PROMPT_CHARS} Zeichen.`,
      });
    }

    if (b.sekunden < MIN_ANSWER_SECONDS || b.sekunden > MAX_ANSWER_SECONDS) {
      fehler.push({
        zeile: b.nr,
        text:
          `Die Antwortzeit ist ${b.sekunden} Sekunden. Erlaubt sind ` +
          `${MIN_ANSWER_SECONDS} bis ${MAX_ANSWER_SECONDS} Sekunden.`,
      });
    }

    if (b.antworten.length < 2) {
      fehler.push({
        zeile: b.nr,
        text:
          `Diese Frage hat ${b.antworten.length === 0 ? 'keine' : 'nur eine'} Antwort. ` +
          'Es muessen zwei bis vier sein.',
      });
    } else if (b.antworten.length > 4) {
      fehler.push({
        zeile: b.nr,
        text:
          `Diese Frage hat ${b.antworten.length} Antworten, erlaubt sind zwei bis vier. ` +
          'Fehlt zwischen zwei Fragen vielleicht eine Leerzeile?',
      });
    }

    for (const a of b.antworten) {
      if (a.label.length === 0) {
        fehler.push({ zeile: a.nr, text: 'Diese Antwort ist leer.' });
      } else if (a.label.length > MAX_OPTION_CHARS) {
        fehler.push({
          zeile: a.nr,
          text:
            `Diese Antwort hat ${a.label.length} Zeichen, erlaubt sind ${MAX_OPTION_CHARS}. ` +
            `Kuerz sie um ${a.label.length - MAX_OPTION_CHARS} Zeichen.`,
        });
      }
    }

    const markierte = b.antworten.filter((a) => a.markiert);
    if (markierte.length === 0) {
      fehler.push({
        zeile: b.nr,
        text: 'keine Antwort markiert, genau eine muss es sein. Setz ein * vor die richtige.',
      });
    } else if (markierte.length > 1) {
      const zweite = markierte[1];
      fehler.push({
        zeile: zweite === undefined ? b.nr : zweite.nr,
        text: `${markierte.length} Antworten markiert, genau eine darf es sein.`,
      });
    }

    const labels = b.antworten.map((a) => a.label);
    const richtigerIndex = markierte.length === 1 ? b.antworten.indexOf(markierte[0] as RohAntwort) : 0;
    const wahrFalsch = istWahrFalsch(labels);

    questions.push({
      id: `q${nr}`,
      type: wahrFalsch ? 'true_false' : 'single_choice',
      prompt: b.promptRoh,
      timeLimitMs: b.sekunden * 1000,
      pointsFactor: 1,
      spec: wahrFalsch
        ? { correct: richtigerIndex === 0, explanation: b.erklaerung }
        : {
            options: labels.map((l) => ({ label: l })),
            correctIndex: richtigerIndex,
            explanation: b.erklaerung,
          },
    });
  });

  return questions;
}

// --- JSON ------------------------------------------------------------------

function zeileFuer(zeilen: readonly Zeile[], nadel: string): number {
  const gesucht = nadel.trim();
  if (gesucht === '') return 0;
  for (const z of zeilen) {
    if (z.text.includes(gesucht)) return z.nr;
  }
  return 0;
}

function erstesFeld(obj: Record<string, unknown>, namen: readonly string[]): unknown {
  for (const name of namen) {
    const wert = obj[name];
    if (wert !== undefined && wert !== null) return wert;
  }
  return undefined;
}

interface JsonAntwort {
  readonly label: string;
  readonly markiert: boolean;
}

function jsonAntworten(roh: unknown): JsonAntwort[] | null {
  if (!Array.isArray(roh)) return null;
  const out: JsonAntwort[] = [];
  for (const eintrag of roh) {
    if (typeof eintrag === 'string') {
      const markiert = istMarkiert(eintrag.trim());
      const text = markiert ? eintrag.trim().replace(MARKIERUNG, '') : eintrag;
      out.push({ label: entpackeAnfuehrung(entferneAuszeichnung(text)).trim(), markiert });
      continue;
    }
    if (isRecord(eintrag)) {
      const label = erstesFeld(eintrag, ['label', 'text', 'antwort', 'answer', 'option']);
      const markiert = erstesFeld(eintrag, ['correct', 'richtig', 'istRichtig', 'correctAnswer']);
      out.push({
        label: typeof label === 'string' ? entpackeAnfuehrung(entferneAuszeichnung(label)).trim() : '',
        markiert: markiert === true,
      });
      continue;
    }
    out.push({ label: '', markiert: false });
  }
  return out;
}

function parseJson(text: string, zeilen: readonly Zeile[]): ParseErgebnis {
  const fehler: ParseFehler[] = [];
  let daten: unknown;
  try {
    daten = JSON.parse(text) as unknown;
  } catch {
    // Eine KI setzt im Fliesstext gern typografische Anfuehrungszeichen.
    try {
      daten = JSON.parse(geradeAnfuehrung(text)) as unknown;
    } catch {
      return {
        ok: false,
        titel: 'Quizbude',
        questions: [],
        hinweise: [],
        quelle: 'json',
        fehler: [
          {
            zeile: 0,
            text:
              'Die Datei faengt wie JSON an, laesst sich aber nicht lesen. ' +
              'Entweder gueltiges JSON schicken oder das Zeilenformat benutzen.',
          },
        ],
      };
    }
  }

  const wurzel = isRecord(daten) ? daten : null;
  const rohFragen = Array.isArray(daten)
    ? daten
    : wurzel === null
      ? null
      : erstesFeld(wurzel, ['fragen', 'questions', 'items']);

  if (!Array.isArray(rohFragen)) {
    return {
      ok: false,
      titel: 'Quizbude',
      questions: [],
      hinweise: [],
      quelle: 'json',
      fehler: [
        {
          zeile: 0,
          text: 'Im JSON fehlt die Liste der Fragen (Feld "fragen" oder "questions").',
        },
      ],
    };
  }

  const titelRoh = wurzel === null ? undefined : erstesFeld(wurzel, ['titel', 'title', 'name']);
  const titel = typeof titelRoh === 'string' && titelRoh.trim() !== '' ? titelRoh.trim() : 'Quizbude';

  const bloecke: RohBlock[] = [];
  rohFragen.forEach((roh: unknown, i: number) => {
    if (!isRecord(roh)) {
      fehler.push({ zeile: 0, text: `Eintrag ${i + 1} im JSON ist keine Frage.` });
      return;
    }
    const promptRoh = erstesFeld(roh, ['frage', 'prompt', 'question', 'text']);
    const prompt = typeof promptRoh === 'string' ? entferneAuszeichnung(promptRoh).trim() : '';
    const nr = zeileFuer(zeilen, typeof promptRoh === 'string' ? promptRoh : '');

    const antworten = jsonAntworten(erstesFeld(roh, ['antworten', 'answers', 'options', 'optionen']));
    if (antworten === null) {
      fehler.push({
        zeile: nr,
        text: `Frage ${i + 1} hat keine Antwortliste (Feld "antworten" oder "answers").`,
      });
      return;
    }

    const richtigRoh = erstesFeld(roh, ['richtig', 'correct', 'correctIndex', 'loesung', 'answer']);
    if (typeof richtigRoh === 'number' && Number.isInteger(richtigRoh)) {
      for (let k = 0; k < antworten.length; k += 1) {
        const a = antworten[k];
        if (a === undefined) continue;
        antworten[k] = { label: a.label, markiert: k === richtigRoh };
      }
    } else if (typeof richtigRoh === 'string') {
      const gesucht = richtigRoh.trim().toLocaleLowerCase('de');
      for (let k = 0; k < antworten.length; k += 1) {
        const a = antworten[k];
        if (a === undefined) continue;
        antworten[k] = { label: a.label, markiert: a.label.toLocaleLowerCase('de') === gesucht };
      }
    }

    const sekundenRoh = erstesFeld(roh, ['sekunden', 'seconds', 'zeit', 'timeLimit']);
    const msRoh = erstesFeld(roh, ['timeLimitMs', 'zeitMs']);
    let sekunden = DEFAULT_ANSWER_SECONDS;
    if (typeof sekundenRoh === 'number' && Number.isFinite(sekundenRoh)) {
      sekunden = Math.round(sekundenRoh);
    } else if (typeof msRoh === 'number' && Number.isFinite(msRoh)) {
      sekunden = Math.round(msRoh / 1000);
    }

    const erklaerungRoh = erstesFeld(roh, ['erklaerung', 'erklärung', 'explanation', 'hinweis']);

    bloecke.push({
      nr,
      promptRoh: prompt,
      sekunden,
      sekundenAngegeben: true,
      antworten: antworten.map((a) => ({ nr, label: a.label, markiert: a.markiert })),
      erklaerung:
        typeof erklaerungRoh === 'string' && erklaerungRoh.trim() !== ''
          ? entferneAuszeichnung(erklaerungRoh).trim()
          : null,
      zeilen: 1,
    });
  });

  if (bloecke.length > MAX_QUESTIONS) {
    return {
      ok: false,
      titel,
      questions: [],
      hinweise: [],
      quelle: 'json',
      fehler: [
        {
          zeile: 0,
          text:
            `Die Datei hat ${bloecke.length} Fragen. ` +
            `Mehr als ${MAX_QUESTIONS} nimmt die Seite nicht an. Teil sie auf zwei Runden auf.`,
        },
      ],
    };
  }

  const questions = pruefeUndBaue(bloecke, fehler);
  fehler.sort((a, b) => a.zeile - b.zeile);
  return {
    ok: fehler.length === 0 && questions.length > 0,
    titel,
    questions,
    fehler,
    hinweise: [],
    quelle: 'json',
  };
}

// --- Einstieg --------------------------------------------------------------

/**
 * Erkennung ohne Auswahlknopf (Ruling 3): sieht die Datei nach JSON aus,
 * wird sie als JSON gelesen, sonst als Zeilenformat.
 */
export function siehtNachJsonAus(text: string): boolean {
  const t = text.trim();
  return t.startsWith('{') || t.startsWith('[');
}

export function parseQuiz(raw: string): ParseErgebnis {
  const text = normalisiereText(raw);
  const alleZeilen: Zeile[] = text.split('\n').map((t, i) => ({ nr: i + 1, text: t }));

  // Code-Zaeune sind Verpackung des Werkzeugs. Die Zeilennummern der
  // Originaldatei bleiben erhalten, damit jede Meldung zutrifft.
  const ohneZaun = alleZeilen.filter((z) => !ZAUN.test(z.text));

  const kern = ohneZaun
    .map((z) => z.text)
    .join('\n')
    .trim();

  if (kern === '') {
    return {
      ok: false,
      titel: 'Quizbude',
      questions: [],
      hinweise: [],
      quelle: 'zeilen',
      fehler: [
        {
          zeile: 1,
          text: 'Da steht noch keine Frage. Schreib eine Frage und darunter die Antworten.',
        },
      ],
    };
  }

  if (siehtNachJsonAus(kern)) return parseJson(kern, ohneZaun);

  const { bloecke, titel, fehler } = zuBloecken(ohneZaun);
  const getrennt = trenneBeiwerk(bloecke);

  if (getrennt.bloecke.length === 0) {
    fehler.push({
      zeile: 1,
      text: 'Da steht noch keine Frage. Schreib eine Frage und darunter die Antworten.',
    });
    return {
      ok: false,
      titel: titel === '' ? 'Quizbude' : titel,
      questions: [],
      fehler,
      hinweise: getrennt.hinweise,
      quelle: 'zeilen',
    };
  }

  if (getrennt.bloecke.length > MAX_QUESTIONS) {
    const zuviel = getrennt.bloecke[MAX_QUESTIONS];
    fehler.push({
      zeile: zuviel === undefined ? 1 : zuviel.nr,
      text:
        `Die Datei hat ${getrennt.bloecke.length} Fragen. ` +
        `Mehr als ${MAX_QUESTIONS} nimmt die Seite nicht an. Teil sie auf zwei Runden auf.`,
    });
    return {
      ok: false,
      titel: titel === '' ? 'Quizbude' : titel,
      questions: [],
      fehler,
      hinweise: getrennt.hinweise,
      quelle: 'zeilen',
    };
  }

  const questions = pruefeUndBaue(getrennt.bloecke, fehler);
  fehler.sort((a, b) => a.zeile - b.zeile);

  return {
    ok: fehler.length === 0 && questions.length > 0,
    titel: titel === '' ? 'Quizbude' : titel,
    questions,
    fehler,
    hinweise: getrennt.hinweise,
    quelle: 'zeilen',
  };
}

/** Die Demorunde als Text im vorgegebenen Format. */
export const DEMO_TEXT = [
  '# Quizbude — Demorunde',
  '',
  'Welcher Planet ist der Sonne am nächsten? | 20',
  '* Merkur',
  'Venus',
  'Mars',
  'Jupiter',
  '> Merkur umkreist die Sonne im Mittel in 58 Millionen Kilometern Abstand.',
  '',
  'Ein Oktopus hat drei Herzen. | 15',
  '* Wahr',
  'Falsch',
  '> Zwei Kiemenherzen pumpen durch die Kiemen, ein Körperherz durch den Rest.',
  '',
].join('\n');
