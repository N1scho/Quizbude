import type { PlayerTileSpec, PublicQuestionBody, RevealView } from '@quizbude/protocol';
import type { ParseResult, QuestionTypeHandler, Verdict } from './handler.js';

/**
 * Eigener Handler statt Single-Choice mit zwei festen Optionen: die
 * Beschriftungen sind nicht editierbar, Mischen ist sinnlos, und die
 * Oberflaeche stellt ihn anders dar (zwei Breitkacheln).
 */

export const TRUE_LABEL = 'Wahr';
export const FALSE_LABEL = 'Falsch';

export interface TrueFalseSpec {
  readonly correct: boolean;
  readonly explanation: string | null;
}

export interface TrueFalseResponse {
  readonly value: boolean;
}

export interface TrueFalseAgg {
  readonly trueCount: number;
  readonly falseCount: number;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Anzeigeposition 0 ist Wahr, 1 ist Falsch. Nie gemischt. */
const MAPPING: readonly number[] = [0, 1];

export const trueFalseHandler: QuestionTypeHandler<
  TrueFalseSpec,
  TrueFalseResponse,
  TrueFalseAgg
> = {
  type: 'true_false',

  parseSpec(raw: unknown): TrueFalseSpec {
    if (!isRecord(raw)) throw new Error('true_false: Spezifikation ist kein Objekt');
    if (typeof raw['correct'] !== 'boolean') {
      throw new Error('true_false: correct muss ein Wahrheitswert sein');
    }
    const explanation = typeof raw['explanation'] === 'string' ? raw['explanation'] : null;
    return { correct: raw['correct'], explanation };
  },

  publicView(): { body: PublicQuestionBody; mapping: readonly number[] } {
    const body: PublicQuestionBody = {
      options: [
        { index: 0, label: TRUE_LABEL },
        { index: 1, label: FALSE_LABEL },
      ],
      selectionMode: 'single',
      maxSelections: 1,
    };
    return { body, mapping: MAPPING };
  },

  tiles(): Pick<PlayerTileSpec, 'tileCount' | 'layout'> {
    return { tileCount: 2, layout: 'duo' };
  },

  parseResponse(raw: unknown): ParseResult<TrueFalseResponse> {
    if (!isRecord(raw)) return { ok: false, reason: 'malformed' };
    const display = raw['index'];
    if (typeof display !== 'number' || !Number.isInteger(display)) {
      return { ok: false, reason: 'malformed' };
    }
    if (display !== 0 && display !== 1) return { ok: false, reason: 'out_of_range' };
    return { ok: true, value: { value: display === 0 } };
  },

  grade(response: TrueFalseResponse, spec: TrueFalseSpec): Verdict {
    return { correct: response.value === spec.correct };
  },

  maxPointUnits(): number {
    return 1;
  },

  emptyAggregate(): TrueFalseAgg {
    return { trueCount: 0, falseCount: 0 };
  },

  accumulate(agg: TrueFalseAgg, response: TrueFalseResponse): TrueFalseAgg {
    return response.value
      ? { trueCount: agg.trueCount + 1, falseCount: agg.falseCount }
      : { trueCount: agg.trueCount, falseCount: agg.falseCount + 1 };
  },

  revealView(spec: TrueFalseSpec, agg: TrueFalseAgg, _mapping, seq: number): RevealView {
    return {
      seq,
      correctIndices: [spec.correct ? 0 : 1],
      distribution: [
        { index: 0, count: agg.trueCount },
        { index: 1, count: agg.falseCount },
      ],
      explanation: spec.explanation,
    };
  },
};
