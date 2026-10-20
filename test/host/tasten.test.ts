import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { istWeiterTaste } from '../../apps/host-web/src/tasten.js';

/**
 * Der Bildschirm vor der Lobby hat ein Textfeld. Ein globales
 * `preventDefault` auf die Leertaste haette dort lautlos das Tippen
 * verhindert - ein Fehler, den niemand meldet, weil niemand ihn als
 * Fehler erkennt.
 */

describe('Leertaste auf der Buehne', () => {
  it('schaltet weiter, wenn der Fokus nirgends haengt', () => {
    expect(istWeiterTaste({ code: 'Space', target: null })).toBe(true);
    expect(istWeiterTaste({ code: 'Space', target: { tagName: 'BODY' } })).toBe(true);
    expect(istWeiterTaste({ code: 'Space', target: { tagName: 'BUTTON' } })).toBe(true);
  });

  it('schaltet NICHT weiter, waehrend jemand Fragen tippt', () => {
    expect(istWeiterTaste({ code: 'Space', target: { tagName: 'TEXTAREA' } })).toBe(false);
    expect(istWeiterTaste({ code: 'Space', target: { tagName: 'textarea' } })).toBe(false);
    expect(istWeiterTaste({ code: 'Space', target: { tagName: 'INPUT' } })).toBe(false);
    expect(istWeiterTaste({ code: 'Space', target: { tagName: 'SELECT' } })).toBe(false);
    expect(
      istWeiterTaste({ code: 'Space', target: { tagName: 'DIV', isContentEditable: true } }),
    ).toBe(false);
  });

  it('jede andere Taste laesst die Buehne in Ruhe', () => {
    expect(istWeiterTaste({ code: 'Enter', target: null })).toBe(false);
    expect(istWeiterTaste({ code: 'KeyA', target: { tagName: 'BODY' } })).toBe(false);
  });

  it('die Buehne benutzt die Entscheidung auch wirklich', () => {
    // Sonst bindet dieser Test eine Funktion, die niemand ruft.
    const app = readFileSync(
      fileURLToPath(new URL('../../apps/host-web/src/App.tsx', import.meta.url)),
      'utf8',
    );
    expect(app).toContain('if (!istWeiterTaste(e)) return;');
    expect(app).not.toMatch(/e\.code === 'Space'/u);
  });
});
