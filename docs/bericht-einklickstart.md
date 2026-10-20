# Bericht: Ein-Klick-Start

**Datum:** 2026-10-20 · **Branch:** `durchstich` · **Ausgangspunkt:** `c66dec1`

## Was gebaut wurde

Nikolai doppelklickt `quizbude-starten.cmd`, und kurz darauf steht die Bühne auf dem Bildschirm, während auf dem Tisch die Adresse liegt, die die Gäste in ihre Handys tippen. Dazwischen liegen vier Dinge, die vorher gefehlt haben.

**1. `quizbude-starten.cmd` im Wurzelverzeichnis.** Prüft der Reihe nach Node und seine Version, holt die Bausteine nur bei fehlendem `node_modules`, baut nur bei Bedarf, startet den Server. Jeder Abbruch nennt in eigenen Worten, was zu tun ist, und bleibt mit `pause` stehen.

**2. Der Server nennt die Adresse fürs WLAN.** Statt `localhost` — für Gäste wertlos, das zeigt auf ihr eigenes Telefon — nennt er jetzt die erreichbaren privaten IPv4-Adressen, den wahrscheinlichsten Kandidaten groß und die übrigen darunter.

**3. Belegter Port.** Ohne gesetztes `PORT` sucht der Server von 3000 bis 3010 den nächsten freien und sagt, welchen er genommen hat.

**4. Die Firewall** wird vor dem Start angesprochen, nicht versteckt in einer Datei, die niemand liest.

Die Logik liegt in reinen Funktionen — `packages/server/src/runtime/network.ts`, `ports.ts`, `banner.ts`, `browser.ts` —, nicht im Rumpf von `main.ts` und nicht im Skript. `main.ts` verdrahtet nur noch.

## Warum die Adressauswahl so gebaut ist

Das war der heikle Teil, und er war heikler als erwartet. Auf dem Zielrechner liegen neben der Netzwerkkarte ein ExpressVPN-Tunnel, Tailscale, eine VirtualBox-Karte und zwei VMware-Netze. Die Routing-Tabelle sagt, welche die richtige ist: die Standardroute `0.0.0.0` läuft über `192.168.0.160`.

| Karte | Adresse | MAC | Urteil |
|---|---|---|---|
| ExpressVPNOpenVPN WinTUN Adapter | 100.64.100.6/32 | `00:00:00:00:00:00` | raus — kein privater Bereich |
| Tailscale | 169.254.83.107 | `00:00:00:00:00:00` | raus — APIPA |
| **Ethernet 4** | 192.168.56.1/24 | `0a:00:27:00:00:09` | VirtualBox — **am Namen nicht zu erkennen** |
| VMware Network Adapter VMnet1 | 192.168.159.1/24 | `00:50:56:c0:00:01` | VMware |
| VMware Network Adapter VMnet8 | 192.168.91.1/24 | `00:50:56:c0:00:08` | VMware |
| **Ethernet 6** | 192.168.0.160/24 | `2c:f0:5d:97:fd:74` | **die richtige** |

Die VirtualBox-Karte heißt schlicht „Ethernet 4", die echte „Ethernet 6". Eine Namensliste allein hätte hier die falsche gewählt — und zwar still. Verraten wird die virtuelle Karte von ihrer MAC (`0a:…` hat das Bit für lokal vergebene Adressen gesetzt; echte Hardware trägt eine bei der IEEE gekaufte Kennung) und davon, dass sie die `.1` ihres eigenen Netzes hält.

Gereiht wird deshalb nach fünf Merkmalen: privater Bereich (192.168 vor 10 vor 172.16–31, wo Docker, WSL und Hyper-V liegen), Namensmarker, MAC, Netzmaske (ein `/32` ist ein Tunnel, daran hängt kein WLAN) und die `.1`-Endung. Bei Gleichstand wird stabil nach Namen sortiert, damit zwei Läufe dasselbe sagen.

