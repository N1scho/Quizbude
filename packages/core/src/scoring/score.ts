import {
  COMPENSATION_CAP_MS,
  FULL_POINTS_THRESHOLD_MS,
  POINT_UNIT_VALUE,
} from './constants.js';

export interface ScoringInput {
  readonly correct: boolean;
  readonly late: boolean;
  readonly scoringMode: 'timed' | 'flat';
  /** Nach compensate(), vor dem Clamping. */
  readonly elapsedMs: number;
  readonly timeLimitMs: number;
  /** handler.maxPointUnits(spec) */
  readonly units: number;
  readonly unitValue: number;
  readonly pointsFactor: number;
}

export function maxPointsOf(i: {
  readonly units: number;
  readonly unitValue: number;
  readonly pointsFactor: number;
}): number {
  return Math.round(i.unitValue * i.units * i.pointsFactor);
}

export function defaultUnitValue(): number {
  return POINT_UNIT_VALUE;
}

/**
 * Ausgleich der Rueckrichtung (Architekturkonzept 5.3).
 * Basis ist das MINIMUM der beobachteten Umlaufzeiten: beste Schaetzung der
 * echten Pfadlaufzeit und zugleich die am wenigsten manipulierbare Statistik.
 */
export function compensate(rawElapsedMs: number, rttMinMs: number | null): number {
  const halfRtt = rttMinMs !== null ? rttMinMs / 2 : 0;
  return Math.max(0, rawElapsedMs - Math.min(halfRtt, COMPENSATION_CAP_MS));
}

/** Die Punkteformel aus Abschnitt 5.4, Zweig fuer Zweig. */
export function scoreAnswer(i: ScoringInput): number {
  // (1) Falsch ergibt null. Kein Trostpunkt, keine Teilpunkte.
  if (!i.correct) return 0;

  // (2) Verspaetet ergibt null, obwohl richtig.
  if (i.late) return 0;

  const max = maxPointsOf(i);

  // (3) "Punkte aus" (pointsFactor = 0).
  if (max === 0) return 0;

  // (4) Zeit zaehlt nicht ergibt vollen Wert.
  if (i.scoringMode === 'flat') return max;

  // (5) Degenerierter Timer ergibt vollen Wert statt Division durch null.
  if (i.timeLimitMs <= 0) return max;

  // (6) Toleranzschwelle gegen Jitter.
  if (i.elapsedMs < FULL_POINTS_THRESHOLD_MS) return max;

  // (7) Clamping auf die Fensterraender.
  const t = Math.min(Math.max(i.elapsedMs, 0), i.timeLimitMs);

  // (8) Die Formel. factor liegt per Konstruktion in [0.5, 1.0].
  const factor = 1 - t / i.timeLimitMs / 2;

  // (9) Kaufmaennische Rundung; factor * max ist stets positiv.
  return Math.round(factor * max);
}
