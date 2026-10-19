/**
 * Gesaeter Zufall. core ruft niemals Math.random; der Startwert kommt
 * von aussen herein, damit jedes Mischen reproduzierbar ist.
 */
export interface Rng {
  /** Gleichverteilt in [0, 1). */
  next(): number;
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next(): number {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/**
 * Fisher-Yates ueber 0..n-1. Ergebnis[d] ist der kanonische Index,
 * der an Anzeigeposition d steht.
 */
export function shuffledIndices(n: number, rng: Rng): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    const a = out[i] as number;
    const b = out[j] as number;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export function identityIndices(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(i);
  return out;
}
