import { useCallback, useEffect, useRef, useState, type JSX } from 'react';
import type { PlayerTileSpec, ServerMessage } from '@quizbude/protocol';
import { connect, type Wire } from './wire';
import { Shape, slotFor, SLOT_LABEL } from './shapes';

/**
 * Das eine Gesetz: Der große Bildschirm ist die Bühne, das Handy ist der
 * Buzzer. Die Frage steht nie auf dem Handy — sie kommt hier gar nicht an.
 */

type Screen =
  | { k: 'code' }
  | { k: 'name' }
  | { k: 'warten' }
  | {
      k: 'frage';
      tiles: PlayerTileSpec;
      announceUntil: number;
      answersOpenAt: number;
      answersCloseAt: number;
      chosen: number | null;
    }
  | {
      k: 'ergebnis';
      answered: boolean;
      correct: boolean;
      late: boolean;
      points: number;
      totalScore: number;
      rank: number;
      deltaToAhead: number;
    }
  | { k: 'zwischenstand'; rank: number; score: number; deltaToAhead: number; playerCount: number }
  | { k: 'endstand'; rank: number; score: number; playerCount: number }
  | { k: 'beendet' };

function codeFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return (params.get('code') ?? '').toUpperCase();
}

function buzz(ms: number): void {
  if (typeof navigator.vibrate === 'function') navigator.vibrate(ms);
}

