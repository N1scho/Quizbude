# Quizbude — Stand

**Letzter Arbeitstag:** 2026-10-20 · **Branch:** `durchstich` (nicht nach `main` gemerged)

## Wo wir stehen

Konzeptphase abgeschlossen, Durchstich gebaut, unabhängig reviewt, Fix-Welle durchgelaufen, Nachreview erledigt, zweite Fix-Welle durchgelaufen, **zweite Welle nachreviewt**, dritte Fix-Welle durchgelaufen, **Ein-Klick-Start gebaut**.

**Selbst nachgemessen am Ende des Tages** (nicht aus Berichten übernommen):

```
npm test        150 Tests, 19 Dateien, grün, Exit 0
npx tsc         Exit 0  (strict: true aus tsconfig.base.json)
npm run build   Exit 0  (Spielergerät: kritischer Pfad 63,45 kB gzip)
Arbeitsbaum     sauber
```

## Was das Nachreview ergeben hat

Alle sechs Befunde der ersten Welle sind **bewiesen behoben**: zwölf Rücknahmeproben, zwölf davon rot, kein Falsch-Grün in den neuen Tests. Die Zahlen des Umsetzerberichts stimmen. Der Bericht liegt als `nachreview-fixwelle.md`.

Das Nachreview fand dabei drei neue Befunde — zwei davon waren durchlässige Wächter, einer eine ungeprüfte Stelle am zentralen Gesetz:

| | Befund | Stand |
|---|---|---|
| NR1 | Der E1-Wächter kannte nur einfache Anführungszeichen; ein Rückfall in doppelten lief durch | behoben, `85cfa50` |
| NR2 | Die Abbildung von `scope` auf die Socket.IO-Räume in `outbound.ts` war von keinem Tor gedeckt | gebunden, `209767e` |
| NR3 | Die Importprüfung arbeitete zeilenweise und verfehlte umbrochene Importe | behoben, `4960558` |

Die zweite Welle hat sie geschlossen, jede mit eigener Rücknahmeprobe. Einzelheiten in `bericht-fixwelle-2.md`.

## Was das Nachreview der zweiten Welle ergeben hat

R1, NR2 und NR3 sind **bewiesen**. NR1 war nur teilweise bewiesen, und NR3 hatte beim Umbau eine neue Lücke aufgerissen: **zwei Wächter hatten je eine Lücke gegen eine andere getauscht.** Siebzehn Rücknahmeproben, kein Falsch-Grün in den neuen Tests. Der Bericht liegt als `nachreview-fixwelle-2.md`.

| | Befund | Stand |
|---|---|---|
| B1 | Der E1-Wächter las genau eine Datei; eine Zeile im bestehenden `connect`-Handler von `wire.ts` stellte E1 vollständig wieder her, während alle 105 Tests grün blieben | behoben, `60c54f7` |
| B2 | Die Importprüfung entfernte Blockkommentare ohne String-Bewusstsein; ein Kommentaranfang in einem Stringliteral verschluckte den nächsten echten Import | behoben, `09ef2c9` |
| B3 | Der E1-Wächter kannte keinen Leerraum vor der Klammer | behoben, `60c54f7` |
| B4 | `konzept-ux.md` nannte unter „Kritischer Pfad" nur den Bündelwert | behoben, `155b2ae` |
| B5 | `MAX_PROMPT_CHARS` war definiert und wurde nirgends durchgesetzt — mit dem offenen Lesefenster tragend geworden | behoben, `d353907` |
| R2 | Die Ping-Pong-Sperre trug nicht, was der Bericht über sie behauptete | Beschreibung korrigiert, Test unverändert, `1231fa5` |

**Die Lehre dieser Welle:** B1 und B2 waren derselbe Fehlertyp — ein Wächter, der so tut, als könne ein regulärer Ausdruck Quelltext zerlegen. Beide sind jetzt nicht enger gefasst, sondern anders gebaut: E1 hängt zusätzlich an einem Verhaltenstest (`test/host/wire.test.ts`), die Importprüfung am TypeScript-Parser (`test/quelltext.ts`). Einzelheiten in `bericht-fixwelle-3.md`.

