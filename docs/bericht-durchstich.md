# Bericht — Durchstich Quizbude

**Stand:** 2026-10-19 · **Branch:** `durchstich` · **Ausgangslage:** zwei Commits (Gerüst, Konzepte), null Quellcode, null Tests.

Der Durchstich ist spielbar. Die Abnahme aus dem Auftrag wurde am Gerät durchlaufen — ein Hostfenster und zwei Spielerfenster im selben Browser, gegen den gebauten Server auf einem Port. Alle sieben Punkte der Abnahmeliste sind eingetreten; der Durchlauf ist in Abschnitt 4 protokolliert.

---

## 1. Was gebaut wurde, Datei für Datei

### Wurzel

| Datei | Zweck |
|---|---|
| `package.json` | npm workspaces über fünf Pakete, die Skripte `build`, `typecheck`, `test`, `start`. |
| `tsconfig.base.json` | Gemeinsame strenge Compiler-Optionen; `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`. |
| `tsconfig.json` | Ein Projekt über alle Quellen für `npx tsc --noEmit`; löst `@quizbude/*` auf die Quellen statt auf gebaute Pakete auf, damit das Tor ohne vorherigen Build grün sein kann. |
| `vitest.config.ts` | Testlauf über `test/**/*.test.ts` mit denselben Pfad-Aliassen. |
| `.gitignore` | `node_modules`, `dist`, `*.tsbuildinfo`. |

### `packages/protocol` — der Vertrag, keine Logik

| Datei | Zweck |
|---|---|
| `src/ids.ts` | Gebrandete Primitivtypen `MonoMs`, `RoomCode`, `PlayerId` plus `Phase`, `PlayerOrigin`, `EndReason`. Eine Wanduhrzeit kann so nicht dort landen, wo eine monotone Zeit stehen muss. |
| `src/views.ts` | `PublicQuestionView` (Bühne) und `RevealView` (erst nach Fensterschluss) als **zwei getrennte Typen**; `PlayerTileSpec` als das, was das Spielergerät über eine Frage erfährt — Kachelzahl und Anordnung, sonst nichts. |
| `src/messages.ts` | `ClientMessage`- und `ServerMessage`-Union, ein Socket.IO-Kanal `quizbude`. Für jede Frage zwei getrennte Nachrichten: `stage:question_prepared` mit Text, `player:question_prepared` ohne. |
| `src/index.ts` | Sammelexport. |

### `packages/core` — rein, transportfrei, I/O-frei

