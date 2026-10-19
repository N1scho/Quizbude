import type {
  AnswerRejectReason,
  EndReason,
  MonoMs,
  Phase,
  PlayerId,
  PublicQuestionView,
  RankedPlayer,
  RosterEntry,
  ServerMessage,
} from '@quizbude/protocol';
import { rank, type RankablePlayer } from '../ranking.js';
import type { QuestionTypeRegistry } from '../questions/registry.js';
import type { AnyRewardLayer, RoundOutcome } from '../reward/layer.js';
import type { Rng } from '../rng.js';
import { compensate, maxPointsOf, scoreAnswer } from '../scoring/score.js';
import { POINT_UNIT_VALUE } from '../scoring/constants.js';
import {
  ALL_ANSWERED_SETTLE_MS,
  MAX_NAME_CHARS,
  PLAYER_SOFT_WARN,
} from './constants.js';
import type { Effect } from './effects.js';
import type { EngineInput, GameEvent, TimerToken } from './events.js';
import { readingWindowMs } from './reading.js';
import type {
  AnswerRecord,
  GameState,
  LiveQuestion,
  LoadedQuestion,
  LobbyState,
  OpenState,
  PlayerState,
  PreviewState,
  RevealState,
  RoomConfig,
  ScoreboardState,
} from './state.js';

export interface EngineDeps {
  readonly registry: QuestionTypeRegistry;
  readonly rng: Rng;
  readonly reward: AnyRewardLayer;
}

export interface StepResult {
  readonly state: GameState;
  readonly effects: readonly Effect[];
}

const SCOREBOARD_TOP_N = 5;

// ===========================================================================
// Aufbau
// ===========================================================================

export function createGame(
  config: RoomConfig,
  questions: readonly LoadedQuestion[],
  at: MonoMs,
  deps: EngineDeps,
): LobbyState {
  if (questions.length === 0) throw new Error('Ein Raum braucht mindestens eine Frage');
  return {
    phase: 'LOBBY',
    locked: false,
    config,
    players: new Map(),
    nameIndex: new Map(),
    questions,
    startedAt: null,
    lastInputAt: at,
    timerGen: 0,
    reward: deps.reward.init(deps.rng),
  };
}

/**
 * Serverseitige Namenspruefung: NFKC, Mehrfach-Leerzeichen zusammen, Trim,
 * 1..16 Zeichen, Unicode-Buchstaben/Ziffern/Leerzeichen und -_. .
 * Gibt null zurueck, wenn der Name nicht zulaessig ist.
 */
export function normalizeName(raw: string): string | null {
  const collapsed = raw.normalize('NFKC').replace(/\s+/gu, ' ').trim();
  if (collapsed.length < 1 || collapsed.length > MAX_NAME_CHARS) return null;
  if (!/^[\p{L}\p{N} _.-]+$/u.test(collapsed)) return null;
  return collapsed;
}

export function nameKey(normalized: string): string {
  return normalized.toLocaleLowerCase('de');
}

// ===========================================================================
// step
// ===========================================================================

export function step(state: GameState, input: EngineInput, deps: EngineDeps): StepResult {
  const settled = settleDeadlines(state, input.at, deps);
  const applied = applyEvent(settled.state, input, deps);
  return {
    state: touch(applied.state, input.at),
    effects: [...settled.effects, ...applied.effects],
  };
}

function touch(state: GameState, at: MonoMs): GameState {
  return { ...state, lastInputAt: at } as GameState;
}

/**
 * Timer sind Hinweise, die Uhr ist die Wahrheit: Jede Eingabe prueft zuerst,
 * ob die aktuelle Phase nach `at` bereits haette enden muessen.
 */
function settleDeadlines(state: GameState, at: MonoMs, deps: EngineDeps): StepResult {
  let current = state;
  const effects: Effect[] = [];

  for (let guard = 0; guard < 4; guard += 1) {
    if (current.phase === 'PREVIEW' && at >= current.answersOpenAt) {
      const r = openAnswers(current, deps);
      current = r.state;
      effects.push(...r.effects);
      continue;
    }
    if (current.phase === 'OPEN') {
      const settleAt = current.settleAt;
      const deadline =
        settleAt !== null && settleAt < current.answersCloseAt ? settleAt : current.answersCloseAt;
      if (at >= deadline) {
        const r = closeAndReveal(current, deadline, deps);
        current = r.state;
        effects.push(...r.effects);
        continue;
      }
    }
    break;
  }

  return { state: current, effects };
}

