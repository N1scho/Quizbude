import { MAX_PROMPT_CHARS } from '../engine/constants.js';
import type { LoadedQuestion } from '../engine/state.js';
import type { QuestionTypeRegistry } from './registry.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Autorenzeit: eine Frage wird einmal geprueft und normalisiert, bevor sie
 * in den Raum kommt - genau wie `parseSpec` es fuer die Antworten tut.
 *
 * Warum der Fragetext hier eine harte Grenze braucht: das Lesefenster ist
 * dynamisch und hat nach oben KEINE Kappung (UX-Konzept Abschnitt 3). Eine
 * versehentlich zweitausend Zeichen lange Frage haelt die Runde damit
 * minutenlang an. Die Kappung kommt nicht zurueck - die Antwort auf zu viel
 * Text ist zu viel Text, nicht zu wenig Lesezeit. Also faellt der Text auf,
 * bevor er in den Raum kommt.
 *
 * Laut werden, nicht still kuerzen: ein abgeschnittener Fragetext waere im
 * Spiel nicht zu bemerken und im schlimmsten Fall nicht mehr beantwortbar.
 */
export function parsePrompt(raw: unknown, wo = 'Frage'): string {
  if (typeof raw !== 'string') throw new Error(`${wo}: prompt ist kein Text`);
  const prompt = raw.trim();
  if (prompt.length < 1 || prompt.length > MAX_PROMPT_CHARS) {
    throw new Error(
      `${wo}: prompt muss 1..${MAX_PROMPT_CHARS} Zeichen haben, hat ${prompt.length}`,
    );
  }
  return prompt;
}

/**
 * Der eine Weg, auf dem Quizinhalt zu einer `LoadedQuestion` wird. Solange
 * jede Quelle - heute das Demo-Quiz, spaeter der Editor - hier durchgeht,
 * kann keine Grenze vergessen werden.
 */
export function loadQuestion(raw: unknown, registry: QuestionTypeRegistry): LoadedQuestion {
  if (!isRecord(raw)) throw new Error('Frage: Eintrag ist kein Objekt');

  const id = raw['id'];
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new Error('Frage: id fehlt oder ist leer');
  }
  const wo = `Frage ${id}`;

  const type = raw['type'];
  if (typeof type !== 'string' || !registry.has(type)) {
    throw new Error(`${wo}: unbekannter Fragetyp ${String(type)}`);
  }

  const timeLimitMs = raw['timeLimitMs'];
  if (typeof timeLimitMs !== 'number' || !Number.isFinite(timeLimitMs) || timeLimitMs <= 0) {
    throw new Error(`${wo}: timeLimitMs muss eine positive Zahl sein`);
  }

  const pointsFactor = raw['pointsFactor'];
  if (typeof pointsFactor !== 'number' || !Number.isFinite(pointsFactor) || pointsFactor <= 0) {
    throw new Error(`${wo}: pointsFactor muss eine positive Zahl sein`);
  }

  return {
    id,
    type,
    prompt: parsePrompt(raw['prompt'], wo),
    timeLimitMs,
    pointsFactor,
    spec: registry.get(type).parseSpec(raw['spec']),
  };
}
