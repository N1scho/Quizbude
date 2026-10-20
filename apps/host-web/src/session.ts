/**
 * Der Raum wird genau einmal je Sitzung erzeugt - und erst auf Zuruf.
 *
 * `socket.io-client` verbindet sich selbsttaetig wieder und feuert `connect`
 * bei JEDER Wiederverbindung. Ein zweites `host:create` legte einen zweiten
 * Raum an: die Buehne zeigt einen neuen Code und eine leere Lobby, die
 * Spielergeraete haengen im alten Raum, dessen Host nie wieder weiterschaltet.
 * Die Runde waere nicht pausiert, sondern tot.
 *
 * Seit dem Fragen-Upload faellt die Entscheidung nicht mehr beim Verbinden,
 * sondern beim Klick nach dem Pruefbericht. Beides muss zusammenkommen:
 * die Leitung steht, und der Host hat den Raum gewollt. Was zuerst
 * eintrifft, wartet auf das andere.
 *
 * Das hier verhindert das doppelte Anlegen - es ist kein Wiedereinstieg.
 * Ein Reconnect-Mechanismus gehoert ausdruecklich nicht in den Durchstich.
 */

/** Nur der Ausschnitt des Sockets, den die Sitzung braucht. */
export interface ConnectSource {
  on(event: 'connect', listener: () => void): unknown;
}

/**
 * Liefert den Oeffner. Jeder Aufruf danach - und jede Wiederverbindung -
 * bleibt folgenlos: `create` laeuft hoechstens einmal.
 */
export function createRoomOnce<T>(
  source: ConnectSource,
  create: (arg: T) => void,
  /**
   * Wird bei jeder Verbindung gerufen. Die Buehne braucht das, um den
   * Oeffnen-Knopf freizugeben - und sie soll dafuer keinen eigenen
   * connect-Handler aufmachen: genau dort ist E1 schon einmal
   * zurueckgekehrt, waehrend alle Tore schwiegen.
   */
  onConnect: () => void = () => undefined,
): (arg: T) => void {
  let erzeugt = false;
  let verbunden = false;
  let wunsch: { readonly arg: T } | null = null;

  const vielleicht = (): void => {
    if (erzeugt || !verbunden || wunsch === null) return;
    erzeugt = true;
    create(wunsch.arg);
  };

  source.on('connect', () => {
    verbunden = true;
    onConnect();
    vielleicht();
  });

  return (arg: T): void => {
    if (wunsch === null) wunsch = { arg };
    vielleicht();
  };
}