function applyEvent(state: GameState, input: EngineInput, deps: EngineDeps): StepResult {
  const { event, at } = input;

  switch (event.kind) {
    case 'PlayerJoinRequested':
      return onJoin(state, event, at);
    case 'PlayerDisconnected':
      return onDisconnect(state, event.playerId, at, deps);
    case 'HostStartedGame':
      return onHostStart(state, event.expectedPhase, at, deps);
    case 'HostAdvanced':
      return onHostAdvance(state, event.expectedPhase, at, deps);
    case 'AnswerSubmitted':
      return onAnswer(state, event, at, deps);
    case 'TimerFired':
      // settleDeadlines hat die Arbeit bereits getan; ein Timer, der
      // danach noch ankommt, ist per Definition veraltet.
      return { state, effects: [] };
    default: {
      const never: never = event;
      void never;
      return { state, effects: [] };
    }
  }
}

// ===========================================================================
// Lobby
// ===========================================================================

function rosterEntries(state: GameState): RosterEntry[] {
  return [...state.players.values()].map((p) => ({
    playerId: p.id,
    displayName: p.displayName,
    connected: p.connected,
  }));
}

function rosterMessage(state: GameState): Extract<ServerMessage, { t: 'room:roster' }> {
  const players = rosterEntries(state);
  return {
    t: 'room:roster',
    players,
    count: players.length,
    softWarn: players.length >= PLAYER_SOFT_WARN,
  };
}

function onJoin(
  state: GameState,
  event: Extract<GameEvent, { kind: 'PlayerJoinRequested' }>,
  at: MonoMs,
): StepResult {
  const reject = (reason: 'name_taken' | 'name_invalid' | 'locked' | 'capacity' | 'finished'): StepResult => ({
    state,
    effects: [
      {
        kind: 'send',
        to: { scope: 'player', playerId: event.playerId },
        message: { t: 'player:join_rejected', reason },
      },
    ],
  });

  if (state.phase === 'FINISHED' || state.phase === 'PODIUM') return reject('finished');
  if (state.phase === 'LOBBY' && state.locked) return reject('locked');

  const cap = state.config.playerHardCap;
  if (cap > 0 && state.players.size >= cap) return reject('capacity');

  const normalized = normalizeName(event.displayName);
  if (normalized === null) return reject('name_invalid');
  const key = nameKey(normalized);
  if (state.nameIndex.has(key)) return reject('name_taken');

  const player: PlayerState = {
    id: event.playerId,
    displayName: normalized,
    origin: event.origin,
    resumeToken: event.resumeToken,
    connected: true,
    joinedAt: at,
    score: 0,
    correctCount: 0,
    answeredCount: 0,
  };

  const players = new Map(state.players);
  players.set(player.id, player);
  const nameIndex = new Map(state.nameIndex);
  nameIndex.set(key, player.id);

  const next = { ...state, players, nameIndex } as GameState;

  return {
    state: next,
    effects: [
      {
        kind: 'send',
        to: { scope: 'player', playerId: player.id },
        message: {
          t: 'player:joined',
          playerId: player.id,
          resumeToken: player.resumeToken,
          roomCode: state.config.roomCode,
          displayName: player.displayName,
          phase: next.phase,
          serverTimeMs: at,
        },
      },
      { kind: 'send', to: { scope: 'host' }, message: rosterMessage(next) },
    ],
  };
}

