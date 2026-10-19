import {
  classicRewardLayer,
  createDefaultRegistry,
  createGame,
  createRng,
  singleChoiceHandler,
  trueFalseHandler,
  type EngineDeps,
  type Effect,
  type GameState,
  type LoadedQuestion,
  type RoomConfig,
  type StepResult,
} from '@quizbude/core';
import {
  asMonoMs,
  asPlayerId,
  asRoomCode,
  type MonoMs,
  type PlayerId,
  type ServerMessage,
} from '@quizbude/protocol';

export const DEMO_QUESTIONS: readonly LoadedQuestion[] = [
  {
    id: 'q1',
    type: 'single_choice',
    prompt: 'Welcher Planet ist der Sonne am naechsten?',
    timeLimitMs: 30_000,
    pointsFactor: 1,
    spec: singleChoiceHandler.parseSpec({
      options: [
        { label: 'Merkur' },
        { label: 'Venus' },
        { label: 'Mars' },
        { label: 'Jupiter' },
      ],
      correctIndex: 0,
      explanation: 'Merkur umkreist die Sonne in rund 58 Millionen Kilometern Abstand.',
    }),
  },
  {
    id: 'q2',
    type: 'true_false',
    prompt: 'Ein Oktopus hat drei Herzen.',
    timeLimitMs: 20_000,
    pointsFactor: 1,
    spec: trueFalseHandler.parseSpec({
      correct: true,
      explanation: 'Zwei Kiemenherzen und ein Koerperherz.',
    }),
  },
];

export function makeDeps(seed = 1): EngineDeps {
  return {
    registry: createDefaultRegistry(),
    rng: createRng(seed),
    reward: classicRewardLayer,
  };
}

export function makeConfig(overrides: Partial<RoomConfig> = {}): RoomConfig {
  return {
    roomCode: asRoomCode('ABC234'),
    hostToken: 'host-token',
    quizTitle: 'Demo',
    scoringMode: 'timed',
    // Im Test aus: so ist Anzeigeindex gleich kanonischem Index und die
    // Erwartungen bleiben lesbar. Das Mischen hat einen eigenen Test.
    shuffleOptions: false,
    rewardLayerId: 'classic',
    playerHardCap: 0,
    announceMs: 3_000,
    lateGraceMs: 1_500,
    ...overrides,
  };
}

export function newLobby(
  deps: EngineDeps,
  questions: readonly LoadedQuestion[] = DEMO_QUESTIONS,
  config: RoomConfig = makeConfig(),
): GameState {
  return createGame(config, questions, asMonoMs(0), deps);
}

export const pid = (s: string): PlayerId => asPlayerId(s);
export const t = (ms: number): MonoMs => asMonoMs(ms);

export function sent(result: StepResult): ServerMessage[] {
  return result.effects
    .filter((e: Effect): e is Extract<Effect, { kind: 'send' }> => e.kind === 'send')
    .map((e) => e.message);
}

export function sentTo(result: StepResult, playerId: PlayerId): ServerMessage[] {
  return result.effects
    .filter((e: Effect): e is Extract<Effect, { kind: 'send' }> => e.kind === 'send')
    .filter((e) => e.to.scope === 'player' && e.to.playerId === playerId)
    .map((e) => e.message);
}

export function firstOfType<K extends ServerMessage['t']>(
  messages: readonly ServerMessage[],
  type: K,
): Extract<ServerMessage, { t: K }> | undefined {
  return messages.find((m) => m.t === type) as Extract<ServerMessage, { t: K }> | undefined;
}

export function lastOfType<K extends ServerMessage['t']>(
  messages: readonly ServerMessage[],
  type: K,
): Extract<ServerMessage, { t: K }> | undefined {
  const hits = messages.filter((m) => m.t === type);
  return hits[hits.length - 1] as Extract<ServerMessage, { t: K }> | undefined;
}