**Geraten wird trotzdem nicht stillschweigend.** Die übrigen Kandidaten stehen darunter, mit dem Namen der Netzwerkkarte, damit ein Mensch entscheiden kann, wenn die Vermutung danebenliegt.

## Das Ruling zu Commit `2e006c6` — und eine Korrektur am Auftrag

Der Auftrag sagt: „Commit `2e006c6` hat ausdrücklich gebunden, dass ein Startfehler mit Exit-Code 1 endet — **der Test dazu existiert, prüf ihn**, bevor du etwas änderst."

**Dieser Test existiert nicht.** Geprüft vor jeder Änderung:

```
$ git show --stat 2e006c6
 packages/server/src/main.ts | 7 +++++++
 1 file changed, 7 insertions(+)

$ grep -rn "exit\|Startfehler\|EADDRINUSE" test/ --include=*.ts
 (keine Treffer)
```

`2e006c6` hat ausschließlich `main.ts` angefasst und keinen Test angelegt. Die Zusicherung stand bis heute nur als Code da und war von keinem Tor gedeckt — genau die Sorte Lücke, die dieses Projekt schon dreimal getroffen hat.

**Folge:** Ich habe keinen bestehenden Test angefasst, weil es keinen gab. Die Zusicherung ist jetzt erstmals gebunden, und zwar an der Entscheidung selbst: `decideAfterListenError` weicht nur aus, wenn alle drei Bedingungen stimmen — der Fehler ist `EADDRINUSE`, `PORT` war nicht ausdrücklich gesetzt, und es ist noch ein Port übrig. Jeder andere Fall endet mit Exit 1. Am Gerät nachgestellt:

```
$ PORT=3000 node packages/server/dist/main.js     # 3000 war belegt
EXIT_CODE=1
[quizbude] Server kann nicht starten: Error: listen EADDRINUSE: address already in use :::3000
[quizbude] Port 3000 ist belegt. PORT ist ausdruecklich gesetzt - dann weiche ich nicht aus.
```

## Die Rücknahmeproben

Achtzehn Mutationen, jede einzeln angebracht und restlos zurückgenommen. Alle achtzehn rot.

