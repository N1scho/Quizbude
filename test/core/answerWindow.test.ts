import { beforeEach, describe, expect, it } from 'vitest';
import { step, type EngineDeps, type GameState } from '@quizbude/core';
import {
  firstOfType,
  lastOfType,
  makeDeps,
  newLobby,
  pid,
  sent,
  sentTo,
  t,
} from './fixture.js';

/** Die Randfalltabelle aus Architekturkonzept 5.5. */

const ANNA = pid('p-anna');
const BERND = pid('p-bernd');

interface Opened {
  readonly state: GameState;
  readonly openedAt: number;
  readonly closesAt: number;
}

function lobbyWithTwo(deps: EngineDeps): GameState {
  let state = newLobby(deps);
  state = step(
    state,
    {
      event: {
        kind: 'PlayerJoinRequested',
        playerId: ANNA,
        displayName: 'Anna',
        origin: 'web',
        resumeToken: 'ta',
      },
      at: t(10),
    },
    deps,
  ).state;
  state = step(
    state,
    {
      event: {
        kind: 'PlayerJoinRequested',
        playerId: BERND,
        displayName: 'Bernd',
        origin: 'web',
        resumeToken: 'tb',
      },
      at: t(20),
    },
    deps,
  ).state;
  return state;
}

function startFirstQuestion(deps: EngineDeps): {
  state: GameState;
  announceUntil: number;
  answersOpenAt: number;
  answersCloseAt: number;
} {
  const lobby = lobbyWithTwo(deps);
  const r = step(lobby, { event: { kind: 'HostStartedGame', expectedPhase: 'LOBBY' }, at: t(1_000) }, deps);
  const prepared = firstOfType(sent(r), 'stage:question_prepared');
  if (prepared === undefined) throw new Error('stage:question_prepared fehlt');
  return {
    state: r.state,
    announceUntil: prepared.announceUntil,
    answersOpenAt: prepared.answersOpenAt,
    answersCloseAt: prepared.answersCloseAt,
  };
}

function openWindow(deps: EngineDeps): Opened {
  const started = startFirstQuestion(deps);
  // Der Timer-Effekt feuert; settleDeadlines oeffnet das Fenster.
  const r = step(
    started.state,
    { event: { kind: 'TimerFired', token: { kind: 'open', gen: 1 } }, at: t(started.answersOpenAt) },
    deps,
  );
  expect(r.state.phase).toBe('OPEN');
  return { state: r.state, openedAt: started.answersOpenAt, closesAt: started.answersCloseAt };
}

