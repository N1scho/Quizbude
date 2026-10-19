import { describe, expect, it } from 'vitest';
import { step, type Audience, type GameEvent, type GameState } from '@quizbude/core';
import type { ServerMessage } from '@quizbude/protocol';
import { makeDeps, newLobby, pid, t } from './fixture.js';

/**
 * E2: Welche Nachricht an wen geht, ist das zentrale Gesetz aus dem
 * UX-Konzept - und es hing an handgeschriebenen `scope`-Literalen, die
 * kein Test gelesen hat. Zwei Mutationen (Frage- und Reveal-Nachricht an
 * `all` statt `host`) blieben gruen.
 *
 * Dieser Test laeuft ueber JEDE Zustellung eines vollstaendigen Spiels und
 * prueft zweierlei: den erlaubten Empfaengerkreis je Nachrichtenart, und -
 * unabhaengig davon - dass kein Fragetext, kein Antworttext und keine
 * Erklaerung je ein Spielergeraet erreicht.
 */

const ANNA = pid('p-anna');
const BERND = pid('p-bernd');
const FREMD = pid('p-fremd');

interface Zustellung {
  readonly scope: Audience['scope'];
  readonly message: ServerMessage;
}

/**
 * Der erlaubte Empfaengerkreis je Nachrichtenart. Record ueber die ganze
 * Union: eine neue Nachrichtenart zwingt hier zu einer Entscheidung,
 * statt still durchzurutschen.
 */
const ERLAUBT: Readonly<Record<ServerMessage['t'], readonly Audience['scope'][]>> = {
  // Nur der Transport erzeugt diese drei; core kennt sie nicht.
  'room:created': ['host'],
  'clock:ping': ['player'],
  'clock:pong': ['player'],
  'room:error': ['player'],

  'room:roster': ['host'],
  'player:joined': ['player'],
  'player:join_rejected': ['player'],

  // Das Gesetz: Fragetext und Antworttexte gehen auf die Buehne, nie aufs Handy.
  'stage:question_prepared': ['host'],
  'player:question_prepared': ['players'],
  'room:answers_open': ['all'],
  'room:answer_count': ['all'],
  'player:answer_ack': ['player'],
  'player:answer_rejected': ['player'],

  // Erst hier darf die Loesung den Server verlassen - und nur zur Buehne.
  'stage:reveal': ['host'],
  'player:question_result': ['player'],

  'stage:scoreboard': ['host'],
  'player:scoreboard': ['player'],
  'stage:podium': ['host'],
  'player:podium': ['player'],
  'room:finished': ['all'],
};

/** Was core in einem vollstaendigen Zwei-Fragen-Spiel ueberhaupt erzeugt. */
const ERWARTETE_ARTEN: readonly ServerMessage['t'][] = [
  'room:roster',
  'player:joined',
  'player:join_rejected',
  'stage:question_prepared',
  'player:question_prepared',
  'room:answers_open',
  'room:answer_count',
  'player:answer_ack',
  'player:answer_rejected',
  'stage:reveal',
  'player:question_result',
  'stage:scoreboard',
  'player:scoreboard',
  'stage:podium',
  'player:podium',
  'room:finished',
];