function onDisconnect(
  state: GameState,
  playerId: PlayerId,
  at: MonoMs,
  deps: EngineDeps,
): StepResult {
  const player = state.players.get(playerId);
  if (player === undefined) return { state, effects: [] };

  const players = new Map(state.players);
  const nameIndex = new Map(state.nameIndex);

  if (state.phase === 'LOBBY') {
    // Vor dem Start gibt es nichts zu bewahren: der Name wird wieder frei.
    players.delete(playerId);
    nameIndex.delete(nameKey(player.displayName));
  } else {
    players.set(playerId, { ...player, connected: false });
  }

  let next = { ...state, players, nameIndex } as GameState;
  const effects: Effect[] = [
    { kind: 'send', to: { scope: 'host' }, message: rosterMessage(next) },
  ];

  if (next.phase === 'OPEN') {
    // Die Uhr der Eingabe, nicht lastInputAt: touch() setzt dieses Feld erst
    // am Ende von step, es traegt also noch den Zeitpunkt der VORHERIGEN
    // Eingabe. Die Gnadenfrist waere sonst verbraucht, bevor sie beginnt.
    const settled = maybeSettle(next, at, deps);
    next = settled.state;
    effects.push(...settled.effects);
  }

  return { state: next, effects };
}

// ===========================================================================
// Frage vorbereiten und freigeben
// ===========================================================================

function connectedCount(state: GameState): number {
  let n = 0;
  for (const p of state.players.values()) if (p.connected) n += 1;
  return n;
}

function prepareQuestion(state: GameState, seq: number, at: MonoMs, deps: EngineDeps): StepResult {
  const loaded = state.questions[seq];
  if (loaded === undefined) throw new Error(`Frage ${seq} existiert nicht`);
  const handler = deps.registry.get(loaded.type);

  const { body, mapping } = handler.publicView(
    loaded.spec,
    deps.rng,
    state.config.shuffleOptions,
  );
  const units = handler.maxPointUnits(loaded.spec) as number;
  const maxPoints = maxPointsOf({
    units,
    unitValue: POINT_UNIT_VALUE,
    pointsFactor: loaded.pointsFactor,
  });

  const publicView: PublicQuestionView = {
    seq,
    total: state.questions.length,
    type: loaded.type,
    prompt: loaded.prompt,
    timeLimitMs: loaded.timeLimitMs,
    maxPoints,
    pointsFactor: loaded.pointsFactor,
    options: body.options,
    selectionMode: body.selectionMode,
    maxSelections: body.maxSelections,
  };

  const reading = readingWindowMs(
    loaded.prompt,
    body.options.map((o) => o.label),
  );
  const announceUntil = (at + state.config.announceMs) as MonoMs;
  const answersOpenAt = (announceUntil + reading) as MonoMs;
  const answersCloseAt = (answersOpenAt + loaded.timeLimitMs) as MonoMs;

  const question: LiveQuestion = {
    seq,
    questionId: loaded.id,
    type: loaded.type,
    timeLimitMs: loaded.timeLimitMs,
    pointsFactor: loaded.pointsFactor,
    units,
    maxPoints,
    spec: loaded.spec,
    publicView,
    optionMapping: mapping,
    readingWindowMs: reading,
  };

  const timerGen = state.timerGen + 1;
  const next: PreviewState = {
    phase: 'PREVIEW',
    config: state.config,
    players: state.players,
    nameIndex: state.nameIndex,
    questions: state.questions,
    startedAt: state.startedAt ?? at,
    lastInputAt: at,
    timerGen,
    reward: state.reward,
    question,
    preparedAt: at,
    announceUntil,
    answersOpenAt,
  };

  const tiles = handler.tiles(loaded.spec) as { tileCount: number; layout: 'quad' | 'duo' };

  const token: TimerToken = { kind: 'open', gen: timerGen };

  return {
    state: next,
    effects: [
      {
        kind: 'send',
        to: { scope: 'host' },
        message: {
          t: 'stage:question_prepared',
          question: publicView,
          announceUntil,
          answersOpenAt,
          answersCloseAt,
          readingWindowMs: reading,
        },
      },
      {
        kind: 'send',
        to: { scope: 'players' },
        message: {
          t: 'player:question_prepared',
          tiles: { seq, total: state.questions.length, ...tiles },
          announceUntil,
          answersOpenAt,
          answersCloseAt,
        },
      },
      { kind: 'scheduleTimer', token, atMono: answersOpenAt },
    ],
  };
}

