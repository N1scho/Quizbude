# Haltepunkt — 2026-10-20, Abend

Die Sitzung wurde mitten im Review des Fragen-Uploads beendet. Dieses Dokument ist
der Einstieg beim Wiederaufnehmen; `STAND.md` bleibt die vollstaendige Uebergabe.

## Zustand, selbst nachgemessen

```
HEAD            42ade60 auf durchstich (nicht nach main gemerged)
npm test        276 Tests, 26 Dateien, Exit 0
npx tsc         Exit 0
npm run build   Exit 0
Arbeitsbaum     sauber bis auf docs/proben-abbruch/
```

## Was fertig ist

Durchstich mit drei Fix-Wellen und je eigenem Nachreview. Ein-Klick-Start per
Doppelklick auf `quizbude-starten.cmd`, inklusive vierter Welle (blockierender
IPv4-Befund behoben, Startentscheidungen in `runtime/startup.ts` gebunden).
Fragen-Upload in beiden Fassungen mit einem Parser in `packages/core`.

## Der naechste Schritt, genau hier weitermachen

**Das Review des Fragen-Uploads (Diff `c344c06..42ade60`) ist unvollstaendig
abgebrochen.** Es gibt keinen Bericht; `docs/review-fragen-upload.md` fehlt.
Neu beauftragen, frischer Agent, rein lesend.

**Der Pruefer sass zuletzt an der wichtigsten Stelle.** Seine beiden unfertigen
Proben liegen in `docs/proben-abbruch/` (als `.txt` geparkt, damit sie nicht als
Tests laufen — zum Wiederbeleben nach `test/` zurueckkopieren und auf `.test.ts`
enden lassen):

- `probe-transportrand.ts.txt` — die heisse Spur: ein `host:create` mit einem
  Titel ueber 256 Zeichen scheint **weder** `room:created` **noch** `room:error`
  zu erzeugen. Ein stiller Abwurf am Transportrand waere ein Befund. Das ist der
  erste Pruefpunkt beim Neustart.
- `probe-parser-ki-ausgaben.ts.txt` — Parser gegen echte KI-Ausgabe (Vorwort,
  Code-Zaun, Nummerierung, `A)`, Fett im Fragetext, Haekchen).

Die uebrigen Schwerpunkte des abgebrochenen Auftrags: Autorisierung am
Transportrand (darf ein Spielergeraet der Buehne ein Quiz unterschieben?),
Escaping in beiden Fassungen, der Riegel gegen Auseinanderlaufen
(`tools/standalone-parser.mjs`), Zeilennummern in Fehlermeldungen nach entferntem
Vorwort, und ob die Oberflaechen gebunden sind oder nur die reinen Funktionen.

## Danach

`standalone/quizbude.html` ist geaendert und committet, aber **noch nicht neu
veroeffentlicht**. Unter dem Link
https://claude.ai/artifact/GSSnCM9puxxFsuSJPasZ8j laeuft weiterhin die alte,
funktionierende Fassung ohne Upload. Neu veroeffentlichen erst nach dem Review.

Danach die zweite Welle: SQLite, Reconnect mit Sitzungstoken, Auswertungsseite,
QR-Code.

## Was keine Maschine beantwortet

Gespielt hat es niemand. Offen bleiben der Doppelklick aus dem Explorer, der
Firewall-Dialog, ein echtes Gasthandy im WLAN und die Frage, ob sich zehn
Sekunden Lesezeit auf der Leinwand richtig anfuehlen.
