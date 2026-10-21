# Quizbude — Stand

**Letzter Arbeitstag:** 2026-10-21 · **Branch:** `durchstich` (nicht nach `main` gemerged)

## Wo wir stehen

Konzeptphase abgeschlossen, Durchstich gebaut, unabhängig reviewt, Fix-Welle durchgelaufen, Nachreview erledigt, zweite Fix-Welle durchgelaufen, **zweite Welle nachreviewt**, dritte Fix-Welle durchgelaufen, Ein-Klick-Start gebaut, Ein-Klick-Start reviewt und die Befunde behoben, eigene Fragen hochladen gebaut, Fragen-Upload reviewt und die Befunde behoben (fünfte Welle), **fünfte Welle nachreviewt und ihre drei Befunde behoben** (sechste Welle, noch nicht nachreviewt).

**Selbst nachgemessen am Ende des Tages** (nicht aus Berichten übernommen):

```
npm test        318 Tests, 27 Dateien, grün, Exit 0
npx tsc         Exit 0  (strict: true aus tsconfig.base.json)
npm run build   Exit 0  (Spielergerät: kritischer Pfad 63,45 kB gzip, unverändert)
Riegel          node tools/standalone-parser.mjs — aktuell, Exit 0
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

## Was das Review des Ein-Klick-Starts ergeben hat

Der tiefere Befund war keiner der sieben: **`main.ts` war von keinem Test berührt.** Der Prüfer konnte dort den Exit-Code auf 0 drehen, die Portnachführung entfernen (am Gerät eine Endlosschleife, 97711 Durchläufe in sechs Sekunden) und die Browser-Adresse fest verdrahten — alle 150 Tests blieben grün. Die Entscheidungen beim Hochfahren stehen deshalb jetzt in `packages/server/src/runtime/startup.ts`; `main.ts` verdrahtet nur noch.

| | Befund | Stand |
|---|---|---|
| B1 | `listen(port)` ohne Host band im Dual-Stack neben einem fremden IPv4-Programm auf 3000 — ohne `EADDRINUSE`, ohne Ausweichen. Der Gastgeber sah über `::1` eine laufende Bühne, die Gäste landeten beim fremden Programm | behoben, Bindung auf `0.0.0.0`, `e29d2fd` |
| B2 | `PORT=abc` endete mit Exit 0, und die `.cmd` meldete „Die Runde ist vorbei" | behoben, `e29d2fd` |
| B3 | Der Banner sagte auch einen Kandidaten ohne Vorbehalt an, den die eigene Heuristik mit −16 bewertet hatte | behoben, `d2ee5d4` |
| B4 | Bei `PORT=0` nannte der Banner Port 0 statt des vergebenen | behoben, `e29d2fd` |
| B5 | Ein Fehler **nach** dem `listening` beendete den Abend | behoben, `e29d2fd` |
| B6 | Eine abgebrochene Installation wurde nie nachgeholt | behoben, `f8f302b` |
| B7 | Strg+C führte in den Fehlerzweig mit falscher Begründung | behoben, `f8f302b` |
| T1 | Der Familienriegel `isIPv4` ließ sich ersatzlos streichen | gebunden, `d2ee5d4` |

**Die Lehre dieser Welle:** die offene Stelle war wieder die Naht, nicht die Bausteine. Vier Module waren dicht gebunden, die Datei, die sie verdrahtet, von nichts. Vierzehn Rücknahmeproben, dreizehn rot, eine Leerprobe grün; dazu die Nachstellung am Gerät für B1, B2 und B4. Einzelheiten in `bericht-fixwelle-einklickstart.md`.

Sichtbare Folge für den Gastgeber: die Bühne heißt jetzt `http://127.0.0.1:<port>/host/` statt `localhost` — nach der IPv4-Bindung löst `localhost` unter Windows zuerst nach `::1` auf, wo niemand mehr lauscht.

## Entschieden: die beiden Nutzerentscheidungen sind gefallen

