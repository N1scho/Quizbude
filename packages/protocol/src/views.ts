import type { PlayerId } from './ids.js';

/**
 * Oeffentliche Fragesicht fuer die BUEHNE.
 *
 * Es gibt in diesem Typ kein Feld, in dem Korrektheit stehen koennte.
 * Dass die Loesung vor REVEAL nicht hinausgeht, ist damit ein Typfehler
 * und keine Disziplinfrage (Architekturkonzept 4.2).
 */
export interface PublicQuestionView {
  readonly seq: number;
  readonly total: number;
  readonly type: string;
  readonly prompt: string;
  readonly timeLimitMs: number;
  readonly maxPoints: number;
  readonly pointsFactor: number;
  /** Nur Beschriftungen in Anzeigereihenfolge. */
  readonly options: readonly PublicOption[];
  readonly selectionMode: 'single' | 'multiple';
  readonly maxSelections: number | null;
}

export interface PublicOption {
  readonly index: number;
  readonly label: string;
}

/** Der typspezifische Teil, den ein Fragetyp-Handler beisteuert. */
export interface PublicQuestionBody {
  readonly options: readonly PublicOption[];
  readonly selectionMode: 'single' | 'multiple';
  readonly maxSelections: number | null;
}

/**
 * Was das SPIELERGERAET ueber eine Frage erfaehrt: wie viele Kacheln,
 * in welcher Anordnung. Kein Fragetext, keine Antworttexte.
 * Das eine Gesetz aus dem UX-Konzept, als Typ.
 */
export interface PlayerTileSpec {
  readonly seq: number;
  readonly total: number;
  readonly tileCount: number;
  readonly layout: 'quad' | 'duo';
}

/** Erst hier darf die Loesung den Server verlassen. */
export interface RevealView {
  readonly seq: number;
  /** In ANZEIGEreihenfolge. */
  readonly correctIndices: readonly number[];
  readonly distribution: readonly { readonly index: number; readonly count: number }[];
  readonly explanation: string | null;
}

export interface RankedPlayer {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly score: number;
  /** 1-basiert; gleiche Punkte ergeben gleichen Rang. */
  readonly rank: number;
  /** Abstand zum naechsthoeheren Punktestand; 0 auf Rang 1. */
  readonly deltaToAhead: number;
}

export interface RosterEntry {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly connected: boolean;
}

export interface RewardView {
  readonly kind: string;
}
