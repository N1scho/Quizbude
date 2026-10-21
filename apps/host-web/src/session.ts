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

/** Was die Buehne mit der Sitzung tun kann. */
export interface RoomSession<T> {
  /** Raum eroeffnen - oder darauf warten, dass die Leitung steht. */
  oeffne(arg: T): void;
  /**
   * Der Server hat die Sammlung abgelehnt (`room:error`). Erst damit ist
   * ein neuer Versuch wieder erlaubt.
   */
  abgelehnt(): void;
}

/**
 * Liefert die Sitzung. Solange ein Raum entsteht oder besteht, bleibt jeder
 * weitere Klick und jede Wiederverbindung folgenlos.
 *
 * B2: Der Riegel haengt am ABSENDEN, nicht am eingetroffenen
 * `room:created` - anders waere der Doppelklick-Schutz in genau dem
 * Zeitfenster offen, in dem er gebraucht wird: zwischen dem ersten Klick
 * und der ersten Antwort des Servers. Dafuer wird er in dem einen Fall
 * wieder geloest, in dem sicher kein Raum entstanden ist: der
 * ausdruecklichen Ablehnung. Vorher war der `room:error`-Pfad der Buehne
 * tot - der Nutzer kam zurueck auf den Fragen-Bildschirm, aenderte etwas,
 * klickte, und nichts wurde gesendet. Die Buehne hing in "Buehne verbindet
 * sich ..." bis zum Neuladen.
 *
 * Das hier bleibt kein Wiedereinstieg. Ein Reconnect-Mechanismus gehoert
 * ausdruecklich nicht in den Durchstich.
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
): RoomSession<T> {
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

  return {
    oeffne: (arg: T): void => {
      // Jeder Aufruf ueberschreibt den Wunsch. Sonst ginge nach einer
      // Ablehnung genau die korrigierte Fassung verloren.
      wunsch = { arg };
      vielleicht();
    },
    abgelehnt: (): void => {
      erzeugt = false;
      // Und der Wunsch geht mit: eine Wiederverbindung darf die abgelehnte
      // Sammlung nicht von sich aus noch einmal schicken. Der naechste
      // Klick setzt sie neu.
      wunsch = null;
    },
  };
}