function ganzesSpiel(): Zustellung[] {
  const deps = makeDeps();
  let state: GameState = newLobby(deps);
  const alle: Zustellung[] = [];

  const run = (event: GameEvent, at: number): void => {
    const result = step(state, { event, at: t(at) }, deps);
    state = result.state;
    for (const effect of result.effects) {
      if (effect.kind === 'send') alle.push({ scope: effect.to.scope, message: effect.message });
    }
  };

  const join = (playerId: typeof ANNA, displayName: string, at: number): void => {
    run({ kind: 'PlayerJoinRequested', playerId, displayName, origin: 'web', resumeToken: 'tok' }, at);
  };

  const letzteFrage = (): Extract<ServerMessage, { t: 'stage:question_prepared' }> => {
    const treffer = alle
      .map((z) => z.message)
      .filter((m): m is Extract<ServerMessage, { t: 'stage:question_prepared' }> =>
        m.t === 'stage:question_prepared',
      );
    const letzte = treffer[treffer.length - 1];
    if (letzte === undefined) throw new Error('keine vorbereitete Frage');
    return letzte;
  };

  join(ANNA, 'Anna', 10);
  join(BERND, 'Bernd', 20);
  // Abweisung: erzeugt player:join_rejected.
  join(FREMD, 'anna', 30);

  run({ kind: 'HostStartedGame', expectedPhase: 'LOBBY' }, 1_000);
  const q1 = letzteFrage();

  // Antwort vor der Freigabe: erzeugt player:answer_rejected.
  run(
    { kind: 'AnswerSubmitted', playerId: ANNA, questionSeq: 0, raw: { index: 0 }, rttMinMs: null },
    q1.announceUntil,
  );

  run({ kind: 'TimerFired', token: { kind: 'open', gen: 1 } }, q1.answersOpenAt);
  run(
    { kind: 'AnswerSubmitted', playerId: ANNA, questionSeq: 0, raw: { index: 0 }, rttMinMs: null },
    q1.answersOpenAt + 2_000,
  );
  run(
    { kind: 'AnswerSubmitted', playerId: BERND, questionSeq: 0, raw: { index: 1 }, rttMinMs: null },
    q1.answersOpenAt + 4_000,
  );
  run({ kind: 'TimerFired', token: { kind: 'close', gen: 2 } }, q1.answersCloseAt);

  run({ kind: 'HostAdvanced', expectedPhase: 'REVEAL' }, q1.answersCloseAt + 3_000);
  run({ kind: 'HostAdvanced', expectedPhase: 'SCOREBOARD' }, q1.answersCloseAt + 9_000);
  const q2 = letzteFrage();

  run({ kind: 'TimerFired', token: { kind: 'open', gen: 5 } }, q2.answersOpenAt);
  run(
    { kind: 'AnswerSubmitted', playerId: BERND, questionSeq: 1, raw: { index: 0 }, rttMinMs: null },
    q2.answersOpenAt + 300,
  );
  // Ein getrennter Spieler: erzeugt eine weitere Roster-Nachricht.
  run({ kind: 'PlayerDisconnected', playerId: ANNA }, q2.answersOpenAt + 1_000);
  run({ kind: 'TimerFired', token: { kind: 'close', gen: 6 } }, q2.answersCloseAt);

  run({ kind: 'HostAdvanced', expectedPhase: 'REVEAL' }, q2.answersCloseAt + 3_000);
  run({ kind: 'HostAdvanced', expectedPhase: 'SCOREBOARD' }, q2.answersCloseAt + 9_000);
  run({ kind: 'HostAdvanced', expectedPhase: 'PODIUM' }, q2.answersCloseAt + 20_000);

  return alle;
}

describe('Empfaengerkreis jeder Nachricht', () => {
  const alle = ganzesSpiel();

  it('erzeugt ueberhaupt Zustellungen jeder erwarteten Art (sonst prueft der Test nichts)', () => {
    const gesehen = new Set(alle.map((z) => z.message.t));
    expect([...gesehen].sort()).toEqual([...ERWARTETE_ARTEN].sort());
  });

  it('stellt jede Nachrichtenart nur an ihren erlaubten Empfaengerkreis zu', () => {
    const verstoesse = alle
      .filter((z) => !ERLAUBT[z.message.t].includes(z.scope))
      .map((z) => `${z.message.t} ging an '${z.scope}', erlaubt ist ${ERLAUBT[z.message.t].join('/')}`);
    expect([...new Set(verstoesse)]).toEqual([]);
  });

  it('laesst weder Fragetext noch Antworttext noch Erklaerung an ein Spielergeraet', () => {
    const verboten = new Set<string>();
    for (const { message } of alle) {
      if (message.t === 'stage:question_prepared') {
        verboten.add(message.question.prompt);
        for (const option of message.question.options) verboten.add(option.label);
      }
      if (message.t === 'stage:reveal' && message.reveal.explanation !== null) {
        verboten.add(message.reveal.explanation);
      }
    }
    expect(verboten.size).toBeGreaterThan(5);

    const lecks: string[] = [];
    for (const { scope, message } of alle) {
      if (scope === 'host') continue;
      const nutzlast = JSON.stringify(message);
      for (const text of verboten) {
        if (nutzlast.includes(text)) lecks.push(`${message.t} an '${scope}' enthaelt "${text}"`);
      }
    }
    expect([...new Set(lecks)]).toEqual([]);
  });

  it('schickt die Loesung ausschliesslich an die Buehne', () => {
    const reveal = alle.filter((z) => z.message.t === 'stage:reveal');
    expect(reveal.length).toBeGreaterThan(0);
    expect(reveal.every((z) => z.scope === 'host')).toBe(true);
  });
});