| | Mutation | Roter Test | Meldung im Wortlaut |
|---|---|---|---|
| P1 | Ausweichen entfernt | weicht bei belegtem Port auf den naechsten der Folge aus | `expected { kind: 'giveUp', reason: 'mutiert' } to deeply equal { kind: 'retry', port: 3001 }` |
| P2 | Riegel „PORT gesetzt" entfernt | bricht ab, wenn PORT ausdruecklich gesetzt ist | `expected 'retry' to be 'giveUp' // Object.is equality` |
| P3 | Riegel „anderer Fehler" entfernt | bricht bei jedem anderen Fehler ab, statt auszuweichen | `expected 'retry' to be 'giveUp' // Object.is equality` |
| P4 | nächster Port als `current + 1` | nimmt den naechsten der Folge, nicht den naechsthoeheren Zahlenwert | `expected { kind: 'retry', port: 3001 } to deeply equal { kind: 'retry', port: 3005 }` |
| P5 | Folgenende läuft um statt abzubrechen | laeuft die ganze Folge ab und bricht erst am Ende ab | `expected 12 to be less than or equal to 11` |
| P6 | MAC-Erkennung ausgeschaltet | erkennt die virtuelle Karte an ihrer MAC | `expected [ '192.168.3.77', '192.168.0.160' ] to deeply equal [ '192.168.0.160', '192.168.3.77' ]` |
| P7 | `internal`-Riegel entfernt | wirft interne Karten auch dann weg, wenn ihre Adresse privat ist | `expected [ '10.0.0.50', '10.0.0.1' ] to deeply equal [ '10.0.0.50' ]` |
| P8 | Punkt-zu-Punkt-Abzug entfernt | stellt ein /32 hinter ein richtiges Netz | `expected [ '10.8.0.6', '10.0.0.50' ] to deeply equal [ '10.0.0.50', '10.8.0.6' ]` |
| P9 | `.1`-Abzug entfernt | stellt die .1 eines /24 hinter eine vergebene Adresse | `expected [ '192.168.5.1', '192.168.9.77' ] to deeply equal [ '192.168.9.77', '192.168.5.1' ]` |
| P10 | Funk-Bonus entfernt | zieht Funk dem Kabel vor, wenn beide echt sind | `expected 'Ethernet' to be 'WLAN' // Object.is equality` |
| P11 | Bereichsreihung eingeebnet | stellt 172.16-31 hinten an | `expected [ '172.20.1.5', '10.0.0.5', …(1) ] to deeply equal [ '192.168.1.5', '10.0.0.5', …(1) ]` |
| P12 | Namensmarker entfernt | erkennt die virtuelle Karte an ihrem Namen | `expected [ '192.168.4.77', '192.168.0.160' ] to deeply equal [ '192.168.0.160', '192.168.4.77' ]` |
| P13 | Bereichsfilter entfernt | wirft APIPA, interne Adressen und alles ausserhalb der privaten Bereiche weg | `expected [ '192.168.0.160', …(5) ] to not include '169.254.83.107'` |
| P14 | Alternativen weggelassen | stellt den wahrscheinlichsten Kandidaten vor die Alternativen | `expected -1 to be greater than 272` |
| P15 | Firewall-Block entfernt | spricht die Firewall an | ``expected '\n-----------------------------------…' to contain 'Firewall'`` |
| P16 | Hinweis bei fehlender Adresse entfernt | sagt es, wenn gar keine Adresse gefunden wurde | ``expected '\n-----------------------------------…' to contain 'Keine Adresse im lokalen Netz'`` |
| P17 | leerer Fenstertitel entfernt | gibt unter Windows den leeren Fenstertitel vor der URL mit | `expected [ '/c', 'start', …(1) ] to deeply equal [ '/c', 'start', '', …(1) ]` |
| P18 | Browser-Flagge immer an | oeffnet nur, wenn der Doppelklick-Start es verlangt | `expected true to be false // Object.is equality` |

Nach jeder Probe wurde die Mutation aus der Sicherung zurückgespielt. `grep -rn "if (false)\|mutiert\|void rest" packages/` findet nichts, `git status` war vor jedem Commit sauber.

### Drei Proben blieben beim ersten Durchlauf grün — und das war der lohnendste Teil

**Falsch-Grün 1: Der MAC-Test band den Begleitumstand statt der Ursache.** Die erste Fassung stellte „Ethernet 4" mit `192.168.56.1` gegen „Ethernet 6" mit `192.168.0.160`. Schaltete man die MAC-Regel ab, blieb der Test **grün** — denn `192.168.56.1` ist eine `.1` in einem `/24` und wurde schon vom Gateway-Abzug hinten angestellt. Der Test hätte eine kaputte MAC-Erkennung nie bemerkt. Jetzt sind Name, Bereich, Netzmaske und Endziffer gleich, übrig bleibt die MAC — und die alphabetisch vordere Karte ist absichtlich die virtuelle, damit sie ohne die Regel gewinnen würde. Dasselbe fehlte für die Namensregel; dafür ist ein zweiter Test dazugekommen (P12).

**Falsch-Grün 2 war keins: die Mutation war zu schwach.** Beim Firewall-Hinweis hatte ich nur die erste Zeile des Blocks ersetzt; die geprüften Wörter „Firewall" und „Privat" stehen in den Zeilen darunter. Mit dem ganzen Block entfernt wird der Test rot (P15). Der Test war in Ordnung, die Probe nicht.

**Toter Riegel gefunden und entfernt.** Die Probe „APIPA-Riegel entfernt" blieb grün, und das zu Recht: `169.254.x.x` liegt ohnehin außerhalb der privaten Bereiche und fiel schon durch den Bereichsfilter. Eine Zeile, die kein Test rot bekommen kann, ist in diesem Projekt genau die falsche Sorte Zeile — sie ist raus. Das **Verhalten** bleibt gebunden, jetzt über den Bereichsfilter (P13).

