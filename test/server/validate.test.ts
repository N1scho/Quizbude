import { describe, expect, it } from 'vitest';
import { MAX_QUESTIONS, MAX_TITLE_CHARS, parseQuiz } from '@quizbude/core';
import { parseClientMessage } from '../../packages/server/src/transport/socketio/validate.js';

/** B2: Jede Nachrichtenform wird vollstaendig geprueft, nicht nur ihr Feld `t`. */

describe('parseClientMessage', () => {
  it('nimmt jede gueltige Nachrichtenform an', () => {
    expect(parseClientMessage({ t: 'host:create' })).toEqual({ t: 'host:create' });
    expect(parseClientMessage({ t: 'host:start', expectedPhase: 'LOBBY' })).toEqual({
      t: 'host:start',
      expectedPhase: 'LOBBY',
    });
    expect(parseClientMessage({ t: 'host:advance', expectedPhase: 'REVEAL' })).toEqual({
      t: 'host:advance',
      expectedPhase: 'REVEAL',
    });
    expect(
      parseClientMessage({ t: 'player:join', roomCode: 'abc234', displayName: 'Anna' }),
    ).toEqual({ t: 'player:join', roomCode: 'abc234', displayName: 'Anna' });
    expect(parseClientMessage({ t: 'player:answer', questionSeq: 0, optionIndex: 3 })).toEqual({
      t: 'player:answer',
      questionSeq: 0,
      optionIndex: 3,
    });
    expect(parseClientMessage({ t: 'clock:ping', seq: 1, clientTime: 1234.5 })).toEqual({
      t: 'clock:ping',
      seq: 1,
      clientTime: 1234.5,
    });
    expect(parseClientMessage({ t: 'clock:pong', seq: 2 })).toEqual({ t: 'clock:pong', seq: 2 });
  });

  it('nimmt nur die Felder der Form an und schleppt nichts weiter', () => {
    const parsed = parseClientMessage({
      t: 'player:join',
      roomCode: 'ABC234',
      displayName: 'Anna',
      schmuggel: 'hier bin ich',
    });
    expect(parsed).toEqual({ t: 'player:join', roomCode: 'ABC234', displayName: 'Anna' });
  });

  it('weist roomCode als Zahl zurueck - das ist B2', () => {
    expect(
      parseClientMessage({ t: 'player:join', roomCode: 123456, displayName: 'Mallory' }),
    ).toBeNull();
  });

  it.each([
    ['kein Objekt', null],
    ['Zahl', 42],
    ['Zeichenkette', 'host:create'],
    ['Feld t fehlt', {}],
    ['t keine Zeichenkette', { t: 42 }],
    ['unbekannte Art', { t: 'es:gibt:mich:nicht' }],
    ['Array', []],
    ['join ohne Felder', { t: 'player:join' }],
    ['join mit Objekt', { t: 'player:join', roomCode: {}, displayName: 'x' }],
    ['join mit Array als Name', { t: 'player:join', roomCode: 'A', displayName: [] }],
    ['join zu lang', { t: 'player:join', roomCode: 'A'.repeat(257), displayName: 'x' }],
    ['start ohne Phase', { t: 'host:start' }],
    ['start mit unbekannter Phase', { t: 'host:start', expectedPhase: 'KEINE_PHASE' }],
    ['advance mit Zahl', { t: 'host:advance', expectedPhase: 7 }],
    ['answer mit Zeichenkette', { t: 'player:answer', questionSeq: '0', optionIndex: 0 }],
    ['answer mit Bruch', { t: 'player:answer', questionSeq: 0, optionIndex: 1.5 }],
    ['answer mit NaN', { t: 'player:answer', questionSeq: Number.NaN, optionIndex: 0 }],
    ['ping mit Zeichenkette', { t: 'clock:ping', seq: 'eins', clientTime: 0 }],
    ['ping mit Unendlich', { t: 'clock:ping', seq: 1, clientTime: Number.POSITIVE_INFINITY }],
    ['pong ohne seq', { t: 'clock:pong', seq: null }],
  ])('weist %s zurueck', (_name, payload) => {
    expect(parseClientMessage(payload)).toBeNull();
  });
});

