# Review — Durchstich Quizbude

**Stand:** 2026-10-19 · **Branch:** `durchstich` · **Geprüfter Diff:** `5f8862b` → `2d14013` (sechs Commits)
**Rolle:** unabhängige Prüfung, rein lesend. Der Umsetzerbericht wurde als Behauptung behandelt, nicht als Befund.

---

## 0. Urteil

Der Spielkern hält, was er verspricht. Punkteformel, Antwortfenster, Reinheit von `core`, Scope-Treue und
Gestaltung sind geprüft und tragen — vier davon durch Mutationsproben belegt, nicht durch Lektüre.

Der **Transport** hält es nicht. Zwei unauthentifizierte Einzelanfragen beenden den Serverprozess und damit
jedes laufende Spiel; beide sind am Gerät reproduziert worden. Solange sie offen sind, ist die Abnahmezusage
„der Durchstich ist spielbar" nur unter Laborbedingungen wahr.

---

## 1. Blockierende Befunde

### B1 — Eine HTTP-Anfrage mit kaputtem Prozentzeichen beendet den Serverprozess

`packages/server/src/http/static.ts:38` · `packages/server/src/main.ts:24`

```ts
const pathname = decodeURIComponent(url.pathname);   // static.ts:38 — wirft URIError
void serveStatic(req, res).then((handled) => { ... });  // main.ts:24 — kein .catch
```

`decodeURIComponent` wirft bei jeder ungültigen Prozent-Sequenz. `serve` ist `async`, der Wurf wird zur
abgelehnten Promise, `main.ts:24` fängt sie nicht ab, und Node 22 beendet bei einer unbehandelten Ablehnung
den Prozess.

**Nachgestellt** (gebauter Server auf Port 3177):

```
GET /play/     -> 200
GET /play/%    -> 000 (Verbindung bricht)
Prozess danach: TOT
URIError: URI malformed
    at serve (.../http/static.js:28:26)
    at Server.<anonymous> (.../main.js:20:10)
```

**Fehlerszenario.** Ein Gast tippt die Adresse ab und verschluckt ein Zeichen hinter einem Prozentzeichen,
oder irgendein Scanner im WLAN klopft die Ports ab. Der Server ist weg. Weil der gesamte Spielzustand im
Prozessspeicher liegt (Ruling 4), ist jede laufende Runde unwiederbringlich verloren — kein Raumcode, keine
Punkte, kein Wiedereinstieg. Der Abend ist zu Ende.

### B2 — Ein einziges `player:join` mit falsch getyptem `roomCode` beendet den Serverprozess

`packages/server/src/transport/socketio/gateway.ts:77` · `gateway.ts:149` · `packages/server/src/runtime/codes.ts:29`

```ts
const msg = raw as ClientMessage;              // gateway.ts:77 — blanker Cast, keine Prüfung
const code = normalizeCode(msg.roomCode);      // gateway.ts:149 — ungeprüft weitergereicht
return asRoomCode(raw.toUpperCase()...);       // codes.ts:29 — TypeError, wenn raw kein String ist
```

Der Cast in Zeile 77 erklärt die gesamte `ClientMessage`-Union für vertrauenswürdig. Geprüft wird danach
genau ein Feld — `displayName` in `gateway.ts:163`. `roomCode` wird ungeprüft an `normalizeCode` gereicht.
Es gibt im Server kein `try/catch` um `handle()` und keinen `uncaughtException`-Handler.

**Nachgestellt** (Port 3179, ein Socket, eine Nachricht):

```
emit('quizbude', { t: 'player:join', roomCode: 123456, displayName: 'Mallory' })
TypeError: raw.toUpperCase is not a function
    at normalizeCode (.../runtime/codes.js:26:27)
    at handle (.../transport/socketio/gateway.js:109:26)
Prozess danach: TOT
```

