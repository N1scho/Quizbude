import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KI_ANWEISUNG, parseQuiz, pruefbericht } from '@quizbude/core';
import { Bericht, Upload, nutzlast } from '../../apps/host-web/src/Upload.js';

/**
 * Die Oberflaeche, nicht die reine Funktion darunter.
 *
 * Der letzte Falsch-Grun-Fall dieses Projekts lag genau hier: eine Datei,
 * die von keinem Test beruehrt wurde. Deshalb werden die Komponenten hier
 * wirklich gerendert - `renderToStaticMarkup` braucht kein DOM und keine
 * zusaetzliche Abhaengigkeit.
 */

vi.mock('socket.io-client', () => ({ io: (): unknown => ({ on: () => undefined }) }));

const BOESE = '<img src=x onerror=alert(1)> "doppelt" \'einfach\' & <script>alert(1)</script>';

function html(element: Parameters<typeof renderToStaticMarkup>[0]): string {
  return renderToStaticMarkup(element);
}

describe('Pruefbericht der Buehne', () => {
  it('nennt Titel, Fragenzahl und geschaetzte Dauer', () => {
    const markup = html(
      createElement(Bericht, {
        bericht: pruefbericht(parseQuiz('# Abendrunde\n\nFrage? | 20\n* A\nB')),
      }),
    );
    expect(markup).toContain('Abendrunde');
    expect(markup).toContain('<dd>1</dd>');
    expect(markup).toMatch(/etwa \d+ (Sekunden|Minuten)/u);
    expect(markup).toContain('Alles in Ordnung');
  });

  it('nennt jede beanstandete Zeile mit ihrer Nummer', () => {
    const markup = html(
      createElement(Bericht, { bericht: pruefbericht(parseQuiz('Frage? | 20\n* A\n* B')) }),
    );
    expect(markup).toContain('Zeile 3: ');
    expect(markup).toContain('2 Antworten markiert, genau eine darf es sein.');
    expect(markup).not.toContain('Alles in Ordnung');
  });

  it('entschaerft Fremdeingabe in Titel und Meldung', () => {
    // Der ganze Weg: boeser Text -> Parser -> Bericht -> Markup.
    const text = `# ${BOESE}\n\n${BOESE}? | 20\n* ${BOESE}\n* B`;
    const markup = html(createElement(Bericht, { bericht: pruefbericht(parseQuiz(text)) }));
    expect(markup).toContain(BOESE.slice(0, 4).replace('<', '&lt;'));
    expect(markup).not.toContain('<img');
    expect(markup).not.toContain('<script>alert(1)</script>');
    expect(markup).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(markup).toContain('&quot;doppelt&quot;');
    expect(markup).toContain('&amp;');
  });
});

describe('Der Bildschirm vor der Lobby', () => {
  const schirm = (bereit: boolean): string =>
    html(
      createElement(Upload, {
        onStart: () => undefined,
        bereit,
        serverfehler: null,
      }),
    );

  it('bietet Datei waehlen, Ablegen und Einfuegen an', () => {
    const markup = schirm(true);
    expect(markup).toContain('type="file"');
    expect(markup).toContain('Datei hierher ziehen');
    expect(markup).toContain('Datei ausw');
    expect(markup).toContain('<textarea');
  });

  it('traegt die Anweisung fuer die KI samt Kopierknopf', () => {
    const markup = schirm(true);
    expect(markup).toContain('Anweisung kopieren');
    // Der Wortlaut aus dem Kern, nicht eine zweite Fassung daneben.
    expect(markup).toContain('Genau eine Antwort beginnt mit einem Stern');
    expect(markup).toContain('Kein Vorwort und kein Schlusswort');
    expect(KI_ANWEISUNG).toContain('Keine Nummerierung der Fragen.');
  });

  it('zeigt den Pruefbericht der Demorunde, bevor irgendetwas startet', () => {
    const markup = schirm(true);
    expect(markup).toContain('Quizbude — Demorunde');
    expect(markup).toContain('Alles in Ordnung');
    expect(markup).toContain('Runde er');
  });

  it('laesst die Runde erst oeffnen, wenn die Leitung steht', () => {
    expect(schirm(false)).toContain('disabled');
    expect(schirm(false)).toContain('Verbinde');
  });

  it('zeigt einen Serverfehler statt ihn zu verschlucken', () => {
    const markup = html(
      createElement(Upload, {
        onStart: () => undefined,
        bereit: true,
        serverfehler: 'Frage q1: prompt muss 1..200 Zeichen haben, hat 404',
      }),
    );
    expect(markup).toContain('hat 404');
  });

  it('schickt genau das weiter, was der Kern geprueft hat', () => {
    const erg = parseQuiz('# Runde\n\nFrage? | 20\n* A\nB');
    expect(nutzlast(erg)).toEqual({ title: 'Runde', questions: erg.questions });
  });
});

describe('Die Buehne beginnt mit den Fragen', () => {
  it('zeigt vor jedem Raumcode den Fragen-Bildschirm', async () => {
    // Wirkungen laufen beim statischen Rendern nicht - genau deshalb ist
    // hier sichtbar, was die Buehne OHNE Leitung anzeigt: keine Lobby,
    // kein Code, sondern die Fragen.
    const { App } = (await import('../../apps/host-web/src/App.js')) as {
      App: () => unknown;
    };
    const markup = html(createElement(App as never));
    expect(markup).toContain('Eigene Fragen');
    expect(markup).toContain('Datei hierher ziehen');
    expect(markup).not.toContain('Code auf quizbude eingeben');
    expect(markup).not.toContain('······');
  });
});