## Entschieden: die beiden Nutzerentscheidungen sind gefallen

- **Lesefenster.** Die 10-Sekunden-Kappung **entfällt als Obergrenze**. Das Fenster wird dynamisch berechnet und hat eine **Mindestdauer von 10 s je Frage** (`READING_MIN_MS = 10000`, kein `READING_MAX_MS` mehr). Eine Frage an der 200-Zeichen-Grenze bekommt damit ihre 15,3 s statt gekappter 10 s; früher freigeben kann der Host jederzeit mit der Leertaste. Umgesetzt in `d0959a4`, nachgezogen in `konzept-ux.md` Abschnitt 3.
- **Ladebudget.** Das Budget der Beitrittsseite steht auf **65 kB gzip** (vorher 60 kB). Es meint den ganzen kritischen Pfad, nicht nur das JavaScript-Bündel; gemessen sind 63,45 kB mit React plus socket.io-client (0,31 kB HTML, 1,32 kB CSS, 61,82 kB JavaScript). Die 1,55 kB Abstand sind am Gerät nicht spürbar, und der Umbau, der Luft schaffen würde, kostet mehr, als er bringt. **React bleibt, kein Umbau.** Umgesetzt in `5c13d20`, nachgezogen in `konzept-ux.md` Abschnitt 6 und `konzept-architektur.md` 6.6.

Dazu unverändert: `PLAYER_HARD_CAP` steht auf 5000 — die hergeleitete Fairnessgrenze, kein Produktlimit.

## Offen — das Wichtigste zuerst

### 1. Zwei Restrisiken aus dem Nachreview, bewusst nicht behoben

Beide sind älter als die letzte Welle und stehen bewusst noch:

- **Timerpfad ohne örtliche Fehlerbehandlung.** `scheduler.ts:21-24` ruft `onFire` im `setTimeout`-Rückruf ohne `try/catch` auf; von dort geht es über `roomHandle.ts:42-57` direkt in `step`. Aufgefangen wird ein Wurf nur noch vom Prozessnetz in `main.ts`. Relevant wird das, sobald der Editor eigene Fragen zulässt und `parseSpec` wieder werfen kann — seit B5 wirft auch `loadQuestion` am Fragetext.
- **Stream-Fehler hinter dem `.catch`.** `static.ts:80` gibt nach `createReadStream(file).pipe(res)` sofort `true` zurück; das `.catch` in `requestListener.ts:28` kann einen Stream-Fehler deshalb strukturell nicht erreichen. Ein `.on('error')` auf dem Lesestrom schließt das.

### 2. Kleinere Folgeaufgaben

Unverändert offen aus dem Durchstich-Review: Raum-TTL und Drosselung, die Token als Kulisse, `MIN_TIME_FACTOR` ohne Wirkung. `MAX_PROMPT_CHARS` ist mit `d353907` **erledigt**.

Neu aus der dritten Welle, bewusst nicht behoben:

- **`MAX_NAME_CHARS = 16` ist ebenso undurchgesetzt, wie `MAX_PROMPT_CHARS` es war.** Die einzige Prüfung eines Spielernamens ist `isShortString` in `validate.ts:72`; die Konstante kommt im Quelltext nicht vor. Der Namensfilter der zweiten Welle ist der Moment, in dem das zählt — `parsePrompt` in `questions/load.ts` ist die Form, in der es zu lösen wäre.
- **Die Uhr-, Zufalls- und Timerprüfung in `purity.test.ts` läuft weiterhin zeilenweise über eine Regex.** Ein über eine Zeilengrenze geschriebenes `Date` `.now()` liefe durch. Seit B2 liegt die parserbasierte Zerlegung daneben; dieselbe Prüfung ließe sich darauf stellen.
- **`scope: 'all'` ist am echten Server ungebunden.** `room:answers_open` entsteht frühestens 13 s nach dem Start; sauber lösbar mit einer steuerbaren Uhr im Scheduler.
- **N1 (niedrig): Der Aufruf von `loadQuestion` in `packages/server/src/demoQuiz.ts` ist von keinem Test gebunden.** Entfernt man ihn und lässt die Fragetexte legal, bleiben alle 118 Tests grün — die Zusicherungen binden getrennt, die Verdrahtung nicht. Die Wirkung ist heute null; spürbar wird die Lücke erst mit dem Quiz-Editor der zweiten Welle.

