import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'socket.io';
import type { Effect } from '@quizbude/core';
import { WIRE_CHANNEL, asPlayerId, asRoomCode, type ServerMessage } from '@quizbude/protocol';
import {
  makeEffectSink,
  type RoomChannels,
} from '../../packages/server/src/transport/socketio/outbound.js';
import { startHarness, type Client, type Harness } from './harness.js';

/**
 * NR2: Das zentrale Gesetz - Fragetext, Antworttexte und Loesung gehen auf
 * die Buehne, nie auf ein Spielergeraet - haengt nach der Typkopplung aus E2
 * noch an genau einer ungeprueften Stelle: der Abbildung von
 * `effect.to.scope` auf die Socket.IO-Raeume in `outbound.ts`.
 *
 * Im Nachreview genuegte dort eine geaenderte Zeile - `scope === 'host'`
 * zusaetzlich an `channels.players` gehaengt -, damit Fragetext,
 * Antworttexte und Loesung an jedes Spielergeraet gingen, und kein Tor sagte
 * ein Wort. Dieser Test schliesst die Luecke von zwei Seiten:
 *
 *   1. unmittelbar an der Abbildung, mit einem aufzeichnenden `io`,
 *   2. am echten Server, mit echten Clients und echten Raeumen.
 */

// ===========================================================================
// 1. Die Abbildung selbst
// ===========================================================================

interface Zustellung {
  readonly raeume: readonly string[];
  readonly kanal: string;
  readonly message: unknown;
}

/** Ein `io`, das nur mitschreibt, an welche Raeume es zustellen wuerde. */
function schreibendesIo(): { io: Server; zustellungen: Zustellung[] } {
  const zustellungen: Zustellung[] = [];
  const operator = (raeume: readonly string[]): unknown => ({
    to: (raum: string): unknown => operator([...raeume, raum]),
    emit: (kanal: string, message: unknown): boolean => {
      zustellungen.push({ raeume, kanal, message });
      return true;
    },
  });
  const io = { to: (raum: string): unknown => operator([raum]) };
  return { io: io as unknown as Server, zustellungen };
}

const ANNA = asPlayerId('p-anna');
const BERND = asPlayerId('p-bernd');

const CHANNELS: RoomChannels = {
  host: 'raum#host',
  players: 'raum#players',
  player: (playerId) => 'raum#p#' + playerId,
};

/** Jeder Scope einmal, mit einer Nachricht, die der Typ dort zulaesst. */
const EFFEKTE: Readonly<Record<string, Effect>> = {
  host: {
    kind: 'send',
    to: { scope: 'host' },
    message: { t: 'room:roster', players: [], count: 0, softWarn: false },
  },
  players: {
    kind: 'send',
    to: { scope: 'players' },
    message: {
      t: 'player:question_prepared',
      tiles: { seq: 0, total: 2, tileCount: 4, layout: 'quad' },
      announceUntil: 1_000,
      answersOpenAt: 11_000,
      answersCloseAt: 31_000,
    },
  },
  all: {
    kind: 'send',
    to: { scope: 'all' },
    message: { t: 'room:finished' },
  },
  player: {
    kind: 'send',
    to: { scope: 'player', playerId: ANNA },
    message: { t: 'player:answer_ack', seq: 0, optionIndex: 1, late: false },
  },
};

function zustellungFuer(effect: Effect): Zustellung {
  const { io, zustellungen } = schreibendesIo();
  makeEffectSink(io, asRoomCode('ABC123'), CHANNELS)(effect);
  expect(zustellungen).toHaveLength(1);
  return zustellungen[0] as Zustellung;
}

describe('Audience auf Socket.IO-Raeume', () => {
  it('stellt scope host ausschliesslich in den Buehnenraum zu', () => {
    const z = zustellungFuer(EFFEKTE.host as Effect);
    expect(z.raeume).toEqual([CHANNELS.host]);
    expect(z.kanal).toBe(WIRE_CHANNEL);
  });

  it('stellt scope players ausschliesslich in den Spielerraum zu', () => {
    expect(zustellungFuer(EFFEKTE.players as Effect).raeume).toEqual([CHANNELS.players]);
  });

  it('stellt scope all an Buehne UND Spieler zu, an beide genau einmal', () => {
    const raeume = zustellungFuer(EFFEKTE.all as Effect).raeume;
    expect([...raeume].sort()).toEqual([CHANNELS.host, CHANNELS.players].sort());
    expect(raeume).toHaveLength(2);
  });

  it('stellt scope player ausschliesslich in den Raum genau dieses Geraets zu', () => {
    expect(zustellungFuer(EFFEKTE.player as Effect).raeume).toEqual([CHANNELS.player(ANNA)]);
    // Und nicht etwa in den eines anderen Geraets.
    expect(CHANNELS.player(ANNA)).not.toBe(CHANNELS.player(BERND));
  });

  it('laesst den Spielerraum nur bei players und all zu', () => {
    // Die Umkehrung der Tabelle: genau hier sass die Mutation des
    // Nachreviews. Haengt irgendein anderer Scope `channels.players` mit an,
    // faellt diese Zeile.
    const mitSpielerraum = Object.entries(EFFEKTE)
      .filter(([, effect]) => zustellungFuer(effect).raeume.includes(CHANNELS.players))
      .map(([scope]) => scope)
      .sort();
    expect(mitSpielerraum).toEqual(['all', 'players']);
  });

  it('reicht Nachricht und Kanal unveraendert durch', () => {
    const z = zustellungFuer(EFFEKTE.host as Effect);
    expect(z.message).toEqual({ t: 'room:roster', players: [], count: 0, softWarn: false });
  });
});

