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

/**
 * Obergrenze fuer den Titel einer Sammlung (B4).
 *
 * Dieselbe Zahl gilt am Transportrand des Servers; `validate.ts` bindet
 * sich an diese Konstante, statt sie ein zweites Mal zu fuehren. Ein
 * laengerer Titel kam frueher durch den Pruefbericht ("Alles in Ordnung"),
 * wurde am Transportrand stillschweigend verworfen, und die Buehne hing
 * ohne ein Wort in "Buehne verbindet sich ...". Wer hier etwas aendert,
 * aendert beide Seiten - `test/server/validate.test.ts` bricht sonst.
 */
export const MAX_TITLE_CHARS = 256;

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

/**
 * Markierung am Zeilenende (B6) - aber NUR die eindeutigen Haekchen.
 *
 * Ein `*` am Zeilenende ist der Rest einer Fett- oder Kursivauszeichnung
 * (`**Merkur**`, `*Merkur*`) und keine Aussage ueber die Richtigkeit; ein
 * `+` steht dort fuer eine Aufzaehlung oder ein Rechenzeichen, und `[x]`
 * gehoert vor die Antwort. Diese drei gelten hinten deshalb ausdruecklich
 * NICHT als Markierung. Ein Haekchen dagegen ist nirgends Auszeichnung:
 * steht es hinten, ist es gemeint.
 */
const MARKIERUNG_ENDE = /\s*(✅|✔|✓|☑)+\s*$/;

/**
 * Ein leerer Kasten ist auch am Zeilenende keine Markierung (Ruling 4) -
 * aber ebenso wenig Inhalt, der auf die Kachel gehoert. Er wird abgetragen,
 * ohne etwas zu markieren.
 */
const LEERKASTEN_ENDE = /\s*(☐|❌|✗)+\s*$/;

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

/**
 * Eine Antwortbeschriftung von allem befreien, was Schreibweise ist, und
 * dabei sagen, ob sie markiert war.
 *
 * Steht hier und nicht zweimal: das Zeilenformat und die JSON-Form hatten
 * je eine eigene Fassung dieses Abtrags, und genau die JSON-Fassung trug
 * B1 unveraendert weiter.
 */
function leseBeschriftung(roh: string): { label: string; markiert: boolean } {
  // Der Fluchtweg steht vor allem anderen: `\* Sternchen` ist Text.
  const direkt = fluchtweg(roh);
  if (direkt !== null) {
    return { label: direkt.trim(), markiert: false };
  }

  // B1 und B6 haben dieselbe Wurzel: einmal abtragen reicht nicht.
  //
  // In jeder Runde wird erst die Schreibweise abgetragen - Beschriftung
  // (`A)`) und Aufzaehlungszeichen (`-`) -, danach erst die Markierung
  // geprueft. Vorher sah `istMarkiert` die rohe Zeile, und `A) ✅ Merkur`
  // galt als unmarkiert, obwohl der Autor markiert hatte (B6). Und weil nur
  // ein einziges Mal ersetzt wurde, blieb bei `* ✅ Merkur` das Haekchen im
  // Antworttext stehen - die richtige Antwort sichtbar auf der Leinwand (B1).
  //
  // Die Schleife laeuft, bis nichts mehr greift. Damit ist die Reihenfolge
  // innerhalb einer Runde nicht mehr tragend, sondern nur noch das, was
  // jede Runde abtraegt.
  //
  // N1: Sie hatte einen Deckel von acht Runden, und der fiel nach oben
  // offen aus - ab der neunten Markierung blieb das Haekchen im sichtbaren
  // Label stehen, waehrend der Pruefbericht gruen blieb. Genau der Schaden,
  // gegen den B1 angetreten ist, nur eine Runde weiter hinten.
  //
  // Der Deckel ist weg, und die Terminierung haengt jetzt allein am Abbruch
  // bei unveraenderter Zeile. Das traegt, weil KEINE der vier beteiligten
  // Regexe auf dem leeren String greifen kann: BESCHRIFTUNG verlangt
  // Zeichen + `).:` + Leerraum (mindestens drei), PUNKT ein
  // Aufzaehlungszeichen + Leerraum (mindestens zwei), MARKIERUNG und
  // LEERKASTEN je mindestens ein Zeichen aus ihrer Klasse - die `\s*` am
  // Ende sind der einzige Teil, der leer bleiben darf. Jede Runde traegt
  // deshalb entweder mindestens ein Zeichen ab oder gar keines; traegt sie
  // keines ab, ist `rest === vorher` und die Schleife bricht. Es gibt keine
  // Eingabe, unter der sie laenger als `roh.length` Runden laeuft.
  let rest = roh;
  let markiert = false;
  for (;;) {
    const vorher = rest;
    rest = rest.replace(BESCHRIFTUNG, '').replace(PUNKT, '');
    if (istMarkiert(rest)) {
      markiert = true;
      rest = rest.replace(MARKIERUNG, '');
      const entkommen = fluchtweg(rest);
      if (entkommen !== null) {
        return { label: entkommen.trim(), markiert: true };
      }
    } else {
      rest = rest.replace(LEERKASTEN, '');
    }
    if (rest === vorher) break;
  }

  // Dasselbe am Zeilenende - nur fuer die eindeutigen Haekchen.
  while (MARKIERUNG_ENDE.test(rest)) {
    markiert = true;
    rest = rest.replace(MARKIERUNG_ENDE, '');
  }
  while (LEERKASTEN_ENDE.test(rest)) rest = rest.replace(LEERKASTEN_ENDE, '');

  rest = entferneAuszeichnung(rest);
  rest = entpackeAnfuehrung(rest);
  return { label: rest.trim(), markiert };
}

