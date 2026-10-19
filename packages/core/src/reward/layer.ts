import type { PlayerId, RankedPlayer, RewardView } from '@quizbude/protocol';
import type { Rng } from '../rng.js';

export interface RoundOutcome {
  readonly seq: number;
  readonly perPlayer: readonly {
    readonly playerId: PlayerId;
    readonly correct: boolean;
    readonly late: boolean;
    /** Kanonisch, bereits vergeben. Eine Schicht kann Punkte NICHT veraendern. */
    readonly points: number;
    readonly totalScore: number;
    readonly rank: number;
  }[];
}

export interface RewardLayer<TState = unknown> {
  readonly id: string;

  init(rng: Rng): TState;

  onRound(
    state: TState,
    outcome: RoundOutcome,
    rng: Rng,
  ): { readonly state: TState; readonly view: RewardView };

  /** Darf nur die ANGEZEIGTE Endreihenfolge ersetzen; null heisst Punkterang. */
  finalRanking(
    state: TState,
    ranking: readonly RankedPlayer[],
    rng: Rng,
  ): readonly RankedPlayer[] | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyRewardLayer = RewardLayer<any>;
