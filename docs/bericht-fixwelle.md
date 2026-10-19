# Bericht — Fix-Welle Durchstich Quizbude

**Stand:** 2026-10-19 · **Branch:** `durchstich` · **Ausgangspunkt:** `2d14013` · **Ende:** `2e006c6`
**Umfang:** die sechs Befunde aus `docs/review-durchstich.md`, eine Welle, sieben Commits.

---

## 0. Kurzfassung

Alle sechs Befunde sind behoben. Für jeden liegt ein Test vor, der ohne den Fix rot wird; jede
Rücknahmeprobe ist einzeln gefahren und unten mit Testname und Anzahl roter Tests belegt. Die beiden
blockierenden Fälle sind am gebauten, laufenden Server nachgestellt: der Prozess lebt danach weiter,
und die laufende Runde besteht.

Das Paket `server` hatte keine Tests. Es hat jetzt 36, verteilt auf drei Dateien, darunter eine
Prüfung gegen einen echten HTTP- und Socket.IO-Server mit echten Clients.

| Tor | Vorher | Nachher |
|---|---|---|
| `npm test` | 46 Tests, 4 Dateien, Exit 0 | **94 Tests, 10 Dateien, Exit 0** |
| `npx tsc --noEmit` | Exit 0 | Exit 0 |
| `npm run build` | Exit 0 | Exit 0 |
| `git status --short` | zwei unverfolgte Pfade | dieselben zwei unverfolgten Pfade |

---

## 1. B2 — Eingangsvalidierung am Transportrand

**Ursache.** `const msg = raw as ClientMessage` erklärte die gesamte Nachrichten-Union für
vertrauenswürdig, geprüft wurde danach nur das Feld `t`, und ein `player:join` mit `roomCode: 123456`
erreichte ungeprüft `normalizeCode`, wo `raw.toUpperCase()` einen `TypeError` warf — ohne `try/catch`
war das das Ende des Prozesses und damit jeder laufenden Runde.

**Änderung.** `packages/server/src/transport/socketio/validate.ts` prüft jede der sieben
Nachrichtenformen vollständig und gibt bei jeder Abweichung `null` zurück; der Aufrufer verwirft die
Nachricht wortlos. Zeichenkettenfelder sind auf 256 Zeichen begrenzt, Zahlenfelder auf sichere
Ganzzahlen, `expectedPhase` auf die sieben bekannten Phasen. Der Kanal-Handler in `gateway.ts` legt
zusätzlich ein `try/catch` um die Verarbeitung: ein Fehler kostet diese eine Verbindung, nie den
Server.

**Bindende Tests.** `test/server/gateway.test.ts` (3 Tests gegen einen echten Server),
`test/server/validate.test.ts` (23 Tests über die Tabelle der Formen).

| Rücknahmeprobe | Ergebnis |
|---|---|
| Validierung entfernt, `try/catch` bleibt | **2 Tests rot**: „ueberlebt player:join mit roomCode als Zahl und laesst die Runde bestehen", „verwirft jede missgebildete Nachrichtenform, ohne zu sterben" |
| `try/catch` entfernt, Validierung bleibt | **1 Test rot**: „ein Fehler in der Verarbeitung kostet die Verbindung, nicht den Server"; vitest meldet zusätzlich eine Uncaught Exception |

Der Unterschied zwischen beiden Hälften ist absichtlich prüfbar gemacht: eine **ungültige** Nachricht
wird verworfen und kostet nicht einmal die Verbindung — derselbe Socket bekommt danach noch eine
Antwort. Ein **innerer** Fehler kostet die Verbindung. Ohne diese Unterscheidung hätte das `try/catch`
die fehlende Validierung verdeckt.

**Begründete Abweichung.** Der Auftrag nennt `codes.ts:29` als Fundstelle. Ich habe `normalizeCode`
zunächst mit `String(raw)` total gemacht — und die Probe sofort zurückgenommen, weil sie messbar
schadet: mit dem zweiten Riegel blieb die Probe „Validierung entfernt" **grün**. Eine Absicherung, die
den eigentlichen Wächter untestbar macht, ist keine. `normalizeCode` steht unverändert; die Prüfung
sitzt dort, wo die fremde Eingabe hereinkommt, und das `try/catch` fängt den Rest.

