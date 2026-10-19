import { describe, expect, it } from 'vitest';
import {
  COMPENSATION_CAP_MS,
  FULL_POINTS_THRESHOLD_MS,
  POINT_UNIT_VALUE,
  compensate,
  maxPointsOf,
  scoreAnswer,
  type ScoringInput,
} from '@quizbude/core';

/** Die Tabelle aus Architekturkonzept 5.4, Zeile fuer Zeile nachgerechnet. */

const base: ScoringInput = {
  correct: true,
  late: false,
  scoringMode: 'timed',
  elapsedMs: 0,
  timeLimitMs: 30_000,
  units: 1,
  unitValue: POINT_UNIT_VALUE,
  pointsFactor: 1,
};

const at = (overrides: Partial<ScoringInput>): number => scoreAnswer({ ...base, ...overrides });

describe('Punkteformel', () => {
  it('Maximum ist unitValue * units * pointsFactor', () => {
    expect(maxPointsOf({ units: 1, unitValue: 1000, pointsFactor: 1 })).toBe(1000);
    expect(maxPointsOf({ units: 1, unitValue: 1000, pointsFactor: 2 })).toBe(2000);
    expect(maxPointsOf({ units: 1, unitValue: 1000, pointsFactor: 0 })).toBe(0);
  });

  it('unter 0,5 s gibt volle Punkte', () => {
    expect(at({ elapsedMs: 0 })).toBe(1000);
    expect(at({ elapsedMs: 1 })).toBe(1000);
    expect(at({ elapsedMs: FULL_POINTS_THRESHOLD_MS - 1 })).toBe(1000);
  });

  it('exakt bei der Schwelle greift die Formel, nicht mehr die Toleranz', () => {
    // factor = 1 - (500/30000)/2 = 0,9916666... -> 992
    expect(at({ elapsedMs: 500 })).toBe(992);
  });

  it('Referenzwerte aus der Tabelle', () => {
    expect(at({ elapsedMs: 2_000 })).toBe(967);
    expect(at({ elapsedMs: 15_000 })).toBe(750);
    expect(at({ elapsedMs: 29_999 })).toBe(500);
  });

  it('Antwort exakt bei Ablauf gibt die Haelfte (50-Prozent-Deckelung)', () => {
    expect(at({ elapsedMs: 30_000 })).toBe(500);
    // Jenseits des Fensters wird auf den Fensterrand geklemmt, nie darunter.
    expect(at({ elapsedMs: 31_200 })).toBe(500);
    expect(at({ elapsedMs: 1_000_000 })).toBe(500);
  });

  it('der Deckel gilt auch bei kurzen Fenstern', () => {
    expect(at({ timeLimitMs: 5_000, elapsedMs: 5_000 })).toBe(500);
    expect(at({ timeLimitMs: 5_000, elapsedMs: 2_500 })).toBe(750);
  });

  it('falsche Antwort gibt 0, egal wie schnell', () => {
    expect(at({ correct: false, elapsedMs: 0 })).toBe(0);
    expect(at({ correct: false, elapsedMs: 29_000 })).toBe(0);
  });

  it('verspaetete Antwort gibt 0, obwohl richtig', () => {
    expect(at({ late: true, elapsedMs: 10 })).toBe(0);
  });

  it('der Punktemultiplikator wirkt', () => {
    expect(at({ elapsedMs: 0, pointsFactor: 2 })).toBe(2000);
    expect(at({ elapsedMs: 15_000, pointsFactor: 2 })).toBe(1500);
    expect(at({ elapsedMs: 0, pointsFactor: 0 })).toBe(0);
    expect(at({ elapsedMs: 15_000, pointsFactor: 0 })).toBe(0);
  });

  it('scoringMode flat ignoriert die Zeit', () => {
    expect(at({ scoringMode: 'flat', elapsedMs: 29_000 })).toBe(1000);
  });

  it('degenerierter Timer gibt vollen Wert statt Division durch null', () => {
    expect(at({ timeLimitMs: 0, elapsedMs: 5_000 })).toBe(1000);
  });

  it('Ueberkompensation ins Negative faellt in die Toleranzschwelle', () => {
    expect(at({ elapsedMs: -120 })).toBe(1000);
  });
});

describe('Latenzausgleich', () => {
  it('ohne Probe wird nicht kompensiert', () => {
    expect(compensate(1_000, null)).toBe(1_000);
  });

  it('kompensiert die halbe minimale Umlaufzeit', () => {
    expect(compensate(1_000, 80)).toBe(960);
  });

  it('deckelt den Ausgleich, damit eine schlechte Leitung nicht belohnt wird', () => {
    expect(compensate(5_000, 10_000)).toBe(5_000 - COMPENSATION_CAP_MS);
  });

  it('wird nie negativ', () => {
    expect(compensate(10, 400)).toBe(0);
  });
});
