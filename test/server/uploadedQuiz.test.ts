import { afterEach, describe, expect, it } from 'vitest';
import { MAX_QUESTIONS, createDefaultRegistry, parseQuiz } from '@quizbude/core';
import { loadUploadedQuiz } from '../../packages/server/src/uploadedQuiz.js';
import { startHarness, type Harness } from './harness.js';

/**
 * Was die Buehne hochlaedt, ist Fremdeingabe - auch wenn sie es vorher
 * selbst geprueft hat. Zwischen Pruefbericht und Raum liegt das Netz.
 */

const EINE_RUNDE = '# Abendrunde\n\nWelcher Planet ist es? | 25\n* Merkur\nVenus\n\nStimmt das? | 9\n* Wahr\nFalsch';

function nutzlast(text: string): { title: string; questions: readonly unknown[] } {
  const erg = parseQuiz(text);
  expect(erg.fehler).toEqual([]);
  return { title: erg.titel, questions: erg.questions };
}

describe('Hochgeladene Sammlung laden', () => {
  const registry = createDefaultRegistry();

  it('nimmt, was der Parser herausgibt', () => {
    const quiz = loadUploadedQuiz(nutzlast(EINE_RUNDE), registry);
    expect(quiz.title).toBe('Abendrunde');
    expect(quiz.questions).toHaveLength(2);
    expect(quiz.questions[0]?.timeLimitMs).toBe(25_000);
    expect(quiz.questions[1]?.type).toBe('true_false');
  });

  it('geht durch dieselbe Tuer wie das Demo-Quiz - und wirft, was core ablehnt', () => {
    // Genau der Fall, gegen den die Pruefung am Transportrand NICHT hilft:
    // die Form stimmt, der Inhalt nicht.
    expect(() =>
      loadUploadedQuiz(
        { title: 'x', questions: [{ id: 'q1', type: 'single_choice', prompt: 'A'.repeat(300), timeLimitMs: 1000, pointsFactor: 1, spec: { options: [{ label: 'a' }, { label: 'b' }], correctIndex: 0, explanation: null } }] },
        registry,
      ),
    ).toThrow(/1\.\.200 Zeichen/u);
  });

  it('lehnt eine leere Sammlung ab', () => {
    expect(() => loadUploadedQuiz({ title: 'x', questions: [] }, registry)).toThrow(/keine Frage/u);
  });

  it('lehnt mehr als 200 Fragen ab', () => {
    const eine = nutzlast('Frage? | 20\n* A\nB').questions[0];
    const viele = Array.from({ length: MAX_QUESTIONS + 1 }, () => eine);
    expect(() => loadUploadedQuiz({ title: 'x', questions: viele }, registry)).toThrow(
      /hoechstens 200/u,
    );
  });

  it('faellt auf einen Titel zurueck, wenn keiner da ist', () => {
    const quiz = loadUploadedQuiz({ ...nutzlast(EINE_RUNDE), title: '   ' }, registry);
    expect(quiz.title).toBe('Quizbude');
  });
});

let harness: Harness | null = null;

afterEach(async () => {
  if (harness !== null) {
    await harness.close();
    harness = null;
  }
});

describe('Der Raum spielt die hochgeladenen Fragen', () => {
  it('nimmt die Sammlung der Buehne an und meldet Titel und Zahl zurueck', async () => {
    const h = await startHarness();
    harness = h;
    const host = await h.client();
    host.sendRaw({ t: 'host:create', quiz: nutzlast(EINE_RUNDE) });
    const created = await host.await('room:created');
    expect(created.quizTitle).toBe('Abendrunde');
    expect(created.questionCount).toBe(2);
    expect(h.registry.byCode(created.roomCode)?.state.questions[0]?.timeLimitMs).toBe(25_000);
  });

  it('ohne Sammlung bleibt es bei der Demorunde', async () => {
    const h = await startHarness();
    harness = h;
    const host = await h.client();
    host.sendRaw({ t: 'host:create' });
    const created = await host.await('room:created');
    expect(created.quizTitle).toBe('Quizbude — Demorunde');
  });

  it('lehnt eine inhaltlich kaputte Sammlung ab, ohne den Server zu verlieren', async () => {
    const h = await startHarness();
    harness = h;
    const host = await h.client();
    host.sendRaw({
      t: 'host:create',
      quiz: {
        title: 'Kaputt',
        questions: [{ id: 'q1', type: 'single_choice', prompt: 'ok?', timeLimitMs: 0, pointsFactor: 1, spec: {} }],
      },
    });
    const fehler = await host.await('room:error');
    expect(fehler.code).toBe('quiz_invalid');
    expect(fehler.message).toContain('timeLimitMs');
    expect(host.socket.connected).toBe(true);
    // Kein Raum und kein Raumcode sind dabei verbraucht worden.
    expect(h.registry.size).toBe(0);
  });

  it('verwirft eine Sammlung, deren Form schon am Transportrand nicht stimmt', async () => {
    const h = await startHarness();
    harness = h;
    const host = await h.client();
    for (const kaputt of [
      { t: 'host:create', quiz: 42 },
      { t: 'host:create', quiz: { title: 'x' } },
      { t: 'host:create', quiz: { title: 'x', questions: {} } },
      { t: 'host:create', quiz: { title: 'x', questions: [] } },
      { t: 'host:create', quiz: { title: 7, questions: [{}] } },
    ]) {
      host.sendRaw(kaputt);
    }
    // Keine dieser Nachrichten hat einen Raum erzeugt; die Leitung traegt.
    host.sendRaw({ t: 'clock:ping', seq: 5, clientTime: 1 });
    expect((await host.await('clock:pong', 2_000)).seq).toBe(5);
    expect(h.registry.size).toBe(0);
  });
});