---

## 2. B1 — Der HTTP-Pfad übersteht jede Anfrage

**Ursache.** `decodeURIComponent(url.pathname)` wirft bei jeder ungültigen Prozent-Sequenz; `serve`
ist `async`, der Wurf wurde zur abgelehnten Promise, `main.ts` fing sie nicht ab, und Node 22 beendet
darauf den Prozess — `GET /play/%` genügte.

**Änderung.** Die Dekodierung in `static.ts` ist abgesichert und beantwortet eine kaputte Sequenz mit
400. Der HTTP-Einstieg liegt jetzt als `makeRequestListener` in
`packages/server/src/http/requestListener.ts`; dort fängt ein `.catch` jede Ablehnung ab und antwortet
mit 500, ohne eine bereits beendete Antwort anzufassen. In `main.ts` liegen `uncaughtException` und
`unhandledRejection` als **zusätzliches** Netz.

**Bindende Tests.** `test/server/http.test.ts`, 10 Tests.

| Rücknahmeprobe | Ergebnis |
|---|---|
| `decodeURIComponent` ungesichert | **5 Tests rot**: die fünf Fälle `/play/%`, `/play/%zz`, `/play/abc%`, `/play/%E0%A4%A`, `/host/%` |
| `.catch` in `makeRequestListener` entfernt | **1 Test rot**: „beantwortet eine abgelehnte Auslieferung mit 500, statt den Prozess zu beenden"; vitest meldet zusätzlich eine Unhandled Rejection |

**Begründete Abweichung.** Der Einstieg musste aus `main.ts` heraus, weil `main.ts` beim Import einen
Port belegt und damit nicht prüfbar ist. Die Datei ist neu, der Inhalt ist der alte Rückrufhandler
plus `.catch`.

**Nachtrag (eigener Befund, siebter Commit).** Das Netz aus `uncaughtException` fing auch einen
fehlgeschlagenen `listen` ab: bei belegtem Port endete der Prozess still mit 0 statt mit einem
Fehler. Das ist ein Rückschritt, den dieser Fix selbst eingeführt hat; aufgefallen beim Nachstellen
am laufenden Server. `http.on('error')` meldet den Startfehler jetzt und beendet mit 1.

---

## 3. E1 — Die Bühne erzeugt den Raum genau einmal

**Ursache.** `socket.io-client` verbindet sich selbsttätig wieder und feuert `connect` bei jeder
Wiederverbindung; der Handler kannte den Unterschied nicht und legte bei einem WLAN-Aussetzer einen
zweiten Raum an, während die Spielergeräte im ersten hängen blieben.

**Änderung.** `apps/host-web/src/session.ts` enthält `createRoomOnce`, das `host:create` genau einmal
je Sitzung durchlässt; `App.tsx` ruft es statt des rohen `connect`-Handlers auf. Kein
Wiedereinstieg, kein Sitzungstoken, keine Wiederverbindungslogik — nur das doppelte Anlegen ist weg.

**Bindende Tests.** `test/host/session.test.ts`, 4 Tests.

| Rücknahmeprobe | Ergebnis |
|---|---|
| Roher `connect`-Handler in `App.tsx` zurück | **1 Test rot**: „die Buehne benutzt den Wachter auch wirklich" |
| Wächter feuert bei jeder Verbindung | **2 Tests rot**: „erzeugt bei jeder Wiederverbindung KEINEN zweiten Raum", „haelt zwei Sitzungen auseinander" |

**Begründete Abweichung.** Es gibt keine DOM-Testumgebung, und `jsdom` plus Testbibliothek wären zwei
neue Abhängigkeiten gewesen. Deshalb steht die Regel in einer eigenen, transportfreien Datei — und ein
vierter Test liest `App.tsx` im Quelltext und stellt sicher, dass die Bühne den Wächter auch benutzt
und keinen rohen `connect`-Handler mehr führt. Ohne diesen vierten Test wäre die Rücknahme in `App.tsx`
grün geblieben.

