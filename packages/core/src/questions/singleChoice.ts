import type { PlayerTileSpec, PublicQuestionBody, RevealView } from '@quizbude/protocol';
import { identityIndices, shuffledIndices, type Rng } from '../rng.js';
import { MAX_OPTION_CHARS } from '../engine/constants.js';
import type { ParseResult, QuestionTypeHandler, Verdict } from './handler.js';

export interface SingleChoiceSpec {
  readonly options: readonly { readonly label: string }[];
  readonly correctIndex: number;
  readonly explanation: string | null;
}

export interface SingleChoiceResponse {
  /** Kanonischer Index, bereits zurueckgerechnet. */
  readonly index: number;
}

export interface SingleChoiceAgg {
  /** Treffer je kanonischem Index. */
  readonly counts: readonly number[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export const singleChoiceHandler: QuestionTypeHandler<
  SingleChoiceSpec,
  SingleChoiceResponse,
  SingleChoiceAgg
> = {
  type: 'single_choice',

  parseSpec(raw: unknown): SingleChoiceSpec {
    if (!isRecord(raw)) throw new Error('single_choice: Spezifikation ist kein Objekt');
    const options = raw['options'];
    if (!Array.isArray(options) || options.length < 2 || options.length > 4) {
      throw new Error('single_choice: 2 bis 4 Antworten erwartet');
    }
    const parsed = options.map((o: unknown, i: number) => {
      if (!isRecord(o) || typeof o['label'] !== 'string') {
        throw new Error(`single_choice: Antwort ${i} hat kein Label`);
      }
      const label = o['label'].trim();
      if (label.length < 1 || label.length > MAX_OPTION_CHARS) {
        throw new Error(`single_choice: Antwort ${i} muss 1..${MAX_OPTION_CHARS} Zeichen haben`);
      }
      return { label };
    });
    const correctIndex = raw['correctIndex'];
    if (
      typeof correctIndex !== 'number' ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex >= parsed.length
    ) {
      throw new Error('single_choice: correctIndex liegt ausserhalb der Antworten');
    }
    const explanation = typeof raw['explanation'] === 'string' ? raw['explanation'] : null;
    return { options: parsed, correctIndex, explanation };
  },

  publicView(
    spec: SingleChoiceSpec,
    rng: Rng,
    shuffle: boolean,
  ): { body: PublicQuestionBody; mapping: readonly number[] } {
    const mapping = shuffle
      ? shuffledIndices(spec.options.length, rng)
      : identityIndices(spec.options.length);
    const body: PublicQuestionBody = {
      options: mapping.map((canonical, display) => ({
        index: display,
        label: (spec.options[canonical] as { label: string }).label,
      })),
      selectionMode: 'single',
      maxSelections: 1,
    };
    return { body, mapping };
  },

  tiles(spec: SingleChoiceSpec): Pick<PlayerTileSpec, 'tileCount' | 'layout'> {
    return { tileCount: spec.options.length, layout: spec.options.length <= 2 ? 'duo' : 'quad' };
  },

  parseResponse(
    raw: unknown,
    _spec: SingleChoiceSpec,
    mapping: readonly number[],
  ): ParseResult<SingleChoiceResponse> {
    if (!isRecord(raw)) return { ok: false, reason: 'malformed' };
    const display = raw['index'];
    if (typeof display !== 'number' || !Number.isInteger(display)) {
      return { ok: false, reason: 'malformed' };
    }
    if (display < 0 || display >= mapping.length) return { ok: false, reason: 'out_of_range' };
    return { ok: true, value: { index: mapping[display] as number } };
  },

  grade(response: SingleChoiceResponse, spec: SingleChoiceSpec): Verdict {
    return { correct: response.index === spec.correctIndex };
  },

  maxPointUnits(): number {
    return 1;
  },

  emptyAggregate(spec: SingleChoiceSpec): SingleChoiceAgg {
    return { counts: spec.options.map(() => 0) };
  },

  accumulate(agg: SingleChoiceAgg, response: SingleChoiceResponse): SingleChoiceAgg {
    const counts = agg.counts.slice();
    counts[response.index] = (counts[response.index] ?? 0) + 1;
    return { counts };
  },

  revealView(
    spec: SingleChoiceSpec,
    agg: SingleChoiceAgg,
    mapping: readonly number[],
    seq: number,
  ): RevealView {
    const correctIndices: number[] = [];
    const distribution = mapping.map((canonical, display) => {
      if (canonical === spec.correctIndex) correctIndices.push(display);
      return { index: display, count: agg.counts[canonical] ?? 0 };
    });
    return { seq, correctIndices, distribution, explanation: spec.explanation };
  },
};