function openAnswers(state: PreviewState, _deps: EngineDeps): StepResult {
  // Der Nullpunkt ist answersOpenAt, nicht der Moment, in dem der Timer feuert.
  const openedAt = state.answersOpenAt;
  const answersCloseAt = (openedAt + state.question.timeLimitMs) as MonoMs;
  const timerGen = state.timerGen + 1;

  const next: OpenState = {
    phase: 'OPEN',
    config: state.config,
    players: state.players,
    nameIndex: state.nameIndex,
    questions: state.questions,
    startedAt: state.startedAt,
    lastInputAt: state.lastInputAt,
    timerGen,
    reward: state.reward,
    question: state.question,
    openedAt,
    answersCloseAt,
    answers: new Map(),
    settleAt: null,
  };

  return {
    state: next,
    effects: [
      {
        kind: 'send',
        to: { scope: 'all' },
        message: { t: 'room:answers_open', seq: state.question.seq, answersCloseAt },
      },
      { kind: 'scheduleTimer', token: { kind: 'close', gen: timerGen }, atMono: answersCloseAt },
    ],
  };
}

function onHostStart(
  state: GameState,
  expectedPhase: Phase,
  at: MonoMs,
  deps: EngineDeps,
): StepResult {
  if (state.phase !== 'LOBBY' || expectedPhase !== 'LOBBY') return { state, effects: [] };
  if (state.players.size === 0) return { state, effects: [] };
  return prepareQuestion(state, 0, at, deps);
}

// ===========================================================================
// Antworten
// ===========================================================================

function rejectAnswer(playerId: PlayerId, seq: number, reason: AnswerRejectReason): Effect {
  return {
    kind: 'send',
    to: { scope: 'player', playerId },
    message: { t: 'player:answer_rejected', seq, reason },
  };
}

function ackAnswer(playerId: PlayerId, record: AnswerRecord, seq: number): Effect {
  return {
    kind: 'send',
    to: { scope: 'player', playerId },
    message: {
      t: 'player:answer_ack',
      seq,
      optionIndex: record.displayIndex,
      late: record.late,
    },
  };
}

function onAnswer(
  state: GameState,
  event: Extract<GameEvent, { kind: 'AnswerSubmitted' }>,
  at: MonoMs,
  deps: EngineDeps,
): StepResult {
  const seq = event.questionSeq;

  if (state.phase === 'PREVIEW') {
    // Eine Wertung mit elapsed = 0 waere die volle Punktzahl und damit ein
    // Freifahrtschein. Deshalb Ablehnung, Eingabe bleibt offen.
    return { state, effects: [rejectAnswer(event.playerId, seq, 'not_open')] };
  }

  if (state.phase === 'OPEN') return onAnswerOpen(state, event, at, deps);
  if (state.phase === 'REVEAL') return onAnswerReveal(state, event, at, deps);

  return { state, effects: [rejectAnswer(event.playerId, seq, 'wrong_phase')] };
}

function gradeAndScore(
  state: GameState,
  question: LiveQuestion,
  event: Extract<GameEvent, { kind: 'AnswerSubmitted' }>,
  at: MonoMs,
  openedAt: MonoMs,
  late: boolean,
  deps: EngineDeps,
):
  | { readonly ok: true; readonly record: AnswerRecord }
  | { readonly ok: false; readonly reason: AnswerRejectReason } {
  const handler = deps.registry.get(question.type);
  const parsed = handler.parseResponse(event.raw, question.spec, question.optionMapping) as
    | { ok: true; value: unknown }
    | { ok: false; reason: AnswerRejectReason };
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const rawElapsedMs = at - openedAt;
  const scoredElapsedMs = compensate(rawElapsedMs, event.rttMinMs);
  const verdict = handler.grade(parsed.value, question.spec) as { correct: boolean };
  const points = scoreAnswer({
    correct: verdict.correct,
    late,
    scoringMode: state.config.scoringMode,
    elapsedMs: scoredElapsedMs,
    timeLimitMs: question.timeLimitMs,
    units: question.units,
    unitValue: POINT_UNIT_VALUE,
    pointsFactor: question.pointsFactor,
  });

  const rawIndex =
    typeof event.raw === 'object' && event.raw !== null
      ? (event.raw as Record<string, unknown>)['index']
      : undefined;

  return {
    ok: true,
    record: {
      playerId: event.playerId,
      displayIndex: typeof rawIndex === 'number' ? rawIndex : -1,
      response: parsed.value,
      receivedAt: at,
      rawElapsedMs,
      scoredElapsedMs,
      correct: verdict.correct,
      late,
      points,
    },
  };
}

