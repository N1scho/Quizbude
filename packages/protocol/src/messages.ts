import type { PlayerId, Phase, RoomCode } from './ids.js';
import type {
  PlayerTileSpec,
  PublicQuestionView,
  RankedPlayer,
  RevealView,
  RewardView,
  RosterEntry,
} from './views.js';

/** Der eine Socket.IO-Kanal, ueber den beide Richtungen laufen. */
export const WIRE_CHANNEL = 'quizbude';

// ===========================================================================
// Client -> Server
// ===========================================================================

/**
 * Eine hochgeladene Fragensammlung, wie die Buehne sie nach dem
 * Pruefbericht mitschickt.
 *
 * `questions` ist bewusst `unknown`: geprueft und normalisiert werden die
 * Fragen von `loadQuestion` in core - der einen Tuer, an der keine Grenze
 * vergessen werden kann. Der Transportrand prueft nur Form und Anzahl.
 * Eine zweite, flachere Pruefung daneben waere genau die Stelle, an der
 * eine Grenze spaeter auseinanderlaeuft.
 */
export interface QuizPayload {
  readonly title: string;
  readonly questions: readonly unknown[];
}

export type ClientMessage =
  /** Ohne `quiz` spielt der Raum die Demorunde des Servers. */
  | { readonly t: 'host:create'; readonly quiz?: QuizPayload }
  | { readonly t: 'host:start'; readonly expectedPhase: Phase }
  | { readonly t: 'host:advance'; readonly expectedPhase: Phase }
  | { readonly t: 'player:join'; readonly roomCode: string; readonly displayName: string }
  | {
      readonly t: 'player:answer';
      readonly questionSeq: number;
      /** Angezeigter Kachelindex. Nie eine Zeit, nie eine Punktzahl. */
      readonly optionIndex: number;
    }
  /** Client misst seinen eigenen Uhren-Offset. Der Server echot nur zurueck. */
  | { readonly t: 'clock:ping'; readonly seq: number; readonly clientTime: number }
  /** Antwort auf den serverseitigen Ping. Der Server misst die Umlaufzeit selbst. */
  | { readonly t: 'clock:pong'; readonly seq: number };

// ===========================================================================
// Server -> Client
// ===========================================================================

export type JoinRejectReason =
  | 'unknown_room'
  | 'name_taken'
  | 'name_invalid'
  | 'locked'
  | 'capacity'
  | 'finished';

export type AnswerRejectReason =
  | 'not_open'
  | 'closed'
  | 'wrong_phase'
  | 'wrong_question'
  | 'unknown_player'
  | 'malformed'
  | 'out_of_range'
  | 'empty'
  | 'too_many_selections';

export type ServerMessage =
  // --- Raum und Lobby -----------------------------------------------------
  | {
      readonly t: 'room:created';
      readonly roomCode: RoomCode;
      readonly hostToken: string;
      readonly quizTitle: string;
      readonly questionCount: number;
      readonly serverTimeMs: number;
    }
  | {
      readonly t: 'room:roster';
      readonly players: readonly RosterEntry[];
      readonly count: number;
      readonly softWarn: boolean;
    }
  | {
      readonly t: 'player:joined';
      readonly playerId: PlayerId;
      readonly resumeToken: string;
      readonly roomCode: RoomCode;
      readonly displayName: string;
      readonly phase: Phase;
      readonly serverTimeMs: number;
    }
  | { readonly t: 'player:join_rejected'; readonly reason: JoinRejectReason }

  // --- Frage --------------------------------------------------------------
  | {
      readonly t: 'stage:question_prepared';
      readonly question: PublicQuestionView;
      /** Gemeinsame Uhr: bis hierhin laeuft die Ankuendigung. */
      readonly announceUntil: number;
      /** Gemeinsame Uhr: ab hier sind Antworten offen. */
      readonly answersOpenAt: number;
      readonly answersCloseAt: number;
      readonly readingWindowMs: number;
    }
  | {
      readonly t: 'player:question_prepared';
      readonly tiles: PlayerTileSpec;
      readonly announceUntil: number;
      readonly answersOpenAt: number;
      readonly answersCloseAt: number;
    }
  | { readonly t: 'room:answers_open'; readonly seq: number; readonly answersCloseAt: number }
  | {
      readonly t: 'room:answer_count';
      readonly seq: number;
      readonly answered: number;
      readonly expected: number;
    }
  | {
      readonly t: 'player:answer_ack';
      readonly seq: number;
      readonly optionIndex: number;
      readonly late: boolean;
    }
  | {
      readonly t: 'player:answer_rejected';
      readonly seq: number;
      readonly reason: AnswerRejectReason;
    }

  // --- Aufloesung ---------------------------------------------------------
  | {
      readonly t: 'stage:reveal';
      readonly question: PublicQuestionView;
      readonly reveal: RevealView;
      readonly answerCount: number;
      readonly correctCount: number;
      readonly playerCount: number;
    }
  | {
      readonly t: 'player:question_result';
      readonly seq: number;
      readonly answered: boolean;
      readonly correct: boolean;
      readonly late: boolean;
      readonly points: number;
      readonly totalScore: number;
      readonly rank: number;
      readonly deltaToAhead: number;
    }

  // --- Zwischenstand und Ende ---------------------------------------------
  | {
      readonly t: 'stage:scoreboard';
      readonly afterSeq: number;
      readonly top: readonly RankedPlayer[];
      readonly othersCount: number;
      readonly hasNextQuestion: boolean;
      readonly reward: RewardView;
    }
  | {
      readonly t: 'player:scoreboard';
      readonly rank: number;
      readonly score: number;
      readonly deltaToAhead: number;
      readonly playerCount: number;
    }
  | { readonly t: 'stage:podium'; readonly ranking: readonly RankedPlayer[] }
  | {
      readonly t: 'player:podium';
      readonly rank: number;
      readonly score: number;
      readonly playerCount: number;
    }
  | { readonly t: 'room:finished' }

  // --- Uhr und Fehler -----------------------------------------------------
  | {
      readonly t: 'clock:pong';
      readonly seq: number;
      readonly clientTime: number;
      readonly serverTimeMs: number;
    }
  | { readonly t: 'clock:ping'; readonly seq: number; readonly serverTimeMs: number }
  | { readonly t: 'room:error'; readonly code: string; readonly message: string };
