import type { PlayerTileSpec, PublicQuestionBody, RevealView } from '@quizbude/protocol';
import type { Rng } from '../rng.js';

export interface Verdict {
  readonly correct: boolean;
  /**
   * Platzhalter fuer einen spaeteren Praezisionstyp (Schieberegler).
   * Heute immer undefined; Ruling 3 sagt Richtig/Falsch. Das Feld steht hier,
   * damit scoring/ spaeter einen zweiten, benannten Modus bekommen kann,
   * ohne dass das Interface bricht.
   */
  readonly accuracy?: number;
}

export type ResponseError = 'malformed' | 'out_of_range' | 'empty' | 'too_many_selections';

export type ParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: ResponseError };

/**
 * Ein Fragetyp ist ein Handler, kein Datensatz. Er kapselt alles
 * Typabhaengige und nichts, was es nicht ist.
 */
export interface QuestionTypeHandler<TSpec, TResponse, TAgg> {
  readonly type: string;

  /** Autorenzeit: rohes spec-JSON pruefen und normalisieren. Wirft bei Unsinn. */
  parseSpec(raw: unknown): TSpec;

  /**
   * Spielzeit, beim Uebergang in PREVIEW. Liefert den typspezifischen Teil
   * der oeffentlichen Sicht plus die Abbildung Anzeigeindex -> kanonischer Index.
   * Die Kopffelder (Fragetext, Zeitlimit, Punkte) setzt die Engine; der Handler
   * bekommt sie nie zu sehen und kann die Loesung daher nicht einschmuggeln.
   */
  publicView(
    spec: TSpec,
    rng: Rng,
    shuffle: boolean,
  ): { readonly body: PublicQuestionBody; readonly mapping: readonly number[] };

  /** Wie das Spielergeraet die Frage sieht: Kachelzahl und Anordnung, sonst nichts. */
  tiles(spec: TSpec): Pick<PlayerTileSpec, 'tileCount' | 'layout'>;

  /** Spielzeit, bei Antworteingang. Rueckkanonisierung ueber mapping. Wirft nie. */
  parseResponse(
    raw: unknown,
    spec: TSpec,
    mapping: readonly number[],
  ): ParseResult<TResponse>;

  /** Die einzige Stelle, an der "richtig" definiert wird. Kennt weder Zeit noch Punkte. */
  grade(response: TResponse, spec: TSpec): Verdict;

  /** Punkteinheiten dieser Frage. 1 fuer Single-Choice und Wahr/Falsch. */
  maxPointUnits(spec: TSpec): number;

  emptyAggregate(spec: TSpec): TAgg;
  accumulate(agg: TAgg, response: TResponse, verdict: Verdict): TAgg;

  /** Hier - und nur hier - darf die Loesung den Server verlassen. */
  revealView(
    spec: TSpec,
    agg: TAgg,
    mapping: readonly number[],
    seq: number,
  ): RevealView;
}

/**
 * Die Registry haelt Handler unterschiedlicher Typparameter nebeneinander.
 * Das geht in TypeScript nur ueber eine bewusst weite Signatur; die Engine
 * behandelt Spezifikation und Antwort deshalb als undurchsichtige Werte und
 * reicht sie ausschliesslich durch denselben Handler.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type AnyQuestionTypeHandler = QuestionTypeHandler<any, any, any>;