- **Lesefenster.** Die 10-Sekunden-Kappung **entfällt als Obergrenze**. Das Fenster wird dynamisch berechnet und hat eine **Mindestdauer von 10 s je Frage** (`READING_MIN_MS = 10000`, kein `READING_MAX_MS` mehr). Eine Frage an der 200-Zeichen-Grenze bekommt damit ihre 15,3 s statt gekappter 10 s; früher freigeben kann der Host jederzeit mit der Leertaste. Umgesetzt in `d0959a4`, nachgezogen in `konzept-ux.md` Abschnitt 3.
- **Ladebudget.** Das Budget der Beitrittsseite steht auf **65 kB gzip** (vorher 60 kB). Es meint den ganzen kritischen Pfad, nicht nur das JavaScript-Bündel; gemessen sind 63,45 kB mit React plus socket.io-client (0,31 kB HTML, 1,32 kB CSS, 61,82 kB JavaScript). Die 1,55 kB Abstand sind am Gerät nicht spürbar, und der Umbau, der Luft schaffen würde, kostet mehr, als er bringt. **React bleibt, kein Umbau.** Umgesetzt in `5c13d20`, nachgezogen in `konzept-ux.md` Abschnitt 6 und `konzept-architektur.md` 6.6.

Dazu unverändert: `PLAYER_HARD_CAP` steht auf 5000 — die hergeleitete Fairnessgrenze, kein Produktlimit.

## Eigene Fragen hochladen — neu

Jemand lässt sich von seiner KI Fragen schreiben, lädt die Ausgabe hoch, das Quiz startet. Der Autor der Datei ist ein Sprachmodell, kein tippender Mensch; danach richtet sich alles Weitere.

- **Ein Parser, im Kern.** `packages/core/src/questions/parse.ts` liest das Zeilenformat und — automatisch erkannt — JSON. Nachsichtig gegen alles, was das Werkzeug beilegt: Code-Zäune, Vorwort, Schlusswort, Nummerierung, `A)`-Beschriftungen, Fettschrift, Häkchen statt Stern, typografische Anführungszeichen, BOM, CRLF, geschützte Leerzeichen. Streng bei allem, was der Autor zu verantworten hat: zwei oder keine markierte Antwort, Textlängen, Antwortzahl, Antwortzeit. Jede Meldung trägt die **Zeilennummer der Originaldatei** und lässt sich zurück in die KI kippen.
- **Die Browser-Fassung benutzt denselben Parser.** `tools/standalone-parser.mjs` übersetzt den Kern und schreibt ihn zwischen zwei Marker in `standalone/quizbude.html`; `test/standalone/kern.test.ts` ist rot, sobald die ausgelieferte Datei nicht mehr aus dem heutigen Kern stammt — und fährt den ausgelieferten Block zusätzlich wirklich aus. Der handgeschriebene zweite Parser ist weg.
- **Erst Prüfbericht, dann Start.** Titel, Fragenzahl, geschätzte Spieldauer (aus `ANNOUNCE_MS`, Lesefenster, Antwortzeit plus Erfahrungswerten für Auflösung und Zwischenstand) und jede beanstandete Zeile. Erst ein ausdrücklicher Klick öffnet die Lobby — die Bühne beginnt mit den Fragen, nicht mit einem Raumcode.
- **Hochladen** per Ablegen, über eine Schaltfläche und als eingefügter Text, in beiden Fassungen. Gelesen wird **im Browser** (`FileReader`); es gibt keinen Hochladepfad im Server. Deckel: 1 MB je Datei, 200 Fragen je Sammlung, Ablehnung mit Anleitung, wenn die Datei nicht UTF-8 ist.
- **Eine Anweisung zum Kopieren** für die eigene KI steht in der Oberfläche beider Fassungen, mit Rückfall auf Markieren, wenn die Zwischenablage abgelehnt wird.

**Nicht einhaltbare Vorgabe, ausdrücklich abgewichen:** `transport/` sollte unberührt bleiben. Ohne eine Änderung in `gateway.ts` und `validate.ts` würde die Bühne aber immer die Demorunde spielen, egal was hochgeladen wird. Geändert sind 15 bzw. 22 Zeilen; die inhaltliche Prüfung liegt weiterhin in `loadQuestion`. `runtime/` ist unberührt. Begründung und Rückbauoption in `bericht-fragen-upload.md` Abschnitt 8.

**Noch zu tun:** `standalone/quizbude.html` muss als Artifact **neu veröffentlicht** werden. Die verlinkte Fassung spielt sonst weiter mit dem alten Parser und ohne Hochladen. Das Nachreview der fünften Welle hat die Veröffentlichung an N1 und N2 geknüpft; beide sind mit der sechsten Welle behoben.

Die Proben haben drei frische Tests als wertlos entlarvt (Code-Zaun, Normalisierung, Zeilenenden) und einen echten Fehler gefunden: der Riegel verglich die Zeilenenden mit und wäre nach jedem frischen Klon auf Windows rot gewesen. Einzelheiten, 43 Rücknahmeproben mit Wortlaut, in `bericht-fragen-upload.md`.

