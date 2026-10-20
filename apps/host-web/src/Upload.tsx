import { useCallback, useRef, useState, type DragEvent, type JSX } from 'react';
import {
  DEMO_TEXT,
  KI_ANWEISUNG,
  MAX_UPLOAD_BYTES,
  dekodiereUtf8,
  parseQuiz,
  pruefbericht,
  type ParseErgebnis,
  type Pruefbericht,
} from '@quizbude/core';
import type { QuizPayload } from '@quizbude/protocol';

/**
 * Der Bildschirm vor der Lobby.
 *
 * Jemand laesst sich von seiner KI Fragen schreiben; die Ausgabe landet
 * hier - als Datei, per Ablegen, oder als eingefuegter Text aus einem
 * Chatfenster. Gelesen wird die Datei im Browser, nie auf dem Server.
 *
 * Erst steht der Pruefbericht, dann oeffnet ein ausdruecklicher Klick die
 * Lobby. Vorher gibt es keinen Raumcode, den jemand schon abtippen koennte.
 */

export interface BerichtProps {
  readonly bericht: Pruefbericht;
}

/**
 * Hochgeladener Text ist Fremdeingabe. JSX setzt jeden Wert als Text, nicht
 * als Markup - deshalb steht hier nirgends `dangerouslySetInnerHTML`, und
 * deshalb bindet der Test genau diese Komponente.
 */