**Fehlerszenario.** Drei Zeilen in der Browserkonsole genügen, und sie brauchen weder Raumcode noch
Beitritt. `main.ts:35` setzt `cors: { origin: true }` — damit darf **jede beliebige Webseite**, die ein
Mitspieler nebenher offen hat, diesen Socket aufbauen und die Nachricht senden. Das Spiel endet ohne
Fehlermeldung auf irgendeinem Bildschirm.

Dass `displayName` geprüft wird und `roomCode` nicht, ist der Beleg dafür, dass es ein Versehen ist und
keine bewusste Scope-Entscheidung.

---

## 2. Ernste Befunde

### E1 — Ein kurzer Verbindungsabriss der Bühne legt einen neuen Raum an und verwirft das laufende Spiel

`apps/host-web/src/App.tsx:108`

```ts
wire.socket.on('connect', () => wire.send({ t: 'host:create' }));
```

`socket.io-client` verbindet sich standardmäßig selbst wieder und feuert `connect` bei **jeder**
Wiederverbindung. Der Handler kennt diesen Unterschied nicht.

**Nachgestellt** (Port 3178, erzwungener Transportabbruch nach 200 ms):

```
room:created -> YHW8EC  (insgesamt 1)
…erzwinge Verbindungsabbruch
room:created -> YQBK22  (insgesamt 2)
```

**Fehlerszenario.** Das WLAN des Bühnenrechners setzt eine Sekunde aus. Die Bühne zeigt danach einen neuen
sechsstelligen Code und eine leere Lobby. Die Spielergeräte hängen weiter im alten Raum, dessen Host nie
wieder weiterschaltet; `gateway.ts:127` hat `st.roomCode` auf den neuen Raum umgeschrieben, also gehen auch
`host:advance`-Nachrichten dorthin. Der alte Raum bleibt mit seinen Timern im `RoomRegistry` liegen, weil es
kein TTL gibt. Die Runde ist nicht pausiert, sie ist tot.