## Selbst gemessene Tore

Vorher nachgemessen, nicht aus Berichten übernommen:

```
                   vorher                         nachher
npm test           118 Tests, 15 Dateien, Exit 0   150 Tests, 19 Dateien, Exit 0
npx tsc --noEmit   Exit 0                          Exit 0
npm run build      Exit 0                          Exit 0
```

32 neue Tests in vier neuen Dateien: `test/server/network.test.ts`, `ports.test.ts`, `banner.test.ts`, `browser.test.ts`.

## Was am Gerät schon geprüft ist

- **Die echte Startmeldung** auf dem Zielrechner wählt `192.168.0.160` auf „Ethernet 6" — die Karte mit der Standardroute. VPN und Tailscale tauchen nicht auf, die drei virtuellen 192.168-Netze stehen als Alternativen darunter.
- **Das Ausweichen.** Zweiter Server bei belegter 3000: `[quizbude] Port 3000 ist belegt - ich nehme 3001.` und die ganze Meldung nennt durchgehend 3001.
- **Exit 1 bei gesetztem PORT** auf belegtem Port (oben im Wortlaut).
- **Ein fehlgeschlagener Browseraufruf legt den Server nicht lahm.** In der Testumgebung ließ sich `cmd` nicht starten; der Server lief weiter und antwortete auf `/play/` mit HTTP 200, ohne Eintrag im Fehlerprotokoll.
- **Ein `::`-gebundener Server ist über IPv4 erreichbar** — nachgestellt über alle sechs Adressen des Rechners. Ohne das wäre die ganze Adressausgabe wertlos gewesen.
- **Der Neubau-Wächter** in beide Richtungen: nach einer Quelländerung „neu bauen", nach dem Bau „aktuell", bei fehlendem `dist` „neu bauen".

## Was nur am Gerät zu prüfen bleibt

Die `.cmd`-Datei ist nicht automatisiert prüfbar. Geprüft wurde an ihr, was prüfbar ist: reines ASCII, durchgehend CRLF, jedes `goto` trifft ein Label, jedes Label wird angesprungen, jeder Fehlerzweig endet über `goto ende` bei `pause`, keine Klammern in `echo`-Zeilen. Offen bleibt:

- **Der Doppelklick selbst** aus dem Explorer: dass sich das Fenster öffnet, offen bleibt, solange der Server läuft, und nach dem Ende die Abschiedszeile zeigt.
- **Der Firewall-Dialog** beim allerersten Start und ob der Haken bei „Privat" gesetzt wird. Ohne ihn kommt kein Handy durch.
- **Ob ein Gasthandy** `http://192.168.0.160:3000/play/` im WLAN wirklich erreicht.
- **Dass sich der Browser öffnet.** In meiner Umgebung war das Starten von `cmd` gesperrt; belegt ist nur, dass ein Fehlschlag folgenlos bleibt.
- **Die Fehlerzweige der `.cmd`** — kein Node, zu altes Node, kein npm, gescheiterter `npm install`, gescheiterter Bau. Der Kontrollfluss ist statisch geprüft, die Zweige sind nicht ausgeführt worden.
- **Der Fall „alle elf Ports belegt"** am laufenden Server. Gebunden ist er als Test (P5), live nachgestellt ist er nicht.

## Begründete Abweichungen vom Auftrag

**1. Die Bühne öffnet der Server, nicht die `.cmd`-Datei.** Der Auftrag führt das Öffnen als Schritt der `.cmd` auf. Das geht nicht sauber: vor dem `listen` steht nicht fest, welchen Port der Server bekommt, und bei belegter 3000 würde die `.cmd` die falsche Seite öffnen — ausgerechnet in dem Fall, für den das Ausweichen gebaut wurde. Geöffnet wird deshalb aus dem `listening`-Ereignis, gesteuert über `QUIZBUDE_BUEHNE_OEFFNEN`, das nur die `.cmd` setzt. Wer `npm start` tippt, bekommt kein Fenster aufgerissen. Die Entscheidung liegt in `browser.ts` als reine Funktion und ist gebunden (P17, P18).