// ===========================================================================
// 2. Dieselbe Abbildung am echten Server
// ===========================================================================

let harness: Harness | null = null;

afterEach(async () => {
  if (harness !== null) {
    await harness.close();
    harness = null;
  }
});

/** Schreibt JEDE Nachricht mit, die an diesem Geraet ankommt. */
function mitschnitt(client: Client): ServerMessage[] {
  const alle: ServerMessage[] = [];
  client.socket.on(WIRE_CHANNEL, (message: ServerMessage) => {
    alle.push(message);
  });
  return alle;
}

/**
 * Sperre: nach dem Pong ist jede Nachricht zugestellt, die der Server vor
 * dem Ping auf denselben Socket geschrieben hat - Socket.IO haelt die
 * Reihenfolge je Verbindung. Ohne diese Sperre koennte die Pruefung vor dem
 * Leck laufen und waere still gruen.
 */
async function sperre(client: Client, seq: number): Promise<void> {
  client.sendRaw({ t: 'clock:ping', seq, clientTime: 1 });
  expect((await client.await('clock:pong', 2_000)).seq).toBe(seq);
}

describe('Empfaengerkreis am echten Server', () => {
  it('haelt Buehnen-, Spieler- und Geraetenachrichten auseinander', async () => {
    const h = await startHarness();
    harness = h;

    const buehne = await h.client();
    const buehneSah = mitschnitt(buehne);
    buehne.sendRaw({ t: 'host:create' });
    const created = await buehne.await('room:created');

    // ZWEI Spieler: erst dadurch ist Anna schon im Spielerraum, wenn Bernds
    // Beitritt die naechste Roster-Nachricht an die Buehne ausloest.
    const anna = await h.client();
    const annaSah = mitschnitt(anna);
    anna.sendRaw({ t: 'player:join', roomCode: created.roomCode, displayName: 'Anna' });
    expect((await anna.await('player:joined')).displayName).toBe('Anna');

    const bernd = await h.client();
    const berndSah = mitschnitt(bernd);
    bernd.sendRaw({ t: 'player:join', roomCode: created.roomCode, displayName: 'Bernd' });
    expect((await bernd.await('player:joined')).displayName).toBe('Bernd');

    buehne.sendRaw({ t: 'host:start', expectedPhase: 'LOBBY' });
    const frage = await buehne.await('stage:question_prepared');
    await anna.await('player:question_prepared');
    await bernd.await('player:question_prepared');

    await sperre(buehne, 91);
    await sperre(anna, 92);
    await sperre(bernd, 93);

    const arten = (alle: readonly ServerMessage[]): string[] => [...new Set(alle.map((m) => m.t))];

    // Der Test prueft ueberhaupt etwas: alle drei Arten sind geflossen.
    expect(arten(buehneSah)).toContain('stage:question_prepared');
    expect(arten(buehneSah)).toContain('room:roster');
    expect(arten(annaSah)).toContain('player:question_prepared');

    // Das Gesetz selbst, am Text statt an der Nachrichtenart, und bewusst
    // VOR den Pruefungen auf Nachrichtenart: was die Buehne an Frage- und
    // Antworttext bekommen hat, steht in keiner einzigen Nutzlast eines
    // Spielergeraets. Das ist die Ursache, alles danach ist die Form.
    const verboten = new Set<string>([
      frage.question.prompt,
      ...frage.question.options.map((o) => o.label),
    ]);
    expect(verboten.size).toBeGreaterThan(4);
    const lecks: string[] = [];
    for (const [wer, alle] of [
      ['Anna', annaSah],
      ['Bernd', berndSah],
    ] as const) {
      for (const message of alle) {
        const nutzlast = JSON.stringify(message);
        for (const text of verboten) {
          if (nutzlast.includes(text)) lecks.push(wer + ' sah in ' + message.t + ': "' + text + '"');
        }
      }
    }
    expect(lecks).toEqual([]);

    // scope host: nichts davon auf einem Spielergeraet.
    expect(annaSah.filter((m) => m.t.startsWith('stage:') || m.t === 'room:roster')).toEqual([]);
    expect(berndSah.filter((m) => m.t.startsWith('stage:') || m.t === 'room:roster')).toEqual([]);

    // scope players: die Kachelnachricht geht nicht an die Buehne.
    expect(buehneSah.filter((m) => m.t === 'player:question_prepared')).toEqual([]);

    // scope player: genau ein Geraet, nicht das Nachbargeraet.
    expect(annaSah.filter((m) => m.t === 'player:joined')).toHaveLength(1);
    expect(berndSah.filter((m) => m.t === 'player:joined')).toHaveLength(1);
    expect(buehneSah.filter((m) => m.t === 'player:joined')).toEqual([]);

  });
});
