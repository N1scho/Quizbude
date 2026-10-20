import { describe, expect, it } from 'vitest';
import * as core from '@quizbude/core';
import { READING_MIN_MS, readingWindowMs } from '@quizbude/core';

/**
 * Ruling R1: Das Lesefenster wird dynamisch berechnet und hat eine
 * Mindestdauer von 10 s je Frage - nach oben ist es offen.
 *
 * Die alte Kappung bei 10 s war unter der Annahme 120 Zeichen Fragetext
 * hergeleitet. Mit den gesetzten 200 Zeichen griff sie als Regel statt als
 * Ausnahme und nahm genau den langen Fragen die Lesezeit, die sie brauchen.
 */

const wortfolge = (n: number): string => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');

describe('Lesefenster', () => {
  it('rechnet nach der Formel, sobald sie ueber der Mindestdauer liegt', () => {
    // 1500 + 400*22 = 10300 ms, also knapp ueber 10 s.
    expect(readingWindowMs(wortfolge(22), [])).toBe(10_300);
  });

  it('kappt lange Fragen NICHT - sie bekommen die volle berechnete Zeit', () => {
    // Eine Frage an der Zeichengrenze: 30 Woerter plus vier dreiwortige
    // Antworten. 1500 + 400*30 + 150*12 = 15300 ms.
    const lang = readingWindowMs(wortfolge(30), [
      wortfolge(3),
      wortfolge(3),
      wortfolge(3),
      wortfolge(3),
    ]);
    expect(lang).toBe(15_300);
    // Der Satz, auf den es ankommt: keine Obergrenze. Eine wiedereingefuehrte
    // Kappung bei 10 s macht diese Zeile rot.
    expect(lang).toBeGreaterThan(10_000);
  });

  it('haelt die Mindestdauer von 10 s auch bei der kuerzesten Frage', () => {
    expect(READING_MIN_MS).toBe(10_000);
    // 1500 + 400*1 + 150*2 = 2200 ms Rohwert.
    expect(readingWindowMs('Wahr?', ['Ja', 'Nein'])).toBe(10_000);
    // Und auch dort, wo der Rohwert knapp darunter liegt: 1500 + 400*21 = 9900.
    expect(readingWindowMs(wortfolge(21), [])).toBe(10_000);
  });

  it('kennt keine Konstante fuer eine Obergrenze mehr', () => {
    // `packages/core/src/index.ts` exportiert den Namensraum per `export *`.
    // Ein stehengebliebener toter READING_MAX_MS waere hier sichtbar.
    expect(Object.keys(core)).not.toContain('READING_MAX_MS');
  });
});
