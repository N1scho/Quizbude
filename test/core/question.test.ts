import { describe, expect, it } from 'vitest';
import {
  MAX_PROMPT_CHARS,
  createDefaultRegistry,
  loadQuestion,
  parsePrompt,
  readingWindowMs,
} from '@quizbude/core';

/**
 * B5: MAX_PROMPT_CHARS war definiert und wurde nirgends durchgesetzt.
 *
 * Solange das Lesefenster bei 10 s gedeckelt war, blieb das folgenlos. Seit
 * die Kappung weg ist - und sie kommt nicht zurueck - waechst das Fenster
 * linear mit der Wortzahl: eine versehentlich zweitausend Zeichen lange
 * Frage haelt die Runde minutenlang an. Die Zeichengrenze ist damit von
 * einer Notiz zu einer tragenden Zusicherung geworden.
 */

const registry = createDefaultRegistry();

function frage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'q1',
    type: 'true_false',
    prompt: 'Ein Oktopus hat drei Herzen.',
    timeLimitMs: 20_000,
    pointsFactor: 1,
    spec: { correct: true, explanation: 'Zwei Kiemenherzen und ein Koerperherz.' },
    ...overrides,
  };
}

describe('Der Fragetext beim Laden', () => {
  it('laesst genau MAX_PROMPT_CHARS Zeichen durch', () => {
    const grenze = 'a'.repeat(MAX_PROMPT_CHARS);
    expect(parsePrompt(grenze)).toBe(grenze);
    expect(loadQuestion(frage({ prompt: grenze }), registry).prompt).toBe(grenze);
  });

  it('faellt bei einem Zeichen mehr laut auf, statt still zu kuerzen', () => {
    const zuViel = 'a'.repeat(MAX_PROMPT_CHARS + 1);
    expect(() => loadQuestion(frage({ prompt: zuViel }), registry)).toThrow(
      /prompt muss 1\.\.200 Zeichen haben, hat 201/,
    );
  });

  it('nimmt keinen leeren und keinen fehlenden Fragetext an', () => {
    expect(() => loadQuestion(frage({ prompt: '   ' }), registry)).toThrow(/prompt muss 1\.\./);
    expect(() => loadQuestion(frage({ prompt: undefined }), registry)).toThrow(
      /prompt ist kein Text/,
    );
    expect(() => loadQuestion(frage({ prompt: 42 }), registry)).toThrow(/prompt ist kein Text/);
  });

  it('ist die Grenze, die das offene Lesefenster baendigt', () => {
    // Die Frage aus dem Befund: zweitausend Zeichen, vierhundert Woerter.
    const ausufernd = 'Wort '.repeat(400).trim();
    expect(ausufernd.length).toBeGreaterThan(1_900);
    expect(readingWindowMs(ausufernd, [])).toBeGreaterThan(150_000);
    expect(() => loadQuestion(frage({ prompt: ausufernd }), registry)).toThrow();

    // Und die Gegenrechnung: der laengste zugelassene Fragetext besteht aus
    // hoechstens 100 Woertern, das Fenster steht damit auch im schlimmsten
    // Fall fest. Ohne Zeichengrenze gaebe es diese Schranke nicht.
    const schlimmster = 'a '.repeat(MAX_PROMPT_CHARS / 2).trim();
    expect(schlimmster.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    expect(parsePrompt(schlimmster)).toBe(schlimmster);
    expect(readingWindowMs(schlimmster, [])).toBeLessThanOrEqual(42_000);
  });
});

describe('Der Rest des Frageeintrags', () => {
  it('nimmt keinen unbekannten Fragetyp an', () => {
    expect(() => loadQuestion(frage({ type: 'schieberegler' }), registry)).toThrow(
      /unbekannter Fragetyp/,
    );
  });

  it('nimmt weder leere id noch unbrauchbare Zahlen an', () => {
    expect(() => loadQuestion(frage({ id: '' }), registry)).toThrow(/id fehlt/);
    expect(() => loadQuestion(frage({ timeLimitMs: 0 }), registry)).toThrow(/timeLimitMs/);
    expect(() => loadQuestion(frage({ pointsFactor: -1 }), registry)).toThrow(/pointsFactor/);
    expect(() => loadQuestion('keine Frage', registry)).toThrow(/kein Objekt/);
  });

  it('reicht die Spezifikation durch den Handler', () => {
    const geladen = loadQuestion(frage(), registry);
    expect(geladen.type).toBe('true_false');
    expect(geladen.spec).toEqual({
      correct: true,
      explanation: 'Zwei Kiemenherzen und ein Koerperherz.',
    });
  });
});