| Datei | Zweck |
|---|---|
| `src/rng.ts` | Gesäter Zufall (mulberry32) und Fisher-Yates; macht das Mischen der Antwortreihenfolge reproduzierbar. |
| `src/ranking.ts` | Punkte zu Rangliste. Gleiche Punkte ergeben gleichen Rang, Gleichstand alphabetisch, `deltaToAhead` zum nächsthöheren Punktestand. |
| `src/scoring/constants.ts` | `FULL_POINTS_THRESHOLD_MS` 500, `MIN_TIME_FACTOR` 0,5, `POINT_UNIT_VALUE` 1000, `COMPENSATION_CAP_MS` 400. |
| `src/scoring/score.ts` | Die Punkteformel aus Architekturkonzept 5.4, Zweig für Zweig, plus `compensate()` auf Basis des **Minimums** der gemessenen Umlaufzeiten. |
| `src/questions/handler.ts` | Das Fragetyp-Interface. `Verdict` trägt ein optionales `accuracy`, damit ein Präzisionstyp später andockt, ohne das Interface zu brechen. |
| `src/questions/singleChoice.ts` | Single-Choice: Spezifikationsprüfung, Mischen, Rückkanonisierung, Bewertung, Verteilungsaggregat, Auflösungssicht. |
| `src/questions/trueFalse.ts` | Wahr/Falsch als eigener Handler, nicht als Sonderfall: nicht editierbare Beschriftungen, kein Mischen, zwei Breitkacheln. |
| `src/questions/registry.ts` | Typ-Kennung zu Handler. Der einzige Ort, an dem ein neuer Fragetyp eingetragen wird. |
| `src/reward/layer.ts` | Die Belohnungsschicht als Interface. `onRound` bekommt Punkte als Eingabe, nicht als Rückgabe — eine Schicht kann Punkte nicht verändern. |
| `src/reward/classic.ts` | Identitätsschicht, vier Zeilen. Hält die Naht offen. |
| `src/engine/constants.ts` | `ANNOUNCE_MS`, `LATE_GRACE_MS`, `ALL_ANSWERED_SETTLE_MS`, `PLAYER_SOFT_WARN`, `PLAYER_HARD_CAP`, die fünf Lesefenster-Konstanten, die Zeichengrenzen 200/100/16. |
| `src/engine/reading.ts` | Die Lesefenster-Formel aus UX-Konzept 3, gekappt auf 4 bis 10 Sekunden. |
| `src/engine/state.ts` | Die sieben Phasen als diskriminierte Union, `RoomConfig`, `PlayerState`, `LiveQuestion`, `AnswerRecord`. |
| `src/engine/events.ts` | `GameEvent`-Union und `TimerToken` mit Generationszähler; `EngineInput` trägt die Uhr als Feldwert. |
| `src/engine/effects.ts` | `Effect`-Union und `Audience`. `persistRound`/`persistFinal` bleiben als Naht bestehen, obwohl heute niemand sie entgegennimmt. |
| `src/engine/step.ts` | Die eine Funktion mit Wirkung: Deadline-Abgleich vor jeder Eingabe, dann Dispatch. Dazu `createGame` und die serverseitige Namensprüfung. |
| `src/index.ts` | Sammelexport. |

### `packages/server` — Prozesszustand und Transport

| Datei | Zweck |
|---|---|
| `src/runtime/clock.ts` | Monotone Uhr aus `process.hrtime.bigint()`; dieselbe Zahl geht als gemeinsame Uhr an die Clients. |
| `src/runtime/codes.ts` | Sechsstelliger Spielcode aus Crockford-Base32 ohne `I L O U 0 1`, Kollisionsprüfung, Normalisierung der Spielereingabe. |
| `src/runtime/tokens.ts` | Opake Zufallstoken, Vergleich in konstanter Zeit. |
| `src/runtime/scheduler.ts` | `TimerToken` auf `setTimeout`, Abbruch über denselben Token. |
| `src/runtime/roomHandle.ts` | Hält den `GameState`, serialisiert Eingaben über eine Warteschlange (`step` läuft nie reentrant) und führt Effekte aus. |
| `src/runtime/roomRegistry.ts` | Räume im Prozessspeicher. |
| `src/transport/socketio/gateway.ts` | Verbindungsaufbau, Nachrichten zu `GameEvent`. Der Zeitstempel entsteht als **erste Anweisung** im Handler. |
| `src/transport/socketio/outbound.ts` | `Effect{send}` auf `emit`; bildet `Audience` auf Socket.IO-Räume ab. |
| `src/transport/socketio/clockSync.ts` | Verbindungszustand, serverseitige Umlaufzeitmessung (Ping alle 5 s, acht Proben, Minimum). |
| `src/http/static.ts` | Minimale Auslieferung der beiden gebauten Oberflächen, mit Pfadprüfung und SPA-Rückfall. |
| `src/demoQuiz.ts` | Das Demo-Quiz im Prozess: eine Single-Choice mit vier Optionen, eine Wahr/Falsch. |
| `src/main.ts` | Zusammenbau: HTTP, Socket.IO mit abgeschaltetem `perMessageDeflate`, Gateway, Startmeldung mit beiden URLs. |

### `apps/host-web` — die Bühne

