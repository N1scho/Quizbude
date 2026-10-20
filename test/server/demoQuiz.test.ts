import { describe, expect, it } from 'vitest';
import { MAX_PROMPT_CHARS } from '@quizbude/core';
import { loadDemoQuiz } from '../../packages/server/src/demoQuiz.js';

/**
 * B5: Das Demo-Quiz ist heute der einzige Weg, auf dem Quizinhalt in einen
 * Raum kommt. Es geht durch dieselbe Tuer wie spaeter der Editor - also
 * faellt hier auf, wenn ein Fragetext die Grenze reisst.
 */
describe('Das Demo-Quiz', () => {
  it('geht durch die Pruefung beim Laden', () => {
    expect(() => loadDemoQuiz()).not.toThrow();
  });

  it('haelt die Zeichengrenze jeder Frage ein', () => {
    const quiz = loadDemoQuiz();
    expect(quiz.questions.length).toBeGreaterThan(1);
    for (const q of quiz.questions) {
      expect(q.prompt.length).toBeGreaterThan(0);
      expect(q.prompt.length).toBeLessThanOrEqual(MAX_PROMPT_CHARS);
    }
  });
});