Neu aus dem Ein-Klick-Start, bewusst nicht behoben:

- **QR-Code auf der Bühne.** Gehört zur zweiten Welle und war ausdrücklich nicht im Paket. Mit der jetzt gewählten Adresse ist es ein kleiner Schritt.
- **Öffentliche IPv4 wird nicht angeboten.** Kandidaten sind nur die privaten Bereiche. Ein Rechner mit öffentlicher IPv4 direkt am Anschluss bekäme keinen Vorschlag.
- **`::` und `0.0.0.0` teilen sich unter Windows denselben Port.** Hält ein fremdes Programm die 3000 auf `0.0.0.0`, bindet die Quizbude die 3000 auf `::` ohne auszuweichen — ein Handy über IPv4 landet dann womöglich beim fremden Programm. Einzelheiten in `bericht-einklickstart.md`.
- **Der Fall „alle elf Ports belegt"** ist als Test gebunden, am Gerät aber nicht nachgestellt.

Dazu: die Zeitleiste in `konzept-ux.md` Abschnitt 3 nennt jetzt T−13,0 bis T0 — das ist die Mindestdauer; eine lange Frage schiebt den Anfang weiter nach vorn.

### 3. Eigenständige Browser-Fassung

Neben dem Durchstich liegt in `standalone/` eine eigenständige Browser-Fassung des Spiels: eine einzige Datei (`quizbude.html`), veröffentlicht als Artifact. Sie spielt mehrgerätig über die `room`-Laufzeitfähigkeit und hat einen netzfreien Ein-Gerät-Modus für den Fall, dass nur ein Bildschirm da ist. Was gebaut wurde und wie, steht in `standalone/bericht-standalone.md`.

**Bekannte Grenze:** Wer abgemeldet ist oder die Seite über einen öffentlichen Link öffnet, kann sich laut Laufzeitvertrag nicht verbinden; Senderechte gelten erst ab Stufe Contributor. Gäste ohne Konto können also nicht mitspielen — für den Spieleabend mit Freunden ohne Konto bleibt der Ein-Gerät-Modus oder der Server aus dem Durchstich.

### 4. Zweite Welle, noch nicht begonnen

Nicht im Durchstich und bewusst weggelassen: Quiz-Editor · SQLite-Persistenz · Reconnect mit Sitzungstoken · Podium · Auswertungsseite · QR-Code · Spieler entfernen · Lobby sperren · Namensfilter · Audio · weitere Fragetypen.

Folgeaufgaben aus Review und Fix-Wellen stehen in `review-durchstich.md`, `bericht-fixwelle.md`, `nachreview-fixwelle.md`, `bericht-fixwelle-2.md`, `nachreview-fixwelle-2.md` und `bericht-fixwelle-3.md`.

## Starten

### Der normale Weg: doppelklicken

**`quizbude-starten.cmd`** im Projektordner doppelklicken. Mehr ist nicht zu tun.

Die Datei prüft Node, holt beim ersten Mal die Bausteine, baut nur, wenn sich etwas geändert hat, startet den Server und öffnet die Bühne im Standardbrowser. Das Fenster bleibt offen, solange der Server läuft; zum Beenden schließt man es.

Was dabei auf dem Bildschirm steht, ist die Adresse für die Gäste — nicht `localhost`, das zeigt auf ihr eigenes Telefon, sondern die Adresse dieses Rechners im WLAN. Der wahrscheinlichste Kandidat steht groß, die übrigen darunter als Alternativen, jeweils mit dem Namen der Netzwerkkarte. Liegt die Vermutung daneben, nimmt man die nächste Zeile.