function onAnswerOpen(
  state: OpenState,
  event: Extract<GameEvent, { kind: 'AnswerSubmitted' }>,
  at: MonoMs,
  deps: EngineDeps,
): StepResult {
  const q = state.question;
  if (event.questionSeq !== q.seq) {
    return { state, effects: [rejectAnswer(event.playerId, event.questionSeq, 'wrong_question')] };
  }
  if (!state.players.has(event.playerId)) {
    return { state, effects: [rejectAnswer(event.playerId, q.seq, 'unknown_player')] };
  }

  const existing = state.answers.get(event.playerId);
  if (existing !== undefined) {
    // Idempotent: die zweite Antwort liefert das Ergebnis der ersten.
    return { state, effects: [ackAnswer(event.playerId, existing, q.seq)] };
  }

  const graded = gradeAndScore(state, q, event, at, state.openedAt, false, deps);
  if (!graded.ok) {
    return { state, effects: [rejectAnswer(event.playerId, q.seq, graded.reason)] };
  }

  const answers = new Map(state.answers);
  answers.set(event.playerId, graded.record);
  let next: GameState = { ...state, answers };

  const effects: Effect[] = [
    ackAnswer(event.playerId, graded.record, q.seq),
    {
      kind: 'send',
      to: { scope: 'all' },
      message: {
        t: 'room:answer_count',
        seq: q.seq,
        answered: answers.size,
        expected: connectedCount(state),
      },
    },
  ];

  const settled = maybeSettle(next, at, deps);
  next = settled.state;
  effects.push(...settled.effects);

  return { state: next, effects };
}

/** Alle verbundenen Spieler haben geantwortet: kurz abwarten, dann aufloesen. */
function maybeSettle(state: GameState, at: MonoMs, _deps: EngineDeps): StepResult {
  if (state.phase !== 'OPEN') return { state, effects: [] };
  if (state.settleAt !== null) return { state, effects: [] };
  const expected = connectedCount(state);
  if (expected === 0 || state.answers.size < expected) return { state, effects: [] };

  const settleAt = (at + ALL_ANSWERED_SETTLE_MS) as MonoMs;
  if (settleAt >= state.answersCloseAt) return { state, effects: [] };

  const next: OpenState = { ...state, settleAt };
  return {
    state: next,
    effects: [
      { kind: 'scheduleTimer', token: { kind: 'settle', gen: state.timerGen }, atMono: settleAt },
    ],
  };
}

function onAnswerReveal(
  state: RevealState,
  event: Extract<GameEvent, { kind: 'AnswerSubmitted' }>,
  at: MonoMs,
  deps: EngineDeps,
): StepResult {
  const q = state.question;
  const existing = state.answers.get(event.playerId);
  if (existing !== undefined) {
    return { state, effects: [ackAnswer(event.playerId, existing, q.seq)] };
  }
  if (event.questionSeq !== q.seq) {
    return { state, effects: [rejectAnswer(event.playerId, event.questionSeq, 'wrong_question')] };
  }
  if (at > state.lateUntil) {
    return { state, effects: [rejectAnswer(event.playerId, q.seq, 'closed')] };
  }
  const player = state.players.get(event.playerId);
  if (player === undefined) {
    return { state, effects: [rejectAnswer(event.playerId, q.seq, 'unknown_player')] };
  }

  const graded = gradeAndScore(state, q, event, at, state.openedAt, true, deps);
  if (!graded.ok) {
    return { state, effects: [rejectAnswer(event.playerId, q.seq, graded.reason)] };
  }

  const answers = new Map(state.answers);
  answers.set(event.playerId, graded.record);
  const players = new Map(state.players);
  players.set(event.playerId, {
    ...player,
    answeredCount: player.answeredCount + 1,
    correctCount: player.correctCount + (graded.record.correct ? 1 : 0),
  });

  const next: RevealState = { ...state, answers, players };
  const ranking = rank(rankable(next));
  const mine = ranking.find((r) => r.playerId === event.playerId);

  return {
    state: next,
    effects: [
      ackAnswer(event.playerId, graded.record, q.seq),
      {
        kind: 'send',
        to: { scope: 'player', playerId: event.playerId },
        message: {
          t: 'player:question_result',
          seq: q.seq,
          answered: true,
          correct: graded.record.correct,
          late: true,
          points: 0,
          totalScore: players.get(event.playerId)?.score ?? 0,
          rank: mine?.rank ?? 0,
          deltaToAhead: mine?.deltaToAhead ?? 0,
        },
      },
    ],
  };
}

