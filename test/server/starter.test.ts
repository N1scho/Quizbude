import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Der Doppelklick-Starter hatte bisher kein Tor: er war in Ordnung, konnte
 * aber unbemerkt kaputtgehen. Ausfuehren laesst er sich im Testlauf nicht -
 * er holt Pakete, baut und startet einen Server. Gebunden wird deshalb
 * sein Kontrollfluss, und zwar an den beiden Stellen, an denen er falsch
 * abgebogen ist: die uebersprungene Nachinstallation und das Strg+C, das
 * als Fehler durchging.
 *
 * Was nur am Geraet prueft: dass der Doppelklick aus dem Explorer das
 * Fenster oeffnet und offen haelt.
 */

const DATEI = fileURLToPath(new URL('../../quizbude-starten.cmd', import.meta.url));
const ROH = readFileSync(DATEI);
const TEXT = ROH.toString('latin1');
const ZEILEN = TEXT.split('\r\n');

/** Die Zeilennummer der ersten Zeile, auf die das Muster passt. */
function zeileMit(muster: RegExp): number {
  return ZEILEN.findIndex((z) => muster.test(z.trim()));
}

describe('Der Doppelklick-Starter', () => {
  it('ist reines ASCII und durchgehend CRLF - die Konsole kennt nicht jede Codepage', () => {
    expect([...ROH].filter((b) => b > 126)).toEqual([]);
    const crlf = TEXT.split('\r\n').length - 1;
    const lf = TEXT.split('\n').length - 1;
    expect(lf).toBe(crlf);
  });

  /**
   * B6: `if exist "node_modules"` hat eine abgebrochene Installation nie
   * nachgeholt. Ein halber Ordner reicht fuer diese Pruefung aus; der Bau
   * scheiterte danach an fehlenden Paketen, und die Diagnose zeigte auf
   * den Bau statt auf die Installation.
   */
  it('haengt die Installation an eine Marke, nicht am blossen Ordner', () => {
    const wache = zeileMit(/^if exist .*goto bauen$/i);
    expect(wache).toBeGreaterThan(-1);
    expect(ZEILEN[wache]).not.toMatch(/if exist\s+"?node_modules"?\s+goto/i);

    const marke = /set "FERTIGMARKE=([^"]+)"/.exec(TEXT)?.[1];
    expect(marke).toBeTruthy();
    expect(ZEILEN[wache]).toContain('%FERTIGMARKE%');
  });

  it('setzt die Marke erst, nachdem npm install geglueckt ist', () => {
    const install = zeileMit(/^call npm install$/i);
    const riegel = zeileMit(/^if errorlevel 1 goto installkaputt$/i);
    const setzen = zeileMit(/^echo .*> "%FERTIGMARKE%"$/i);
    expect(install).toBeGreaterThan(-1);
    expect(riegel).toBeGreaterThan(install);
    expect(setzen).toBeGreaterThan(riegel);
  });

  /**
   * B7: Strg+C beendet Node mit 0xC000013A. Wer die Rueckfrage
   * "Batchvorgang abbrechen?" mit N beantwortet, lief in den Fehlerzweig
   * und las, alle Ports seien belegt - nach einem Beenden, das der Server
   * selbst empfiehlt.
   */
  it('haelt Strg+C fuer ein normales Ende, nicht fuer einen Fehler', () => {
    const nachLauf = ZEILEN.slice(zeileMit(/^set "ENDE=%errorlevel%"$/i));
    expect(nachLauf.length).toBeGreaterThan(0);

    const ziele = new Map<string, string>();
    for (const zeile of nachLauf) {
      const treffer = /^if "%ENDE%"=="([^"]*)" goto (\w+)$/i.exec(zeile.trim());
      if (treffer?.[1] !== undefined && treffer[2] !== undefined) ziele.set(treffer[1], treffer[2]);
      if (/^:\w+$/.test(zeile.trim()) && zeile.trim() !== ':fertig') break;
    }

    const normal = ziele.get('0');
    expect(normal).toBeTruthy();
    expect(ziele.get('-1073741510')).toBe(normal);
    expect(ziele.get('3221225786')).toBe(normal);

    const ende = ZEILEN.findIndex((z) => z.trim() === `:${normal ?? ''}`);
    expect(ende).toBeGreaterThan(-1);
    expect(ZEILEN.slice(ende, ende + 4).join('\n')).toContain('Die Runde ist vorbei');
  });

  it('endet jeder Fehlerzweig bei pause - eine Meldung, die niemand liest, ist keine', () => {
    for (const label of [
      'keinnode',
      'nodezualt',
      'nodeunklar',
      'keinnpm',
      'installkaputt',
      'baukaputt',
      'serverkaputt',
    ]) {
      const start = ZEILEN.findIndex((z) => z.trim() === `:${label}`);
      expect(start, label).toBeGreaterThan(-1);
      const rest = ZEILEN.slice(start).join('\n');
      expect(rest, label).toContain('goto ende');
    }
    expect(ZEILEN.slice(ZEILEN.findIndex((z) => z.trim() === ':ende')).join('\n')).toContain(
      'pause',
    );
  });
});