## Was das Review des Fragen-Uploads ergeben hat

Zwölf Befunde, davon vier blockierend. Der gemeinste war der stillste: `* ✅ Merkur` — Stern **und** Häkchen, die häufigste Mischform echter KI-Ausgaben — ging grün durch und schrieb das Häkchen auf die Kachel. Jeder im Raum sah die richtige Antwort, bevor er tippte; nichts meldete etwas. Daneben zwei Fälle, in denen ein grüner Prüfbericht eine Nutzlast erzeugte, die der Server stillschweigend verwarf oder an der die Verbindung abriss — und ein Fehlerpfad, der nie wieder aus sich herausfand.

Drei Mutationsproben des Reviews waren grün bei 276/276; zwei davon (B10) hat die fünfte Welle geschlossen, eine (B11) gehört in das nächste Transport-Paket. Der Bericht liegt als `review-fragen-upload.md`.

| | Befund | Stand |
|---|---|---|
| B1 | `* ✅ Merkur` ging grün durch, das Häkchen blieb im Antworttext stehen und verriet die Antwort auf der Leinwand | behoben, `e72eac3` + `223ec81` (ab der neunten Markierung war es zurück, s. N1) |
| B2 | Nach einer Ablehnung konnte die Bühne nie wieder eröffnen — der `room:error`-Pfad war in der Praxis tot | behoben, `e2593c2` |
| B3 | Eine erlaubte Datei riss die Verbindung ab: `maxHttpBufferSize` stand auf der Socket.IO-Vorgabe von 1e6 Bytes | behoben, `c2a5680` |
| B4 | Ein Titel über 256 Zeichen wurde grün geprüft und am Transportrand stillschweigend verworfen | behoben, `25e4409` |
| B5 | Vorwort **plus** Titelzeile machte aus dem Titel eine Frage ohne Antwort — die häufigste KI-Ausgabe überhaupt | behoben, `4f8cef9` |
| B6 | `A) ✅ Merkur` und `Merkur ✅` verloren die Markierung ganz | behoben, `e72eac3` |
| B7 | `loadQuestion` lässt Zahl und Erklärung ohne Obergrenze durch | offen, zweite Welle |
| B8 | `host:create` ohne Deckel, Räume werden nie freigegeben | offen, zweite Welle |
| B9 | `host:create` überschreibt die Raumbindung eines Spieler-Sockets | offen, zweite Welle |
| B10 | „Erst der Prüfbericht, dann die Lobby“ war in **beiden** Fassungen ungebunden | gebunden, `7b1024d` |
| B11 | Der Riegel „nur der Gastgeber schaltet weiter“ ist ungebunden | offen, nächstes Transport-Paket |
| B12 | Zweite, handgeschriebene Fassung der Escaping-Funktion in der Browser-Fassung | behoben, `c05b2c9` |

**Die Lehre dieser Welle:** jede Nachsicht des Parsers war einzeln getestet und funktionierte einzeln. Gebrochen ist die **Kombination** — Vorwort *und* Titel, Beschriftung *und* Häkchen, Stern *und* Häkchen. Tests, die Nachsichten aufzählen, sagen nichts über Eingaben, die mehrere zugleich tragen; genau so sehen echte KI-Ausgaben aber aus. Die neuen Tests **kreuzen** sie deshalb und führen den Leitfall des Reviews als eine einzige Eingabe mit.

Eine Alt-Zusage ist dabei ausdrücklich korrigiert worden: „erzeugt bei jeder Wiederverbindung und jedem weiteren Klick KEINEN zweiten Raum“ war in dieser Form falsch und widersprach dem `room:error`-Pfad derselben Welle. Sie steht jetzt in sechs Teilen, jeder einzeln gebunden. Einzelheiten, 26 Mutationsproben mit Wortlaut, in `bericht-welle5-fragen-upload.md`.

Nebenbei festgehalten: **Gesetz 0 hält auch für hochgeladene Inhalte.** Fragetext, Antworttext, Erklärung und Titel als Marker durch Upload → Raum → Spielergerät — keiner kommt an.

## Was das Nachreview der fünften Welle ergeben hat

Sieben der acht Behebungen tragen und sind mutationsgeprüft. Die Welle hatte dabei aber zwei neue Löcher gerissen, beide im Parser-Kern und damit in **beiden** Fassungen — das Nachreview hat die Veröffentlichung der Browser-Fassung genau daran abgelehnt. 26 Mutationsproben mit Wortlaut in `nachreview-welle5.md`.