---

## 4. E3 — Die Purity-Prüfung erfasst jede Importform

**Ursache.** `/from\s+'([^']+)'/g` kannte nur eine Schreibweise. Doppelte Anführungszeichen,
Seiteneffekt-Importe und dynamische Importe gingen unentdeckt durch.

**Änderung.** `specifiersOf` in `test/core/purity.test.ts` erfasst `from`, Seiteneffekt-`import`,
dynamisches `import(...)` und `require(...)`, beide Anführungszeichen, zeilenweise und mit derselben
Kommentarfilterung wie die Uhren-/Zufalls-/Timer-Prüfung.

**Rücknahmeproben.** Die fünf Mutationen aus dem Review, jeweils als erste Zeile in
`packages/core/src/engine/reading.ts`:

| Mutation | vorher | jetzt |
|---|---|---|
| M1a `export const leak = Date.now();` | rot | **rot**, 1 Test |
| M1b `import "node:crypto";` | grün | **rot**, 1 Test |
| M1c `import { randomUUID } from "node:crypto";` | grün | **rot**, 1 Test |
| M1d `import 'node:crypto';` | grün | **rot**, 1 Test |
| M1e `export const load = () => import('node:crypto');` | grün | **rot**, 1 Test |

Roter Test ist jedes Mal „importiert ausser protocol kein weiteres Paket".

**Gegenprobe.** Mit dem **alten** Muster zurückgedreht und M1c angewandt: **19 Tests, alle grün** —
also war wirklich das Muster die Lücke und nicht etwas anderes.

**Falsch-Grün-Riegel.** Ein Wächter, der nichts findet, ist still grün. Zwei neue Tests verhindern
das: einer prüft jede Schreibweise einzeln, einer stellt fest, dass die Prüfung in `core` überhaupt
mehr als zwanzig Importe findet und `@quizbude/protocol` darunter ist. Probe mit einem absichtlich
toten Muster: **2 Tests rot**.

---

## 5. E2 — Nachrichtenart und Empfängerkreis sind aneinander gebunden

**Ursache.** `Effect.send` trug Nachricht und `Audience` nebeneinander, ohne Beziehung. Welche
Nachricht an wen ging, entschieden fünf handgeschriebene `scope: 'host'`-Literale, und kein Test las
sie.

**Änderung — Test.** `test/core/audience.test.ts` spielt ein vollständiges Zwei-Fragen-Spiel von der
Lobby bis `room:finished`, sammelt **jede** Zustellung und prüft drei Dinge: den erlaubten
Empfängerkreis je Nachrichtenart gegen eine Tabelle über die ganze `ServerMessage`-Union; dass die
Lösung ausschließlich zur Bühne geht; und — unabhängig von der Tabelle — dass kein Fragetext, kein
Antworttext und keine Erklärung in irgendeiner Nachricht steht, die ein Spielergerät erreicht. Ein
vierter Test stellt sicher, dass der Durchlauf überhaupt jede erwartete Nachrichtenart erzeugt, damit
die Prüfung nicht leerläuft.

**Änderung — Typkopplung.** Sie ging ohne großen Umbau, deshalb ist sie drin. `SendEffect` ist in
vier Fälle aufgeteilt, einen je Empfängerkreis, mit den jeweils erlaubten Nachrichtenarten. Das kostete
genau zwei Eingriffe: die neue Fassung von `effects.ts` und den Rückgabetyp von `rosterMessage`.
`tsc --noEmit` blieb danach bei Exit 0; `outbound.ts`, `step.ts` und die Testfixture brauchten keine
Anpassung. Weil die Kopplung steht, wurde der Kommentar in `views.ts` nicht abgeschwächt, sondern
erweitert: er benennt jetzt beide Achsen und sagt, wo die zweite hängt.

**Rücknahmeproben (am Stand `2e006c6`, jeweils `scope: 'host'` → `scope: 'all'`):**

