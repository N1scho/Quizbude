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
  it('erzeugt den Raum erst, wenn er gewollt ist - nicht schon beim Verbinden', () => {
    // Seit dem Fragen-Upload faellt die Entscheidung nach dem Pruefbericht.
    // Ein Raum beim Verbinden hiesse: der Code steht auf der Leinwand,
    // bevor jemand weiss, ob die Fragen ueberhaupt taugen.
    const socket = fakeSocket();
    let erzeugt = 0;
    createRoomOnce<string>(socket.source, () => {
      erzeugt += 1;
    });
    socket.connect();
    socket.connect();
    expect(erzeugt).toBe(0);
  });

  it('erzeugt den Raum beim Zuruf, wenn die Leitung schon steht', () => {
    const socket = fakeSocket();
    const gesehen: string[] = [];
    const sitzung = createRoomOnce<string>(socket.source, (q) => gesehen.push(q));
    socket.connect();
    sitzung.oeffne('runde-a');
    expect(gesehen).toEqual(['runde-a']);
  });

  it('wartet auf die Leitung, wenn der Zuruf zuerst kommt', () => {
    const socket = fakeSocket();
    const gesehen: string[] = [];
    const sitzung = createRoomOnce<string>(socket.source, (q) => gesehen.push(q));
    sitzung.oeffne('runde-a');
    expect(gesehen).toEqual([]);
    socket.connect();
    expect(gesehen).toEqual(['runde-a']);
  });

  /**
   * B2: Die fruehere Zusage lautete "erzeugt bei jeder Wiederverbindung und
   * JEDEM WEITEREN KLICK keinen zweiten Raum". Sie war in dieser Form
   * falsch: sie widersprach dem `room:error`-Pfad derselben Welle, der den
   * Nutzer ausdruecklich zurueck auf den Fragen-Bildschirm schickt, damit
   * er etwas aendern kann. Genau dieser Pfad war damit tot - die Buehne
   * hing bis zum Neuladen.
   *
   * Richtig ist: solange ein Raum entsteht oder besteht, erzeugt kein
   * weiterer Klick und keine Wiederverbindung einen zweiten Raum - nach
   * einer Ablehnung ist ein neuer Versuch aber wieder moeglich. Die
   * fruehere Zusage steht deshalb jetzt in drei Teilen, und jeder Teil ist
   * einzeln gebunden.
   */
  it('vor der Leitung gewinnt der letzte Zuruf, nicht der erste', () => {
    // Wer zweimal klickt, bevor die Leitung steht, hat beim zweiten Mal
    // meistens etwas geaendert. Nicht ueberschriebene Wuensche hiessen:
    // die Buehne spielt eine Fassung, die der Nutzer verworfen hat.
    const socket = fakeSocket();
    const gesehen: string[] = [];
    const sitzung = createRoomOnce<string>(socket.source, (q) => gesehen.push(q));
    sitzung.oeffne('erste-fassung');
    sitzung.oeffne('korrigierte-fassung');
    expect(gesehen).toEqual([]);
    socket.connect();
    expect(gesehen).toEqual(['korrigierte-fassung']);
  });

  it('zwei schnelle Klicks vor der ersten Antwort erzeugen nur einen Raum', () => {
    const socket = fakeSocket();
    const gesehen: string[] = [];
    const sitzung = createRoomOnce<string>(socket.source, (q) => gesehen.push(q));
    socket.connect();
    sitzung.oeffne('a');
    sitzung.oeffne('b');
    sitzung.oeffne('c');
    expect(gesehen).toEqual(['a']);
  });

  it('eine Wiederverbindung erzeugt keinen zweiten Raum', () => {
    const socket = fakeSocket();
    let erzeugt = 0;
    const sitzung = createRoomOnce<string>(socket.source, () => {
      erzeugt += 1;
    });
    socket.connect();
    sitzung.oeffne('a');
    socket.connect();
    socket.connect();
    expect(erzeugt).toBe(1);
  });

  it('nach einer Ablehnung geht ein neuer Versuch - mit der korrigierten Fassung', () => {
    const socket = fakeSocket();
    const gesehen: string[] = [];
    const sitzung = createRoomOnce<string>(socket.source, (q) => gesehen.push(q));
    socket.connect();
    sitzung.oeffne('kaputte-fassung');
    sitzung.abgelehnt();
    sitzung.oeffne('korrigierte-fassung');
    expect(gesehen).toEqual(['kaputte-fassung', 'korrigierte-fassung']);
  });

  it('eine Ablehnung schickt von sich aus gar nichts nach', () => {
    // Weder sofort noch bei der naechsten Wiederverbindung: die abgelehnte
    // Sammlung wuerde sonst still ein zweites Mal gegen die Wand laufen.
    const socket = fakeSocket();
    const gesehen: string[] = [];
    const sitzung = createRoomOnce<string>(socket.source, (q) => gesehen.push(q));
    socket.connect();
    sitzung.oeffne('kaputte-fassung');
    sitzung.abgelehnt();
    socket.connect();
    socket.connect();
    expect(gesehen).toEqual(['kaputte-fassung']);
  });

  it('nach der Ablehnung gilt der Doppelklick-Schutz wieder', () => {
    const socket = fakeSocket();
    const gesehen: string[] = [];
    const sitzung = createRoomOnce<string>(socket.source, (q) => gesehen.push(q));
    socket.connect();
    sitzung.oeffne('a');
    sitzung.abgelehnt();
    sitzung.oeffne('b');
    sitzung.oeffne('c');
    socket.connect();
    expect(gesehen).toEqual(['a', 'b']);
  });

  it('meldet jede Verbindung, damit die Buehne keinen eigenen Handler braucht', () => {
    const socket = fakeSocket();
    let verbindungen = 0;
    createRoomOnce<string>(
      socket.source,
      () => undefined,
      () => {
        verbindungen += 1;
      },
    );
    socket.connect();
    socket.connect();
    expect(verbindungen).toBe(2);
  });

  it('haelt zwei Sitzungen auseinander', () => {
    const a = fakeSocket();
    const b = fakeSocket();
    const codes: string[] = [];
    const sitzungA = createRoomOnce<string>(a.source, () => codes.push('a'));
    const sitzungB = createRoomOnce<string>(b.source, () => codes.push('b'));
    a.connect();
    b.connect();
    sitzungA.oeffne('x');
    sitzungA.oeffne('x');
    sitzungB.oeffne('y');
    sitzungB.oeffne('y');
    expect(codes).toEqual(['a', 'b']);
    // Und eine Ablehnung bleibt in ihrer Sitzung.
    sitzungA.abgelehnt();
    sitzungA.oeffne('x');
    sitzungB.oeffne('y');
    expect(codes).toEqual(['a', 'b', 'a']);
  });

  it('die Buehne benutzt den Wachter auch wirklich', () => {
    const app = readFileSync(
      fileURLToPath(new URL('../../apps/host-web/src/App.tsx', import.meta.url)),
      'utf8',
    );
    expect(app).toContain("wire.send({ t: 'host:create', quiz })");
    expect(app).toContain('createRoomOnce<QuizPayload>(');
    // B2/N3: Hier stand `expect(app).toContain('oeffne.current?.abgelehnt()')`.
    // Der Waechter hielt genau so lange, wie der Text dort stand - das
    // Nachreview hat die Zeile woertlich stehen lassen und tot gemacht
    // (`if (message.code === 'niemals') ...`): 309/309 gruen, tsc Exit 0,
    // der ganze room:error-Pfad wieder folgenlos. Und nach dem Umbau faende
    // derselbe Waechter seinen Text sogar im Kommentar ueber `verdrahte`.
    //
    // Gebunden ist der Pfad jetzt am Verhalten:
    // `test/host/wire.test.ts` > "Die verdrahtete Buehne (B2/N3)" schickt
    // ein echtes `room:error` ueber den Kanal und zaehlt, was danach auf die
    // Leitung geht. Hier bleibt nur die Frage, ob die Komponente ueberhaupt
    // durch die gebundene Verdrahtung geht.
    expect(app).toContain('verdrahte({');
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
