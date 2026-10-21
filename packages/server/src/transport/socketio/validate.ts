import { MAX_QUESTIONS, MAX_TITLE_CHARS, MAX_UPLOAD_BYTES } from '@quizbude/core';
import type { ClientMessage, Phase, QuizPayload } from '@quizbude/protocol';

/**
 * Eingangsvalidierung am Transportrand.
 *
 * Jede Nachricht aus dem Netz ist fremd, bis sie hier geprueft wurde. Ein
 * blanker Cast auf ClientMessage erklaert die ganze Union fuer vertrauens-
 * wuerdig; ein falsch getyptes Feld wird dann erst tief im Server zum Fehler.
 * Hier wird jede Nachrichtenform vollstaendig geprueft, bevor die Nutzlast
 * core erreicht. Was nicht passt, gibt null - der Aufrufer verwirft sie.
 */

const PHASES: ReadonlySet<string> = new Set<string>([
  'LOBBY',
  'PREVIEW',
  'OPEN',
  'REVEAL',
  'SCOREBOARD',
  'PODIUM',
  'FINISHED',
]);

/**
 * Obergrenze fuer jedes Zeichenkettenfeld am Eingang. Die fachlichen Grenzen
 * (Name, Raumcode) zieht core; hier geht es nur darum, dass eine Nachricht
 * nicht beliebig viel Speicher kosten kann.
 */
export const MAX_FIELD_CHARS = 256;

/**
 * Aufschlag von der Datei zur Nutzlast am Draht (B3).
 *
 * Die Buehne schickt nicht die Datei, sondern das Ergebnis des Parsers als
 * JSON. Gemessen an einer Datei von 996 906 Bytes mit 200 Fragen:
 *
 * - gewoehnlicher Text: Faktor 1,03 (das JSON-Geruest je Frage),
 * - lauter Anfuehrungszeichen oder umgekehrte Schraegstriche: Faktor 2,03,
 *   weil JSON jedes davon zu zwei Zeichen macht,
 * - lauter Steuerzeichen: Faktor 6,01, weil JSON jedes davon zu `\uXXXX`
 *   macht. Zeichen ausserhalb von ASCII waechsen nicht - sie stehen in der
 *   Datei wie in der Nachricht als dieselben UTF-8-Bytes.
 *
 * Sechs ist damit nicht geschaetzt, sondern die laengste Ersetzung, die
 * JSON kennt - mehr kann ein Byte nicht werden.
 */
export const WIRE_ESCAPE_FACTOR = 6;

/** Nachrichtenrahmen und JSON-Geruest von 200 Fragen, grosszuegig gerundet. */
export const WIRE_FRAME_BYTES = 64 * 1024;

/**
 * Obergrenze fuer eine einzelne Nachricht am Draht, in Bytes.
 *
 * Ohne dieses Mass galt die Vorgabe von Socket.IO - 1e6 Bytes. Eine Datei
 * unter dem angekuendigten Deckel ("Hoechstens 1 MB", `Upload.tsx`) wurde
 * gruen geprueft, war am Draht aber groesser als 1e6 Bytes, und Socket.IO
 * trennte die Verbindung: keine Meldung, kein Raumcode, nichts.
 *
 * `MAX_UPLOAD_BYTES` wird dafuer ausdruecklich NICHT gesenkt - die Zusage
 * der Oberflaeche bleibt wahr, statt dass der Deckel kleiner wird.
 */
export const MAX_SOCKET_MESSAGE_BYTES = MAX_UPLOAD_BYTES * WIRE_ESCAPE_FACTOR + WIRE_FRAME_BYTES;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPhase(value: unknown): value is Phase {
  return typeof value === 'string' && PHASES.has(value);
}

function isShortString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_FIELD_CHARS;
}

/**
 * Der Titel einer Sammlung - gegen dieselbe Konstante wie im Parser (B4).
 *
 * Die Zahl darf nicht zweimal unabhaengig im Baum stehen: ein Titel, den
 * der Pruefbericht gruen laesst, aber der Transportrand verwirft, laesst
 * die Buehne ohne ein Wort haengen. `MAX_QUESTIONS` kommt denselben Weg.
 */
function isTitle(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TITLE_CHARS;
}

/** Ganzzahl im sicheren Bereich. Schliesst NaN, Infinity und Brueche aus. */
function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Form und Groesse einer hochgeladenen Sammlung - mehr nicht.
 *
 * Was in den einzelnen Fragen steht, prueft `loadQuestion` in core. Hier
 * eine zweite, flachere Pruefung aufzubauen hiesse, dieselbe Grenze an
 * zwei Stellen zu pflegen; genau daran ist in diesem Projekt schon einmal
 * ein Waechter zerbrochen.
 */
function parseQuizPayload(raw: unknown): QuizPayload | null {
  if (!isRecord(raw)) return null;
  const title = raw['title'];
  const questions = raw['questions'];
  if (!isTitle(title)) return null;
  if (!Array.isArray(questions)) return null;
  if (questions.length < 1 || questions.length > MAX_QUESTIONS) return null;
  return { title, questions };
}

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isRecord(raw)) return null;
  const t = raw['t'];
  if (typeof t !== 'string') return null;

  switch (t) {
    case 'host:create': {
      // Ohne Sammlung bleibt es beim Demo-Quiz des Servers.
      const quiz = raw['quiz'];
      if (quiz === undefined || quiz === null) return { t: 'host:create' };
      const geprueft = parseQuizPayload(quiz);
      if (geprueft === null) return null;
      return { t: 'host:create', quiz: geprueft };
    }

    case 'host:start':
    case 'host:advance': {
      const expectedPhase = raw['expectedPhase'];
      if (!isPhase(expectedPhase)) return null;
      return t === 'host:start'
        ? { t: 'host:start', expectedPhase }
        : { t: 'host:advance', expectedPhase };
    }

    case 'player:join': {
      const roomCode = raw['roomCode'];
      const displayName = raw['displayName'];
      if (!isShortString(roomCode) || !isShortString(displayName)) return null;
      return { t: 'player:join', roomCode, displayName };
    }

    case 'player:answer': {
      const questionSeq = raw['questionSeq'];
      const optionIndex = raw['optionIndex'];
      if (!isIndex(questionSeq) || !isIndex(optionIndex)) return null;
      return { t: 'player:answer', questionSeq, optionIndex };
    }

    case 'clock:ping': {
      const seq = raw['seq'];
      const clientTime = raw['clientTime'];
      if (!isIndex(seq) || !isFiniteNumber(clientTime)) return null;
      return { t: 'clock:ping', seq, clientTime };
    }

    case 'clock:pong': {
      const seq = raw['seq'];
      if (!isIndex(seq)) return null;
      return { t: 'clock:pong', seq };
    }

    default:
      return null;
  }
}
