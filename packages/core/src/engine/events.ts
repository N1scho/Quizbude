import type { MonoMs, Phase, PlayerId, PlayerOrigin } from '@quizbude/protocol';

/** Der Token traegt die Generation; ein veralteter Timer wird verworfen. */
export type TimerKind = 'open' | 'close' | 'settle';

export interface TimerToken {
  readonly kind: TimerKind;
  readonly gen: number;
}

export type GameEvent =
  | {
      readonly kind: 'PlayerJoinRequested';
      readonly playerId: PlayerId;
      readonly displayName: string;
      readonly origin: PlayerOrigin;
      readonly resumeToken: string;
    }
  | { readonly kind: 'PlayerDisconnected'; readonly playerId: PlayerId }
  | { readonly kind: 'HostStartedGame'; readonly expectedPhase: Phase }
  | { readonly kind: 'HostAdvanced'; readonly expectedPhase: Phase }
  | {
      readonly kind: 'AnswerSubmitted';
      readonly playerId: PlayerId;
      readonly questionSeq: number;
      /** Rohwert vom Geraet. Enthaelt nie eine Zeit und nie eine Punktzahl. */
      readonly raw: unknown;
      /** Minimum der serverseitig gemessenen Umlaufzeiten, oder null. */
      readonly rttMinMs: number | null;
    }
  | { readonly kind: 'TimerFired'; readonly token: TimerToken };

/** Die Uhr kommt als Feldwert jeder Eingabe herein, nicht als Interface. */
export interface EngineInput {
  readonly event: GameEvent;
  readonly at: MonoMs;
}
