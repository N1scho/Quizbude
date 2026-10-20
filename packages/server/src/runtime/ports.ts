/**
 * Was tun, wenn der Port schon belegt ist?
 *
 * An einem Spieleabend darf der Start nicht daran scheitern, dass irgendein
 * anderes Programm die 3000 haelt. Ist kein Port vorgegeben, sucht der
 * Server den naechsten freien und sagt, welchen er genommen hat.
 *
 * Die Zusicherung aus `2e006c6` bleibt davon unberuehrt: ein Start, der
 * nicht gelingt, endet mit Exit-Code 1. Ausgewichen wird deshalb nur, wenn
 * alle drei Bedingungen stimmen - der Fehler ist ein belegter Port, der
 * Port war nicht ausdruecklich gesetzt, und es ist noch einer uebrig.
 * Sonst bricht der Server ab wie bisher.
 */

export const DEFAULT_PORT = 3000;
export const LAST_FALLBACK_PORT = 3010;

/** Die Ports, die der Reihe nach probiert werden. */
export function portSequence(first: number = DEFAULT_PORT, last: number = LAST_FALLBACK_PORT): readonly number[] {
  if (!Number.isInteger(first) || first < 1 || first > 65535) return [DEFAULT_PORT];
  if (!Number.isInteger(last) || last < first) return [first];
  const out: number[] = [];
  for (let p = first; p <= Math.min(last, 65535); p += 1) out.push(p);
  return out;
}

export type ListenDecision =
  | { readonly kind: 'retry'; readonly port: number }
  | { readonly kind: 'giveUp'; readonly reason: string };

export interface ListenErrorFacts {
  /** Der `code` des Fehlers aus `listen` - z. B. 'EADDRINUSE'. */
  readonly code: string | undefined;
  /** Der Port, auf dem es gerade gescheitert ist. */
  readonly current: number;
  /** Hat ein Mensch PORT gesetzt? Dann wird nicht ausgewichen. */
  readonly portWasChosenByUser: boolean;
  /** Die Reihe, aus der der naechste Port kommt. */
  readonly sequence: readonly number[];
}

/**
 * Ausweichen oder abbrechen. Rein - sie fasst weder Netz noch Prozess an.
 */
export function decideAfterListenError(facts: ListenErrorFacts): ListenDecision {
  if (facts.code !== 'EADDRINUSE') {
    return { kind: 'giveUp', reason: 'Das ist kein belegter Port, sondern ein anderer Fehler.' };
  }
  if (facts.portWasChosenByUser) {
    return {
      kind: 'giveUp',
      reason: `Port ${facts.current} ist belegt. PORT ist ausdruecklich gesetzt - dann weiche ich nicht aus.`,
    };
  }
  const index = facts.sequence.indexOf(facts.current);
  const next = index < 0 ? undefined : facts.sequence[index + 1];
  if (next === undefined) {
    const first = facts.sequence[0];
    const last = facts.sequence[facts.sequence.length - 1];
    const range = first === undefined || last === undefined ? `${facts.current}` : `${first} bis ${last}`;
    return { kind: 'giveUp', reason: `Alle Ports von ${range} sind belegt.` };
  }
  return { kind: 'retry', port: next };
}
