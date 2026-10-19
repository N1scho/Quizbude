/**
 * Dauer der Ankuendigung vor dem Lesefenster.
 * Das Architekturkonzept nennt PREVIEW_MS = 3000; das UX-Konzept setzt
 * davor eine Ankuendigung und danach ein berechnetes Lesefenster.
 * Beides zusammen ergibt die Phase PREVIEW:
 *   answersOpenAt = preparedAt + ANNOUNCE_MS + readingWindowMs
 */
export const ANNOUNCE_MS = 3000;

/** Gnadenfrist fuer Nachzuegler in REVEAL. */
export const LATE_GRACE_MS = 1500;

/** Nach der letzten erwarteten Antwort noch kurz warten. */
export const ALL_ANSWERED_SETTLE_MS = 300;

/** Ab hier passt die Buehne die Namen nicht mehr alle - ein Hinweis, kein Limit. */
export const PLAYER_SOFT_WARN = 25;

/**
 * Notbremse gegen Ressourcenerschoepfung, KEIN Produktlimit.
 * 0 schaltet sie ab. Herleitung: Architekturkonzept 6.6.
 */
export const PLAYER_HARD_CAP = 5000;

// --- Lesefenster (UX-Konzept Abschnitt 3) ---------------------------------
export const READING_BASE_MS = 1500;
export const READING_PER_PROMPT_WORD_MS = 400;
export const READING_PER_OPTION_WORD_MS = 150;
export const READING_MIN_MS = 4000;
export const READING_MAX_MS = 10000;

// --- Textgrenzen (Ruling 2 des Auftrags) ----------------------------------
export const MAX_PROMPT_CHARS = 200;
export const MAX_OPTION_CHARS = 100;
export const MAX_NAME_CHARS = 16;