| | Befund | Stand |
|---|---|---|
| N1 | Der Deckel der Abtrag-Schleife fiel nach oben offen aus: ab der **neunten** Markierung in derselben Zeile blieb das Häkchen im sichtbaren Label stehen, bei grünem Prüfbericht — B1 war zurück | behoben, `223ec81` |
| N2 | Der B5-Fix ließ die **erste** Frage stillschweigend verschwinden, wenn ihr nur die Markierung fehlte: neun statt zehn Fragen und „Alles in Ordnung" | behoben, `f903d7f` |
| N3 | Die Wirkung von B2 und B3 hing an je einer Zeile Verdrahtung, und die war nur durch einen Textschnipsel gebunden — beide Proben waren grün bei 309/309 und `tsc` Exit 0 | gebunden, `ddc15b2` |
| N4 | `docs/STAND.md` führte B1 als behoben | nachgezogen |

**Die Lehre dieser Welle:** zweimal hat ein Riegel **nach oben offen** ausgefallen statt geschlossen. Der Rundendeckel sicherte die Terminierung und ließ dafür genau den Schaden durch, gegen den die Vorwelle angetreten war; der verbreiterte Vorwort-Maßstab schloss einen Fall und öffnete am selben Zug einen stilleren. Beides fiel erst auf, weil das Nachreview über die getesteten Zahlen hinaus gemessen hat — die Falsch-Grün-Probe der fünften Welle prüfte elf Mischformen, von denen keine die achte Runde erreichte.

Der Rundendeckel war nebenbei auch teuer: mit ihm blieb der Rest des Markierungslaufs stehen, und die Regex am Zeilenende suchte ihn von jeder Zeichenstelle aus neu ab — 245 s am Dateideckel gegen 67 ms ohne Deckel.

Für N3 reichte ein Test nicht. Die Verdrahtung der Bühne lag im `useEffect` und war ohne DOM von keinem Verhaltenstest erreichbar; sie steht jetzt als `verdrahte()` daneben. Die Maße des Sockets lagen in `main.ts`, das kein Test anfasst; sie stehen jetzt in `transport/socketio/server.ts`, das auch das Harness aller Transporttests benutzt — und in `main.ts` gibt es kein `io` mehr, auf das sich die Mutation noch stützen könnte. Einzelheiten in `bericht-welle6.md`.

