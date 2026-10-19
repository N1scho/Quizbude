import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRoomOnce, type ConnectSource } from '../../apps/host-web/src/session.js';

/**
 * E1: Ein kurzer Verbindungsabriss der Buehne darf keinen zweiten Raum
 * anlegen. `socket.io-client` feuert `connect` bei jeder Wiederverbindung.
 */

function fakeSocket(): { source: ConnectSource; connect: () => void } {
  const listeners: (() => void)[] = [];
  return {
    source: {
      on(event: 'connect', listener: () => void): unknown {
        if (event === 'connect') listeners.push(listener);
        return undefined;
      },
    },
    connect: () => {
      for (const l of [...listeners]) l();
    },
  };
}

describe('Raum genau einmal je Sitzung', () => {
  it('erzeugt den Raum bei der ersten Verbindung', () => {
    const socket = fakeSocket();
    let erzeugt = 0;
    createRoomOnce(socket.source, () => {
      erzeugt += 1;
    });
    expect(erzeugt).toBe(0);
    socket.connect();
    expect(erzeugt).toBe(1);
  });

  it('erzeugt bei jeder Wiederverbindung KEINEN zweiten Raum', () => {
    const socket = fakeSocket();
    let erzeugt = 0;
    createRoomOnce(socket.source, () => {
      erzeugt += 1;
    });
    socket.connect();
    socket.connect();
    socket.connect();
    socket.connect();
    expect(erzeugt).toBe(1);
  });

  it('haelt zwei Sitzungen auseinander', () => {
    const a = fakeSocket();
    const b = fakeSocket();
    const codes: string[] = [];
    createRoomOnce(a.source, () => codes.push('a'));
    createRoomOnce(b.source, () => codes.push('b'));
    a.connect();
    a.connect();
    b.connect();
    b.connect();
    expect(codes).toEqual(['a', 'b']);
  });

  it('die Buehne benutzt den Wachter auch wirklich', () => {
    const app = readFileSync(
      fileURLToPath(new URL('../../apps/host-web/src/App.tsx', import.meta.url)),
      'utf8',
    );
    expect(app).toContain("createRoomOnce(wire.socket, () => wire.send({ t: 'host:create' }))");
    // Ein roher connect-Handler in der Buehne waere genau der Rueckfall.
    expect(app).not.toMatch(/socket\.on\(\s*'connect'/);
  });
});