export function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>({ k: 'code' });
  const [code, setCode] = useState(codeFromUrl);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [answered, setAnswered] = useState<{ answered: number; expected: number } | null>(null);
  const [me, setMe] = useState<{ displayName: string; score: number }>({
    displayName: '',
    score: 0,
  });
  const [now, setNow] = useState(0);
  const wireRef = useRef<Wire | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    const wire = connect((message: ServerMessage) => {
      switch (message.t) {
        case 'player:joined':
          setMe((m) => ({ ...m, displayName: message.displayName }));
          setError(null);
          setScreen({ k: 'warten' });
          return;
        case 'player:join_rejected':
          setError(rejectText(message.reason));
          setShake((n) => n + 1);
          setScreen((s) => (s.k === 'name' && message.reason === 'name_taken' ? s : { k: 'code' }));
          return;
        case 'player:question_prepared':
          openedRef.current = false;
          setAnswered(null);
          setScreen({
            k: 'frage',
            tiles: message.tiles,
            announceUntil: message.announceUntil,
            answersOpenAt: message.answersOpenAt,
            answersCloseAt: message.answersCloseAt,
            chosen: null,
          });
          return;
        case 'room:answer_count':
          setAnswered({ answered: message.answered, expected: message.expected });
          return;
        case 'player:answer_ack':
          setScreen((s) => (s.k === 'frage' ? { ...s, chosen: message.optionIndex } : s));
          return;
        case 'player:answer_rejected':
          // Die Eingabe bleibt offen; der Spieler darf erneut tippen.
          setScreen((s) => (s.k === 'frage' ? { ...s, chosen: null } : s));
          return;
        case 'player:question_result':
          setMe((m) => ({ ...m, score: message.totalScore }));
          setScreen({
            k: 'ergebnis',
            answered: message.answered,
            correct: message.correct,
            late: message.late,
            points: message.points,
            totalScore: message.totalScore,
            rank: message.rank,
            deltaToAhead: message.deltaToAhead,
          });
          buzz(message.correct && !message.late ? 30 : 0);
          return;
        case 'player:scoreboard':
          setScreen({
            k: 'zwischenstand',
            rank: message.rank,
            score: message.score,
            deltaToAhead: message.deltaToAhead,
            playerCount: message.playerCount,
          });
          return;
        case 'player:podium':
          setScreen({
            k: 'endstand',
            rank: message.rank,
            score: message.score,
            playerCount: message.playerCount,
          });
          return;
        case 'room:finished':
          setScreen({ k: 'beendet' });
          return;
        default:
          return;
      }
    });
    wireRef.current = wire;
    return () => {
      wire.dispose();
      wireRef.current = null;
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    const loop = (): void => {
      const wire = wireRef.current;
      if (wire !== null) setNow(wire.serverNow());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Die Freigabe ist ein körperlicher Moment: eine kurze Vibration.
  useEffect(() => {
    if (screen.k !== 'frage') return;
    if (openedRef.current) return;
    if (now >= screen.answersOpenAt) {
      openedRef.current = true;
      buzz(10);
    }
  }, [screen, now]);

  const join = useCallback(() => {
    const wire = wireRef.current;
    if (wire === null) return;
    wire.send({ t: 'player:join', roomCode: code, displayName: name });
  }, [code, name]);

  const answer = useCallback(
    (index: number) => {
      const wire = wireRef.current;
      if (wire === null || screen.k !== 'frage') return;
      if (now < screen.answersOpenAt) {
        setShake((n) => n + 1);
        return;
      }
      if (screen.chosen !== null) return;
      buzz(20);
      setScreen({ ...screen, chosen: index });
      wire.send({ t: 'player:answer', questionSeq: screen.tiles.seq, optionIndex: index });
    },
    [screen, now],
  );

  return (
    <div className="buzzer">
      {renderScreen({
        screen,
        setScreen,
        now,
        code,
        setCode,
        name,
        setName,
        join,
        answer,
        error,
        shake,
        answered,
        me,
      })}
    </div>
  );
}

function rejectText(reason: string): string {
  switch (reason) {
    case 'unknown_room':
      return 'Diesen Code gibt es nicht. Nochmal prüfen.';
    case 'name_taken':
      return 'Den Namen gibt es schon. Nimm einen anderen.';
    case 'name_invalid':
      return 'Der Name geht so nicht. 1 bis 16 Zeichen, Buchstaben und Ziffern.';
    case 'locked':
      return 'Die Runde ist gesperrt. Der Host kann wieder öffnen.';
    case 'finished':
      return 'Die Runde ist schon vorbei.';
    case 'capacity':
      return 'Der Raum ist voll.';
    default:
      return 'Beitritt nicht möglich.';
  }
}

interface ViewProps {
  screen: Screen;
  setScreen: (s: Screen) => void;
  now: number;
  code: string;
  setCode: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  join: () => void;
  answer: (index: number) => void;
  error: string | null;
  shake: number;
  answered: { answered: number; expected: number } | null;
  me: { displayName: string; score: number };
}

function renderScreen(p: ViewProps): JSX.Element {
  switch (p.screen.k) {
    case 'code':
      return <CodeScreen {...p} />;
    case 'name':
      return <NameScreen {...p} />;
    case 'warten':
      return (
        <div className="feld">
          <p className="gross">{p.me.displayName}</p>
          <p className="frageText">Du bist dabei.</p>
          <p className="einordnung">Schau nach vorn.</p>
        </div>
      );
    case 'frage':
      return <FrageScreen {...p} screen={p.screen} />;
    case 'ergebnis':
      return <ErgebnisScreen screen={p.screen} />;
    case 'zwischenstand':
      return (
        <div className="vollbild neutral">
          <p className="gross">Platz {p.screen.rank}</p>
          <p className="punkte">{p.screen.score}</p>
          <p className="einordnung">
            {p.screen.rank === 1
              ? 'Ganz vorn.'
              : `${p.screen.deltaToAhead} zurück · von ${p.screen.playerCount}`}
          </p>
        </div>
      );
    case 'endstand':
      return (
        <div className={`vollbild ${p.screen.rank <= 3 ? 'sonne' : 'neutral'}`}>
          <p className="gross">Platz {p.screen.rank}</p>
          <p className="punkte">{p.screen.score}</p>
          <p className="einordnung">
            Platz {p.screen.rank} von {p.screen.playerCount}
          </p>
          <p className="einordnung">Danke fürs Mitspielen.</p>
        </div>
      );
    default:
      return (
        <div className="vollbild neutral">
          <p className="wort">Runde beendet</p>
        </div>
      );
  }
}

function CodeScreen(p: ViewProps): JSX.Element {
  const ready = p.code.length === 6;
  return (
    <>
      <div className="oben" />
      <div className="feld">
        <h1 className="marke">Quizbude</h1>
        <input
          key={`code-${p.shake}`}
          className={`code ${p.error !== null ? 'wackelt' : ''}`}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={6}
          value={p.code}
          aria-label="Spielcode"
          onChange={(e) => p.setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
        />
        {p.error !== null ? <p className="fehler">{p.error}</p> : null}
        <button
          className="aktion"
          type="button"
          disabled={!ready}
          onClick={() => {
            // Der Code wird erst beim Beitritt zusammen mit dem Namen geprüft.
            window.history.replaceState(null, '', `?code=${p.code}`);
            p.setScreen({ k: 'name' });
          }}
        >
          Weiter
        </button>
      </div>
      <div className="unten" />
    </>
  );
}

function NameScreen(p: ViewProps): JSX.Element {
  const ready = p.name.trim().length > 0;
  return (
    <>
      <div className="oben" />
      <div className="feld">
        <p className="frageText">Wie heißt du heute Abend?</p>
        <input
          key={`name-${p.shake}`}
          className={`name ${p.error !== null ? 'wackelt' : ''}`}
          maxLength={16}
          value={p.name}
          aria-label="Dein Name"
          onChange={(e) => p.setName(e.target.value)}
        />
        {p.error !== null ? <p className="fehler">{p.error}</p> : null}
        <button className="aktion" type="button" disabled={!ready} onClick={p.join}>
          Mitspielen
        </button>
      </div>
      <div className="unten">
        <span>Code {p.code}</span>
      </div>
    </>
  );
}

function FrageScreen(
  p: ViewProps & { screen: Extract<Screen, { k: 'frage' }> },
): JSX.Element {
  const s = p.screen;
  const announcing = p.now < s.announceUntil;
  const locked = p.now < s.answersOpenAt;
  const remaining = Math.max(0, s.answersCloseAt - p.now);
  const share = Math.max(0, Math.min(1, remaining / Math.max(1, s.answersCloseAt - s.answersOpenAt)));

  if (s.chosen !== null) {
    const slot = slotFor(s.chosen, s.tiles.tileCount);
    return (
      <div className={`vollbild ${slot}`}>
        <Shape slot={slot} size={160} />
        <p className="wort">Abgegeben</p>
        {p.answered !== null ? (
          <p className="einordnung">
            {p.answered.answered} von {p.answered.expected} sind fertig
          </p>
        ) : null}
      </div>
    );
  }

  if (announcing) {
    return (
      <>
        <div className="oben">Frage {s.tiles.seq + 1} von {s.tiles.total}</div>
        <div className="feld">
          <p className="gross">{s.tiles.seq + 1}</p>
          <p className="einordnung">Schau nach vorn.</p>
        </div>
        <div className="unten" />
      </>
    );
  }

  const indices = Array.from({ length: s.tiles.tileCount }, (_, i) => i);
  return (
    <>
      <div className="oben">
        {locked ? (
          'LESEN'
        ) : (
          <span className="zeitleiste">
            <i style={{ width: `${share * 100}%` }} />
          </span>
        )}
      </div>
      <div className={`kacheln ${s.tiles.layout}`}>
        {indices.map((i) => {
          const slot = slotFor(i, s.tiles.tileCount);
          return (
            <button
              key={`${i}-${locked ? p.shake : 0}`}
              type="button"
              className={`kachel ${slot} ${locked ? 'gesperrt' : ''} ${p.shake > 0 && locked ? 'gewackelt' : ''}`}
              aria-label={SLOT_LABEL[slot]}
              onClick={() => p.answer(i)}
            >
              <Shape slot={slot} size={72} />
            </button>
          );
        })}
      </div>
      <div className="unten">
        <span>{p.me.displayName}</span>
        <span>{p.me.score}</span>
      </div>
    </>
  );
}

function ErgebnisScreen({
  screen,
}: {
  screen: Extract<Screen, { k: 'ergebnis' }>;
}): JSX.Element {
  const kind = !screen.answered
    ? 'neutral'
    : screen.late
      ? 'neutral'
      : screen.correct
        ? 'richtig'
        : 'falsch';
  const wort = !screen.answered
    ? 'Keine Antwort'
    : screen.late
      ? 'Zu spät'
      : screen.correct
        ? 'Richtig'
        : 'Daneben';
  const glyph = !screen.answered || screen.late ? '–' : screen.correct ? '✓' : '✕';

  return (
    <div className={`vollbild ${kind}`}>
      <span className="glyph">{glyph}</span>
      <p className="wort">{wort}</p>
      <p className="punkte">+{screen.points}</p>
      <p className="einordnung">
        Platz {screen.rank}
        {screen.deltaToAhead > 0 ? ` · ${screen.deltaToAhead} zurück` : ''}
      </p>
    </div>
  );
}
