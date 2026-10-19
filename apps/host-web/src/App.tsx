import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type {
  Phase,
  PublicQuestionView,
  RankedPlayer,
  RevealView,
  RosterEntry,
  ServerMessage,
} from '@quizbude/protocol';
import { connect, type Wire } from './wire';
import { Shape, slotFor } from './shapes';

type Stage =
  | { k: 'connecting' }
  | { k: 'lobby' }
  | {
      k: 'question';
      q: PublicQuestionView;
      announceUntil: number;
      answersOpenAt: number;
      answersCloseAt: number;
    }
  | {
      k: 'reveal';
      q: PublicQuestionView;
      reveal: RevealView;
      answerCount: number;
      correctCount: number;
      playerCount: number;
    }
  | {
      k: 'scoreboard';
      afterSeq: number;
      top: readonly RankedPlayer[];
      othersCount: number;
      hasNext: boolean;
    }
  | { k: 'podium'; ranking: readonly RankedPlayer[] }
  | { k: 'finished' };

/** Rund 25 Kacheln passen in lesbarer Größe auf die Bühne (UX 1.1/B3). */
const NAME_TILE_LIMIT = 25;

export function App(): JSX.Element {
  const [stage, setStage] = useState<Stage>({ k: 'connecting' });
  const [code, setCode] = useState<string>('');
  const [roster, setRoster] = useState<readonly RosterEntry[]>([]);
  const [answered, setAnswered] = useState<{ answered: number; expected: number }>({
    answered: 0,
    expected: 0,
  });
  const wireRef = useRef<Wire | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const wire = connect((message: ServerMessage) => {
      switch (message.t) {
        case 'room:created':
          setCode(message.roomCode);
          setStage({ k: 'lobby' });
          return;
        case 'room:roster':
          setRoster(message.players);
          return;
        case 'stage:question_prepared':
          setAnswered({ answered: 0, expected: 0 });
          setStage({
            k: 'question',
            q: message.question,
            announceUntil: message.announceUntil,
            answersOpenAt: message.answersOpenAt,
            answersCloseAt: message.answersCloseAt,
          });
          return;
        case 'room:answer_count':
          setAnswered({ answered: message.answered, expected: message.expected });
          return;
        case 'stage:reveal':
          setStage({
            k: 'reveal',
            q: message.question,
            reveal: message.reveal,
            answerCount: message.answerCount,
            correctCount: message.correctCount,
            playerCount: message.playerCount,
          });
          return;
        case 'stage:scoreboard':
          setStage({
            k: 'scoreboard',
            afterSeq: message.afterSeq,
            top: message.top,
            othersCount: message.othersCount,
            hasNext: message.hasNextQuestion,
          });
          return;
        case 'stage:podium':
          setStage({ k: 'podium', ranking: message.ranking });
          return;
        case 'room:finished':
          setStage({ k: 'finished' });
          return;
        default:
          return;
      }
    });
    wireRef.current = wire;
    wire.socket.on('connect', () => wire.send({ t: 'host:create' }));
    return () => {
      wire.dispose();
      wireRef.current = null;
    };
  }, []);

  // Die gemeinsame Uhr treibt jede Phase der Frage — nicht ein eintreffendes Ereignis.
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

  const phase: Phase = useMemo(() => {
    switch (stage.k) {
      case 'lobby':
        return 'LOBBY';
      case 'question':
        return now >= stage.answersOpenAt ? 'OPEN' : 'PREVIEW';
      case 'reveal':
        return 'REVEAL';
      case 'scoreboard':
        return 'SCOREBOARD';
      case 'podium':
        return 'PODIUM';
      default:
        return 'FINISHED';
    }
  }, [stage, now]);

  const advance = useCallback(() => {
    const wire = wireRef.current;
    if (wire === null) return;
    if (stage.k === 'lobby') {
      if (roster.length === 0) return;
      wire.send({ t: 'host:start', expectedPhase: 'LOBBY' });
      return;
    }
    if (stage.k === 'reveal' || stage.k === 'scoreboard' || stage.k === 'podium') {
      wire.send({ t: 'host:advance', expectedPhase: phase });
    }
  }, [stage, phase, roster.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance]);

  return (
    <div className="buehne">
      <header className="kopf">
        <span className="marke">Quizbude</span>
        {stage.k === 'question' || stage.k === 'reveal' ? (
          <span>
            Frage {stage.q.seq + 1} / {stage.q.total}
            {stage.q.pointsFactor !== 1 ? ` · ${stage.q.pointsFactor}×` : ''}
          </span>
        ) : code !== '' && stage.k !== 'lobby' ? (
          <span>Code {code}</span>
        ) : null}
      </header>

      <main className="mitte">{renderStage(stage, now, answered, roster, code)}</main>

      <footer className="fuss">
        <span className="tastaturhinweis">
          {stage.k === 'lobby'
            ? 'Leertaste startet die Runde'
            : stage.k === 'question'
              ? 'Die Runde läuft'
              : 'Leertaste schaltet weiter'}
        </span>
        <button
          className="weiter"
          type="button"
          onClick={advance}
          disabled={
            (stage.k === 'lobby' && roster.length === 0) ||
            stage.k === 'question' ||
            stage.k === 'connecting' ||
            stage.k === 'finished'
          }
        >
          {buttonLabel(stage, roster.length)}
        </button>
      </footer>
    </div>
  );
}

