import type {
  EndReason,
  MonoMs,
  Phase,
  PlayerId,
  PlayerOrigin,
  PublicQuestionView,
  RankedPlayer,
  RoomCode,
} from '@quizbude/protocol';

/** Beim Anlegen fixiert, danach unveraenderlich. */
export interface RoomConfig {
  readonly roomCode: RoomCode;
  readonly hostToken: string;
  readonly quizTitle: string;
  readonly scoringMode: 'timed' | 'flat';
  readonly shuffleOptions: boolean;
  readonly rewardLayerId: string;
  /** Notbremse gegen Ressourcenerschoepfung, KEIN Produktlimit. 0 = aus. */
  readonly playerHardCap: number;
  readonly announceMs: number;
  readonly lateGraceMs: number;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly displayName: string;
  readonly origin: PlayerOrigin;
  readonly resumeToken: string;
  readonly connected: boolean;
  readonly joinedAt: MonoMs;
  readonly score: number;
  readonly correctCount: number;
  readonly answeredCount: number;
}

/** Eine Frage, wie sie beim Raumstart geladen wurde. */
export interface LoadedQuestion {
  readonly id: string;
  readonly type: string;
  readonly prompt: string;
  readonly timeLimitMs: number;
  readonly pointsFactor: number;
  /** Vollstaendige typspezifische Spezifikation inklusive Loesung. */
  readonly spec: unknown;
}

export interface LiveQuestion {
  readonly seq: number;
  readonly questionId: string;
  readonly type: string;
  readonly timeLimitMs: number;
  readonly pointsFactor: number;
  readonly units: number;
  readonly maxPoints: number;
  /** Verlaesst core nie vor dem Uebergang nach REVEAL. */
  readonly spec: unknown;
  /** Fuer die Buehne. Enthaelt strukturell keine Loesung. */
  readonly publicView: PublicQuestionView;
  /** Anzeigeindex -> kanonischer Index. Bleibt serverseitig. */
  readonly optionMapping: readonly number[];
  readonly readingWindowMs: number;
}

export interface AnswerRecord {
  readonly playerId: PlayerId;
  /** Angezeigter Kachelindex - nur fuer die Rueckmeldung ans Geraet. */
  readonly displayIndex: number;
  /** Kanonisierte, typspezifische Antwort. */
  readonly response: unknown;
  readonly receivedAt: MonoMs;
  readonly rawElapsedMs: number;
  readonly scoredElapsedMs: number;
  readonly correct: boolean;
  readonly late: boolean;
  readonly points: number;
}

interface BaseState {
  readonly config: RoomConfig;
  readonly players: ReadonlyMap<PlayerId, PlayerState>;
  /** Normalisierter Name -> Spieler. Haelt Namen im Raum eindeutig. */
  readonly nameIndex: ReadonlyMap<string, PlayerId>;
  readonly questions: readonly LoadedQuestion[];
  readonly startedAt: MonoMs | null;
  readonly lastInputAt: MonoMs;
  /** Jeder Zustandswechsel erhoeht ihn; veraltete Timer werden verworfen. */
  readonly timerGen: number;
  /** Zustand der Belohnungsschicht. core kennt nur den Typ, nicht den Inhalt. */
  readonly reward: unknown;
}

export interface LobbyState extends BaseState {
  readonly phase: 'LOBBY';
  readonly locked: boolean;
}

export interface PreviewState extends BaseState {
  readonly phase: 'PREVIEW';
  readonly question: LiveQuestion;
  readonly preparedAt: MonoMs;
  readonly announceUntil: MonoMs;
  readonly answersOpenAt: MonoMs;
}

export interface OpenState extends BaseState {
  readonly phase: 'OPEN';
  readonly question: LiveQuestion;
  /** Der einzige Nullpunkt der Zeitmessung. */
  readonly openedAt: MonoMs;
  readonly answersCloseAt: MonoMs;
  readonly answers: ReadonlyMap<PlayerId, AnswerRecord>;
  /** Gesetzt, sobald alle verbundenen Spieler geantwortet haben. */
  readonly settleAt: MonoMs | null;
}

export interface RevealState extends BaseState {
  readonly phase: 'REVEAL';
  readonly question: LiveQuestion;
  /** Nullpunkt der Zeitmessung der abgeschlossenen Frage. */
  readonly openedAt: MonoMs;
  readonly closedAt: MonoMs;
  readonly lateUntil: MonoMs;
  readonly answers: ReadonlyMap<PlayerId, AnswerRecord>;
  /** Vom Fragetyp-Handler aggregiert, beim Schliessen eingefroren. */
  readonly aggregate: unknown;
}

export interface ScoreboardState extends BaseState {
  readonly phase: 'SCOREBOARD';
  readonly afterSeq: number;
  readonly ranking: readonly RankedPlayer[];
}

export interface PodiumState extends BaseState {
  readonly phase: 'PODIUM';
  readonly ranking: readonly RankedPlayer[];
  readonly displayRanking: readonly RankedPlayer[];
  readonly endReason: EndReason;
}

export interface FinishedState extends BaseState {
  readonly phase: 'FINISHED';
  readonly endReason: EndReason;
}

export type GameState =
  | LobbyState
  | PreviewState
  | OpenState
  | RevealState
  | ScoreboardState
  | PodiumState
  | FinishedState;

export type { Phase };