`package.json`, `tsconfig.json`, `vite.config.ts` (Basis `/host/`, Entwicklungs-Proxy auf 3000), `index.html`,
`src/main.tsx` (Einstieg, bewusst ohne `StrictMode`, weil dessen doppelter Effektlauf zwei Räume anlegen würde),
`src/wire.ts` (Socket-Anbindung und Uhrenabgleich; Median für den Anzeige-Offset),
`src/shapes.tsx` (Blitz, Tropfen, Herz, Mond als Inline-SVG; feste Paarung mit Sonne, Welle, Glut, Nacht),
`src/styles.css` (Palette ausschließlich aus UX-Konzept 4; Schriftgrößen und Ränder aus Abschnitt 7),
`src/App.tsx` (Lobby, Ankündigung, Lesefenster, Antwortzeit, Auflösung mit Verteilungsbalken, Zwischenstand, Endstand; Leertaste schaltet weiter).

### `apps/player-web` — der Buzzer

Dieselben Dateien mit Basis `/play/`. `src/App.tsx` kennt sieben Ansichten: Code, Name, Warteraum, Ankündigung, gesperrte Kacheln, aktive Kacheln, Vollbild-Ergebnis, Zwischenstand, Endstand. Es gibt dort keinen Platz für einen Fragetext — das Protokoll liefert keinen.

### `test/core`

| Datei | Zweck |
|---|---|
| `fixture.ts` | Zwei-Fragen-Quiz, Hilfsfunktionen zum Lesen der Effekte. Kein Test. |
| `purity.test.ts` | Liest jede Datei unter `core/src` und schlägt fehl bei `Date.now`, `new Date`, `performance.now`, `Math.random`, `setTimeout`, `setInterval`, `queueMicrotask`, `process.`, `require(` sowie bei jedem Import außer `protocol`. |
| `scoring.test.ts` | Die Tabelle aus 5.4, Zeile für Zeile, plus der Latenzausgleich. |
| `answerWindow.test.ts` | Die Randfalltabelle aus 5.5. |
| `playthrough.test.ts` | Ein vollständiges Zwei-Fragen-Spiel durch alle sieben Phasen, plus ein Durchlauf mit gemischter Antwortreihenfolge. |

---

## 2. Gemessene Torzahlen

Selbst ausgeführt, nicht geschätzt.

| Tor | Befehl | Ergebnis |
|---|---|---|
| Build | `npm run build` | **Exit 0.** protocol, core, server über `tsc`; host-web in 645 ms, player-web in 640 ms über Vite. |
| Typen | `npx tsc --noEmit` | **Exit 0**, keine Ausgabe. `strict: true` über alle fünf Pakete und die Tests. |
| Tests | `npm test` | **46 Tests in 4 Dateien, alle grün.** Dauer 486 ms. |

Aufteilung der 46 Tests: `purity` 19, `scoring` 16, `answerWindow` 9, `playthrough` 2.

**Zwei Mutationsproben, damit die Zahlen etwas bedeuten** — beide zurückgenommen, Arbeitsbaum danach sauber:

1. `export const leak = Date.now();` an `core/src/ranking.ts` angehängt → `purity.test.ts` wird rot (1 von 19 fehlgeschlagen). Der Purity-Test prüft also tatsächlich etwas.
2. Den 50-Prozent-Deckel entfernt (`1 - t/limit/2` zu `1 - t/limit`) → `scoring.test.ts` wird rot (5 von 16 fehlgeschlagen). Die Formel ist durch die Tests gebunden, nicht nur beschrieben.

**Bundlegrößen** (gzip): Bühne 61,55 kB JS + 1,47 kB CSS; Buzzer 61,82 kB JS + 1,32 kB CSS. Siehe Folgeaufgabe 4.

---

## 3. Wie man es startet

Einmalig und nach jeder Änderung:

```
cd C:\Users\nikol\quiz
npm install
npm run build
npm start
```