function buttonLabel(stage: Stage, playerCount: number): string {
  switch (stage.k) {
    case 'connecting':
      return 'Verbinde …';
    case 'lobby':
      return playerCount === 0 ? 'Warte auf Spieler' : 'Runde starten';
    case 'question':
      return 'Läuft …';
    case 'reveal':
      return 'Zwischenstand';
    case 'scoreboard':
      return stage.hasNext ? 'Nächste Frage' : 'Endstand';
    case 'podium':
      return 'Runde beenden';
    default:
      return 'Beendet';
  }
}

function renderStage(
  stage: Stage,
  now: number,
  answered: { answered: number; expected: number },
  roster: readonly RosterEntry[],
  code: string,
): JSX.Element {
  switch (stage.k) {
    case 'connecting':
      return <p className="code-hinweis">Bühne verbindet sich …</p>;

    case 'lobby':
      return <Lobby roster={roster} code={code} />;

    case 'question':
      return <Question stage={stage} now={now} answered={answered} />;

    case 'reveal':
      return <Reveal stage={stage} />;

    case 'scoreboard':
      return <Board top={stage.top} othersCount={stage.othersCount} title="Zwischenstand" />;

    case 'podium':
      return (
        <Board
          top={stage.ranking.slice(0, 3)}
          othersCount={Math.max(0, stage.ranking.length - 3)}
          title="Endstand"
        />
      );

    default:
      return <p className="frage">Spiel beendet.</p>;
  }
}

function Lobby({ roster, code }: { roster: readonly RosterEntry[]; code: string }): JSX.Element {
  const shown = roster.slice(0, NAME_TILE_LIMIT);
  const hidden = roster.length - shown.length;
  return (
    <>
      <p className="code-hinweis">Code auf quizbude eingeben</p>
      <p className="code">{code === '' ? '······' : code}</p>
      <div className="namensraster">
        {shown.map((p) => (
          <span key={p.playerId} className={p.connected ? 'name' : 'name weg'}>
            {p.displayName}
          </span>
        ))}
      </div>
      <p className="code-hinweis">
        {roster.length === 0 ? 'Noch niemand dabei' : `${roster.length} dabei`}
        {hidden > 0 ? ` · und ${hidden} weitere` : ''}
      </p>
    </>
  );
}