Reconnect war nicht beauftragt — das ist hier aber nicht „kein Reconnect", sondern eine aktive Zerstörung.
`apps/host-web/src/main.tsx` benennt im Kommentar genau dieses Risiko für `StrictMode` („dessen doppelter
Effektlauf würde zwei Räume anlegen") und übersieht denselben Mechanismus zwei Dateien weiter.

### E2 — Das zentrale UX-Gesetz hängt an fünf Zeichenketten, nicht am Typsystem — und kein Test deckt es ab

`packages/protocol/src/views.ts:6-8` · `packages/core/src/engine/effects.ts:16` · `packages/core/src/engine/step.ts:376`

`views.ts:6-8` behauptet wörtlich:

> „Es gibt in diesem Typ kein Feld, in dem Korrektheit stehen könnte. Dass die Lösung vor REVEAL nicht
> hinausgeht, ist damit ein Typfehler und keine Disziplinfrage."

Für die **Nachrichtenachse** stimmt das: `PublicQuestionView` und `PlayerTileSpec` sind sauber getrennt, und
kein Spielertyp trägt ein Textfeld. Für die **Empfängerachse** stimmt es nicht. `Effect.send` ist

```ts
{ kind: 'send'; to: Audience; message: ServerMessage }    // effects.ts:16
```

— Nachrichtentyp und Audience sind vollkommen entkoppelt. Welche Nachricht an wen geht, entscheiden fünf
handgeschriebene `scope: 'host'`-Literale in `step.ts`.

**Mutationsprobe (M4a).** `step.ts:376`, `scope: 'host'` → `scope: 'all'` bei `stage:question_prepared`:
Fragetext und alle vier Antworttexte gehen an jedes Spielergerät. **46 von 46 Tests bleiben grün.**

**Mutationsprobe (M4b).** `step.ts:740`, `scope: 'host'` → `scope: 'all'` bei `stage:reveal`: zusätzlich die
Lösung. **46 von 46 Tests bleiben grün.**

**Kontrollprobe (M4c).** Fragetext direkt in die Spieler-Nutzlast geschmuggelt: **1 Test rot.** Der Wächter
existiert also — er steht in `playthrough.test.ts:102-103` und prüft mit zwei `JSON.stringify`-Zeilen genau
eine Nachricht einer einzigen Frage. Die Audience prüft er nicht, und kein anderer Test tut es.

**Befund.** Im ausgelieferten Code gibt es **kein Leck** — alle fünf Literale stehen richtig, und ich habe
jeden Pfad vom `protocol` bis zum `emit` in `outbound.ts:20-28` verfolgt. Falsch ist die Behauptung, der
Schutz sei strukturell. Er ist eine Konvention, und die wahrscheinlichste Regression — ein falsch gesetzter
Scope beim Hinzufügen einer Nachricht — läuft ohne einen einzigen roten Test durch.

Verschärfend: `step.ts:391` spreizt den Rückgabewert von `handler.tiles()` ungeprüft in die
Spieler-Nutzlast (`...tiles`, davor ein `as`-Cast in Zeile 367). Ein künftiger Fragetyp, dessen `tiles()`
ein Feld zu viel zurückgibt, schiebt es ohne Typfehler aufs Handy.

### E3 — Der Purity-Test ist Falsch-Grün für drei von vier Importschreibweisen

`test/core/purity.test.ts:61` — `const re = /from\s+'([^']+)'/g;`

Das Muster kennt nur einfache Anführungszeichen und nur die `from`-Form.

| Mutation in `core/src/engine/reading.ts` | Purity-Test |
|---|---|
| M1a `export const leak = Date.now();` | **rot** (1 von 19) ✓ |
| M1b `import "node:crypto";` | **grün** ✗ |
| M1c `import { randomUUID } from "node:crypto";` | **grün** ✗ |
| M1d `import 'node:crypto';` | **grün** ✗ |
| M1e `export const load = () => import('node:crypto');` | **grün** ✗ |

Die Uhren-/Zufalls-/Timer-Prüfung (Zeilen 13-23) trägt und greift über **alle** Dateien unter `core/src`,
nicht nur über eine Stichprobe — das habe ich an einer anderen Datei als der im Bericht genannten geprüft.
Die Importprüfung dagegen hält Ruling 6 nur, solange alle Beteiligten einfache Anführungszeichen tippen.

**Fehlerszenario.** Jemand ergänzt in `core` ein `import { randomUUID } from "node:crypto"`. Testtor grün,
Typtor grün, Build grün — und `core` ist nicht mehr transportfrei. Genau die Erosion, gegen die der Test
laut seinem eigenen Kommentar (Zeile 7-8: „eine Regel, die nur in einem Dokument steht, hält drei Wochen")
geschrieben wurde.

### E4 — `onDisconnect` rechnet mit einem veralteten Zeitstempel statt mit der aktuellen Uhr

`packages/core/src/engine/step.ts:280`

```ts
const settled = maybeSettle(next, next.lastInputAt, deps);
```

`onDisconnect` bekommt kein `at` übergeben und greift auf `lastInputAt` zurück. `touch()` setzt dieses Feld
aber erst am **Ende** von `step` (`step.ts:103`), also trägt es noch den Zeitpunkt der **vorherigen**
Eingabe.

**Nachgestellt** (eigene Probe, danach gelöscht): zwei Spieler, Anna antwortet bei `openedAt + 500`, Bernd
trennt sich 15 s später bei `openedAt + 15 500`.

```
now= 24400   settleAt= 9700   Differenz= -14700
```

Erwartet wären `now + 300`. Tatsächlich liegt `settleAt` 14,7 Sekunden in der **Vergangenheit**.

**Folgen.** `scheduler.ts:20` klemmt die Verzögerung auf 0, der Timer feuert sofort: die 300-ms-Atempause
aus `ALL_ANSWERED_SETTLE_MS` entfällt, die Auflösung schlägt übergangslos zu. Schwerer wiegt, dass
`settleDeadlines` anschließend `closeAndReveal(current, 9700)` aufruft — `closedAt` wird 14,7 s in der
Vergangenheit verbucht und `lateUntil` (`step.ts:726`) damit auf `11 200`, also auf einen längst
verstrichenen Zeitpunkt. Die 1,5-Sekunden-Gnadenfrist ist aufgebraucht, bevor sie beginnt.

Das ist derselbe Fehlertyp, gegen den die Architektur ausdrücklich antritt: `step.ts:112-114` schreibt
„Timer sind Hinweise, die Uhr ist die Wahrheit". An dieser einen Stelle ist die Uhr ein altes Feld.

---

## 3. Hinweise

| # | Stelle | Sache |
|---|---|---|
| H1 | `core/src/engine/constants.ts:33` | `MAX_PROMPT_CHARS = 200` wird nirgends durchgesetzt. Nur `MAX_OPTION_CHARS` prüft (`singleChoice.ts:44`), nur `MAX_NAME_CHARS` prüft (`step.ts:85`). Heute harmlos (Demo-Quiz fest im Prozess), beim Editor eine offene Flanke. |
| H2 | `core/src/scoring/constants.ts:5` | `MIN_TIME_FACTOR = 0.5` wird von niemandem gelesen. Der Deckel steht als nacktes `/2` in `score.ts:68`. Die Konstante dokumentiert etwas, das sie nicht steuert. |
| H3 | `server/src/runtime/tokens.ts:8` | `tokenEquals` ist toter Code — kein Aufrufer. `hostToken` und `resumeToken` werden erzeugt und an die Clients geschickt (`gateway.ts:134`, `step.ts:246`), aber nirgends geprüft. Die Autorisierung von `host:start`/`host:advance` hängt allein an `st.isHost` (`gateway.ts:198`), also an der Socket-Identität. Das trägt im Durchstich; das Token ist Kulisse. |
| H4 | `server/src/main.ts:35` | `cors: { origin: true }` erlaubt jeder Webseite den Socket-Aufbau. Für sich genommen harmlos, in Verbindung mit B2 der Zustellweg. |
| H5 | `server/src/transport/socketio/gateway.ts:95` | `host:create` ist unauthentifiziert und unbegrenzt; Räume werden nie abgeräumt (`roomRegistry.remove` hat keinen Aufrufer). Raum-TTL ist als Lücke benannt, die fehlende Drosselung nicht. |
| H6 | `docs/bericht-durchstich.md:192` | Die Abhängigkeitsliste nennt `@types/react` und `@types/react-dom` nicht. Beide sind Typstubs einer vorgegebenen Bibliothek — die Aussage „vitest ist die einzige nicht vorgegebene Abhängigkeit" bleibt richtig, die Aufzählung ist unvollständig. |

---

## 4. Was geprüft wurde und trägt

**Punkteformel** (`core/src/scoring/score.ts`). Drei Werte unabhängig von Hand nachgerechnet:
500 ms/30 s → `1−(500/30000)/2 = 0,9916̅` → **992**; 2 s → `0,96̅` → **967**; 15 s → `0,75` → **750**.
Alle drei stimmen mit der Implementierung und mit `scoring.test.ts:159-164` überein. Deckelung bei 50 %
(`score.ts:65` klemmt `t` auf `timeLimitMs`), unter 500 ms volles Maximum (Zeile 62), falsch = 0 (Zeile 45),
verspätet = 0 (Zeile 48), Multiplikator wirkt über `maxPointsOf`.
*Mutation M2:* `1 - t/limit/2` → `1 - t/limit` ⇒ **8 von 46 Tests rot** in drei Dateien. Der Deckel ist
durch Tests gebunden.

**Antwortfenster** (`core/src/engine/step.ts:474-613`). Alle vier Zusagen mutationsgeprüft:

| Zusage | Mutation | Ergebnis |
|---|---|---|
| Antwort vor Freigabe wird abgelehnt, nicht als 0 ms gewertet | `settleDeadlines` öffnet PREVIEW bedingungslos (Freifahrtschein) | **1 Test rot** |
| … und auch nicht unter falschem Grund quittiert | `'not_open'` → `'wrong_phase'` | **1 Test rot** |
| Antwort nach Fensterschluss wird abgelehnt | `lateUntil` auf unendlich | **1 Test rot** |
| Zweitantwort ist idempotent | Idempotenzzweig entfernt | **1 Test rot** |
| Verspätete Antwort gibt 0 | `if (i.late) return 0;` entfernt | **2 Tests rot** |

Das im Konzept benannte Freifahrtschein-Risiko ist sauber gelöst: `step.ts:482-485` lehnt in PREVIEW ab,
statt mit `elapsed = 0` zu buchen, und `openAnswers` setzt den Nullpunkt auf `answersOpenAt` statt auf den
Moment des Timers (`step.ts:403-404`).

**Transportfreiheit von `core`.** Kein `Date.now`, kein `Math.random`, kein `setTimeout`, kein `process.`
in `core/src` — unabhängig nachgegrept. Der einzige Nicht-Verwandte-Import ist `@quizbude/protocol`. Die
Uhr kommt als Feldwert herein (`events.ts:34`), der Zufall als `Rng`-Interface (`rng.ts:5`). Die Reinheit
selbst ist in Ordnung; nur ihr Wächter hat die Lücke aus E3.

**Die sechs begründeten Abweichungen, einzeln geprüft:**

1. **`answersOpenAt = preparedAt + ANNOUNCE_MS + readingWindowMs`** — **richtig gelesen.**
   `konzept-ux.md` Abschnitt 3 setzt die Ankündigung auf T−8,0 bis T−5,0 und lässt das Lesefenster danach
   beginnen; die Reihenfolge Ankündigung → Lesefenster → Freigabe deckt sich exakt. Meine Nachrechnung von
   `reading.ts:22-29` reproduziert beide Beispielwerte des Konzepts punktgenau (8 Wörter/4 Wörter → 5300 ms
   gegen „5,3 s"; 20/12 → 11 300 ms gegen „11,3 s → gekappt auf 10 s").
2. **Umlaufzeit als Ereignisfeld statt in `PlayerState`** — **richtig.** `konzept-architektur.md:490-492`
   schreibt wörtlich „Vom Transport gepflegt, von core nur gelesen". Das verlangt einen Schreibzugriff des
   Transports in den Zustand von `core` und bricht Ruling 6. `AnswerSubmitted.rttMinMs` (`events.ts:29`)
   ist strenger, nicht schwächer.
3. **`room:answer_count` an alle** — **belegt.** `konzept-architektur.md:170` beziffert den Strom in
   Übergang 9 als `send(host, …)`. `konzept-ux.md` Abschnitt 3, Zeile „T+6 bis T+15", Spalte Buzzer:
   „Wartende sehen ‚14 von 18 sind fertig'". Z6 verlangt es tatsächlich auf dem Gerät; die Dokumente
   widersprechen sich, die Auflösung zugunsten der UX-Zusage ist richtig und kostet ~20 Nachrichten je
   Gerät und Frage.
4. **vitest als einzige Zusatzabhängigkeit** — **im Kern richtig**, siehe H6. Alle `package.json` geprüft:
   `socket.io`/`socket.io-client` 4.8, `react`/`react-dom` 18.3, `vite` 5.4, `typescript` 5.6,
   `@types/node` 22, `engines.node >= 22`. Nichts außerhalb des Stacks außer `vitest` (und den beiden
   React-Typstubs).
5. **`publicView` liefert nur den Body** — zutreffend; der Handler sieht den Fragetext nie
   (`handler.ts:37-41`, Kopffelder in `step.ts:315-325`).
6. **`persistRound`/`persistFinal`/`closeRoom` werden erzeugt, nicht verarbeitet** — zutreffend;
   `outbound.ts:31-34` verwirft sie mit Kommentar, `playthrough.test.ts` prüft ihr Entstehen.

**Scope-Treue — gehalten.** Kein Treffer für `sqlite`, `qrcode`, `confetti`, `localStorage`,
`sessionStorage`, `new Audio`, `AudioContext`, `nickname`, `Dockerfile` im gesamten Quellbaum.
`packages/server/src/runtime/tokens.ts` ist **keine** unbeauftragte Reconnect-Funktionalität: die Datei
erzeugt Zufallstoken (`randomBytes(16).toString('base64url')`) und stellt einen Vergleich in konstanter Zeit
bereit, der nirgends aufgerufen wird. Da kein Client das `resumeToken` speichert — `localStorage` kommt im
ganzen Baum nicht vor — und der Server es nie entgegennimmt, existiert kein Wiedereinstiegspfad. `locked`
(`state.ts:96`) ist ebenso eine tote Naht: immer `false`, kein Ereignis setzt es. `dist/` ist nicht
eingecheckt, keine `.env`, keine Zugangsdaten im Quellbaum.

**Gestaltung — konform.** Die Oberflächen verwenden genau dreizehn Farben: die vier Antwortfarben
`#FFC94D` / `#36BFE0` / `#B3350C` / `#2B2A8C` und die neun Nebenfarben aus `konzept-ux.md` Abschnitt 4
(`#121126`, `#2B2752`, `#413B73`, `#F7F6FB`, `#A9A6C9`, `#3DDC97`, `#3B1033`, `#3A3A4A`). Kein weiterer
Hexwert in CSS, TSX oder HTML. Keine Bronze `#B79155`, kein Gold `#C3A371`, kein Teal — die Trennung zur
SIMO-CI ist sauber. Formen sind Blitz, Tropfen, Herz, Mond als Inline-SVG (`shapes.tsx:19-28`), kein
Dreieck, keine Raute, kein Kreis, kein Quadrat. Der Umriss gegen den Nacht-auf-Bühne-Fall sitzt:
3 px Papier auf der Bühne (`host-web/src/styles.css:170`), 2 px auf dem Handy
(`player-web/src/styles.css:196`), beides mit Kommentar an der richtigen Stelle.

**Zeichengrenzen.** 200/100/16 in `constants.ts:33-35`, nicht 120/75. Durchgesetzt werden nur 100 und 16
(H1). Die Folgeaufgabe F2 des Berichts ist **berechtigt**: mit 200 Zeichen ergibt die Formel bei rund
30 Wörtern 15 300 ms, die 10-Sekunden-Kappung greift dann nicht mehr als Ausnahme, sondern als Regel.

**Torzahlen.** `npx tsc --noEmit` selbst ausgeführt: **Exit 0, keine Ausgabe.** Die Testzahlen waren
vorgegeben und wurden nicht erneut behauptet; geprüft wurde stattdessen, was sie messen — siehe oben.

---

## 5. Test-Lücken und Restrisiken

1. **Das Paket `server` hat null Tests.** Beide blockierenden Befunde liegen dort. `gateway.ts`,
   `static.ts`, `codes.ts`, `scheduler.ts`, `clockSync.ts` sind ungeprüft, und genau dort sitzt die
   Nahtstelle zwischen fremder Eingabe und Spielzustand.
2. **Kein Test prüft die Audience eines Effekts.** Siehe E2. Die Hilfsfunktion `sentTo` in `fixture.ts:97`
   kann es, sie wird aber nur für erwartete Zustellungen benutzt, nie für verbotene. Ein Test, der über
   **alle** Effekte eines vollständigen Durchlaufs läuft und jede Nachricht mit `scope` ≠ `host` gegen
   Fragetext und Antworttexte prüft, würde M4a und M4b fangen.
3. **Keine Eigenschaftsprüfung der Punkteformel.** Alle 16 Scoring-Tests sind Einzelwerte aus der Tabelle.
   Monotonie (schneller ⇒ nie weniger Punkte) und die Invariante `0 ≤ points ≤ maxPoints` sind nirgends als
   Eigenschaft festgehalten.
4. **Das Zusammenspiel mehrerer Räume ist ungeprüft.** `RoomRegistry` und die Trennung der Socket.IO-Räume
   haben keinen Test; der Nachweis, dass zwei parallele Runden sich nicht in die Quere kommen, fehlt.
5. **Nur am Gerät prüfbar und hier nicht geprüft:** Lesbarkeit aus 3 Metern auf einem echten Fernseher,
   `navigator.vibrate`, Daumenreichweite und Tapflächen auf einem echten Telefon, das Verhalten bei 20
   gleichzeitigen Geräten.

---

## 6. Mutationsproben im Überblick

| # | Mutation | Erwartung | Ergebnis |
|---|---|---|---|
| M1a | `Date.now()` in `core/src/engine/reading.ts` | rot | **rot**, 1/19 ✓ |
| M1b | `import "node:crypto";` | rot | grün ✗ (E3) |
| M1c | `import { randomUUID } from "node:crypto";` | rot | grün ✗ (E3) |
| M1d | `import 'node:crypto';` | rot | grün ✗ (E3) |
| M1e | `() => import('node:crypto')` | rot | grün ✗ (E3) |
| M2 | 50-Prozent-Deckel entfernt | rot | **rot**, 8/46 ✓ |
| M3a | PREVIEW öffnet bedingungslos | rot | **rot**, 1/46 ✓ |
| M3b | `'not_open'` → `'wrong_phase'` | rot | **rot**, 1/46 ✓ |
| M4a | `stage:question_prepared` an `all` | rot | grün ✗ (E2) |
| M4b | `stage:reveal` an `all` | rot | grün ✗ (E2) |
| M4c | Fragetext in die Spieler-Nutzlast (Kontrolle) | rot | **rot**, 1/46 ✓ |
| M5a | `lateUntil` unendlich | rot | **rot**, 1/46 ✓ |
| M5b | `late`-Zweig in `scoreAnswer` entfernt | rot | **rot**, 2/46 ✓ |
| M5c | Idempotenz der Zweitantwort entfernt | rot | **rot**, 1/46 ✓ |
| P1 | Probe `onDisconnect`-Uhr (eigener Test, gelöscht) | — | `settleAt` 14 700 ms in der Vergangenheit (E4) |
| P2 | `GET /play/%` gegen den gebauten Server | — | Prozess tot (B1) |
| P3 | `player:join` mit `roomCode: 123456` | — | Prozess tot (B2) |
| P4 | Erzwungener Reconnect der Bühne | — | zweiter Raum `YHW8EC` / `YQBK22` (E1) |

Alle Quellmutationen wurden aus Sicherungskopien zurückgespielt, der Probe-Test wurde gelöscht, die drei
Serverprozesse wurden beendet.

**Arbeitsbaum nach Abschluss aller Proben, vor dem Schreiben dieses Berichts:**

```
$ git status --short
$ git status --porcelain | wc -l
0
$ git stash list
$ git log --oneline -1
2d14013 docs: Bericht zum Durchstich und Entwicklungs-Proxy
```

Keine Ausgabe bei `git status --short` ⇒ sauber. Nichts committet, nichts gepusht, kein Branch angelegt
oder gewechselt. Die einzige Änderung danach ist diese Datei.

---

## 7. Empfohlene Reihenfolge der Fix-Welle

1. **B2** — Eingangsvalidierung in `gateway.ts` statt des blanken Casts, plus ein `try/catch` um `handle()`.
2. **B1** — `decodeURIComponent` absichern und `.catch` an `main.ts:24`.
3. **E1** — `host:create` nur bei der ersten Verbindung senden.
4. **E3** — Importprüfung über beide Anführungszeichen, Seiteneffekt- und dynamische Importe.
5. **E2** — Audience-Test über alle Effekte eines vollständigen Durchlaufs.
6. **E4** — `at` an `onDisconnect` durchreichen.

E2 und E3 sind Tests, keine Produktivänderungen; sie gehören trotzdem in dieselbe Welle, weil sie die
übrigen Fixes absichern. Das Nachreview prüft nur den Diff dieser Welle.