Der Server meldet beim Start beide Adressen. Auf demselben Rechner:

| Rolle | URL |
|---|---|
| **Bühne (Host)** | `http://localhost:3000/host/` |
| **Spielergerät** | `http://localhost:3000/play/` |
| Spielergerät mit vorbelegtem Code | `http://localhost:3000/play/?code=ABC234` |

`http://localhost:3000/` leitet auf das Spielergerät um.

Ablauf: Bühne öffnen — der sechsstellige Code steht sofort da. In zwei weiteren Fenstern das Spielergerät öffnen, Code eintippen, Namen eingeben. Die Namen erscheinen auf der Bühne. Dort „Runde starten" klicken oder die Leertaste drücken. Weiterschalten geht ebenfalls mit der Leertaste.

Anderer Port, in PowerShell:

```
$env:PORT=3100; npm start
```

In Git Bash: `PORT=3100 npm start`.

**Entwicklungsmodus** (Hot Reload der Oberflächen) — drei Terminals:

```
npm start                               # Spielserver auf 3000
npm run dev -w @quizbude/host-web       # Bühne   auf http://localhost:5173/host/
npm run dev -w @quizbude/player-web     # Buzzer  auf http://localhost:5174/play/
```

Beide Vite-Server leiten `/socket.io` auf Port 3000 weiter.

---

## 4. Der durchlaufene Abnahmetest

Server auf Port 3100, gebaute Oberflächen, drei Browserfenster. Beobachtet:

