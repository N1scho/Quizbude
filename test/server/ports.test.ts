import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PORT,
  LAST_FALLBACK_PORT,
  decideAfterListenError,
  portSequence,
} from '../../packages/server/src/runtime/ports.js';

/**
 * Die Zusicherung aus `2e006c6` - Startfehler endet mit Exit 1 - stand
 * bisher nur als Code in `main.ts` und war von keinem Test gebunden.
 * Hier wird sie gebunden, und zwar an der Entscheidung selbst: wann darf
 * ausgewichen werden und wann nicht.
 */
describe('Die Portfolge', () => {
  it('geht von 3000 bis 3010', () => {
    const folge = portSequence();
    expect(folge[0]).toBe(DEFAULT_PORT);
    expect(folge[folge.length - 1]).toBe(LAST_FALLBACK_PORT);
    expect(folge).toEqual([3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010]);
  });

  it('ist bei unsinnigen Grenzen trotzdem brauchbar', () => {
    expect(portSequence(3000, 2000)).toEqual([3000]);
    expect(portSequence(-5)).toEqual([DEFAULT_PORT]);
    expect(portSequence(1.5)).toEqual([DEFAULT_PORT]);
  });
});

describe('Ausweichen oder abbrechen', () => {
  const folge = portSequence();

  it('weicht bei belegtem Port auf den naechsten der Folge aus', () => {
    const d = decideAfterListenError({
      code: 'EADDRINUSE',
      current: 3000,
      portWasChosenByUser: false,
      sequence: folge,
    });
    expect(d).toEqual({ kind: 'retry', port: 3001 });
  });

  /**
   * Nicht "irgendein Port", sondern der naechste der uebergebenen Folge.
   * Mit einer Folge voller Luecken faellt auf, wenn jemand heimlich
   * `current + 1` rechnet.
   */
  it('nimmt den naechsten der Folge, nicht den naechsthoeheren Zahlenwert', () => {
    const d = decideAfterListenError({
      code: 'EADDRINUSE',
      current: 3000,
      portWasChosenByUser: false,
      sequence: [3000, 3005, 3007],
    });
    expect(d).toEqual({ kind: 'retry', port: 3005 });
  });

  it('laeuft die ganze Folge ab und bricht erst am Ende ab', () => {
    const besucht: number[] = [];
    let current = folge[0] ?? DEFAULT_PORT;
    besucht.push(current);
    for (;;) {
      const d = decideAfterListenError({
        code: 'EADDRINUSE',
        current,
        portWasChosenByUser: false,
        sequence: folge,
      });
      if (d.kind === 'giveUp') {
        expect(d.reason).toContain('3000 bis 3010');
        break;
      }
      current = d.port;
      besucht.push(current);
      expect(besucht.length).toBeLessThanOrEqual(folge.length);
    }
    expect(besucht).toEqual([...folge]);
  });

  it('bricht ab, wenn PORT ausdruecklich gesetzt ist - auch bei belegtem Port', () => {
    const d = decideAfterListenError({
      code: 'EADDRINUSE',
      current: 3000,
      portWasChosenByUser: true,
      sequence: folge,
    });
    expect(d.kind).toBe('giveUp');
    if (d.kind === 'giveUp') expect(d.reason).toContain('ausdruecklich');
  });

  it('bricht bei jedem anderen Fehler ab, statt auszuweichen', () => {
    for (const code of ['EACCES', 'EADDRNOTAVAIL', undefined]) {
      const d = decideAfterListenError({
        code,
        current: 3000,
        portWasChosenByUser: false,
        sequence: folge,
      });
      expect(d.kind).toBe('giveUp');
    }
  });

  it('bricht ab, wenn der gescheiterte Port gar nicht aus der Folge stammt', () => {
    const d = decideAfterListenError({
      code: 'EADDRINUSE',
      current: 9999,
      portWasChosenByUser: false,
      sequence: folge,
    });
    expect(d.kind).toBe('giveUp');
  });
});