function Question({
  stage,
  now,
  answered,
}: {
  stage: Extract<Stage, { k: 'question' }>;
  now: number;
  answered: { answered: number; expected: number };
}): JSX.Element {
  const announcing = now < stage.announceUntil;
  const reading = !announcing && now < stage.answersOpenAt;
  const open = now >= stage.answersOpenAt;

  const readProgress = reading
    ? (now - stage.announceUntil) / Math.max(1, stage.answersOpenAt - stage.announceUntil)
    : 1;
  const remaining = Math.max(0, Math.ceil((stage.answersCloseAt - now) / 1000));
  const totalSeconds = Math.ceil(stage.q.timeLimitMs / 1000);

  if (announcing) {
    return (
      <>
        <p className="ankuendigung">
          Frage {stage.q.seq + 1} / {stage.q.total}
        </p>
        <p className="code-hinweis">Schaut nach vorn.</p>
      </>
    );
  }

  return (
    <>
      <p className="frage">{stage.q.prompt}</p>
      {reading ? (
        <div className="lesebalken">
          <i style={{ width: `${Math.min(100, readProgress * 100)}%` }} />
        </div>
      ) : null}
      <div className={`kacheln ${stage.q.options.length <= 2 ? 'duo' : 'quad'}`}>
        {stage.q.options.map((o) => (
          <div key={o.index} className={`kachel ${slotFor(o.index, stage.q.options.length)}`}>
            <Shape slot={slotFor(o.index, stage.q.options.length)} />
            <span>{o.label}</span>
          </div>
        ))}
      </div>
      <div className="leiste">
        <div className={`ring ${reading ? 'steht' : remaining <= 5 ? 'eng' : ''}`}>
          {reading ? totalSeconds : remaining}
        </div>
        <div className="zaehler">
          {answered.answered}
          <small>{open ? 'haben geantwortet' : 'Lesen'}</small>
        </div>
      </div>
    </>
  );
}

function Reveal({ stage }: { stage: Extract<Stage, { k: 'reveal' }> }): JSX.Element {
  const max = Math.max(1, ...stage.reveal.distribution.map((d) => d.count));
  const correct = new Set(stage.reveal.correctIndices);
  return (
    <>
      <p className="code-hinweis">{stage.q.prompt}</p>
      <div className={`kacheln ${stage.q.options.length <= 2 ? 'duo' : 'quad'}`}>
        {stage.q.options.map((o) => {
          const count = stage.reveal.distribution.find((d) => d.index === o.index)?.count ?? 0;
          const slot = slotFor(o.index, stage.q.options.length);
          return (
            <div
              key={o.index}
              className={`kachel ${slot} ${correct.has(o.index) ? 'richtig' : 'falsch'}`}
            >
              <Shape slot={slot} />
              <span>{o.label}</span>
              <span className="marke-richtig">{correct.has(o.index) ? '✓' : '✕'}</span>
              <span className="balkenzahl">{count}</span>
              <span className="balken">
                <i style={{ width: `${(count / max) * 100}%` }} />
              </span>
            </div>
          );
        })}
      </div>
      <p className="code-hinweis">
        {stage.answerCount === 0
          ? 'Niemand hat geantwortet.'
          : stage.correctCount === 0
            ? 'Keiner. Respekt an die Frage.'
            : stage.correctCount === stage.playerCount
              ? 'Alle. Zu einfach.'
              : `${stage.correctCount} von ${stage.playerCount} richtig`}
      </p>
    </>
  );
}

function Board({
  top,
  othersCount,
  title,
}: {
  top: readonly RankedPlayer[];
  othersCount: number;
  title: string;
}): JSX.Element {
  return (
    <>
      <p className="code-hinweis">{title}</p>
      <div className="rangliste">
        {top.map((r) => (
          <div key={r.playerId} className={`rang ${r.rank === 1 ? 'eins' : ''}`}>
            <span className="platz">{r.rank}</span>
            <span>{r.displayName}</span>
            <span>{r.score}</span>
          </div>
        ))}
      </div>
      {othersCount > 0 ? <p className="weitere">und {othersCount} weitere</p> : null}
    </>
  );
}
