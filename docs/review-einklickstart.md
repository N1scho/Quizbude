# Review: Ein-Klick-Start

**Datum:** 2026-10-20 · **Branch:** `durchstich` · **Geprüfter Diff:** `c66dec1..d5ac8c1` (`1dded32`, `110833c`, `d5ac8c1`) · **Prüfer:** unabhängig, rein lesend

## Urteil in einem Satz

Die vier reinen Funktionen sind sauber gebaut und — bis auf eine Regel — dicht gebunden; die **Verdrahtung in `main.ts` ist von keinem einzigen Test gedeckt**, und der Fall, für den das Ausweichen gebaut wurde, greift am Gerät nachweislich nicht, wenn das fremde Programm nur IPv4 hält.

## Selbst gemessene Tore

Nicht aus dem Bericht übernommen, eigenhändig gefahren:

```
npx vitest run     19 Dateien, 150 Tests, Exit 0
npx tsc --noEmit   Exit 0
npm run build      Exit 0
git status --short (leer, auch mit --untracked-files=all)
```

Die Zahlen des Umsetzers (150/19, vorher 118/15) stimmen.

## Befunde

### B1 — hoch, blockierend: das Ausweichen greift nicht, wenn das fremde Programm nur IPv4 hält

Der Umsetzer führt das als Folgeaufgabe mit einem „womöglich". Es ist kein „womöglich". Am Gerät nachgestellt, Windows 10 Home, Node 22:

Ein fremdes Programm belegt `0.0.0.0:3000` (nur IPv4 — so binden `python -m http.server`, Docker Desktops Port-Forwarder, viele Java- und .NET-Dienste). Dann gestartet:

```
$ node packages/server/dist/main.js
      http://localhost:3000/host/
      http://192.168.0.160:3000/play/        <- das liest der Gastgeber vor

$ netstat -ano | grep ":3000 "
  TCP    0.0.0.0:3000   LISTENING   6156     <- fremdes Programm
  TCP    0.0.0.0:3000   LISTENING  16104     <- Quizbude
  TCP    [::]:3000      LISTENING  16104

$ curl http://192.168.0.160:3000/play/       # was das Gasthandy bekommt
FREMDES PROGRAMM auf 3000
```

Kein `EADDRINUSE`, keine Warnzeile, kein Ausweichen. `main.ts:84` ruft `http.listen(port)` ohne Host; Node bindet `::` im Dual-Stack, und Windows lässt das neben einer bestehenden IPv4-Bindung zu.

**Das Schlimmste daran ist die Unsichtbarkeit.** Dieselbe Lage, zwei Abrufe:

```
$ curl -w "%{remote_ip}" http://localhost:3000/host/   ->  status=200  remote=::1
$ curl http://192.168.0.160:3000/                       ->  FREMDES PROGRAMM auf 3000
```

`localhost` löst unter Windows zuerst nach `::1` auf — der Gastgeber bekommt also durch `openStage` (`main.ts:81`) eine **funktionierende Bühne** zu sehen, während jedes Gasthandy beim fremden Programm landet. Er hat keinen Anlass, an der vorgelesenen Adresse zu zweifeln. Genau diese Kombination macht den Befund schwerer als die Folgeaufgabe im Bericht nahelegt.

Die vom Umsetzer vermutete Abhilfe ist belegt: bei derselben Belegung schlägt eine ausdrückliche IPv4-Bindung sauber fehl.

```
$ node -e "...listen(3000,'0.0.0.0')"
BIND 0.0.0.0 -> FEHLER EADDRINUSE
```

Zur Einordnung, ebenfalls gemessen: **zwei Quizbuden** kollidieren korrekt (beide binden Dual-Stack), die zweite meldet `Port 3000 ist belegt - ich nehme 3001.` Der Fehler tritt nur gegen einen IPv4-only-Nachbarn auf — und das ist der verbreitete Fall.

### B2 — mittel bis hoch: ein fehlgeschlagener Start endet mit Exit 0, und die `.cmd` meldet Erfolg

