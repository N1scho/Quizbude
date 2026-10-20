import { MAX_QUESTIONS } from '@quizbude/core';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPhase(value: unknown): value is Phase {
  return typeof value === 'string' && PHASES.has(value);
}

function isShortString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_FIELD_CHARS;
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
  if (!isShortString(title)) return null;
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
