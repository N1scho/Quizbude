import { describe, expect, it } from 'vitest';
import {
  ALL_ANSWERED_SETTLE_MS,
  step,
  type Effect,
  type EngineDeps,
  type GameState,
} from '@quizbude/core';
import { firstOfType, makeDeps, newLobby, pid, sent, t } from './fixture.js';

/**
 * E4: `onDisconnect` rechnete mit `lastInputAt` statt mit der Uhr der
 * Eingabe. `touch()` setzt dieses Feld erst am Ende von `step`, es trug
 * also noch den Zeitpunkt der VORHERIGEN Eingabe - die Atempause lag
 * damit in der Vergangenheit, und die Gnadenfrist fuer Nachzuegler war
 * verbraucht, bevor sie begann.
 *
 * "Timer sind Hinweise, die Uhr ist die Wahrheit" (step.ts) - an dieser
 * einen Stelle war die Uhr ein altes Feld.
 */

const ANNA = pid('p-anna');
const BERND = pid('p-bernd');

function join(state: GameState, playerId: typeof ANNA, name: string, at: number, deps: EngineDeps) {
  return step(
    state,
    {
      event: {
        kind: 'PlayerJoinRequested',
        playerId,
        displayName: name,
        origin: 'web',
        resumeToken: `t-${name}`,
      },
      at: t(at),
    },
    deps,
  ).state;
}

function settleTimer(effects: readonly Effect[]): number | null {
  const treffer = effects.find(
    (e): e is Extract<Effect, { kind: 'scheduleTimer' }> =>
      e.kind === 'scheduleTimer' && e.token.kind === 'settle',
  );
  return treffer === undefined ? null : treffer.atMono;
}

describe('Trennung des letzten offenen Spielers', () => {
  it('rechnet die Atempause auf der Uhr der Eingabe, nicht auf dem letzten Zeitstempel', () => {
    const deps = makeDeps();
    let state: GameState = newLobby(deps);
    state = join(state, ANNA, 'Anna', 10, deps);
    state = join(state, BERND, 'Bernd', 20, deps);

    const started = step(
      state,
      { event: { kind: 'HostStartedGame', expectedPhase: 'LOBBY' }, at: t(1_000) },
      deps,
    );
    const prepared = firstOfType(sent(started), 'stage:question_prepared');
    if (prepared === undefined) throw new Error('stage:question_prepared fehlt');
    const openedAt = prepared.answersOpenAt;

    state = step(
      started.state,
      { event: { kind: 'TimerFired', token: { kind: 'open', gen: 1 } }, at: t(openedAt) },
      deps,
    ).state;
    expect(state.phase).toBe('OPEN');

    // Anna antwortet frueh; damit traegt lastInputAt danach openedAt + 500.
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
        at: t(openedAt + 500),
      },
      deps,
    ).state;
    expect(state.lastInputAt).toBe(openedAt + 500);

    // Bernd trennt sich 15 Sekunden spaeter. Jetzt haben alle verbundenen
    // Spieler geantwortet - die Atempause beginnt JETZT.
    const jetzt = openedAt + 15_500;
    const getrennt = step(
      state,
      { event: { kind: 'PlayerDisconnected', playerId: BERND }, at: t(jetzt) },
      deps,
    );
    state = getrennt.state;
    if (state.phase !== 'OPEN') throw new Error('erwartet OPEN');

    expect(state.settleAt).toBe(jetzt + ALL_ANSWERED_SETTLE_MS);
    expect(settleTimer(getrennt.effects)).toBe(jetzt + ALL_ANSWERED_SETTLE_MS);
    // Der eigentliche Befund: die Frist darf nie in der Vergangenheit liegen.
    expect(state.settleAt as number).toBeGreaterThanOrEqual(jetzt);
  });

  it('laesst die Gnadenfrist fuer Nachzuegler nach der Trennung noch laufen', () => {
    const deps = makeDeps();
    let state: GameState = newLobby(deps);
    state = join(state, ANNA, 'Anna', 10, deps);
    state = join(state, BERND, 'Bernd', 20, deps);

    const started = step(
      state,
      { event: { kind: 'HostStartedGame', expectedPhase: 'LOBBY' }, at: t(1_000) },
      deps,
    );
    const prepared = firstOfType(sent(started), 'stage:question_prepared');
    if (prepared === undefined) throw new Error('stage:question_prepared fehlt');
    const openedAt = prepared.answersOpenAt;

    state = step(
      started.state,
      { event: { kind: 'TimerFired', token: { kind: 'open', gen: 1 } }, at: t(openedAt) },
      deps,
    ).state;
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
        at: t(openedAt + 500),
      },
      deps,
    ).state;

    const jetzt = openedAt + 15_500;
    state = step(
      state,
      { event: { kind: 'PlayerDisconnected', playerId: BERND }, at: t(jetzt) },
      deps,
    ).state;
    if (state.phase !== 'OPEN') throw new Error('erwartet OPEN');
    const settleAt = state.settleAt as number;

    const aufgeloest = step(
      state,
      { event: { kind: 'TimerFired', token: { kind: 'settle', gen: state.timerGen } }, at: t(settleAt) },
      deps,
    );
    state = aufgeloest.state;
    if (state.phase !== 'REVEAL') throw new Error('erwartet REVEAL');

    expect(state.closedAt).toBe(settleAt);
    // 1,5 Sekunden Gnadenfrist, gerechnet ab jetzt - nicht ab einem
    // laengst verstrichenen Zeitpunkt. Entscheidend ist die zweite Zeile:
    // mit dem alten Zeitstempel lag lateUntil VOR dem Moment der Trennung.
    expect(state.lateUntil as number).toBe(settleAt + 1_500);
    expect(state.lateUntil as number).toBeGreaterThan(jetzt);
  });
});
