import { randomInt } from 'node:crypto';
import { asRoomCode, type RoomCode } from '@quizbude/protocol';

/**
 * Crockford-Base32 ohne I, L, O, U, 0 und 1.
 * Kein Schutz, sondern Tippsicherheit.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const LENGTH = 6;

export function drawCode(): RoomCode {
  let out = '';
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return asRoomCode(out);
}

export function drawFreeCode(taken: (code: RoomCode) => boolean): RoomCode {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = drawCode();
    if (!taken(code)) return code;
  }
  throw new Error('Kein freier Spielcode gefunden');
}

/** Eingabe des Spielers normalisieren: Grossschreibung, Leerzeichen weg. */
export function normalizeCode(raw: string): RoomCode {
  return asRoomCode(raw.toUpperCase().replace(/[^0-9A-Z]/g, ''));
}