**2. `tools/build-needed.mjs` liegt außerhalb von `packages/server/src`.** Der Auftrag verlangt die neue Logik als reine Funktionen dort. Für diesen Wächter geht das nicht: er läuft, **bevor** gebaut wird, kann also nicht aus `dist` kommen. Er ist auch keine der beiden Logiken, die der Auftrag ausdrücklich benennt. Geprüft ist er am Gerät in beiden Richtungen.

**3. Konsolenausgabe durchgehend ASCII.** `main.ts` druckte bisher „Bühne" und „Spielgerät" mit Umlauten. Auf einer Konsole mit Codepage 850 wird daraus Buchstabensalat, und die Startmeldung ist genau der Text, auf den es ankommt. Die Meldung ist jetzt umlautfrei; ein Test bindet das.

**4. Öffentliche IPv4-Adressen werden nicht angeboten.** Der Auftrag nennt die privaten Bereiche als die Kandidaten; daran halte ich mich. Ein Rechner mit öffentlicher IPv4 direkt am Anschluss bekäme damit keinen Vorschlag — er bekommt dann den Hinweis, dass keine Adresse gefunden wurde. Als Folgeaufgabe notiert.

## Folgeaufgaben

Neu aus diesem Paket:

- **QR-Code auf der Bühne.** Wäre hier verlockend gewesen und ist ausdrücklich nicht im Paket — er gehört zur zweiten Welle. Mit der jetzt bekannten Adresse ist er ein kleiner Schritt: die gewählte Adresse steht als Zeichenkette bereit.
- **Öffentliche IPv4 als letzter Ausweg.** Heute fällt sie durch den Bereichsfilter. Sinnvoll wäre, sie hinter allen privaten als allerletzte Alternative zu nennen.
- **`::` und `0.0.0.0` können sich unter Windows denselben Port teilen.** Beim Nachstellen aufgefallen: ein Server auf `0.0.0.0:3000` und einer auf `:::3000` koexistieren ohne `EADDRINUSE`. Hält also ein fremdes Programm die 3000 auf `0.0.0.0`, bindet die Quizbude die 3000 auf `::` **ohne** auszuweichen — und ein Handy, das über IPv4 kommt, landet womöglich beim fremden Programm. Das Ausweichen greift nur bei gleicher Bindeart. Sauber lösbar wäre es mit einer Vorabprüfung auf `0.0.0.0`.
- **Der Fall „alle Ports belegt"** ist nur als Test gebunden, nicht am Gerät nachgestellt.

Unverändert offen bleibt alles aus `STAND.md`: die beiden Restrisiken aus dem Nachreview (Timerpfad ohne örtliche Fehlerbehandlung, Stream-Fehler hinter dem `.catch`), `MAX_NAME_CHARS`, die zeilenweise Uhr- und Zufallsprüfung in `purity.test.ts`, `scope: 'all'` am echten Server, N1 — und die gesamte zweite Welle.

## Erledigt

| Was | Datei | Commit |
|---|---|---|
| Doppelklick-Start mit Node-Prüfung, bedingtem `npm install`, bedingtem Bau, Firewall-Hinweis, offenem Fenster | `quizbude-starten.cmd` | `110833c` |
| Baut nur, wenn nötig — im Zweifel baut er | `tools/build-needed.mjs` | `110833c` |
| Auswahl und Reihung der Netzadressen | `packages/server/src/runtime/network.ts` | `1dded32` |
| Portfolge und die Entscheidung „ausweichen oder abbrechen" | `packages/server/src/runtime/ports.ts` | `1dded32` |
| Die Startmeldung als reiner Text | `packages/server/src/runtime/banner.ts` | `1dded32` |
| Wann und womit die Bühne geöffnet wird | `packages/server/src/runtime/browser.ts` | `1dded32` |
| Verdrahtet nur noch | `packages/server/src/main.ts` | `1dded32` |
