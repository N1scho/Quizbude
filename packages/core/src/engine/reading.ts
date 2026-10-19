import {
  READING_BASE_MS,
  READING_MAX_MS,
  READING_MIN_MS,
  READING_PER_OPTION_WORD_MS,
  READING_PER_PROMPT_WORD_MS,
} from './constants.js';

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/u).length;
}

/**
 * Lesefenster = 1,5 s + 0,40 s je Wort der Frage + 0,15 s je Wort aller
 * Antworten, begrenzt auf 4,0 s bis 10,0 s (UX-Konzept Abschnitt 3).
 *
 * Die Untergrenze ist nicht verhandelbar: darunter reicht die Zeit nicht
 * fuer die Sakkade vom Handy zur Leinwand plus Fixierung.
 */
export function readingWindowMs(prompt: string, optionLabels: readonly string[]): number {
  const promptWords = countWords(prompt);
  const optionWords = optionLabels.reduce((sum, label) => sum + countWords(label), 0);
  const raw =
    READING_BASE_MS +
    READING_PER_PROMPT_WORD_MS * promptWords +
    READING_PER_OPTION_WORD_MS * optionWords;
  return Math.min(Math.max(Math.round(raw), READING_MIN_MS), READING_MAX_MS);
}