**Zwei Punkte gehören dem Nutzer vorgelegt** (gemessen, nicht behoben): `[x]` am Zeilenende steht sichtbar auf der Kachel und markiert dabei die *falsche* Antwort (`* Venus` / `Merkur [x]` → grün, Label „Merkur [x]"); und ein langer Markierungslauf **mitten** in einer Zeile bremst den Parser weiterhin quadratisch (9 s bei 64 000 Häkchen, am Dateideckel Minuten — im Browser des Gastgebers ein eingefrorener Tab). Beides steht in `bericht-welle6.md` Abschnitt 6.3 und 7.

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
- **Öffentliche IPv4 wird nicht angeboten.** Kandidaten sind nur die privaten Bereiche. Ein Rechner mit öffentlicher IPv4 direkt am Anschluss bekäme keinen Vorschlag — und liest heute „Keine Adresse im lokalen Netz gefunden - ist das WLAN an?", eine Frage in die falsche Richtung.
- **IPv6 wird nicht bedient.** Gebunden wird seit B1 ausdrücklich auf `0.0.0.0`, damit ein IPv4-Konflikt überhaupt gesehen wird. Ein reiner IPv6-Client kommt damit nicht durch; am Spieleabend ist das kein Fall.
- **`tools/build-needed.mjs` hat kein Tor.** Die Datei ist `.mjs` und steht in keinem `include` — weder `tsc` noch ein Test fasst sie an. Sechs Lagen sind von Hand gefahren.
- **UNC-Pfad im Starter.** Liegt der Ordner auf einer Netzfreigabe, scheitert `cd /d` still und die Diagnose zeigt auf das Internet. Restrisiko; ein Spieleabend-Rechner hat die Dateien lokal.
- **Windows-MAC-Randomisierung.** Ein echtes WLAN mit zufälliger Hardwareadresse gilt `isVirtualMac` als virtuell. In allen geprüften Paarungen gewinnt es trotzdem — das Merkmal ist dort aber wertlos.
- **Ob eine negativ bewertete Karte überhaupt angeboten werden soll**, ist eine Nutzerentscheidung. Seit B3 wird sie wenigstens als Vermutung ausgewiesen.

Dazu: die Zeitleiste in `konzept-ux.md` Abschnitt 3 nennt jetzt T−13,0 bis T0 — das ist die Mindestdauer; eine lange Frage schiebt den Anfang weiter nach vorn.

### 3. Eigenständige Browser-Fassung

Neben dem Durchstich liegt in `standalone/` eine eigenständige Browser-Fassung des Spiels: eine einzige Datei (`quizbude.html`), veröffentlicht als Artifact. Sie spielt mehrgerätig über die `room`-Laufzeitfähigkeit und hat einen netzfreien Ein-Gerät-Modus für den Fall, dass nur ein Bildschirm da ist. Was gebaut wurde und wie, steht in `standalone/bericht-standalone.md`.

**Bekannte Grenze:** Wer abgemeldet ist oder die Seite über einen öffentlichen Link öffnet, kann sich laut Laufzeitvertrag nicht verbinden; Senderechte gelten erst ab Stufe Contributor. Gäste ohne Konto können also nicht mitspielen — für den Spieleabend mit Freunden ohne Konto bleibt der Ein-Gerät-Modus oder der Server aus dem Durchstich.

### 4. Zweite Welle, noch nicht begonnen

Nicht im Durchstich und bewusst weggelassen: SQLite-Persistenz · Reconnect mit Sitzungstoken · Podium · Auswertungsseite · QR-Code · Spieler entfernen · Lobby sperren · Namensfilter · Audio · weitere Fragetypen.

Folgeaufgaben aus Review und Fix-Wellen stehen in `review-durchstich.md`, `bericht-fixwelle.md`, `nachreview-fixwelle.md`, `bericht-fixwelle-2.md`, `nachreview-fixwelle-2.md` und `bericht-fixwelle-3.md`.

## Starten

### Der normale Weg: doppelklicken

**`quizbude-starten.cmd`** im Projektordner doppelklicken. Mehr ist nicht zu tun.

Die Datei prüft Node, holt beim ersten Mal die Bausteine, baut nur, wenn sich etwas geändert hat, startet den Server und öffnet die Bühne im Standardbrowser. Das Fenster bleibt offen, solange der Server läuft; zum Beenden schließt man es.

Was dabei auf dem Bildschirm steht, ist die Adresse für die Gäste — nicht `localhost`, das zeigt auf ihr eigenes Telefon, sondern die Adresse dieses Rechners im WLAN. Der wahrscheinlichste Kandidat steht groß, die übrigen darunter als Alternativen, jeweils mit dem Namen der Netzwerkkarte. Liegt die Vermutung daneben, nimmt man die nächste Zeile. Hält die Heuristik ihren eigenen besten Kandidaten für virtuell, sagt sie „Wahrscheinlich" statt „Das" und fragt nach dem WLAN.

**Beim allerersten Start fragt Windows, ob Node im Netzwerk annehmen darf.** Erlauben — und den Haken bei **„Privat"** setzen. Wird das weggeklickt oder nur „Öffentlich" erlaubt, kommt kein Handy durch, und es sieht aus wie ein Programmfehler.

Ist Port 3000 belegt, nimmt der Server den nächsten freien bis 3010 und sagt, welchen — auch dann, wenn das fremde Programm nur IPv4 hält. Wer `PORT` von Hand setzt, bekommt kein Ausweichen: dann gilt genau dieser Port, und ist er belegt, endet der Start mit Exit-Code 1. Ein `PORT`, das keine Portnummer ist, endet ebenfalls mit 1 und sagt warum.

### Der zweite Weg: über die Kommandozeile

```
cd C:\Users\nikol\quiz
npm install
npm run build
npm start
```

Bühne: `http://127.0.0.1:3000/host/` · Spielergerät: `http://127.0.0.1:3000/play/`
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
| `review-einklickstart.md` | Unabhängiges Review des Ein-Klick-Starts: sieben Befunde, drei Mutationen an der Verdrahtung blieben grün |
| `bericht-fixwelle-einklickstart.md` | Vierte Welle: B1–B7 und T1, Startentscheidungen in `startup.ts`, vierzehn Rücknahmeproben |
| `bericht-fragen-upload.md` | Eigene Fragen hochladen: Format, verdautes KI-Beiwerk, ein Parser für beide Fassungen, 43 Rücknahmeproben |
| `review-fragen-upload.md` | Unabhängiges Review des Fragen-Uploads: zwölf Befunde, drei Mutationen blieben grün |
| `bericht-welle5-fragen-upload.md` | Fünfte Welle: B1–B6, B10, B12, eine korrigierte Alt-Zusage, 23 Rücknahmeproben |
