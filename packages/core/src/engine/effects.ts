import type { MonoMs, PlayerId, ServerMessage } from '@quizbude/protocol';
import type { TimerToken } from './events.js';

export type Audience =
  | { readonly scope: 'host' }
  | { readonly scope: 'players' }
  | { readonly scope: 'all' }
  | { readonly scope: 'player'; readonly playerId: PlayerId };

/**
 * Nachrichtenart und Empfaengerkreis sind aneinander gebunden.
 *
 * Vorher waren sie entkoppelt: welche Nachricht an wen ging, entschieden
 * handgeschriebene `scope`-Literale. Ein falsch gesetzter Scope - die
 * wahrscheinlichste Regression beim Hinzufuegen einer Nachricht - schob
 * Fragetext und Loesung aufs Spielergeraet, ohne einen einzigen Fehler.
 * Jetzt ist genau das ein Typfehler.
 */

/** Was nur die BUEHNE sehen darf: Fragetext, Antworttexte, Loesung. */
export type HostBoundMessage = Extract<ServerMessage, { t: `stage:${string}` | 'room:roster' }>;

/** Was an alle Spielergeraete geht: Kachelzahl und Anordnung, kein Text. */
export type PlayersBoundMessage = Extract<ServerMessage, { t: 'player:question_prepared' }>;

/** Was beide Seiten gleichzeitig brauchen: gemeinsame Uhr und Zaehlstand. */
export type AllBoundMessage = Extract<
  ServerMessage,
  { t: 'room:answers_open' | 'room:answer_count' | 'room:finished' }
>;

/** Was genau ein Geraet angeht: Quittung, Rang, eigenes Ergebnis. */
export type PlayerBoundMessage = Exclude<
  Extract<ServerMessage, { t: `player:${string}` }>,
  PlayersBoundMessage
>;

export type SendEffect =
  | {
      readonly kind: 'send';
      readonly to: { readonly scope: 'host' };
      readonly message: HostBoundMessage;
    }
  | {
      readonly kind: 'send';
      readonly to: { readonly scope: 'players' };
      readonly message: PlayersBoundMessage;
    }
  | {
      readonly kind: 'send';
      readonly to: { readonly scope: 'all' };
      readonly message: AllBoundMessage;
    }
  | {
      readonly kind: 'send';
      readonly to: { readonly scope: 'player'; readonly playerId: PlayerId };
      readonly message: PlayerBoundMessage;
    };

/**
 * Ein Effekt beschreibt eine Absicht, nicht ihre Ausfuehrung.
 * Ein zweites Frontend liefert einen zweiten Adapter, der Audience auf
 * seine Zustellwege abbildet - core merkt davon nichts.
 */
export type Effect =
  | SendEffect
  | { readonly kind: 'scheduleTimer'; readonly token: TimerToken; readonly atMono: MonoMs }
  | { readonly kind: 'cancelTimer'; readonly token: TimerToken }
  /**
   * Im Durchstich bewusst ohne Empfaenger (Ruling 4: keine Persistenz).
   * Der Effekt bleibt, weil die Zustandsmaschine ihn spezifiziert - die
   * Naht zur Persistenz kostet so null Zeilen und bleibt sichtbar.
   */
  | { readonly kind: 'persistRound'; readonly seq: number }
  | { readonly kind: 'persistFinal'; readonly reason: string }
  | { readonly kind: 'closeRoom'; readonly reason: string };