| Mutation | vorher | Tests jetzt | Typtor jetzt |
|---|---|---|---|
| M4a `stage:question_prepared` | grün | **2 rot** | **1 Typfehler** |
| M4b `stage:reveal` | grün | **3 rot** | **1 Typfehler** |
| M4c `stage:scoreboard` | ungeprüft | **1 rot** | **1 Typfehler** |
| M4d `stage:podium` | ungeprüft | **1 rot** | **1 Typfehler** |

Rote Tests bei M4a/M4b sind „stellt jede Nachrichtenart nur an ihren erlaubten Empfaengerkreis zu",
„laesst weder Fragetext noch Antworttext noch Erklaerung an ein Spielergeraet" und bei M4b zusätzlich
„schickt die Loesung ausschliesslich an die Buehne". Beide Tore greifen unabhängig voneinander: der
Test fällt auch dort, wo jemand die Typen mit aufweicht, der Compiler auch dort, wo niemand den Test
laufen lässt.

---

## 6. E4 — `onDisconnect` rechnet auf der Uhr der Eingabe

**Ursache.** `onDisconnect` bekam kein `at` und griff auf `lastInputAt` zurück; `touch()` setzt dieses
Feld erst am Ende von `step`, es trug also noch den Zeitpunkt der vorherigen Eingabe.

**Änderung.** `applyEvent` reicht `at` durch, `maybeSettle` rechnet damit. Die Reinheit von `core`
bleibt unangetastet: `at` ist der Feldwert, der ohnehin mit jeder Eingabe hereinkommt.

**Bindende Tests.** `test/core/disconnect.test.ts`, 2 Tests. Anna antwortet bei `openedAt + 500`,
Bernd trennt sich bei `openedAt + 15 500`.

| Rücknahmeprobe | Ergebnis |
|---|---|
| `maybeSettle(next, next.lastInputAt, deps)` zurück | **2 Tests rot**: „rechnet die Atempause auf der Uhr der Eingabe, nicht auf dem letzten Zeitstempel" (`settleAt` liegt 14 700 ms in der Vergangenheit statt 300 ms in der Zukunft), „laesst die Gnadenfrist fuer Nachzuegler nach der Trennung noch laufen" (`lateUntil` liegt vor dem Moment der Trennung) |

Der zweite Test trägt die eigentliche Folge: ohne den Fix ist die 1,5-Sekunden-Gnadenfrist
aufgebraucht, bevor sie beginnt.

---

## 7. Die beiden blockierenden Fälle am laufenden Server

Gebauter Server, `node packages/server/dist/main.js`, Port 3191. Zuerst eine echte Runde aufgesetzt:
Raum `388QT9`, Anna beigetreten, `host:start`, Frage 1 läuft.

```
--- B1: GET /play/% ---
  GET /play/           -> 200
  GET /play/%          -> 400
  GET /play/%zz        -> 400
  GET /play/%E0%A4%A   -> 400
  GET /play/ danach    -> 200

--- B2: player:join mit roomCode 123456 ---
  Angreifer-Socket     -> lebt, clock:pong seq 42 (Nachricht verworfen)

--- Zustand nach beiden Angriffen ---
  Prozess HTTP         -> 200
  Buehnen-Socket       -> verbunden
  Spieler-Socket       -> verbunden
  Raum 388QT9 nimmt noch auf -> Bernd
  Buehne antwortet     -> clock:pong seq 7
```

Der Prozess lebt, beide bestehenden Verbindungen leben, der Raum nimmt einen weiteren Spieler auf,
und die Bühne antwortet weiter. Das Serverprotokoll blieb bei beiden Angriffen leer: die ungültige
Nachricht wird verworfen, nicht erst tief im Server zum Fehler. Der Probelauf ist außerhalb des
Projektbaums abgelegt, der Serverprozess wurde beendet, Port 3191 ist wieder frei.

---

## 8. Gemessene Torzahlen

Alle vier selbst ausgeführt, am Stand `2e006c6`:

```
npm test            -> 10 Dateien, 94 Tests, alle grün, Exit 0
npx tsc --noEmit    -> Exit 0, keine Ausgabe
npm run build       -> Exit 0
git status --short  -> ?? .claude/
                       ?? docs/review-durchstich.md
```

