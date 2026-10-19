import { afterEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './harness.js';

/**
 * B2: Eine einzelne fremde Nachricht darf den Prozess nicht beenden.
 *
 * `cors: { origin: true }` erlaubt jeder Webseite den Socket-Aufbau. Alles,
 * was hier ankommt, ist fremde Eingabe - und am Prozess haengt der gesamte
 * Spielzustand jeder laufenden Runde.
 */

let harness: Harness | null = null;

afterEach(async () => {
  if (harness !== null) {
    await harness.close();
    harness = null;
  }
});

/** Beweist, dass der Server noch Nachrichten beantwortet. */
async function istAmLeben(h: Harness): Promise<boolean> {
  const probe = await h.client();
  probe.sendRaw({ t: 'clock:ping', seq: 99, clientTime: 1 });
  const pong = await probe.await('clock:pong', 2_000);
  probe.close();
  return pong.seq === 99;
}

describe('Gateway - Eingangsvalidierung am Transportrand', () => {
  it('ueberlebt player:join mit roomCode als Zahl und laesst die Runde bestehen', async () => {
    const h = await startHarness();
    harness = h;

    const host = await h.client();
    host.sendRaw({ t: 'host:create' });
    const created = await host.await('room:created');
    expect(created.roomCode).toHaveLength(6);

    // Drei Zeilen in der Browserkonsole: weder Raumcode noch Beitritt noetig.
    const angreifer = await h.client();
    angreifer.sendRaw({ t: 'player:join', roomCode: 123456, displayName: 'Mallory' });

    // Die Nachricht wird VERWORFEN, nicht erst tief im Server zum Fehler:
    // derselbe Socket bekommt danach noch eine Antwort.
    angreifer.sendRaw({ t: 'clock:ping', seq: 7, clientTime: 1 });
    expect((await angreifer.await('clock:pong', 2_000)).seq).toBe(7);
    expect(angreifer.socket.connected).toBe(true);

    expect(await istAmLeben(h)).toBe(true);

    // Die Runde steht noch: ein echter Spieler kommt in denselben Raum.
    const spieler = await h.client();
    spieler.sendRaw({ t: 'player:join', roomCode: created.roomCode, displayName: 'Anna' });
    const joined = await spieler.await('player:joined');
    expect(joined.roomCode).toBe(created.roomCode);
    expect(joined.displayName).toBe('Anna');
    expect(h.registry.byCode(created.roomCode)?.state.players.size).toBe(1);
  });

  it('verwirft jede missgebildete Nachrichtenform, ohne zu sterben', async () => {
    const h = await startHarness();
    harness = h;

    const boeswillig = await h.client();
    const muell: readonly unknown[] = [
      null,
      42,
      'player:join',
      [],
      {},
      { t: 42 },
      { t: 'player:join' },
      { t: 'player:join', roomCode: null, displayName: 'x' },
      { t: 'player:join', roomCode: {}, displayName: [] },
      { t: 'host:start' },
      { t: 'host:start', expectedPhase: 'KEINE_PHASE' },
      { t: 'host:advance', expectedPhase: 7 },
      { t: 'player:answer', questionSeq: '0', optionIndex: 0 },
      { t: 'player:answer', questionSeq: 0, optionIndex: 1.5 },
      { t: 'player:answer', questionSeq: Number.NaN, optionIndex: 0 },
      { t: 'clock:ping', seq: 'eins', clientTime: 0 },
      { t: 'clock:ping', seq: 1, clientTime: Number.POSITIVE_INFINITY },
      { t: 'clock:pong', seq: null },
      { t: 'es:gibt:mich:nicht' },
    ];
    for (const payload of muell) boeswillig.sendRaw(payload);

    // Jede davon wird verworfen - die Verbindung traegt weiter.
    boeswillig.sendRaw({ t: 'clock:ping', seq: 11, clientTime: 1 });
    expect((await boeswillig.await('clock:pong', 2_000)).seq).toBe(11);
    expect(boeswillig.socket.connected).toBe(true);

    expect(await istAmLeben(h)).toBe(true);
  });

  it('ein Fehler in der Verarbeitung kostet die Verbindung, nicht den Server', async () => {
    const h = await startHarness();
    harness = h;

    const host = await h.client();
    host.sendRaw({ t: 'host:create' });
    const created = await host.await('room:created');

    // Stellvertreter fuer jeden inneren Fehler: die Registry wirft.
    h.registry.byCode = (): never => {
      throw new Error('Probe: innerer Fehler');
    };

    const opfer = await h.client();
    const getrennt = new Promise<void>((resolve) => {
      opfer.socket.on('disconnect', () => resolve());
    });
    opfer.sendRaw({ t: 'player:join', roomCode: created.roomCode, displayName: 'Anna' });

    await getrennt;
    expect(opfer.socket.connected).toBe(false);
    expect(await istAmLeben(h)).toBe(true);
  });
});
