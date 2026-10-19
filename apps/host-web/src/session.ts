/**
 * Der Raum wird genau einmal je Sitzung erzeugt.
 *
 * `socket.io-client` verbindet sich selbsttaetig wieder und feuert `connect`
 * bei JEDER Wiederverbindung. Ein zweites `host:create` legte einen zweiten
 * Raum an: die Buehne zeigt einen neuen Code und eine leere Lobby, die
 * Spielergeraete haengen im alten Raum, dessen Host nie wieder weiterschaltet.
 * Die Runde waere nicht pausiert, sondern tot.
 *
 * Das hier verhindert das doppelte Anlegen - es ist kein Wiedereinstieg.
 * Ein Reconnect-Mechanismus gehoert ausdruecklich nicht in den Durchstich.
 */

/** Nur der Ausschnitt des Sockets, den die Sitzung braucht. */
export interface ConnectSource {
  on(event: 'connect', listener: () => void): unknown;
}

export function createRoomOnce(source: ConnectSource, create: () => void): void {
  let created = false;
  source.on('connect', () => {
    if (created) return;
    created = true;
    create();
  });
}