**Beim allerersten Start fragt Windows, ob Node im Netzwerk annehmen darf.** Erlauben — und den Haken bei **„Privat"** setzen. Wird das weggeklickt oder nur „Öffentlich" erlaubt, kommt kein Handy durch, und es sieht aus wie ein Programmfehler.

Ist Port 3000 belegt, nimmt der Server den nächsten freien bis 3010 und sagt, welchen. Wer `PORT` von Hand setzt, bekommt kein Ausweichen: dann gilt genau dieser Port, und ist er belegt, endet der Start mit Exit-Code 1.

### Der zweite Weg: über die Kommandozeile

```
cd C:\Users\nikol\quiz
npm install
npm run build
npm start
```

Bühne: `http://localhost:3000/host/` · Spielergerät: `http://localhost:3000/play/`
Anderer Port in PowerShell: `$env:PORT=3100; npm start`

Zum echten Testen drei Fenster: eins als Bühne, zwei als Spieler — eins davon im Privatmodus, sonst teilen sie sich den Browserspeicher.

**Noch nicht am Gerät erlebt:** ob sich Timing, Lesefenster und Rhythmus gut anfühlen. Mit der Mindestdauer von 10 s ist das jetzt die dringendste offene Frage, denn zehn Sekunden stehende Zeit fühlen sich auf der Leinwand anders an, als sie sich rechnen. Das ist die eine Frage, die kein Test beantwortet.

## Entscheidungen, die schon gefallen sind

| Thema | Entscheidung |
|---|---|
| Name | Quizbude |
| Einsatz | Privat, Spieleabende, ~20 Spieler, kein Produktlimit |
| Plattform | Reine Web-App; Discord Activity später möglich, Spiellogik ist transportfrei |
| Optik | Eigene Gestaltung, **kein SIMO-Branding**, keine Kahoot-Kopie |
| Zeichengrenzen | 200 Zeichen Frage, 100 je Antwort (nicht 120/75 wie beim Vorbild) — beide durchgesetzt |
| Lesefenster | Dynamisch, Mindestdauer 10 s je Frage, keine Obergrenze |
| Ladebudget | 65 kB gzip für die Beitrittsseite, React bleibt |
| Ergebnistyp | Richtig/Falsch, Präzisionstyp später andockbar |
| Datenbank | SQLite als Zielzustand, im Durchstich noch gar keine |
| Streak-Bonus | Nicht bauen — das Vorbild hat ihn abgeschafft |

## Dokumente

| Datei | Inhalt |
|---|---|
| `kahoot-feature-analyse.md` | Feature-Analyse des Vorbilds, ~36 Quellen, MUST/SHOULD/COULD |
| `plattform-stack-entscheidung.md` | Web vs. Discord Activity vs. Bot, Stack, 44 Events |
| `konzept-architektur.md` | Schichtenschnitt, Zustandsmaschine, Timing, Datenmodell |
| `konzept-ux.md` | Screens, Wireframes, Palette mit gerechneten Kontrasten |
| `aenderung-2026-10-19-teilnehmerzahl.md` | Nachzug auf „kein Produktlimit, Normalfall 20" |
| `bericht-durchstich.md` | Was der Umsetzer gebaut hat |
| `review-durchstich.md` | Unabhängiges Review, zwei blockierende Befunde |
| `bericht-fixwelle.md` | Die sechs Fixes der ersten Welle |
| `nachreview-fixwelle.md` | Nachreview: alle sechs bewiesen behoben, drei neue Befunde |
| `bericht-fixwelle-2.md` | Zweite Welle: NR1–NR3 und die beiden Nutzerentscheidungen |
| `nachreview-fixwelle-2.md` | Nachreview der zweiten Welle: fünf Befunde, zwei Wächter mit getauschten Lücken |
| `bericht-fixwelle-3.md` | Dritte Welle: B1–B5, E1 am Verhalten, Importprüfung am Parser |
| `bericht-einklickstart.md` | Ein-Klick-Start: Doppelklick, WLAN-Adresse, Portausweichen, 18 Rücknahmeproben |