```
$ PORT=abc node packages/server/dist/main.js
[quizbude] Unbehandelter Fehler - der Server laeuft weiter:
  RangeError [ERR_SOCKET_BAD_PORT]: options.port should be >= 0 and < 65536. Received type number (NaN).
    at Server.listen (node:net:2091:5)
    at file:///C:/Users/nikol/quiz/packages/server/dist/main.js:75:6
EXIT=0
```

`main.ts:27` rechnet `Number(rawPort)` ohne Prüfung, `main.ts:84` wirft daraufhin synchron, und das Netz aus `main.ts:16-18` fängt den Wurf ab, behauptet „der Server laeuft weiter" und lässt die Ereignisschleife leerlaufen — Exit **0**.

Das ist wörtlich der Fehler, den `2e006c6` behoben hatte („Das uncaughtException-Netz aus B1 fing auch einen fehlgeschlagenen `listen` ab: bei belegtem Port endete der Prozess still mit 0"), nur über den synchronen Pfad wieder hereingekommen. Die Folge reicht bis in die `.cmd`: `quizbude-starten.cmd:74` prüft `if not "%ENDE%"=="0"` und druckt bei 0 die Zeile `Die Runde ist vorbei - der Server ist aus.` — für einen Server, der nie gestartet ist.

Die Zusicherung ist außerdem von keinem Tor gedeckt (siehe T2).

### B3 — mittel: der Banner nennt auch einen Kandidaten ohne Vorbehalt, den die Heuristik selbst für virtuell hält

`banner.ts:40` kennt nur zwei Zustände: Liste leer oder Liste nicht leer. Die Bewertung aus `scoreOf` (`network.ts:144-152`) wird weggeworfen, bevor sie jemand sieht (`network.ts:181`). Ein Entwicklerrechner mit WSL2 und ausgeschaltetem WLAN hat genau eine Karte — den Hyper-V-Standardschalter. Gerendert:

```
  Das tippen die Gaeste in ihr Handy:
      http://172.28.112.1:3000/play/
      (Netzwerkkarte: vEthernet (Default Switch))
```

Keine Alternative, kein Vorbehalt, kein Hinweis auf das WLAN — obwohl dieselbe Datei diesen Kandidaten mit **-14** bewertet hat (Bereich 0, Namensmarker −8, Hyper-V-MAC −8, kein Funkbonus). Der Satz „Keine Adresse im lokalen Netz gefunden - ist das WLAN an?" (`banner.ts:42`) wäre hier der richtige, wird aber nur bei leerer Liste gedruckt. Ein Mensch kann hier nicht selbst wählen — es steht nichts zur Wahl.

Der Auftrag fragt: merkt der Mensch es, wenn die Heuristik danebenliegt? Antwort: **solange mindestens zwei Kandidaten übrig sind, ja** — die Alternativen stehen mit Kartennamen darunter und sind gebunden (Proben B1/B2/B4 unten). **Bei genau einem Kandidaten nein**, und dann ist es stumm.

### B4 — niedrig bis mittel: `port` wird nicht aus der tatsächlichen Bindung nachgeführt

```
$ PORT=0 node packages/server/dist/main.js
      http://localhost:0/host/
      http://192.168.0.160:0/play/
```

Der Server läuft (auf einem zufälligen Port), der Banner nennt **0**. `main.ts:78` und `:81` lesen die Variable `port`, nicht `http.address()`. Im Ausweichpfad wird sie korrekt nachgeführt (`main.ts:68`, am Gerät belegt: drei belegte Ports → durchgehend 3003 in Banner und Browser-URL), bei `PORT=0` nicht. `PORT=0` ist ein geläufiges „nimm irgendeinen"; die `.cmd` setzt es nie.

### B5 — niedrig: der Startfehler-Handler gilt für die ganze Prozesslebensdauer

`main.ts:63-75` ist nicht auf die Startphase beschränkt. Ein `error`-Ereignis des HTTP-Servers **nach** dem `listening` läuft in dieselbe Entscheidung, trifft wegen `code !== 'EADDRINUSE'` auf `giveUp` und ruft `process.exit(1)` — mitten im Spiel. Das widerspricht der Absicht zwei Zeilen weiter oben: „ein uebersehener Pfad darf den Abend nicht beenden" (`main.ts:15`). Praktisch schwer auszulösen, deshalb niedrig — aber der Riegel gehört gelöst, sobald `listening` gefeuert hat.

### B6 — niedrig: eine abgebrochene Installation wird nie nachgeholt

`quizbude-starten.cmd:38` prüft `if exist "node_modules"`. Bricht `npm install` ab (Strg+C, Netz weg, Akku leer), bleibt ein halbes `node_modules` liegen; beim nächsten Doppelklick wird die Installation übersprungen, der Bau scheitert an fehlenden Paketen, und der Gastgeber landet bei `:baukaputt` mit der Diagnose „Das Bauen ist schiefgegangen" statt bei der wahren Ursache.

### B7 — niedrig: Strg+C führt in den Fehlerzweig mit falscher Begründung

`banner.ts:68` empfiehlt „Beenden: dieses Fenster schliessen oder Strg+C." Strg+C beendet Node mit `0xC000013A`; wer die Rückfrage „Batchvorgang abbrechen (J/N)?" mit **N** beantwortet, läuft in `quizbude-starten.cmd:74` und bekommt `:serverkaputt` zu lesen: „Der Server hat sich mit einem Fehler beendet. Haeufigster Grund: alle Ports von 3000 bis 3010 sind belegt." Falsche Fährte nach einem empfohlenen Beenden.

## Die Reihungsheuristik gegen fremde Rechner

Fünfzehn Lagen gegen das übersetzte Modul gefahren, nicht gegen den Zielrechner. Das Ergebnis trägt überwiegend.

Richtig entschieden: WLAN und Kabel gleichzeitig (beide erreichbar, Reihenfolge egal); Tailscale/CGNAT `100.64/10` fällt ganz heraus; WireGuard-`/24` im 10er-Netz steht hinter einem echten 192.168er — und auch hinter einem echten 10er-Netz, weil die Karte „Ethernet 6" heißt und die Tunnelkarte nicht; WSL2 und Docker stehen hinter dem WLAN; ein **echtes Heimnetz in 172.16/12** gewinnt gegen den WSL-Schalter (`172.16.5.77` vor `172.22.48.1`) — die Namens- und MAC-Regeln tragen hier, nicht die Bereichsreihung; ein Router, der dem Rechner selbst die `.1` gibt, verliert dadurch nicht (der `.1`-Abzug ist mit −1 bewusst klein gehalten und wird vom Funkbonus überstimmt); ein `/32`-VPN im 192.168er steht hinter einem echten 10er-Netz.

Drei Punkte verdienen Erwähnung, keiner davon ist ein Befund:

**Windows-MAC-Randomisierung.** Ein echtes WLAN mit zufälliger Hardwareadresse trägt das Bit für lokal vergebene Adressen und wird von `isVirtualMac` (`network.ts:128`) als virtuell gewertet. In allen geprüften Paarungen gewinnt es trotzdem, weil der Funkbonus (+2) und der symmetrische Abzug beim Gegenkandidaten das auffangen. Das Merkmal ist in diesem Fall aber wertlos, und der Abstand schrumpft auf das Namensmerkmal.

**Mobiler Hotspot.** Schaltet der Gastgeber den Windows-Hotspot ein und hängen die Gäste daran, ist `192.168.137.1` die richtige Adresse — und genau die bestraft der `.1`-Abzug. Sie landet auf Platz zwei und bleibt sichtbar; im Einzelkandidaten-Fall siehe B3.

**Gast-WLAN.** Hängt der Rechner zugleich im Gast-WLAN (isoliert) und per Kabel im Heimnetz, gewinnt der Funkbonus und die Heuristik nennt das isolierte Netz zuerst. Die Alternative steht darunter — tragfähig, aber es ist die Lage, in der der Gastgeber die zweite Zeile braucht.

## Rücknahmeproben

Alle Proben über eine Sicherungskopie im Scratchpad, binär zurückgespielt und mit `cmp` geprüft. Je Probe anschließend `git status --short` auf die Datei: leer.

### `network.ts` — die Reihungsregeln einzeln zurückgedreht

| | Mutation (`datei:zeile`) | Ergebnis | Fehlermeldung im Wortlaut |
|---|---|---|---|
| M1 | `network.ts:146` Namensmarker-Abzug entfernt | **bewiesen** | `expected [ '192.168.4.77', '192.168.0.160' ] to deeply equal [ '192.168.0.160', '192.168.4.77' ]` |
| M2 | `network.ts:147` MAC-Abzug entfernt | **bewiesen** | `expected [ '192.168.3.77', '192.168.0.160' ] to deeply equal [ '192.168.0.160', '192.168.3.77' ]` |
| M3 | `network.ts:148` Punkt-zu-Punkt-Abzug entfernt | **bewiesen** | `expected [ '10.8.0.6', '10.0.0.50' ] to deeply equal [ '10.0.0.50', '10.8.0.6' ]` |
| M4 | `network.ts:149` `.1`-Abzug entfernt | **bewiesen** | `expected [ '192.168.5.1', '192.168.9.77' ] to deeply equal [ '192.168.9.77', '192.168.5.1' ]` |
| M5 | `network.ts:150` Funkbonus entfernt | **bewiesen** | `expected 'Ethernet' to be 'WLAN' // Object.is equality` |
| M6 | `network.ts:168` `internal`-Riegel entfernt | **bewiesen** | `expected [ '10.0.0.50', '10.0.0.1' ] to deeply equal [ '10.0.0.50' ]` |
| M7 | `network.ts:169` IPv4-Riegel entfernt | **unbewiesen (grün)** | — |
| M8 | `network.ts:172` Bereichsfilter entfernt | **bewiesen** | `expected [ '192.168.0.160', …(5) ] to not include '169.254.83.107'` |
| M9 | `network.ts:106` 172er auf Rang von 192.168 gehoben | **bewiesen** | `expected [ '172.20.1.5', '192.168.1.5', …(1) ] to deeply equal [ '192.168.1.5', '10.0.0.5', …(1) ]` |
| M10 | `network.ts:105` 10er auf Rang von 192.168 gehoben | **bewiesen** | `expected [ '10.0.0.5', '192.168.1.5', …(1) ] to deeply equal [ '192.168.1.5', '10.0.0.5', …(1) ]` |

**M7 ist die eine unbewiesene Regel.** `if (!isIPv4(entry)) continue;` lässt sich ersatzlos streichen, ohne dass ein Test fällt. Der Test „laesst IPv6 liegen" (`test/server/network.test.ts:181-188`) bindet nicht den Familienriegel, sondern `octets` — `fe80::1` hat keine vier punktgetrennten Zahlen und fällt schon dort heraus. Das ist dieselbe Sorte Zeile, die der Umsetzer beim APIPA-Riegel richtig erkannt und entfernt hat: ein Merkmal, dessen Wirkung ein anderes Merkmal bereits mitnimmt. Praktischer Schaden ist keiner zu konstruieren (`os.networkInterfaces()` liefert keine IPv6-Adresse in Punktschreibweise), deshalb kein Befund, sondern Test-Lücke T1.

### `ports.ts` — bindet der Test das Ausweichen oder nur „irgendeinen Port"?

Er bindet das Ausweichen. Alle vier Proben rot:

| | Mutation | Ergebnis | Fehlermeldung im Wortlaut |
|---|---|---|---|
| P1 | `ports.ts:63` `port: next` → `port: facts.current + 1` | **bewiesen** | `expected { kind: 'retry', port: 3001 } to deeply equal { kind: 'retry', port: 3005 }` |
| P2 | `ports.ts:49` Riegel „PORT gesetzt" ausgeschaltet | **bewiesen** | `expected 'retry' to be 'giveUp' // Object.is equality` |
| P3 | `ports.ts:46` Riegel „anderer Fehler" ausgeschaltet | **bewiesen** | `expected 'retry' to be 'giveUp' // Object.is equality` |
| P4 | `ports.ts:55` unbekannter Port fällt auf Folgenanfang | **bewiesen** | `expected 'retry' to be 'giveUp' // Object.is equality` |

Der Test mit der lückenhaften Folge `[3000, 3005, 3007]` (`test/server/ports.test.ts:48-56`) ist der entscheidende: er trennt „nächster der Folge" von „nächsthöhere Zahl". Das ist richtig gebaut.

### `banner.ts` — stehen die Alternativen wirklich darunter?

| | Mutation | Ergebnis | Fehlermeldung im Wortlaut |
|---|---|---|---|
| B-M1 | `banner.ts:56` Alternativenschleife leergelegt | **bewiesen** | `expected -1 to be greater than 272` |
| B-M2 | `banner.ts:28` Reihenfolge umgedreht | **bewiesen** | `expected 272 to be greater than 394` |
| B-M3 | `banner.ts:50` `best.address` → `localhost` | **bewiesen** | `expected '…' to contain 'http://192.168.0.160:3007/play/'` |
| B-M4 | `banner.ts:51` Kartenname weggelassen | **bewiesen** | `expected '…' to contain 'Ethernet 6'` |
| B-M5 | Leerprobe (identischer Ersatz) | **grün, wie erwartet** | — |

B-M5 ist der Wachhund gegen eine Prüfvorrichtung, die immer rot meldet: identischer Ersatz, Suite grün.

### `main.ts` — die Verdrahtung ist von nichts gedeckt

Drei Mutationen, jeweils gegen die **ganze** Suite:

| | Mutation | Ergebnis |
|---|---|---|
| W1 | `main.ts:74` `process.exit(1)` → `process.exit(0)` | **19 Dateien / 150 Tests grün** |
| W2 | `main.ts:68` `port = decision.port;` entfernt | **19 Dateien / 150 Tests grün** |
| W3 | `main.ts:81` Flagge und Port ignoriert, fest `3000` geöffnet | **19 Dateien / 150 Tests grün** |

**W2 ist die gefährlichste.** Was die Suite durchwinkt, ist am Gerät eine Endlosschleife — dieselbe Mutation auf das gebaute `dist/main.js` angewandt, mit belegter 3000:

```
EXIT=124 (nach 6 s abgeschossen)
Warnzeilen "Port 3000 ist belegt - ich nehme 3001.": 97711
```

Die Schleife terminiert ausschließlich, weil `main.ts:68` den Port nachführt, bevor `main.ts:69` erneut lauscht. Diese eine Zuweisung ist das Abbruchkriterium der ganzen Ausweichmechanik und von nichts gebunden.

### Live am Gerät, nicht mutiert

| Lage | Ergebnis |
|---|---|
| 3000–3002 belegt (Dual-Stack) | `ich nehme 3001` → `3002` → `3003`, Banner durchgehend 3003, kein halb offener Server im `netstat` |
| alle elf Ports 3000–3010 belegt | **Exit 1**, `[quizbude] Alle Ports von 3000 bis 3010 sind belegt.` |
| `PORT=3000` gesetzt, 3000 belegt | **Exit 1**, `PORT ist ausdruecklich gesetzt - dann weiche ich nicht aus.` |
| `PORT=abc` | **Exit 0** — siehe B2 |
| `PORT=0` | läuft, Banner nennt Port 0 — siehe B4 |

Damit ist der vom Umsetzer offen gelassene Punkt „alle elf Ports belegt, live nicht nachgestellt" geschlossen: er trägt.

## Die Behauptung zum Ruling `2e006c6`

Zur Hälfte richtig.

**Richtig:** Der Test existierte nie. `git show --stat 2e006c6` zeigt `packages/server/src/main.ts | 7 +++++++`, eine Datei, keine Testdatei. In `test/` findet sich bis heute kein Treffer auf `main.ts`, `process.exit` oder `exitCode` — die einzige Fundstelle ist der Kommentar, den der Umsetzer selbst in `test/server/ports.test.ts:11` geschrieben hat. Der Umsetzer hat zu Recht gegen den Auftrag widersprochen.

**Falsch:** „Die Zusicherung ist jetzt erstmals gebunden." Gebunden ist `decideAfterListenError` — eine reine Funktion, die ein `{ kind: 'giveUp' }` zurückgibt. Dass aus diesem Rückgabewert ein Exit-Code 1 wird, bindet kein Test: W1 dreht `process.exit(1)` auf `process.exit(0)` und die Suite bleibt vollständig grün. Und die Zusicherung gilt nicht einmal mehr — B2 zeigt einen realen Pfad, auf dem ein nicht gelungener Start mit 0 endet. Urteil: **unbewiesen, und am Gerät verletzt.**

## `quizbude-starten.cmd` und `tools/build-needed.mjs`

Der Kontrollfluss der `.cmd` hält, was statisch prüfbar ist: reines ASCII, durchgehend CRLF (nachgemessen: 153 CRLF, 0 nackte LF), zehn Labels, siebzehn `goto`, jedes trifft, jeder Fehlerzweig endet über `:ende` bei `pause`. In keiner `echo`-Zeile stehen unmaskierte Sonderzeichen; die einzige Zeile mit Metazeichen ist `quizbude-starten.cmd:26` und dort gewollt — und bemerkenswerterweise **ohne** das klassische Leerzeichen vor der Pipe, das die Versionsprüfung sonst still kaputtgemacht hätte.

Pfade mit Leerzeichen und Umlauten trägt `cd /d "%~dp0"` (Zeile 4); ein Aufruf aus einem anderen Arbeitsverzeichnis ebenfalls. Nicht abgefangen ist der UNC-Pfad: liegt der Ordner auf `\\server\freigabe`, scheitert `cd /d` still, die `.cmd` arbeitet in `C:\Windows` weiter, und `npm install` scheitert dort — der Anwender landet bei `:installkaputt` mit einer Diagnose, die auf das Internet zeigt. Restrisiko, kein Befund: ein Spieleabend-Rechner hat die Dateien lokal.

Die Entscheidung „Bau nötig?" greift. Sechs Lagen selbst gefahren:

| Lage | Ausgabe | Exit |
|---|---|---|
| frisch gebaut, nichts angefasst | `Der letzte Bau ist noch aktuell.` | 0 |
| eine Quelldatei berührt | `Neu bauen: die Quellen sind neuer als das letzte Ergebnis.` | 1 |
| `package.json` berührt | dieselbe Meldung | 1 |
| `packages/protocol/dist` fehlt | `Neu bauen: packages/protocol/dist fehlt.` | 1 |
| `dist` vorhanden, aber leer | `Neu bauen: apps/host-web/dist fehlt.` | 1 |
| `dist` mit leerem Unterordner (halb gebaut) | `Neu bauen: apps/host-web/dist fehlt.` | 1 |

Der Trick, der das trägt, ist die Asymmetrie in `tools/build-needed.mjs:89-101`: verglichen wird die **jüngste** Quelle gegen das **älteste** Ergebnis. Ein halb gebautes `dist` hat entweder einen leeren Zweig (dann greift `oldest(...) === 0` in Zeile 83) oder eine alte Datei, die den Vergleich kippt. Die Richtung stimmt: im Zweifel wird gebaut.

## Die vier Abweichungen, einzeln geprüft

**1. Die Bühne öffnet der Server, nicht die `.cmd`. Richtig.** Die Begründung ist am Gerät belegt: bei drei belegten Ports landet der Server auf 3003, und `main.ts:81` öffnet `http://localhost:3003/host/`. Eine `.cmd`, die vorab 3000 öffnet, hätte genau im Ausweichfall die falsche Seite gezeigt. Die Steuerung über `QUIZBUDE_BUEHNE_OEFFNEN` ist gebunden (`test/server/browser.test.ts:5-11`), und `spawn` ohne `shell` schließt die Einschleusung über die URL aus. Einschränkung: dass der Gastgeber immer eine funktionierende Bühne sieht, ist unter B1 ein Nachteil — es verbirgt den Fehler.

**2. `tools/build-needed.mjs` außerhalb von `packages/server/src`. Richtig.** Der Wächter läuft, bevor gebaut wird, kann also nicht aus `dist` kommen. Der Preis ist zu nennen: `tsconfig.json` nimmt nur `.ts` auf, die Datei ist `.mjs` und steht in keinem `include` — weder `tsc --noEmit` noch ein Test fassen sie an. Deshalb oben die sechs Lagen von Hand.

**3. Konsolenausgabe auf ASCII. Richtig und gebunden** für `banner.ts` (`test/server/banner.test.ts:51-55`, Zeichen > 126). Die Datei selbst ist ASCII (nachgemessen), die `.cmd` ebenfalls. Nicht gebunden sind die Meldungen in `main.ts:17,20,67,72` — sie sind heute umlautfrei, aber nichts hält sie dort.

**4. Öffentliche IPv4 wird nicht angeboten. Richtig entschieden**, mit einer Nebenwirkung, die der Umsetzer nicht nennt: ein Rechner mit öffentlicher IPv4 bekommt `banner.ts:42` zu lesen — „Keine Adresse im lokalen Netz gefunden - ist das WLAN an?". Die Frage geht in die falsche Richtung; das WLAN ist an. Das ist Teil derselben Lücke wie B3: der leere und der schlechte Fall sehen von außen gleich aus.

## Test-Lücken

- **T1** — `network.ts:169` (`isIPv4`) ist unbewiesen: ersatzlos zu streichen, ohne dass ein Test fällt. Der Test in `test/server/network.test.ts:181-188` bindet `octets`, nicht die Familie.
- **T2** — `main.ts` ist von keinem Test berührt. Drei Mutationen an der Verdrahtung lassen 150/150 grün: der Exit-Code (W1), die Abbruchbedingung der Ausweichschleife (W2) und die Browsersteuerung (W3). Die drei reinen Funktionen sind dicht, die Naht zwischen ihnen ist offen — in diesem Projekt genau die Stelle, an der die Lücke bisher immer stand.
- **T3** — `quizbude-starten.cmd` und `tools/build-needed.mjs` haben kein Tor. Beide sind heute in Ordnung; beide können unbemerkt kaputtgehen.

## Folgeaufgaben (getrennt von den Befunden)

- Für B1 ist die Richtung belegt (ausdrückliche Bindung auf `0.0.0.0` erkennt die Kollision). Ob die Bühne dann noch über `localhost` erreichbar bleibt, ist zu messen, bevor das entschieden wird — eine Produktfrage, keine Reviewfrage.
- Ein Vertrauensmaß im Banner (B3): ob eine negativ bewertete Karte überhaupt als „die Adresse" angeboten werden soll, ist eine Entscheidung des Nutzers, nicht des Reviews.
- QR-Code und öffentliche IPv4 als letzter Ausweg: unverändert offen, ausdrücklich nicht im Paket.

## Was nur am Gerät prüfbar bleibt

Der Doppelklick aus dem Explorer selbst — dass sich das Fenster öffnet, offen bleibt und am Ende die Abschiedszeile zeigt. Der Windows-Firewall-Dialog beim allerersten Start und der Haken bei „Privat"; ohne ihn kommt kein Handy durch, und keine Zeile Code kann das belegen. Ob ein echtes Gasthandy `http://192.168.0.160:3000/play/` im WLAN erreicht. Dass sich der Standardbrowser tatsächlich öffnet (ich habe `openStage` nicht scharf ausgelöst, um kein Fenster auf dem Rechner aufzureißen; belegt ist nur, dass ein Fehlschlag folgenlos bleibt). Die fünf Fehlerzweige der `.cmd` — kein Node, zu altes Node, kein npm, gescheiterte Installation, gescheiterter Bau — sind statisch geprüft, aber nicht ausgeführt.

## Arbeitsbaum

Alle Mutationen über binäre Sicherungskopien zurückgespielt und mit `cmp` geprüft; die Mutation am gebauten `dist/main.js` ebenso. Nach der letzten Probe:

```
$ git status --short --untracked-files=all
(leer)

$ git diff --stat
(leer)

$ npx vitest run      19 Dateien, 150 Tests, Exit 0
$ npx tsc --noEmit    Exit 0
```

Hinweis zur Nebenwirkung: Die Proben haben Quelldateien inhaltsgleich neu geschrieben, womit sich deren Änderungszeit verschoben hat. `tools/build-needed.mjs` hat daraufhin erwartungsgemäß „neu bauen" verlangt; nach einem vollständigen `npm run build` meldet er wieder „Der letzte Bau ist noch aktuell." Git kennt keine Änderungszeiten, der Stand des Branches ist unberührt.
