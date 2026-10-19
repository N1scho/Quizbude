import type { MonoMs, PlayerId, ServerMessage } from '@quizbude/protocol';
import type { TimerToken } from './events.js';

export type Audience =
  | { readonly scope: 'host' }
  | { readonly scope: 'players' }
  | { readonly scope: 'all' }
  | { readonly scope: 'player'; readonly playerId: PlayerId };

/**
 * Ein Effekt beschreibt eine Absicht, nicht ihre Ausfuehrung.
 * Ein zweites Frontend liefert einen zweiten Adapter, der Audience auf
 * seine Zustellwege abbildet - core merkt davon nichts.
 */
export type Effect =
  | { readonly kind: 'send'; readonly to: Audience; readonly message: ServerMessage }
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