function leseAntwort(zeile: Zeile): RohAntwort {
  const gelesen = leseBeschriftung(zeile.text.trim());
  return { nr: zeile.nr, label: gelesen.label, markiert: gelesen.markiert };
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

/**
 * Koennte dieser Block ueberhaupt eine Frage sein?
 *
 * Beiwerk eines Sprachmodells endet nicht auf ein Fragezeichen, traegt
 * keine Zeitangabe und hat keine markierte Antwort. Derselbe Massstab
 * entscheidet zweierlei: ob ein Block am Rand als Vorwort uebersprungen
 * wird und ob die Titelzeile noch erlaubt ist. Nur so haelt auch ein
 * mehrzeiliges Vorwort, dessen zweite Zeile sonst zur einzigen Antwort
 * einer Frage wird, die keine ist.
 */
function kannFrageSein(b: RohBlock): boolean {
  return wirktWieFrage(b.promptRoh) || b.antworten.some((a) => a.markiert);
}

/**
 * Satzzeichen, mit dem Beiwerk sich ankuendigt oder verabschiedet.
 *
 * Ein Sprachmodell kuendigt seine Liste an ("Hier sind deine Fragen:") und
 * verabschiedet sich ("Klar!", "Viel Spass!"). Fragetexte und Antworten
 * tragen keines von beiden: eine Frage endet auf ein Fragezeichen oder gar
 * nichts, eine Antwort auf das letzte Zeichen ihres Labels.
 */
const BEIWERK_ZEICHEN = /[:!]$/;

/** Liest sich diese Zeile wie Beiwerk und nicht wie Frage oder Antwort? */
function wirktWieBeiwerk(text: string): boolean {
  const t = text.trim();
  return t !== '' && BEIWERK_ZEICHEN.test(t);
}

/**
 * Ist dieser Block ein Vorwort - Beiwerk des Werkzeugs statt einer Frage?
 *
 * Zwei Bedingungen, beide notwendig:
 *
 * 1. Der Block kann gar keine Frage sein (`kannFrageSein`): kein
 *    Fragezeichen, keine Zeitangabe, keine markierte Antwort.
 * 2. **Jede** seiner Zeilen traegt ein Beiwerk-Zeichen.
 *
 * Die zweite Bedingung traegt den Unterschied. Die Zahl der Zeilen taugt
 * dafuer nicht: ein dreizeiliges Vorwort hat genau so "zwei Antworten" wie
 * eine Frage mit zwei Antworten, und ein zweizeiliges Vorwort genau so
 * "eine Antwort" wie eine Frage mit einer. Wer nach Zeilen misst, muss
 * eines von beiden falsch entscheiden - und hat es auch getan: erst
 * verschwand die erste Frage still, dann liess das dreizeilige Vorwort den
 * ganzen Upload scheitern.
 *
 * Tragend ist, dass eine **richtig geschriebene** Frage ihre Markierung
 * traegt und damit nie Vorwort sein kann. Faellt die Markierung weg,
 * entscheidet das Satzzeichen - und zwar im Zweifel laut: was kein
 * Beiwerk-Zeichen traegt, bleibt stehen und wird von `pruefeUndBaue` mit
 * der Zeilennummer der Originaldatei beanstandet.
 */
function istVorwort(b: RohBlock): boolean {
  if (kannFrageSein(b)) return false;
  if (!wirktWieBeiwerk(b.promptRoh)) return false;
  return b.antworten.every((a) => wirktWieBeiwerk(a.label));
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
    if (aktuell !== null) {
      bloecke.push(aktuell);
      // B5: Erst ein Block, der eine Frage sein koennte, beendet die
      // Titelzeile. Ein Vorwort darf ihr nicht die Tuer zuschlagen.
      if (kannFrageSein(aktuell)) titelErlaubt = false;
    }
    aktuell = null;
  };

  for (const zeile of zeilen) {
    const text = zeile.text.trim();
    if (text === '') {
      schliessen();
      continue;
    }

    // B5: Die Titelzeile bleibt erlaubt, solange nichts gelesen wurde, was
    // eine Frage sein koennte - auch der offene Block zaehlt. Vorher gab
    // die erste Zeile Beiwerk sie auf, und `# Abendrunde` wurde als
    // Fragetext gelesen: ohne Antworten, mit zwei Fehlern ueber einer
    // Zeile, die gar keine Frage ist. Das ist die haeufigste KI-Ausgabe
    // ueberhaupt ("Klar! Hier sind deine Fragen:" plus Titel).
    if (
      text.startsWith('#') &&
      titelErlaubt &&
      (aktuell === null || !kannFrageSein(aktuell))
    ) {
      // Eine Ueberschrift trennt. Ohne das Schliessen wuerde die naechste
      // Frage zur Antwort des Vorworts darueber.
      schliessen();
      const t = entferneAuszeichnung(text.replace(/^#+\s*/, '')).trim();
      if (t.length > MAX_TITLE_CHARS) {
        fehler.push({
          zeile: zeile.nr,
          text:
            `Der Titel hat ${t.length} Zeichen, erlaubt sind ${MAX_TITLE_CHARS}. ` +
            `Kuerz ihn um ${t.length - MAX_TITLE_CHARS} Zeichen.`,
        });
      }
      if (t !== '') titel = t;
      titelErlaubt = false;
      continue;
    }

    if (aktuell === null) {
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
 * aber nur, wenn sie am Rand stehen und keine ihrer Zeilen wie eine Frage
 * oder eine Antwort aussieht. Das entscheidet `istVorwort`, nicht die Zahl
 * der Zeilen; eine Frage, der nur die Markierung fehlt, bleibt stehen und
 * faellt mit ihrer eigenen Zeilennummer auf.
 */
function trenneBeiwerk(bloecke: RohBlock[]): Beiwerk {
  const hinweise: string[] = [];
  const rest = bloecke.slice();

  // Ein mehrzeiliges Vorwort ("Klar!" / "Hier sind deine Fragen:") wird zu
  // einem Block, dessen Folgezeilen als Antworten gelten. Gezaehlt wird
  // deshalb nicht; gelesen wird, wie die Zeilen enden (`istVorwort`).
  //
  // N2 war: mit `kannFrageSein` allein verschwand die erste Frage still.
  // Wer "Nenne den kleinsten Planeten" schreibt und die Markierung
  // vergisst, hat keinen der drei Anhaltspunkte - kein Fragezeichen, keine
  // Zeitangabe, keine erkannte Markierung -, und der Block galt als
  // Vorwort. Der Pruefbericht meldete neun statt zehn Fragen und "Alles in
  // Ordnung"; den Hinweis "Zeile 1: als Vorwort uebersprungen" liest
  // niemand als Verlustmeldung.
  //
  // Die Gegenrichtung war genauso teuer: der Massstab "hoechstens eine
  // Folgezeile" erklaerte jedes dreizeilige Vorwort zur Frage und liess
  // den ganzen Upload scheitern - mit einer Fehlermeldung ueber dem Wort
  // "Klar!". Beides war dieselbe Klausel, und keine Zeilenzahl trennt die
  // beiden Faelle.
  //
  // Mehrere Vorwortbloecke hintereinander ("Klar!" - Leerzeile - "Hier
  // sind deine Fragen:") fallen ebenso weg; die JSON-Tuer nimmt sie auch.
  // Die Schleife terminiert, weil jede Runde einen Block entfernt, und der
  // letzte Block bleibt immer stehen - eine Eingabe aus einem einzigen
  // Block kommt nie leer heraus.
  for (;;) {
    const erste = rest[0];
    if (rest.length <= 1 || erste === undefined || !istVorwort(erste)) break;
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
      // Derselbe Abtrag wie im Zeilenformat - nicht eine zweite Fassung
      // davon. `"* ✅ Merkur"` kommt im JSON genauso vor.
      out.push(leseBeschriftung(eintrag.trim()));
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
  if (titel.length > MAX_TITLE_CHARS) {
    fehler.push({
      zeile: zeileFuer(zeilen, titel),
      text:
        `Der Titel hat ${titel.length} Zeichen, erlaubt sind ${MAX_TITLE_CHARS}. ` +
        `Kuerz ihn um ${titel.length - MAX_TITLE_CHARS} Zeichen.`,
    });
  }

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

/** Laesst sich der Text als JSON lesen - notfalls nach geraden Anfuehrungen? */
function lesbaresJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    // Eine KI setzt im Fliesstext gern typografische Anfuehrungszeichen.
  }
  try {
    JSON.parse(geradeAnfuehrung(text));
    return true;
  } catch {
    return false;
  }
}

/**
 * JSON unter einem Vorwort (B5).
 *
 * `siehtNachJsonAus` lief auf dem Text ohne Zaun, aber MIT Vorwort - und
 * fiel deshalb bei "Klar, hier ist deine Datei:" plus JSON-Block ins
 * Zeilenformat zurueck. Gesucht wird darum ab der ersten Zeile, die wie
 * JSON anfaengt, bis zur letzten, die wie JSON aufhoert. Verschoben wird
 * nur, was sich danach wirklich als JSON lesen laesst; alles andere bleibt
 * beim Zeilenformat. Die Zeilennummern der Originaldatei bleiben erhalten,
 * weil `parseJson` weiter die ungekuerzte Zeilenliste bekommt.
 */
function jsonNachBeiwerk(zeilen: readonly Zeile[]): {
  readonly text: string;
  readonly hinweise: readonly string[];
  readonly fehler: readonly ParseFehler[];
} | null {
  let von = -1;
  for (let i = 0; i < zeilen.length; i += 1) {
    const z = zeilen[i];
    if (z !== undefined && siehtNachJsonAus(z.text)) {
      von = i;
      break;
    }
  }
  // `von === 0` haette schon `siehtNachJsonAus` auf dem ganzen Text erkannt.
  if (von <= 0) return null;

  let bis = zeilen.length - 1;
  while (bis > von && !/[}\]]\s*$/.test(zeilen[bis]?.text ?? '')) bis -= 1;

  const text = zeilen
    .slice(von, bis + 1)
    .map((z) => z.text)
    .join('\n')
    .trim();
  if (!lesbaresJson(text)) return null;

  // Beide Tueren geben dieselbe Antwort. Was ueber dem JSON steht, wird
  // genau so gelesen wie ueber einer Frage im Zeilenformat: derselbe
  // `istVorwort`-Massstab auf denselben Bloecken. Steht dort etwas, das
  // kein Beiwerk ist, verschwindet es nicht still - es faellt mit seiner
  // Zeilennummer auf. Eine Titelzeile mit # wird von `zuBloecken` gar
  // nicht erst zu einem Block und bleibt deshalb erlaubt.
  const fehler: ParseFehler[] = [];
  for (const b of zuBloecken(zeilen.slice(0, von)).bloecke) {
    if (istVorwort(b)) continue;
    fehler.push({
      zeile: b.nr,
      text:
        'Ueber den Fragen steht Text, der kein Vorwort ist. Loesch ihn - ' +
        'die Fragen stehen darunter.',
    });
  }

  // "Als Vorwort uebersprungen" nur sagen, wenn es auch stimmt. Wer eben
  // gelesen hat, dass dort kein Vorwort steht, soll nicht darunter den
  // Hinweis finden, es sei eines uebersprungen worden.
  const hinweise: string[] = [];
  const vorwort = zeilen.find((z) => z.text.trim() !== '');
  if (vorwort !== undefined && fehler.length === 0) {
    hinweise.push(`Zeile ${vorwort.nr}: als Vorwort uebersprungen.`);
  }
  const schluss = zeilen.slice(bis + 1).find((z) => z.text.trim() !== '');
  if (schluss !== undefined) hinweise.push(`Zeile ${schluss.nr}: als Schlusswort uebersprungen.`);

  return { text, hinweise, fehler };
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

  const alsJson = jsonNachBeiwerk(ohneZaun);
  if (alsJson !== null) {
    const erg = parseJson(alsJson.text, ohneZaun);
    const fehler = [...alsJson.fehler, ...erg.fehler].sort((a, b) => a.zeile - b.zeile);
    return {
      ...erg,
      ok: erg.ok && alsJson.fehler.length === 0,
      fehler,
      hinweise: [...alsJson.hinweise, ...erg.hinweise],
    };
  }

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