describe('Antwortfenster', () => {
  let deps: EngineDeps;
  beforeEach(() => {
    deps = makeDeps();
  });

  it('Antwort vor der Freigabe wird abgelehnt, nicht als 0 ms gewertet', () => {
    const started = startFirstQuestion(deps);
    const early = step(
      started.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(started.announceUntil + 100),
      },
      deps,
    );

    const rejected = firstOfType(sentTo(early, ANNA), 'player:answer_rejected');
    expect(rejected?.reason).toBe('not_open');
    expect(firstOfType(sentTo(early, ANNA), 'player:answer_ack')).toBeUndefined();
    expect(early.state.phase).toBe('PREVIEW');

    // Die Eingabe bleibt offen: dieselbe Antwort zaehlt spaeter regulaer.
    const opened = step(
      early.state,
      { event: { kind: 'TimerFired', token: { kind: 'open', gen: 1 } }, at: t(started.answersOpenAt) },
      deps,
    );
    expect(opened.state.phase).toBe('OPEN');
    const later = step(
      opened.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(started.answersOpenAt + 100),
      },
      deps,
    );
    expect(firstOfType(sentTo(later, ANNA), 'player:answer_ack')).toBeDefined();
    if (later.state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    expect(later.state.answers.get(ANNA)?.points).toBe(1000);
  });

  it('Antwort nach Fensterschluss wird abgelehnt', () => {
    const opened = openWindow(deps);
    // Eine Eingabe nach answersCloseAt schliesst das Fenster zuerst (lazy close)
    // und wird dann im Zustand REVEAL jenseits der Gnadenfrist abgelehnt.
    const late = step(
      opened.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(opened.closesAt + 1_600),
      },
      deps,
    );
    expect(late.state.phase).toBe('REVEAL');
    const rejected = firstOfType(sentTo(late, ANNA), 'player:answer_rejected');
    expect(rejected?.reason).toBe('closed');
    if (late.state.phase !== 'REVEAL') throw new Error('erwartet REVEAL');
    expect(late.state.answers.has(ANNA)).toBe(false);
  });

  it('innerhalb der Gnadenfrist wird gebucht, aber mit 0 Punkten', () => {
    const opened = openWindow(deps);
    const late = step(
      opened.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(opened.closesAt + 500),
      },
      deps,
    );
    if (late.state.phase !== 'REVEAL') throw new Error('erwartet REVEAL');
    const record = late.state.answers.get(ANNA);
    expect(record?.late).toBe(true);
    expect(record?.correct).toBe(true);
    expect(record?.points).toBe(0);
    expect(late.state.players.get(ANNA)?.score).toBe(0);
    // Der Fensterschluss schickt zuerst ein "nicht geantwortet"-Ergebnis;
    // die Nachzueglerbuchung schickt danach das endgueltige.
    const result = lastOfType(sentTo(late, ANNA), 'player:question_result');
    expect(result?.late).toBe(true);
    expect(result?.answered).toBe(true);
    expect(result?.points).toBe(0);
  });

  it('eine zweite Antwort desselben Spielers gibt idempotent das erste Ergebnis', () => {
    const opened = openWindow(deps);
    const first = step(
      opened.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 2 },
          rttMinMs: null,
        },
        at: t(opened.openedAt + 1_000),
      },
      deps,
    );
    if (first.state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    const firstRecord = first.state.answers.get(ANNA);
    expect(firstRecord?.displayIndex).toBe(2);
    expect(firstRecord?.correct).toBe(false);

    const second = step(
      first.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(opened.openedAt + 2_000),
      },
      deps,
    );
    const ack = firstOfType(sentTo(second, ANNA), 'player:answer_ack');
    expect(ack?.optionIndex).toBe(2);
    if (second.state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    const stored = second.state.answers.get(ANNA);
    expect(stored?.displayIndex).toBe(2);
    expect(stored?.correct).toBe(false);
    expect(stored?.receivedAt).toBe(firstRecord?.receivedAt);
    expect(second.state.answers.size).toBe(1);
  });

  it('Antwort auf eine andere Frage wird abgelehnt', () => {
    const opened = openWindow(deps);
    const r = step(
      opened.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 7,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(opened.openedAt + 100),
      },
      deps,
    );
    expect(firstOfType(sentTo(r, ANNA), 'player:answer_rejected')?.reason).toBe('wrong_question');
  });

  it('Antwort in der Lobby wird mit wrong_phase abgelehnt', () => {
    const lobby = lobbyWithTwo(deps);
    const r = step(
      lobby,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(100),
      },
      deps,
    );
    expect(firstOfType(sentTo(r, ANNA), 'player:answer_rejected')?.reason).toBe('wrong_phase');
  });

  it('eine unsinnige Nutzlast wird abgelehnt und nicht gebucht', () => {
    const opened = openWindow(deps);
    const r = step(
      opened.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 99 },
          rttMinMs: null,
        },
        at: t(opened.openedAt + 50),
      },
      deps,
    );
    expect(firstOfType(sentTo(r, ANNA), 'player:answer_rejected')?.reason).toBe('out_of_range');
    if (r.state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    expect(r.state.answers.size).toBe(0);
  });

  it('die schnellere richtige Antwort gibt mehr Punkte', () => {
    const opened = openWindow(deps);
    let state = step(
      opened.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(opened.openedAt + 2_000),
      },
      deps,
    ).state;
    state = step(
      state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: BERND,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(opened.openedAt + 15_000),
      },
      deps,
    ).state;
    if (state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    const anna = state.answers.get(ANNA)?.points ?? 0;
    const bernd = state.answers.get(BERND)?.points ?? 0;
    expect(anna).toBe(967);
    expect(bernd).toBe(750);
    expect(anna).toBeGreaterThan(bernd);
  });

  it('wenn alle geantwortet haben, loest das Fenster vorzeitig auf', () => {
    const opened = openWindow(deps);
    let state = step(
      opened.state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(opened.openedAt + 1_000),
      },
      deps,
    ).state;
    const both = step(
      state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: BERND,
          questionSeq: 0,
          raw: { index: 1 },
          rttMinMs: null,
        },
        at: t(opened.openedAt + 1_200),
      },
      deps,
    );
    if (both.state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    expect(both.state.settleAt).not.toBeNull();
    const settleAt = both.state.settleAt as number;
    expect(settleAt).toBe(opened.openedAt + 1_200 + 300);

    const settled = step(
      both.state,
      { event: { kind: 'TimerFired', token: { kind: 'settle', gen: both.state.timerGen } }, at: t(settleAt) },
      deps,
    );
    expect(settled.state.phase).toBe('REVEAL');
    state = settled.state;
    expect(state.players.get(ANNA)?.score).toBe(983);
    expect(state.players.get(BERND)?.score).toBe(0);
  });
});
