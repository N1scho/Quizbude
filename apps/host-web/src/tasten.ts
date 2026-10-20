/**
 * Die Leertaste schaltet die Buehne weiter - ausser dort, wo sie ein
 * Leerzeichen ist.
 *
 * Seit die Buehne mit einem Fragenfeld beginnt, ist das keine Feinheit
 * mehr: ein globales `preventDefault` auf Space haette das Tippen im
 * Textfeld unmoeglich gemacht, und zwar lautlos. Die Entscheidung steht
 * deshalb in einer eigenen Funktion, die ohne Browser pruefbar ist.
 */

/** Nur der Ausschnitt des Ereignisses, auf den es ankommt. */
export interface Tastendruck {
  readonly code: string;
  readonly target: unknown;
}

function istSchreibfeld(ziel: unknown): boolean {
  if (typeof ziel !== 'object' || ziel === null) return false;
  const el = ziel as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return true;
  return el.isContentEditable === true;
}

export function istWeiterTaste(e: Tastendruck): boolean {
  if (e.code !== 'Space') return false;
  return !istSchreibfeld(e.target);
}
