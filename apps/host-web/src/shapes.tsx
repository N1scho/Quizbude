import type { JSX } from 'react';

/**
 * Vier Formen, vier Farben, feste Paarung. Keine davon ist Dreieck, Raute,
 * Kreis oder Quadrat; die Silhouetten unterscheiden sich in Symmetrie,
 * Konkavitaet, Seitenverhaeltnis und Oberkante.
 */
export type Slot = 'sonne' | 'welle' | 'glut' | 'nacht';

export const SLOT_QUAD: readonly Slot[] = ['sonne', 'welle', 'glut', 'nacht'];
/** Wahr/Falsch nimmt das Paar mit dem groessten Helligkeitsabstand. */
export const SLOT_DUO: readonly Slot[] = ['sonne', 'nacht'];

export function slotFor(index: number, tileCount: number): Slot {
  const table = tileCount <= 2 ? SLOT_DUO : SLOT_QUAD;
  return table[index % table.length] as Slot;
}

const PATHS: Record<Slot, string> = {
  // Blitz: asymmetrisch-diagonal
  sonne: 'M14 2 L4 14 h6 l-2 8 L20 10 h-6 z',
  // Tropfen: schmal, spitze Oberkante
  welle: 'M12 2 C12 2 5 10.5 5 15 a7 7 0 0 0 14 0 C19 10.5 12 2 12 2 z',
  // Herz: breit, eingekerbte Oberkante
  glut: 'M12 21.3 C12 21.3 2.8 14.6 2.8 8.9 A5.1 5.1 0 0 1 12 5.9 A5.1 5.1 0 0 1 21.2 8.9 C21.2 14.6 12 21.3 12 21.3 z',
  // Mond: als einzige Form konkav
  nacht: 'M16.2 1.6 A10.4 10.4 0 1 0 16.2 22.4 A8.3 8.3 0 1 1 16.2 1.6 z',
};

export function Shape({ slot, size = 64 }: { slot: Slot; size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[slot]} fill="currentColor" />
    </svg>
  );
}

export const SLOT_LABEL: Record<Slot, string> = {
  sonne: 'Sonne, Blitz',
  welle: 'Welle, Tropfen',
  glut: 'Glut, Herz',
  nacht: 'Nacht, Mond',
};
