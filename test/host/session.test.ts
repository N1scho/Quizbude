import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRoomOnce, type ConnectSource } from '../../apps/host-web/src/session.js';
import { textliterale } from '../quelltext.js';

/**
 * E1: Ein kurzer Verbindungsabriss der Buehne darf keinen zweiten Raum
 * anlegen. `socket.io-client` feuert `connect` bei jeder Wiederverbindung.
 */

const BUEHNE_SRC = fileURLToPath(new URL('../../apps/host-web/src', import.meta.url));

/** Jede Quelldatei der Buehne, nicht nur die eine, die der Waechter kannte. */
function buehnenQuellen(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (full.endsWith('.ts') || full.endsWith('.tsx')) out.push(full);
    }
  };
  walk(BUEHNE_SRC);
  return out;
}

function fakeSocket(): { source: ConnectSource; connect: () => void } {
  const listeners: (() => void)[] = [];
  return {
    source: {
      on(event: 'connect', listener: () => void): unknown {
        if (event === 'connect') listeners.push(listener);
        return undefined;
      },
    },
    connect: () => {
      for (const l of [...listeners]) l();
    },
  };
}

describe('Raum genau einmal je Sitzung', () => {
  it('erzeugt den Raum bei der ersten Verbindung', () => {
    const socket = fakeSocket();
    let erzeugt = 0;
    createRoomOnce(socket.source, () => {
      erzeugt += 1;
    });
    expect(erzeugt).toBe(0);
    socket.connect();
    expect(erzeugt).toBe(1);
  });

  it('erzeugt bei jeder Wiederverbindung KEINEN zweiten Raum', () => {
    const socket = fakeSocket();
    let erzeugt = 0;
    createRoomOnce(socket.source, () => {
      erzeugt += 1;
    });
    socket.connect();
    socket.connect();
    socket.connect();
    socket.connect();
    expect(erzeugt).toBe(1);
  });

  it('haelt zwei Sitzungen auseinander', () => {
    const a = fakeSocket();
    const b = fakeSocket();
    const codes: string[] = [];
    createRoomOnce(a.source, () => codes.push('a'));
    createRoomOnce(b.source, () => codes.push('b'));
    a.connect();
    a.connect();
    b.connect();
    b.connect();
    expect(codes).toEqual(['a', 'b']);
  });

  it('die Buehne benutzt den Wachter auch wirklich', () => {
    const app = readFileSync(
      fileURLToPath(new URL('../../apps/host-web/src/App.tsx', import.meta.url)),
      'utf8',
    );
    expect(app).toContain("createRoomOnce(wire.socket, () => wire.send({ t: 'host:create' }))");
    // Ein roher connect-Handler in der Buehne waere genau der Rueckfall.
    //
    // NR1: Der Waechter darf nicht an der Anfuehrungsart haengen. Das Projekt
    // hat weder eslint noch prettier, nichts erzwingt einfache
    // Anfuehrungszeichen - ein Rueckfall in doppelten lief frueher durch,
    // waehrend alle vier Tests gruen blieben. `\s*` deckt zugleich den
    // Zeilenumbruch zwischen Klammer und Ereignisnamen ab.
    //
    // B3: Auch vor der Klammer. Das Projekt hat weder eslint noch prettier,
    // nichts erzwingt, dass die Klammer am `.on` klebt - `.on ('connect', …)`
    // lief frueher durch.
    expect(app).not.toMatch(/\.on\s*\(\s*['"`]connect['"`]/);
  });

  it('host:create steht in der ganzen Buehne an genau einer Stelle', () => {
    // B1: Der Waechter oben liest genau eine Datei. `wire.ts` hat einen
    // eigenen connect-Handler, in dem `send` im Gueltigkeitsbereich liegt -
    // eine Zeile dort stellte E1 vollstaendig wieder her, und alle Tore
    // schwiegen. Die Lueckenverschiebung von "andere Anfuehrungszeichen" auf
    // "andere Datei" schliesst nur ein Waechter ueber die ganze Buehne.
    //
    // Ein pauschales Verbot von connect-Handlern geht nicht: wire.ts braucht
    // einen fuer die Uhrproben. Gebunden wird deshalb das, worauf es
    // ankommt - der Raumbefehl selbst.
    const treffer: Record<string, number> = {};
    for (const datei of buehnenQuellen()) {
      const name = relative(BUEHNE_SRC, datei).split(sep).join('/');
      // Nur Code, keine Kommentare: `session.ts` erklaert den Befehl, ohne
      // ihn zu senden. Gezaehlt wird das Literal, das wirklich auf die
      // Leitung ginge.
      const anzahl = textliterale(readFileSync(datei, 'utf8'), name).filter(
        (t) => t === 'host:create',
      ).length;
      if (anzahl > 0) treffer[name] = anzahl;
    }
    expect(treffer).toEqual({ 'App.tsx': 1 });
  });
});