// ===========================================================================
// Aufloesung
// ===========================================================================

function rankable(state: GameState): RankablePlayer[] {
  return [...state.players.values()].map((p) => ({
    id: p.id,
    displayName: p.displayName,
    score: p.score,
  }));
}

function closeAndReveal(state: OpenState, closedAt: MonoMs, deps: EngineDeps): StepResult {
  const q = state.question;
  const handler = deps.registry.get(q.type);

  let agg: unknown = handler.emptyAggregate(q.spec);
  let correctCount = 0;
  for (const a of state.answers.values()) {
    agg = handler.accumulate(agg, a.response, { correct: a.correct });
    if (a.correct) correctCount += 1;
  }

  const players = new Map(state.players);
  for (const a of state.answers.values()) {
    const p = players.get(a.playerId);
    if (p === undefined) continue;
    players.set(a.playerId, {
      ...p,
      score: p.score + a.points,
      correctCount: p.correctCount + (a.correct ? 1 : 0),
      answeredCount: p.answeredCount + 1,
    });
  }

  const next: RevealState = {
    phase: 'REVEAL',
    config: state.config,
    players,
    nameIndex: state.nameIndex,
    questions: state.questions,
    startedAt: state.startedAt,
    lastInputAt: state.lastInputAt,
    timerGen: state.timerGen + 1,
    reward: state.reward,
    question: q,
    openedAt: state.openedAt,
    closedAt,
    lateUntil: (closedAt + state.config.lateGraceMs) as MonoMs,
    answers: state.answers,
    aggregate: agg,
  };

  const ranking = rank(rankable(next));
  const rankOf = new Map(ranking.map((r) => [r.playerId, r]));
  const reveal = handler.revealView(q.spec, agg, q.optionMapping, q.seq);

  const effects: Effect[] = [
    { kind: 'cancelTimer', token: { kind: 'close', gen: state.timerGen } },
    { kind: 'cancelTimer', token: { kind: 'settle', gen: state.timerGen } },
    {
      kind: 'send',
      to: { scope: 'host' },
      message: {
        t: 'stage:reveal',
        question: q.publicView,
        reveal,
        answerCount: state.answers.size,
        correctCount,
        playerCount: players.size,
      },
    },
  ];

  for (const p of players.values()) {
    const a = state.answers.get(p.id);
    const r = rankOf.get(p.id);
    effects.push({
      kind: 'send',
      to: { scope: 'player', playerId: p.id },
      message: {
        t: 'player:question_result',
        seq: q.seq,
        answered: a !== undefined,
        correct: a?.correct ?? false,
        late: a?.late ?? false,
        points: a?.points ?? 0,
        totalScore: p.score,
        rank: r?.rank ?? 0,
        deltaToAhead: r?.deltaToAhead ?? 0,
      },
    });
  }

  return { state: next, effects };
}

// ===========================================================================
// Host schaltet weiter
// ===========================================================================

