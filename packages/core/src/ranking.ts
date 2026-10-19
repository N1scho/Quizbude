import type { PlayerId, RankedPlayer } from '@quizbude/protocol';

export interface RankablePlayer {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly score: number;
}

/**
 * Punkte zu Rangliste. Gleiche Punkte ergeben gleichen Rang; bei Gleichstand
 * wird alphabetisch sortiert (UX-Konzept B6). deltaToAhead ist der Abstand
 * zum naechsthoeheren Punktestand, 0 auf Rang 1.
 */
export function rank(players: readonly RankablePlayer[]): RankedPlayer[] {
  const sorted = players.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.displayName.localeCompare(b.displayName, 'de');
  });

  const out: RankedPlayer[] = [];
  let currentRank = 0;
  let previousScore: number | null = null;

  for (let i = 0; i < sorted.length; i += 1) {
    const p = sorted[i] as RankablePlayer;
    if (previousScore === null || p.score !== previousScore) {
      currentRank = i + 1;
      previousScore = p.score;
    }
    const deltaToAhead = currentRank === 1 ? 0 : (out[currentRank - 2] as RankedPlayer).score - p.score;
    out.push({
      playerId: p.id,
      displayName: p.displayName,
      score: p.score,
      rank: currentRank,
      deltaToAhead,
    });
  }
  return out;
}
