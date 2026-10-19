import { describe, expect, it } from 'vitest';
import { readingWindowMs, step, type GameState } from '@quizbude/core';
import { firstOfType, makeDeps, newLobby, pid, sent, sentTo, t } from './fixture.js';

/** Ein Durchlauf der Zustandsmaschine ueber ein vollstaendiges Zwei-Fragen-Spiel. */

const ANNA = pid('p-anna');
const BERND = pid('p-bernd');

describe('Zwei-Fragen-Spiel von der Lobby bis zum Podium', () => {
  it('laeuft durch alle sieben Phasen und vergibt Punkte serverseitig', () => {
    const deps = makeDeps();
    let state: GameState = newLobby(deps);
    expect(state.phase).toBe('LOBBY');

    // --- Beitritt ---------------------------------------------------------
    const joinA = step(
      state,
      {
        event: {
          kind: 'PlayerJoinRequested',
          playerId: ANNA,
          displayName: '  Anna  ',
          origin: 'web',
          resumeToken: 'ta',
        },
        at: t(10),
      },
      deps,
    );
    state = joinA.state;
    expect(firstOfType(sentTo(joinA, ANNA), 'player:joined')?.displayName).toBe('Anna');

    const joinB = step(
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
    );
    state = joinB.state;
    const roster = firstOfType(sent(joinB), 'room:roster');
    expect(roster?.count).toBe(2);
    expect(roster?.softWarn).toBe(false);

    // Derselbe Name ein zweites Mal wird abgewiesen.
    const dup = step(
      state,
      {
        event: {
          kind: 'PlayerJoinRequested',
          playerId: pid('p-x'),
          displayName: 'anna',
          origin: 'web',
          resumeToken: 'tx',
        },
        at: t(30),
      },
      deps,
    );
    expect(firstOfType(sentTo(dup, pid('p-x')), 'player:join_rejected')?.reason).toBe('name_taken');
    state = dup.state;
    expect(state.players.size).toBe(2);

    // --- Frage 1: Ankuendigung und Lesefenster ----------------------------
    const started = step(
      state,
      { event: { kind: 'HostStartedGame', expectedPhase: 'LOBBY' }, at: t(1_000) },
      deps,
    );
    state = started.state;
    expect(state.phase).toBe('PREVIEW');

    const prepared = firstOfType(sent(started), 'stage:question_prepared');
    if (prepared === undefined) throw new Error('stage:question_prepared fehlt');
    expect(prepared.question.prompt).toBe('Welcher Planet ist der Sonne am naechsten?');
    expect(prepared.question.options).toHaveLength(4);
    // Die Ankuendigung liegt vor dem Lesefenster.
    expect(prepared.announceUntil).toBe(1_000 + 3_000);
    expect(prepared.readingWindowMs).toBe(
      readingWindowMs('Welcher Planet ist der Sonne am naechsten?', [
        'Merkur',
        'Venus',
        'Mars',
        'Jupiter',
      ]),
    );
    expect(prepared.answersOpenAt).toBe(prepared.announceUntil + prepared.readingWindowMs);
    expect(prepared.answersCloseAt).toBe(prepared.answersOpenAt + 30_000);

    // Das Spielergeraet bekommt nur Kachelzahl und Anordnung - keinen Text.
    const tiles = firstOfType(sent(started), 'player:question_prepared');
    expect(tiles?.tiles.tileCount).toBe(4);
    expect(tiles?.tiles.layout).toBe('quad');
    expect(JSON.stringify(tiles)).not.toContain('Merkur');
    expect(JSON.stringify(tiles)).not.toContain('Planet');

    // --- Frage 1: Freigabe ------------------------------------------------
    const opened = step(
      state,
      {
        event: { kind: 'TimerFired', token: { kind: 'open', gen: state.timerGen } },
        at: t(prepared.answersOpenAt),
      },
      deps,
    );
    state = opened.state;
    expect(state.phase).toBe('OPEN');
    expect(firstOfType(sent(opened), 'room:answers_open')?.seq).toBe(0);
    if (state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    // Nullpunkt ist answersOpenAt, nicht der Moment des Timers.
    expect(state.openedAt).toBe(prepared.answersOpenAt);

    // --- Frage 1: Antworten ----------------------------------------------
    state = step(
      state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(prepared.answersOpenAt + 2_000),
      },
      deps,
    ).state;

    const answerB = step(
      state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: BERND,
          questionSeq: 0,
          raw: { index: 1 },
          rttMinMs: null,
        },
        at: t(prepared.answersOpenAt + 4_000),
      },
      deps,
    );
    state = answerB.state;
    expect(firstOfType(sent(answerB), 'room:answer_count')?.answered).toBe(2);

    // --- Frage 1: Aufloesung ---------------------------------------------
    const revealed = step(
      state,
      {
        event: { kind: 'TimerFired', token: { kind: 'close', gen: state.timerGen } },
        at: t(prepared.answersCloseAt),
      },
      deps,
    );
    state = revealed.state;
    expect(state.phase).toBe('REVEAL');

    const reveal = firstOfType(sent(revealed), 'stage:reveal');
    expect(reveal?.reveal.correctIndices).toEqual([0]);
    expect(reveal?.answerCount).toBe(2);
    expect(reveal?.correctCount).toBe(1);
    expect(reveal?.reveal.distribution).toEqual([
      { index: 0, count: 1 },
      { index: 1, count: 1 },
      { index: 2, count: 0 },
      { index: 3, count: 0 },
    ]);

    const resultA = firstOfType(sentTo(revealed, ANNA), 'player:question_result');
    const resultB = firstOfType(sentTo(revealed, BERND), 'player:question_result');
    expect(resultA?.correct).toBe(true);
    expect(resultA?.points).toBe(967);
    expect(resultA?.rank).toBe(1);
    expect(resultB?.correct).toBe(false);
    expect(resultB?.points).toBe(0);
    expect(resultB?.rank).toBe(2);
    expect(resultB?.deltaToAhead).toBe(967);

    // --- Zwischenstand ----------------------------------------------------
    const scoreboard = step(
      state,
      { event: { kind: 'HostAdvanced', expectedPhase: 'REVEAL' }, at: t(prepared.answersCloseAt + 3_000) },
      deps,
    );
    state = scoreboard.state;
    expect(state.phase).toBe('SCOREBOARD');
    expect(scoreboard.effects.some((e) => e.kind === 'persistRound')).toBe(true);
    const board = firstOfType(sent(scoreboard), 'stage:scoreboard');
    expect(board?.hasNextQuestion).toBe(true);
    expect(board?.top?.[0]?.displayName).toBe('Anna');
    expect(board?.top?.[0]?.score).toBe(967);
    expect(board?.reward.kind).toBe('classic');

    // Ein Doppelklick des Hosts mit veralteter Phase tut nichts.
    const stale = step(
      state,
      { event: { kind: 'HostAdvanced', expectedPhase: 'REVEAL' }, at: t(prepared.answersCloseAt + 3_100) },
      deps,
    );
    expect(stale.state.phase).toBe('SCOREBOARD');
    expect(stale.effects).toHaveLength(0);

    // --- Frage 2 ----------------------------------------------------------
    const q2 = step(
      state,
      { event: { kind: 'HostAdvanced', expectedPhase: 'SCOREBOARD' }, at: t(100_000) },
      deps,
    );
    state = q2.state;
    expect(state.phase).toBe('PREVIEW');
    const prepared2 = firstOfType(sent(q2), 'stage:question_prepared');
    if (prepared2 === undefined) throw new Error('stage:question_prepared fehlt');
    expect(prepared2.question.seq).toBe(1);
    expect(prepared2.question.type).toBe('true_false');
    expect(prepared2.question.options.map((o) => o.label)).toEqual(['Wahr', 'Falsch']);
    const tiles2 = firstOfType(sent(q2), 'player:question_prepared');
    expect(tiles2?.tiles.layout).toBe('duo');

    state = step(
      state,
      {
        event: { kind: 'TimerFired', token: { kind: 'open', gen: state.timerGen } },
        at: t(prepared2.answersOpenAt),
      },
      deps,
    ).state;
    expect(state.phase).toBe('OPEN');

    // Bernd ist schnell und richtig, Anna langsam und richtig.
    state = step(
      state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: BERND,
          questionSeq: 1,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(prepared2.answersOpenAt + 300),
      },
      deps,
    ).state;
    const bothAnswered = step(
      state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 1,
          raw: { index: 0 },
          rttMinMs: null,
        },
        at: t(prepared2.answersOpenAt + 10_000),
      },
      deps,
    );
    state = bothAnswered.state;
    if (state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    const settleAt = state.settleAt as number;

    const reveal2 = step(
      state,
      { event: { kind: 'TimerFired', token: { kind: 'settle', gen: state.timerGen } }, at: t(settleAt) },
      deps,
    );
    state = reveal2.state;
    expect(state.phase).toBe('REVEAL');
    // Bernd unter 500 ms: volle 1000. Anna bei 10 s von 20 s: Faktor 0,75.
    expect(state.players.get(BERND)?.score).toBe(1_000);
    expect(state.players.get(ANNA)?.score).toBe(967 + 750);

    // --- Zwischenstand nach der letzten Frage -----------------------------
    const board2 = step(
      state,
      { event: { kind: 'HostAdvanced', expectedPhase: 'REVEAL' }, at: t(settleAt + 2_000) },
      deps,
    );
    state = board2.state;
    expect(firstOfType(sent(board2), 'stage:scoreboard')?.hasNextQuestion).toBe(false);

    // --- Podium -----------------------------------------------------------
    const podium = step(
      state,
      { event: { kind: 'HostAdvanced', expectedPhase: 'SCOREBOARD' }, at: t(settleAt + 9_000) },
      deps,
    );
    state = podium.state;
    expect(state.phase).toBe('PODIUM');
    const ranking = firstOfType(sent(podium), 'stage:podium')?.ranking ?? [];
    expect(ranking.map((r) => [r.displayName, r.score, r.rank])).toEqual([
      ['Anna', 1_717, 1],
      ['Bernd', 1_000, 2],
    ]);
    expect(firstOfType(sentTo(podium, BERND), 'player:podium')?.rank).toBe(2);

    // --- Ende -------------------------------------------------------------
    const finished = step(
      state,
      { event: { kind: 'HostAdvanced', expectedPhase: 'PODIUM' }, at: t(settleAt + 60_000) },
      deps,
    );
    expect(finished.state.phase).toBe('FINISHED');
    expect(finished.effects.some((e) => e.kind === 'persistFinal')).toBe(true);
    expect(finished.effects.some((e) => e.kind === 'closeRoom')).toBe(true);
    expect(firstOfType(sent(finished), 'room:finished')).toBeDefined();
  });

  it('mischt die Antwortreihenfolge reproduzierbar und rechnet sie korrekt zurueck', () => {
    const deps = makeDeps(42);
    const config = { ...newLobby(deps).config, shuffleOptions: true };
    let state: GameState = newLobby(makeDeps(42), undefined, config);
    const deps2 = makeDeps(42);

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
      deps2,
    ).state;

    const started = step(
      state,
      { event: { kind: 'HostStartedGame', expectedPhase: 'LOBBY' }, at: t(1_000) },
      deps2,
    );
    state = started.state;
    const prepared = firstOfType(sent(started), 'stage:question_prepared');
    if (prepared === undefined) throw new Error('fehlt');
    const merkurAt = prepared.question.options.findIndex((o) => o.label === 'Merkur');
    expect(merkurAt).toBeGreaterThanOrEqual(0);

    state = step(
      state,
      {
        event: { kind: 'TimerFired', token: { kind: 'open', gen: state.timerGen } },
        at: t(prepared.answersOpenAt),
      },
      deps2,
    ).state;

    const answered = step(
      state,
      {
        event: {
          kind: 'AnswerSubmitted',
          playerId: ANNA,
          questionSeq: 0,
          raw: { index: merkurAt },
          rttMinMs: null,
        },
        at: t(prepared.answersOpenAt + 100),
      },
      deps2,
    );
    if (answered.state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    expect(answered.state.answers.get(ANNA)?.correct).toBe(true);
    expect(answered.state.answers.get(ANNA)?.points).toBe(1_000);
  });
});
