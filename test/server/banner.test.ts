import { describe, expect, it } from 'vitest';
import { stageBanner } from '../../packages/server/src/runtime/banner.js';
import type { LanAddress } from '../../packages/server/src/runtime/network.js';

const ADRESSEN: readonly LanAddress[] = [
  { iface: 'Ethernet 6', address: '192.168.0.160', score: 2 },
  { iface: 'Ethernet 4', address: '192.168.56.1', score: -9 },
];

/** Ein Rechner mit nur dem Hyper-V-Standardschalter: -14, sonst nichts. */
const NUR_VIRTUELL: readonly LanAddress[] = [
  { iface: 'vEthernet (Default Switch)', address: '172.28.112.1', score: -14 },
];

const text = (zeilen: readonly string[]): string => zeilen.join('\n');

describe('Die Startmeldung', () => {
  /**
   * Nicht `localhost`: gebunden wird auf `0.0.0.0`, und unter Windows
   * loest `localhost` zuerst nach `::1` auf - dort lauscht niemand.
   */
  it('nennt die Buehne fuer diesen Bildschirm mit dem genommenen Port', () => {
    expect(text(stageBanner({ port: 3007, addresses: ADRESSEN, rooms: 0 }))).toContain(
      'http://127.0.0.1:3007/host/',
    );
  });

  it('nennt die Adresse fuer die Handys mit demselben Port', () => {
    expect(text(stageBanner({ port: 3007, addresses: ADRESSEN, rooms: 0 }))).toContain(
      'http://192.168.0.160:3007/play/',
    );
  });

  it('stellt den wahrscheinlichsten Kandidaten vor die Alternativen', () => {
    const t = text(stageBanner({ port: 3000, addresses: ADRESSEN, rooms: 0 }));
    const besterIndex = t.indexOf('192.168.0.160');
    const andererIndex = t.indexOf('192.168.56.1');
    expect(besterIndex).toBeGreaterThanOrEqual(0);
    expect(andererIndex).toBeGreaterThan(besterIndex);
  });

  it('nennt die Netzwerkkarte, damit ein Mensch die Vermutung pruefen kann', () => {
    const t = text(stageBanner({ port: 3000, addresses: ADRESSEN, rooms: 0 }));
    expect(t).toContain('Ethernet 6');
    expect(t).toContain('Ethernet 4');
  });

  it('sagt es, wenn gar keine Adresse gefunden wurde', () => {
    const t = text(stageBanner({ port: 3000, addresses: [], rooms: 0 }));
    expect(t).toContain('Keine Adresse im lokalen Netz');
    expect(t).not.toContain('/play/\n      (Netzwerkkarte');
  });

  /**
   * Der Fall, in dem die Heuristik nichts Besseres hat als eine Karte,
   * die sie selbst fuer virtuell haelt. Frueher stand sie da wie eine
   * echte Adresse - ohne Vorbehalt, ohne Alternative, ohne Hinweis auf
   * das WLAN. Ein Mensch konnte hier nicht einmal selbst waehlen.
   */
  it('sagt einen schwach bewerteten Kandidaten als Vermutung an, nicht als Tatsache', () => {
    const t = text(stageBanner({ port: 3000, addresses: NUR_VIRTUELL, rooms: 0 }));
    expect(t).toContain('http://172.28.112.1:3000/play/');
    expect(t).toContain('Wahrscheinlich');
    expect(t).toContain('virtuell');
    expect(t).toContain('WLAN');
    expect(t).not.toContain('Das tippen die Gaeste in ihr Handy:');
  });

  it('bleibt bei einem gut bewerteten Kandidaten bei der klaren Ansage', () => {
    const t = text(stageBanner({ port: 3000, addresses: ADRESSEN, rooms: 0 }));
    expect(t).toContain('Das tippen die Gaeste in ihr Handy:');
    expect(t).not.toContain('Wahrscheinlich');
    expect(t).not.toContain('virtuell');
  });

  it('spricht die Firewall an, bevor sie als Programmfehler durchgeht', () => {
    const t = text(stageBanner({ port: 3000, addresses: ADRESSEN, rooms: 0 }));
    expect(t).toContain('Firewall');
    expect(t).toContain('Privat');
  });

  it('bleibt bei reinem ASCII - die Konsole kennt nicht jede Codepage', () => {
    const t = text(stageBanner({ port: 3000, addresses: ADRESSEN, rooms: 2 }));
    const fremd = [...t].filter((z) => z.charCodeAt(0) > 126);
    expect(fremd).toEqual([]);
    const v = text(stageBanner({ port: 3000, addresses: NUR_VIRTUELL, rooms: 2 }));
    expect([...v].filter((z) => z.charCodeAt(0) > 126)).toEqual([]);
  });
});