export function Bericht({ bericht }: BerichtProps): JSX.Element {
  return (
    <div className="bericht">
      <dl>
        <dt>Titel</dt>
        <dd>{bericht.titel}</dd>
        <dt>Fragen</dt>
        <dd>{bericht.fragenzahl}</dd>
        <dt>Dauer</dt>
        <dd>{bericht.dauerText}</dd>
      </dl>
      {bericht.hinweise.length > 0 ? (
        <ul className="hinweise">
          {bericht.hinweise.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      ) : null}
      {bericht.ok ? (
        <p className="gut">Alles in Ordnung. Du kannst die Runde eröffnen.</p>
      ) : (
        <>
          <p>
            <b>Das passt noch nicht:</b>
          </p>
          <ul className="maengel">
            {bericht.fehler.map((f, i) => (
              <li key={`${f.zeile}-${i}`}>
                {f.zeile > 0 ? <b>Zeile {f.zeile}: </b> : null}
                {f.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export interface UploadProps {
  readonly onStart: (quiz: QuizPayload) => void;
  /** Solange die Leitung nicht steht, gibt es nichts zu eröffnen. */
  readonly bereit: boolean;
  /** Was der Server zu den Fragen gesagt hat, falls er etwas gesagt hat. */
  readonly serverfehler: string | null;
}

export function nutzlast(erg: ParseErgebnis): QuizPayload {
  return { title: erg.titel, questions: erg.questions };
}

export function Upload({ onStart, bereit, serverfehler }: UploadProps): JSX.Element {
  const [text, setText] = useState<string>(DEMO_TEXT);
  const [erg, setErg] = useState<ParseErgebnis>(() => parseQuiz(DEMO_TEXT));
  const [meldung, setMeldung] = useState<string | null>(null);
  const [ueberAblage, setUeberAblage] = useState(false);
  const [kopierstand, setKopierstand] = useState<string>('');
  const dateifeld = useRef<HTMLInputElement | null>(null);
  const anweisung = useRef<HTMLPreElement | null>(null);

  const uebernimm = useCallback((neu: string): void => {
    setText(neu);
    setErg(parseQuiz(neu));
    setMeldung(null);
  }, []);

  const lies = useCallback(
    (datei: File | null | undefined): void => {
      if (datei === null || datei === undefined) return;
      setMeldung(null);
      if (datei.size > MAX_UPLOAD_BYTES) {
        setMeldung(
          `Die Datei ist ${Math.round(datei.size / 1024)} kB groß. Mehr als ` +
            `${Math.round(MAX_UPLOAD_BYTES / 1024)} kB nimmt die Bühne nicht an. ` +
            'Teil die Fragen auf mehrere Dateien auf.',
        );
        return;
      }
      const leser = new FileReader();
      leser.onerror = (): void => {
        setMeldung('Die Datei ließ sich nicht lesen. Versuch es noch einmal.');
      };
      leser.onload = (): void => {
        const roh = leser.result;
        if (!(roh instanceof ArrayBuffer)) {
          setMeldung('Die Datei ließ sich nicht lesen. Versuch es noch einmal.');
          return;
        }
        const gelesen = dekodiereUtf8(new Uint8Array(roh));
        if (!gelesen.ok) {
          setMeldung(gelesen.meldung);
          return;
        }
        uebernimm(gelesen.text);
      };
      leser.readAsArrayBuffer(datei);
    },
    [uebernimm],
  );

  const kopiere = useCallback((): void => {
    const markiere = (): void => {
      try {
        const knoten = anweisung.current;
        const auswahl = window.getSelection();
        if (knoten === null || auswahl === null) throw new Error('nichts zu markieren');
        const bereich = document.createRange();
        bereich.selectNodeContents(knoten);
        auswahl.removeAllRanges();
        auswahl.addRange(bereich);
        setKopierstand('Markiert — jetzt Strg+C drücken.');
      } catch {
        setKopierstand('Markier den Block und kopier ihn mit Strg+C.');
      }
    };
    // navigator.clipboard darf abgelehnt werden - ohne Rückfall stünde der
    // Nutzer dann vor einem Knopf, der nichts tut.
    if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined) {
      navigator.clipboard
        .writeText(KI_ANWEISUNG)
        .then(() => setKopierstand('Kopiert.'))
        .catch(markiere);
      return;
    }
    markiere();
  }, []);

  const ueberFlaeche = (e: DragEvent<HTMLElement>, drueber: boolean): void => {
    e.preventDefault();
    setUeberAblage(drueber);
  };

  const bericht = pruefbericht(erg);

  return (
    <div className="laden">
      <h1>Eigene Fragen</h1>
      <p className="unterzeile">
        Lass dir die Fragen von deiner KI schreiben. Die Datei legst du hier ab — oder du kippst
        den Text ins Feld. Geprüft wird, bevor irgendetwas startet.
      </p>

      <section className="kasten">
        <h2>Anweisung für deine KI</h2>
        <p className="unterzeile">
          Kopier den Block, leg ihn deiner KI vor, und was zurückkommt, landet hier.
        </p>
        <pre className="anweisung" ref={anweisung} tabIndex={0}>
          {KI_ANWEISUNG}
        </pre>
        <div className="knopfreihe">
          <button className="still" type="button" onClick={kopiere}>
            Anweisung kopieren
          </button>
          <span className="unterzeile" role="status" aria-live="polite">
            {kopierstand}
          </span>
        </div>
      </section>

      <div
        className={ueberAblage ? 'ablage bereit' : 'ablage'}
        onDragEnter={(e) => ueberFlaeche(e, true)}
        onDragOver={(e) => ueberFlaeche(e, true)}
        onDragLeave={(e) => ueberFlaeche(e, false)}
        onDrop={(e) => {
          e.preventDefault();
          setUeberAblage(false);
          lies(e.dataTransfer.files[0]);
        }}
      >
        <p>
          <b>Datei hierher ziehen</b>
        </p>
        <p className="unterzeile">Textdatei oder JSON, als UTF-8 gespeichert. Höchstens 1 MB.</p>
        <button className="still" type="button" onClick={() => dateifeld.current?.click()}>
          Datei auswählen
        </button>
        <input
          ref={dateifeld}
          type="file"
          hidden
          accept=".txt,.md,.json,text/plain,text/markdown,application/json"
          onChange={(e) => {
            lies(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <label htmlFor="fragenfeld">… oder Text einfügen</label>
      <textarea
        id="fragenfeld"
        spellCheck={false}
        value={text}
        onChange={(e) => uebernimm(e.target.value)}
      />

      {meldung !== null ? (
        <p className="meldung" role="status" aria-live="polite">
          {meldung}
        </p>
      ) : null}
      {serverfehler !== null ? <p className="meldung">{serverfehler}</p> : null}

      <Bericht bericht={bericht} />

      <div className="knopfreihe">
        <button
          className="weiter"
          type="button"
          disabled={!bericht.ok || !bereit}
          onClick={() => onStart(nutzlast(erg))}
        >
          {bereit ? 'Runde eröffnen' : 'Verbinde …'}
        </button>
        <button className="still" type="button" onClick={() => uebernimm(DEMO_TEXT)}>
          Demorunde zurückholen
        </button>
      </div>
    </div>
  );
}