Verteilung der 94 Tests: `purity` 21, `validate` 23, `scoring` 16, `http` 10, `answerWindow` 9,
`session` 4, `audience` 4, `gateway` 3, `playthrough` 2, `disconnect` 2. Vorher 46 in vier Dateien;
alle 46 laufen unverändert weiter.

**Anmerkung zum Arbeitsbaum.** Der Auftrag nennt den Arbeitsbaum bei `2d14013` sauber. Tatsächlich
waren `.claude/` und `docs/review-durchstich.md` dort bereits unverfolgt vorhanden. Beide sind
unverändert geblieben — kein verfolgter Pfad ist offen, nichts liegt im Index. Ob der Reviewbericht
eingecheckt werden soll, ist keine Entscheidung dieser Welle.

---

## 9. Folgeaufgaben

Gefunden, nicht behoben:

**F1 — Die Kanalabbildung im Transport ist weiterhin ungeprüft.** Die Typkopplung aus E2 bindet
Nachricht an `Audience`; dass `outbound.ts:20-28` die vier Scopes auch auf die richtigen Socket.IO-Räume
abbildet, prüft kein Test. Eine falsche Zeile dort schöbe die Lösung wieder aufs Handy. Ein Test über
den echten Server — Bühne und Spieler getrennt verbunden, jede Nachricht beim richtigen Empfänger —
schließt die letzte Lücke dieser Achse.

**F2 — Räume werden nie abgeräumt.** `closeRoom` wird protokolliert, `RoomRegistry.remove` hat keinen
Aufrufer, `host:create` ist unauthentifiziert und unbegrenzt. Jeder Raum bleibt mit seinen Timern bis
zum Prozessende liegen. Im Review als H5 benannt, hier nicht angefasst: Raum-TTL und Drosselung sind
Produktentscheidungen, keine Befunde dieser Welle.

**F3 — Die Token sind Kulisse.** `tokenEquals` hat keinen Aufrufer; `hostToken` und `resumeToken`
werden erzeugt und verschickt, aber nirgends geprüft. Die Autorisierung von `host:start`/`host:advance`
hängt allein an der Socket-Identität. Das trägt im Durchstich, sollte aber benannt bleiben (Review H3).

**F4 — `MAX_PROMPT_CHARS` wird nicht durchgesetzt** (Review H1), **`MIN_TIME_FACTOR` steuert nichts**
(Review H2). Beides unverändert offen.

**F5 — Die Servertests brauchen Loopback und freie Ports.** `test/server/gateway.test.ts` bindet einen
echten Port (`listen(0)`). Auf einer Maschine ohne Loopback-Bindung oder in einem abgeschotteten
Container fällt die Datei aus. Das war der Preis dafür, den Absturz echt nachzustellen statt ihn
nachzubauen; wenn der Durchstich je in eine Pipeline geht, gehört das geprüft.

**F6 — Fehler sind jetzt leiser.** Validierung, `try/catch` und das Prozessnetz verhindern den Absturz
— sie machen einen inneren Fehler damit auch unauffällig. Im Durchstich genügt `console.error`; sobald
es einen Betrieb gibt, braucht es einen Zähler oder ein Protokollziel, sonst bemerkt niemand den
hundertsten abgebrochenen Socket.

---

## 10. Was nicht angefasst wurde

Lesefenster-Kappung und Ladebudget, `PLAYER_HARD_CAP`, Punkteformel, Zustandsmaschine, Schichtenschnitt
und Farbpalette stehen unverändert. Keine Umbenennung, kein Aufräumen nebenbei, keine neue
Abhängigkeit — `vitest` bleibt die einzige nicht vorgegebene. Nichts aus der Verbotsliste des
Durchstichs ist hinzugekommen; insbesondere ist E1 kein Reconnect, sondern dessen Gegenteil: es
verhindert, dass eine Wiederverbindung etwas anlegt. Nicht nach `main` gemerget, nichts gepusht.