describe('host:create mit hochgeladener Sammlung', () => {
  const frage = { id: 'q1', type: 'single_choice', prompt: 'F?', timeLimitMs: 20_000 };

  it('laesst eine Sammlung durch, ohne ihren Inhalt zu beurteilen', () => {
    // Die inhaltliche Pruefung gehoert core. Haette der Transportrand hier
    // eine eigene, flachere Fassung der Grenzen, muesste sie bei jeder
    // Aenderung mitgezogen werden - und genau das geht schief.
    expect(
      parseClientMessage({ t: 'host:create', quiz: { title: 'Runde', questions: [frage] } }),
    ).toEqual({ t: 'host:create', quiz: { title: 'Runde', questions: [frage] } });
  });

  it('ohne Sammlung bleibt die Nachricht, was sie war', () => {
    expect(parseClientMessage({ t: 'host:create' })).toEqual({ t: 'host:create' });
    expect(parseClientMessage({ t: 'host:create', quiz: null })).toEqual({ t: 'host:create' });
  });

  it('weist eine Sammlung zurueck, deren Form nicht stimmt', () => {
    const kaputt: readonly unknown[] = [
      { t: 'host:create', quiz: 42 },
      { t: 'host:create', quiz: [] },
      { t: 'host:create', quiz: { title: 'x' } },
      { t: 'host:create', quiz: { questions: [frage] } },
      { t: 'host:create', quiz: { title: 7, questions: [frage] } },
      { t: 'host:create', quiz: { title: 'x', questions: {} } },
      { t: 'host:create', quiz: { title: 'x', questions: [] } },
      { t: 'host:create', quiz: { title: 'A'.repeat(257), questions: [frage] } },
    ];
    for (const payload of kaputt) expect(parseClientMessage(payload), JSON.stringify(payload)).toBeNull();
  });

  it('nimmt genau den Titel an, den der Parser gruen prueft (B4)', () => {
    // Die Zahl steht nur einmal im Baum. Laufen Parser und Transportrand
    // auseinander, haengt die Buehne ohne ein Wort: der Pruefbericht sagt
    // "Alles in Ordnung", `parseClientMessage` gibt null, und es kommt
    // weder `room:created` noch `room:error`. Deshalb beides hier an
    // EINER Grenze gemessen.
    const gerade = `# ${'A'.repeat(MAX_TITLE_CHARS)}\n\nFrage? | 20\n* A\nB`;
    const ergGerade = parseQuiz(gerade);
    expect(ergGerade.ok).toBe(true);
    expect(
      parseClientMessage({
        t: 'host:create',
        quiz: { title: ergGerade.titel, questions: ergGerade.questions },
      }),
    ).not.toBeNull();

    // Ein Zeichen mehr: der Parser schlaegt an, BEVOR etwas gesendet wird.
    const zuviel = `# ${'A'.repeat(MAX_TITLE_CHARS + 1)}\n\nFrage? | 20\n* A\nB`;
    expect(parseQuiz(zuviel).ok).toBe(false);
    expect(
      parseClientMessage({
        t: 'host:create',
        quiz: { title: 'A'.repeat(MAX_TITLE_CHARS + 1), questions: [frage] },
      }),
    ).toBeNull();
  });

  it('deckelt die Fragenzahl - eine Million Fragen sind kein Quiz, sondern eine Last', () => {
    const gerade = Array.from({ length: MAX_QUESTIONS }, () => frage);
    expect(parseClientMessage({ t: 'host:create', quiz: { title: 'x', questions: gerade } })).not
      .toBeNull();
    expect(
      parseClientMessage({ t: 'host:create', quiz: { title: 'x', questions: [...gerade, frage] } }),
    ).toBeNull();
  });
});