1. Bühne öffnet, Code **QAJ498** steht sechsstellig da. ✓
2. Zwei Spielergeräte treten mit Code und Namen bei; „Anna" und „Bernd" erscheinen in der Lobby, Zähler „2 dabei". ✓
3. Host startet. Ankündigung „Frage 1 / 2", dann Fragetext mit stehendem Timer, Lesefenster **4900 ms** nach der Formel (7 Wörter Frage, 4 Wörter Antworten: 1500 + 2800 + 600). ✓
4. Während des Lesefensters zeigt das Spielergerät vier gedämpfte Kacheln unter der Zeile „LESEN" — **kein Fragetext, keine Antworttexte**. Die Momentaufnahme des Geräts enthält weder „Planet" noch „Merkur". ✓
5. Beide antworten. Anna trifft (Glut/Herz, hinter dem gemischt „Merkur" lag), Bernd daneben. Punkte serverseitig: Anna **827**, Bernd **0**. In der automatisierten Rauchprobe mit zwei korrekten Antworten im Abstand von 2,5 s bekam die schnellere 1000 und die langsamere weniger. ✓
6. Auflösung auf der Bühne: richtige Kachel mit Haken, falsche gedimmt mit Kreuz, Verteilungszahlen 1/0/1/0, Zeile „1 von 2 richtig". Gleichzeitig Vollbild auf den Geräten: „Daneben", „+0", „Platz 2 · 827 zurück". ✓
7. Host schaltet weiter: Zwischenstand, zweite Frage (Wahr/Falsch, zwei Breitkacheln auf dem Gerät), Endstand **Anna 1797 vor Bernd 788**, auf dem Gerät „Platz 2 von 2". ✓

Zusätzlich über eine kopflose Rauchprobe gegen den laufenden Server geprüft: Antwort vor der Freigabe wird mit `not_open` abgelehnt; eine zweite Antwort desselben Spielers liefert idempotent die erste zurück; nach der letzten Frage meldet der Zwischenstand `hasNextQuestion = false`.

---

## 5. Begründete Abweichungen

Jede einzeln, mit Grund.

**5.1 `PREVIEW_MS` ist die Ankündigung, nicht die ganze Vorschau.** Das Architekturkonzept setzt `PREVIEW_MS = 3000` fest; das UX-Konzept verlangt eine Ankündigung **und** danach ein nach Formel berechnetes Lesefenster von 4 bis 10 Sekunden. Beides zugleich geht nur so: `answersOpenAt = preparedAt + ANNOUNCE_MS + readingWindowMs`. Die Phase `PREVIEW` trägt deshalb zwei Zeitpunkte, `announceUntil` und `answersOpenAt`, und beide gehen an die Clients. Ohne diese Lesart wäre entweder die Formel oder die Konstante tot. *Siehe auch Folgeaufgabe 1.*

**5.2 Die Umlaufzeit-Statistik reist mit dem Ereignis, nicht im Zustand.** Architekturkonzept 3.4 führt `rtt: RttStats` als veränderliches Feld in `PlayerState`, gepflegt vom Transport. Das bricht die Reinheit, die Ruling 6 verlangt: der Transport müsste in den Zustand von `core` schreiben. Stattdessen trägt `AnswerSubmitted` ein Feld `rttMinMs`. Das ist strenger, nicht schwächer — `step` bleibt eine reine Funktion über `(Zustand, Ereignis, Zeitpunkt)`.

**5.3 `publicView` liefert nur den typspezifischen Teil.** Das Konzept zeigt den Handler eine vollständige `PublicQuestionView` mit Platzhalter-Nullen zurückgeben (siehe das Schieberegler-Beispiel in 4.5). Hier gibt er `PublicQuestionBody` zurück, und die Engine setzt Kopffelder wie Fragetext, Zeitlimit und Punktwert. Wirkung ist dieselbe, aber der Handler bekommt den Fragetext gar nicht erst zu sehen und kann ihn also auch nicht versehentlich verformen.

**5.4 `room:answer_count` geht an alle, nicht nur an den Host.** Architekturkonzept 6.6 beziffert diesen Strom als host-gerichtet. Das UX-Konzept verlangt aber auf Z6 die Zeile „17 von 18 sind fertig" **auf dem Spielergerät**. Bei ~20 Spielern sind das 20 Nachrichten in 20 Sekunden je Gerät, also rund 0,4 kB — unterhalb jeder Relevanz. Die Alternative wäre, die UX-Zusage zu streichen.

**5.5 `Verdict` hat ein optionales `accuracy`.** Ruling 3 des Auftrags sagt Richtig/Falsch, und genau das wird heute benutzt — `scoring/` liest das Feld nicht. Es steht nur da, damit der in 4.5 beschriebene Präzisionstyp später andockt, ohne dass `Verdict` bricht. Offene Entscheidung 8 des Architekturkonzepts nennt genau das als die Entscheidung, die „vor die Umsetzung gehört, nicht dahinter". Das Feld kostet null Zeilen Logik.

**5.6 Die Effekte `persistRound`, `persistFinal` und `closeRoom` werden erzeugt, aber nicht verarbeitet.** Ruling 4 verbietet Persistenz. Die Zustandsmaschine spezifiziert diese Effekte an bestimmten Phasenwechseln; sie wegzulassen hieße, die Übergangstabelle zu verändern. Der Adapter verwirft sie ausdrücklich mit Kommentar. Die Tests prüfen, dass sie an der richtigen Stelle entstehen.

**5.7 Keine Schriftarten geladen.** UX-Konzept 7 empfiehlt Fredoka oder Baloo 2 für die Display-Rolle. Beide würden eine Netzwerkabhängigkeit oder eine eingebettete Datei bedeuten; das Ladebudget ist ohnehin schon knapp (Folgeaufgabe 4). Verwendet wird ein System-Stack. Das ist eine sichtbare Lücke gegenüber der Design-Richtung und bewusst offengelassen.

**5.8 Zusätzliche Abhängigkeiten.** Vier, jede begründet: `socket.io` und `socket.io-client` (der im Stack vorgegebene Transport), `react`/`react-dom` plus `@vitejs/plugin-react` und `vite` (der vorgegebene Frontend-Stack), `typescript` und `@types/node` (Stack), **`vitest`** (nicht vorgegeben, aber ohne Testläufer gibt es kein Testtor; Node-eigener Läufer bräuchte zusätzlich einen TypeScript-Lader und damit genauso eine Abhängigkeit). Keine weitere.

**5.9 Kein `multi_select`.** Das Architekturkonzept führt ihn als dritten MVP-Typ; der Auftrag verbietet ausdrücklich „weitere Fragetypen" und verlangt genau zwei Demo-Fragen. Die Registry nimmt ihn als eine Zeile auf.

---

## 6. Gefundene Spezifikationsmängel — Folgeaufgaben

Nicht nebenbei behoben, wie beauftragt.

**F1 — Ankündigung und Lesefenster sind in den Dokumenten nicht zusammengeführt.** `konzept-architektur.md` 2.3 nennt `PREVIEW_MS = 3000` als die Vorschaudauer; `konzept-ux.md` 3 nennt eine berechnete Lesezeit von 4 bis 10 Sekunden *plus* eine Ankündigungsphase von T−8 bis T−5. Die Phase `PREVIEW` der Zustandsmaschine muss beide tragen, und keines der beiden Dokumente sagt, wie. Hier als Summe gelöst (5.1). **Zu entscheiden:** ob die Ankündigung eine eigene Phase bekommt oder ob `PREVIEW_MS` dauerhaft als Ankündigungsdauer umgedeutet wird. Betroffen sind die Übergangstabelle 2.2 und die Konstantentabelle 2.3.

**F2 — Die Kappung des Lesefensters bei 10 s wurde unter der 120-Zeichen-Annahme hergeleitet.** Das UX-Konzept rechnet den oberen Beispielfall mit „20 Wörtern, 120-Zeichen-Maximum" und kommt auf 11,3 s, also knapp über die Kappung. Mit den vom Auftrag gesetzten **200 Zeichen** sind rund 30 Wörter möglich; die Formel ergibt dann 13,5 s und mehr, die Kappung greift also nicht mehr als Ausnahme, sondern als Regel. Eine Frage an der Zeichengrenze bekommt damit systematisch zu wenig Lesezeit. **Zu entscheiden:** Obergrenze anheben, Formel strecken oder die Zeichengrenze für den Fragetext senken.

**F3 — Eine Nachzügler-Antwort erzeugt zwei `player:question_result`.** Beim Fensterschluss bekommt jeder Spieler ein Ergebnis, auch wer nicht geantwortet hat („keine Antwort"). Trifft danach innerhalb der Gnadenfrist doch noch eine Antwort ein, folgt ein zweites Ergebnis („zu spät"). Das Protokoll sagt nicht, welches gilt; die Oberfläche nimmt hier das zuletzt eingetroffene. **Vorschlag:** entweder im Protokoll festschreiben, dass das letzte Ergebnis je `seq` gilt, oder für den Nachzüglerfall eine eigene Nachricht einführen. Architekturkonzept 5.5, Fall 6 beschreibt die Buchung, nicht die Zustellung.

**F4 — Das 60-kB-Ladebudget der Beitrittsseite ist mit dem vorgegebenen Stack nicht einzuhalten.** Gemessen: 61,82 kB gzip für das Spielergerät, davon praktisch alles React und `socket.io-client`. Das UX-Konzept 6 bezeichnet das Budget als vom schlechten Mobilfunkgerät abgeleitet und ausdrücklich nicht verhandelbar; der Stack ist ebenso vorgegeben. Einer von beiden gibt nach. **Optionen:** Preact-Alias (spart rund 35 kB), handgeschriebener WebSocket-Client statt `socket.io-client` (spart rund 15 kB, kostet Reconnect-Logik), oder das Budget auf 70 kB anheben und das begründen.

**F5 — Für den Beitritt während eines laufenden Spiels fehlt die Zustellung.** `konzept-ux.md` Z1 sagt, der Beitritt bleibe erlaubt („du steigst bei Frage 4 ein"). Die Übergangstabelle erlaubt Beitritte ebenfalls in jeder Phase außer `PODIUM`/`FINISHED`. Es ist aber nirgends festgelegt, was ein solcher Spieler unmittelbar nach dem Beitritt zu sehen bekommt — `room:question_prepared` ist längst verschickt. Der Abzug aus 6.2 (`PlayerSnapshot`) wäre der richtige Weg, gehört aber zum nicht gebauten Reconnect. **Zu entscheiden** zusammen mit dem Reconnect.

**F6 — `PLAYER_HARD_CAP` und `PLAYER_SOFT_WARN` sind als Herleitung, nicht als Produktentscheidung markiert.** Das Nachzugsdokument bittet ausdrücklich um Bestätigung (5000 als Notbremse, 0 schaltet sie ab). Hier ist 5000 gesetzt, weil irgendein Wert im Code stehen muss. **Bestätigung erbeten.**

---

## 7. Was ausdrücklich noch fehlt

**Vom Auftrag ausgeschlossen und entsprechend nicht gebaut:** Quiz-Editor · jede Form von Persistenz · Reconnect und Sitzungstoken · Podium-Animation · Auswertungsseite · QR-Code · Spieler entfernen · Lobby sperren · Namensfilter · Nickname-Generator · Audio · Konfetti · Teams · weitere Fragetypen · Discord · Deployment, Dockerfile, CI.

**Darüber hinaus nicht gebaut, weil für die Abnahme nicht nötig** — jedes davon ist im Konzept spezifiziert und wäre ein eigenes kleines Paket:

| Fehlt | Konzeptstelle |
|---|---|
| `HostSkippedPreview` (Leertaste gibt das Lesefenster früher frei) | Übergang 7 |
| `HostForcedReveal` (Frage vorzeitig schließen) | Übergang 12 |
| `HostEndedGame` (Spiel mitten in einer Phase beenden) | Übergang 19, Regel 2.4 |
| `RoomLockToggled`, `PlayerRemoved` | Übergänge 3 und 4 |
| `ROOM_IDLE_TTL_MS` und `PODIUM_TTL_MS` (Räume räumen sich selbst ab) | Übergänge 21 und 22 |
| Endspurt (Timer springt auf 5 s, wenn nur noch zwei offen sind) | UX-Konzept 3 |
| Die Spielerliste zeigt getrennte Spieler als Umriss; der Raum vergisst sie nie | UX-Konzept 1.1/B3 |
| Verbindungsverlust-Banner auf beiden Geräten | UX-Konzept 8.2 |
| Punkte-Hochzählen, Zeilen-Tausch im Zwischenstand, Balken-Wachstum als Animation | UX-Konzept 3 und 7 |
| `multi_select` | Architekturkonzept 4.3 |
| Bilder in Fragen (`media_url`) | Offene Entscheidung 7 |

**Zwei Dinge, die nur am Gerät prüfbar sind** und hier nicht geprüft werden konnten: die Lesbarkeit aus 3 Metern auf einem echten Fernseher (gerechnet ist sie, siehe UX 0/Regel 3) und die Vibration beim Freigabemoment — `navigator.vibrate` gibt es auf dem Desktop nicht.

---

## 8. Commits auf `durchstich`

```
54fe48a  chore: Workspace-Gerüst und Paket protocol
5ef3ffd  feat: Spielkern core — Zustandsmaschine, Punkteformel, Fragetypen
cc2e791  test: Punkteformel, Antwortfenster, Purity und ein ganzes Spiel
f632960  feat: Server — Laufzeit, Socket.IO-Adapter und Demo-Quiz
a7fb52a  feat: Bühne und Buzzer — die beiden Oberflächen
```

Nicht nach `main` gemerged, nichts gepusht, kein Remote angelegt.