function onHostAdvance(
  state: GameState,
  expectedPhase: Phase,
  at: MonoMs,
  deps: EngineDeps,
): StepResult {
  // Doppelklick, zweiter Host-Tab, Wiederholung nach Wiederverbindung:
  // eine Regel loest alle drei.
  if (state.phase !== expectedPhase) return { state, effects: [] };

  if (state.phase === 'REVEAL') return revealToScoreboard(state, deps);
  if (state.phase === 'SCOREBOARD') {
    const nextSeq = state.afterSeq + 1;
    if (nextSeq < state.questions.length) return prepareQuestion(state, nextSeq, at, deps);
    return toPodium(state, 'completed', deps);
  }
  if (state.phase === 'PODIUM') {
    const next = {
      phase: 'FINISHED',
      config: state.config,
      players: state.players,
      nameIndex: state.nameIndex,
      questions: state.questions,
      startedAt: state.startedAt,
      lastInputAt: state.lastInputAt,
      timerGen: state.timerGen + 1,
      reward: state.reward,
      endReason: state.endReason,
    } satisfies GameState;
    return {
      state: next,
      effects: [
        { kind: 'persistFinal', reason: state.endReason },
        { kind: 'send', to: { scope: 'all' }, message: { t: 'room:finished' } },
        { kind: 'closeRoom', reason: state.endReason },
      ],
    };
  }
  return { state, effects: [] };
}

function revealToScoreboard(state: RevealState, deps: EngineDeps): StepResult {
  const ranking = rank(rankable(state));
  const rankOf = new Map(ranking.map((r) => [r.playerId, r]));

  const outcome: RoundOutcome = {
    seq: state.question.seq,
    perPlayer: [...state.players.values()].map((p) => {
      const a = state.answers.get(p.id);
      const r = rankOf.get(p.id);
      return {
        playerId: p.id,
        correct: a?.correct ?? false,
        late: a?.late ?? false,
        points: a?.points ?? 0,
        totalScore: p.score,
        rank: r?.rank ?? 0,
      };
    }),
  };
  const rewarded = deps.reward.onRound(state.reward, outcome, deps.rng);

  const next: ScoreboardState = {
    phase: 'SCOREBOARD',
    config: state.config,
    players: state.players,
    nameIndex: state.nameIndex,
    questions: state.questions,
    startedAt: state.startedAt,
    lastInputAt: state.lastInputAt,
    timerGen: state.timerGen + 1,
    reward: rewarded.state,
    afterSeq: state.question.seq,
    ranking,
  };

  const effects: Effect[] = [
    { kind: 'persistRound', seq: state.question.seq },
    {
      kind: 'send',
      to: { scope: 'host' },
      message: {
        t: 'stage:scoreboard',
        afterSeq: next.afterSeq,
        top: ranking.slice(0, SCOREBOARD_TOP_N),
        othersCount: Math.max(0, ranking.length - SCOREBOARD_TOP_N),
        hasNextQuestion: next.afterSeq + 1 < state.questions.length,
        reward: rewarded.view,
      },
    },
  ];

  for (const r of ranking) {
    effects.push({
      kind: 'send',
      to: { scope: 'player', playerId: r.playerId },
      message: {
        t: 'player:scoreboard',
        rank: r.rank,
        score: r.score,
        deltaToAhead: r.deltaToAhead,
        playerCount: ranking.length,
      },
    });
  }

  return { state: next, effects };
}

function toPodium(state: ScoreboardState, endReason: EndReason, deps: EngineDeps): StepResult {
  const ranking = rank(rankable(state));
  const overridden = deps.reward.finalRanking(state.reward, ranking, deps.rng);
  const displayRanking: readonly RankedPlayer[] = overridden ?? ranking;

  const next: GameState = {
    phase: 'PODIUM',
    config: state.config,
    players: state.players,
    nameIndex: state.nameIndex,
    questions: state.questions,
    startedAt: state.startedAt,
    lastInputAt: state.lastInputAt,
    timerGen: state.timerGen + 1,
    reward: state.reward,
    ranking,
    displayRanking,
    endReason,
  };

  const effects: Effect[] = [
    {
      kind: 'send',
      to: { scope: 'host' },
      message: { t: 'stage:podium', ranking: displayRanking },
    },
  ];
  for (const r of displayRanking) {
    effects.push({
      kind: 'send',
      to: { scope: 'player', playerId: r.playerId },
      message: {
        t: 'player:podium',
        rank: r.rank,
        score: r.score,
        playerCount: displayRanking.length,
      },
    });
  }
  return { state: next, effects };
}
