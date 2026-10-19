import type { Server } from 'socket.io';
import type { Effect } from '@quizbude/core';
import { WIRE_CHANNEL, type PlayerId, type RoomCode } from '@quizbude/protocol';
import type { EffectSink } from '../../runtime/roomHandle.js';

export interface RoomChannels {
  readonly host: string;
  readonly players: string;
  readonly player: (playerId: PlayerId) => string;
}

/**
 * Effect{send} auf emit. Die Audience ist der ganze Vertrag - ein zweites
 * Frontend liefert hier einen zweiten Adapter und core merkt davon nichts.
 */
export function makeEffectSink(io: Server, code: RoomCode, channels: RoomChannels): EffectSink {
  return (effect: Effect): void => {
    switch (effect.kind) {
      case 'send': {
        const target =
          effect.to.scope === 'host'
            ? io.to(channels.host)
            : effect.to.scope === 'players'
              ? io.to(channels.players)
              : effect.to.scope === 'all'
                ? io.to(channels.host).to(channels.players)
                : io.to(channels.player(effect.to.playerId));
        target.emit(WIRE_CHANNEL, effect.message);
        return;
      }
      case 'persistRound':
      case 'persistFinal':
        // Ruling 4: keine Persistenz im Durchstich. Die Naht bleibt sichtbar.
        return;
      case 'closeRoom':
        // Der Raum bleibt bis zum Prozessende liegen; aufgeraeumt wird in main.
        console.info(`[quizbude] Raum ${code} beendet (${effect.reason})`);
        return;
      default:
        return;
    }
  };
}
