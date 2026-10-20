# Bericht: Fix-Welle zum Ein-Klick-Start

**Datum:** 2026-10-20 · **Branch:** `durchstich` · **Ausgangspunkt:** `d5ac8c1` · **Grundlage:** `docs/review-einklickstart.md`

## Urteil in einem Satz

Alle sieben Befunde sind behoben und jeder einzeln durch eine Rücknahmeprobe belegt; der tiefere Befund — `main.ts` war von keinem Test berührt — ist dadurch behoben, dass `main.ts` keine Entscheidung mehr trifft.

## Selbst gemessene Tore

Eigenhändig gefahren, nicht aus einem Bericht übernommen:

```
npx tsc --noEmit   Exit 0
npm test           21 Dateien, 191 Tests, Exit 0   (vorher 19 / 150)
npm run build      Exit 0   (Spielergerät: 0,31 kB HTML + 1,32 kB CSS + 61,82 kB JS gzip)
```

Dazu 14 Rücknahmeproben, davon 13 rot und eine Leerprobe grün.

## Ruling R0 zuerst: die Naht ist jetzt gebunden

Die Startentscheidungen stehen in `packages/server/src/runtime/startup.ts`. `packages/server/src/main.ts` ist auf 77 Zeilen Verdrahtung geschrumpft: echter Server, echte Konsole, echter Browser — und `runtime.start()` als letzte Zeile.

Prüfbar sind damit, wie gefordert:

| Frage | Wo entschieden | Wo gebunden |
|---|---|---|
| Welcher Port gilt? | `startup.ts:116-147` (`beginStartup`), `startup.ts:197` (Nachführung aus `address()`) | `test/server/startup.test.ts` — „fuehrt den Port nach und laeuft die Folge genau einmal ab", „fuehrt den Port aus der tatsaechlichen Bindung nach" |
| Welcher Exit-Code bei welchem Fehler? | `startup.ts:114` (`EXIT_START_GESCHEITERT`), `startup.ts:151-187`, `startup.ts:218-228` | neun Tests fallen, wenn die 1 auf 0 gedreht wird |
| Welche Adresse bekommt der Browser? | `startup.ts:40` und `:43-45` (`STAGE_HOST`, `stageUrl`) | „gibt dem Browser die Schleife dieses Rechners, nicht localhost", „nennt Banner und Browser denselben, tatsaechlich gebundenen Port" |
| Vor oder nach dem `listening`? | `startup.ts:152` (Phasenriegel), `startup.ts:218` (`decideUncaught`) | „toetet den Server nach dem listening nicht mehr", „macht aus einem unbehandelten Wurf vor dem listening Exit 1, danach nicht" |

Die drei Mutationen, die beim Prüfer alle 150 Tests grün ließen, sind jetzt rot — W1, W2 und W3 stehen unten mit Wortlaut.

## Die Befunde einzeln

### B1 — Bindung auf IPv4 statt Dual-Stack

**Stelle:** vorher `main.ts:84` (`http.listen(port)`), jetzt `startup.ts:33` (`BIND_HOST = '0.0.0.0'`) und `startup.ts:271` (`server.listen(step.port, step.host)`).

**Änderung und Begründung.** Gebunden wird ausdrücklich auf `0.0.0.0`. Maßgeblich ist, was der Prüfer als maßgeblich benannt hat: **das Gasthandy im Heim-WLAN kommt über IPv4.** Ohne Hostangabe bindet Node `::` im Dual-Stack; Windows lässt das neben einem fremden Programm auf `0.0.0.0:3000` zu, meldet kein `EADDRINUSE`, und die Quizbude liest einen Port vor, auf dem für die Gäste ein fremdes Programm antwortet.

**IPv6 wird bewusst nicht zusätzlich bedient.** Jede Form von Dual-Stack-Bindung nimmt genau die Erkennung wieder weg, um die es hier geht — und ein zweiter Listener auf `::` daneben hätte dasselbe blinde Verhalten an einer zweiten Stelle. Im Heimnetz eines Spieleabends erreicht kein Gast den Rechner über IPv6, den er nicht auch über IPv4 erreicht. Die Folge ist benannt: ein reiner IPv6-Client kommt nicht mehr durch. Das ist am Spieleabend kein Fall.

**Folge für die Bühne:** `localhost` löst unter Windows zuerst nach `::1` auf, wo nach dieser Bindung niemand mehr lauscht. Der Gastgeber bekommt deshalb `http://127.0.0.1:<port>/host/` — in Banner (`banner.ts:37`) und Browseraufruf (`startup.ts:40`) dieselbe Adresse. Das ist eine sichtbare Änderung gegenüber `d5ac8c1` und unten unter „Abweichungen" ausdrücklich genannt.

**Bindet der Test die Ursache?** Ja, zweifach. Der Zustandstest bindet die Bindungsadresse wörtlich (`host: '0.0.0.0'`), und am echten Socket hält ein fremder IPv4-Server den ersten Port; wird der Host weggenommen, bindet die Quizbude daneben und bleibt auf dem belegten Port — der erwartete Wechsel bleibt aus. Es ist ausdrücklich **nicht** der Test „irgendein Server kommt hoch".

**Rücknahmeprobe** (`BIND_HOST` auf `'::'`, also genau das Verhalten vor dem Fix): **5 Tests rot.**

```
FAIL test/server/startup.test.ts > Der Zustand beim Hochfahren > bindet ausdruecklich auf IPv4, nicht im Dual-Stack
AssertionError: expected '::' to be '0.0.0.0' // Object.is equality

FAIL test/server/startup.test.ts > Die Verdrahtung > lauscht beim Start auf dem ersten Port der Folge, auf IPv4
AssertionError: expected [ { port: 3000, host: '::' } ] to deeply equal [ { port: 3000, host: '0.0.0.0' } ]

FAIL test/server/startup.test.ts > Am echten Socket > bemerkt einen fremden IPv4-Server auf dem Port und weicht aus
AssertionError: expected [ 55696 ] to deeply equal [ 55697 ]
```

Der dritte ist der entscheidende: mit Dual-Stack bleibt die Quizbude auf dem belegten Port `55696`, statt auf `55697` auszuweichen.

**Nachstellung am Gerät** (Windows 10 Home, Node 22). Ein fremdes Programm hält `0.0.0.0:3000`, nur IPv4, dann die gebaute Fassung gestartet:

```
[probe] fremdes Programm lauscht auf 0.0.0.0:3000 (nur IPv4)
[quizbude] Port 3000 ist belegt - ich nehme 3001.

  Buehne auf diesem Bildschirm:
      http://127.0.0.1:3001/host/

  Das tippen die Gaeste in ihr Handy:
      http://192.168.0.160:3001/play/
      (Netzwerkkarte: Ethernet 6)
```

Der Konflikt wird gesehen, es wird ausgewichen, und die vorgelesene Adresse zeigt auf den Port, auf dem die Quizbude wirklich lauscht.

### B2 — `PORT=abc` endet mit Exit 1, laut und benannt

**Stelle:** vorher `main.ts:27` (`Number(rawPort)` ungeprüft) und `main.ts:16-18` (das Netz fing den synchronen Wurf), jetzt `startup.ts:70-87` (`planPorts`) und `startup.ts:218-228` (`decideUncaught`).

**Änderung und Begründung.** `PORT` wird geprüft, bevor irgendjemand die Zahl an `listen` weiterreicht: Ziffernform (`/^\d+$/` auf dem getrimmten Text) und Bereich 0 bis 65535. Leer und reiner Leerraum heißen weiterhin „nicht gesetzt". `PORT=0` bleibt gültig — es heißt „nimm irgendeinen freien" und wird von B4 mitgetragen.

Zusätzlich darf das Schutznetz einen **Startfehler** nicht mehr verschlucken: `decideUncaught` entscheidet nach der Phase. Vor dem `listening` ist ein unbehandelter Wurf das Ende des Starts (Exit 1), danach ein Zwischenfall. Und `createRuntime` fängt einen synchronen Wurf aus `listen` selbst ab (`startup.ts:268-283`), statt ihn ins Prozessnetz laufen zu lassen.

**Rücknahmeprobe** (Prüfung entfernt, `Number(text)` ungeprüft wie vorher): **4 Tests rot.**

```
FAIL test/server/startup.test.ts > PORT lesen > weist alles zurueck, was keine Portnummer ist
AssertionError: abc: expected 'folge' to be 'unbrauchbar' // Object.is equality

FAIL test/server/startup.test.ts > Der Zustand beim Hochfahren > endet bei unbrauchbarem PORT mit Exit 1, statt still zu lauschen
AssertionError: expected 'listen' to be 'fatal' // Object.is equality

FAIL test/server/startup.test.ts > Die Verdrahtung > versucht bei unbrauchbarem PORT gar nicht erst zu lauschen
AssertionError: expected [ { port: NaN, host: '0.0.0.0' } ] to deeply equal []
```

Die letzte Meldung zeigt die Ursache wörtlich: ohne die Prüfung steht `port: NaN` im `listen`.

**Nachstellung am Gerät**, gegen die gebaute Fassung:

```
$ PORT=abc node packages/server/dist/main.js
[quizbude] PORT ist keine Portnummer: "abc".
EXIT=1

$ PORT=99999 node packages/server/dist/main.js
[quizbude] PORT liegt ausserhalb von 0 bis 65535: "99999".
EXIT=1
```

Die Zusicherung aus `2e006c6` gilt damit wieder — und ist diesmal gebunden, nicht nur geschrieben. `quizbude-starten.cmd` meldet in diesem Fall folgerichtig den Fehlerzweig statt „Die Runde ist vorbei".

Die bestehenden Zusagen bleiben, ebenfalls am Gerät nachgemessen: alle elf Ports 3000–3010 belegt → **Exit 1**; `PORT=3000` gesetzt und 3000 belegt → **Exit 1**, `[quizbude] Port 3000 ist belegt. PORT ist ausdruecklich gesetzt - dann weiche ich nicht aus.`

### B3 — ein schwacher Kandidat wird als Vermutung ausgewiesen

**Stelle:** vorher `banner.ts:40` (nur „leer / nicht leer") und `network.ts:181` (Bewertung weggeworfen), jetzt `network.ts:41` (`score` in `LanAddress`), `network.ts:49-53` (`WEAK_BELOW`, `isWeakGuess`), `network.ts:200` (Bewertung kommt mit) und `banner.ts:52-64`.

**Änderung und Begründung.** Die Bewertung war da und endete in `network.ts`; jetzt kommt sie in der Ausgabe an. Unterhalb von 0 — also sobald die Heuristik selbst mehr Merkmale einer virtuellen als einer echten Karte zählt — sagt der Banner nicht mehr „Das tippen die Gaeste in ihr Handy", sondern:

```
  Wahrscheinlich tippen die Gaeste das in ihr Handy:
      http://172.28.112.1:3000/play/
      (Netzwerkkarte: vEthernet (Default Switch))
  Sicher ist das nicht: diese Karte sieht virtuell aus. Ist das
  WLAN an? Kommt kein Handy durch, liegt es meistens daran.
```

Die Alternativen stehen unverändert darunter. Die Schwelle liegt bei 0, nicht höher: ein echtes Heimnetz in 172.16/12 kommt auf 0 und bleibt damit eine Ansage; der Hyper-V-Standardschalter kommt auf −16 und wird zur Vermutung.

**Rücknahmeprobe** (`const unsicher = isWeakGuess(best)` → `const unsicher = false`): **1 Test rot.**

```
FAIL test/server/banner.test.ts > Die Startmeldung > sagt einen schwach bewerteten Kandidaten als Vermutung an, nicht als Tatsache
AssertionError: expected '\n-----------------------------------…' to contain 'Wahrscheinlich'
```

Gebunden ist außerdem, dass die Bewertung überhaupt aus `lanAddresses` herauskommt (`test/server/network.test.ts` — „gibt die Bewertung mit, damit die Ausgabe eine Vermutung als solche nennen kann", erwartet `score: -16`) und dass ein gut bewerteter Kandidat weiterhin die klare Ansage bekommt.

### B4 — der Port wird aus der tatsächlichen Bindung nachgeführt

**Stelle:** vorher `main.ts:78` und `:81` (lasen die Variable), jetzt `startup.ts:196-204` (`afterListening`) und `startup.ts:208-211` (`boundPort`).

**Änderung und Begründung.** Beim `listening` gilt der Port, den das Betriebssystem vergeben hat. Banner und Browseradresse entstehen beide aus demselben Wert, nicht mehr aus zwei Quellen.

**Rücknahmeprobe** (`const port = bound ?? state.port` → `const port = state.port`): **4 Tests rot.**

```
FAIL test/server/startup.test.ts > Der Zustand beim Hochfahren > fuehrt den Port aus der tatsaechlichen Bindung nach
AssertionError: expected +0 to be 54321 // Object.is equality

FAIL test/server/startup.test.ts > Am echten Socket > nennt bei PORT=0 den vergebenen Port, nicht die 0
AssertionError: expected [ +0 ] to deeply equal [ 55956 ]

FAIL test/server/startup.test.ts > Am echten Socket > ist unter der Adresse erreichbar, die der Gastgeber vorgelesen bekommt
AssertionError: fetch failed
```

Die dritte Meldung ist die aussagekräftigste: unter der vorgelesenen Adresse antwortet dann niemand.

**Am Gerät**, gebaute Fassung mit `PORT=0`:

```
      http://127.0.0.1:55773/host/
      http://192.168.0.160:55773/play/
```

### B5 — nach dem `listening` tötet ein Fehler den Abend nicht mehr

**Stelle:** vorher `main.ts:63-75` (galt für die ganze Prozesslebensdauer), jetzt `startup.ts:152-159`.

**Änderung und Begründung.** `afterListenError` kennt die Phase. Vor dem `listening` wird ausgewichen oder abgebrochen; danach wird der Fehler gemeldet und der Server bleibt stehen. Das ist dieselbe Haltung wie beim Prozessnetz und steht jetzt an beiden Stellen aus derselben Entscheidung.

**Rücknahmeprobe** (Phasenriegel entfernt): **2 Tests rot.**

```
FAIL test/server/startup.test.ts > Der Zustand beim Hochfahren > toetet den Server nach dem listening nicht mehr
AssertionError: expected 'fatal' to be 'weiter' // Object.is equality

FAIL test/server/startup.test.ts > Die Verdrahtung > beendet den Prozess bei einem Fehler nach dem listening nicht
AssertionError: expected [ …(2) ] to deeply equal [ { port: 3000, host: '0.0.0.0' } ]
```

### B6 — eine abgebrochene Installation wird nachgeholt

**Stelle:** vorher `quizbude-starten.cmd:38` (`if exist "node_modules"`), jetzt `quizbude-starten.cmd:43-50`.

**Änderung und Begründung.** Die Wache hängt an einer Marke `node_modules\.quizbude-vollstaendig`, die **erst nach** dem `if errorlevel 1 goto installkaputt` geschrieben wird. Ein abgebrochenes `npm install` hinterlässt zwar einen halben Ordner, aber keine Marke — der nächste Doppelklick holt die Installation nach. Das kostet keinen Start eine Sekunde: geprüft wird die Existenz einer Datei, nicht der Inhalt des Ordners. Ein vollständiger Vergleich gegen `package-lock.json` wäre die genauere, aber teure Antwort; sie wurde verworfen, weil sie bei jedem Start Zeit kostet, ohne einen Fall zu treffen, den die Marke nicht trifft.

**Rücknahmeproben** (zwei, weil der Befund zwei Hälften hat): je **1 Test rot.**

```
FAIL test/server/starter.test.ts > Der Doppelklick-Starter > haengt die Installation an eine Marke, nicht am blossen Ordner
AssertionError: expected 'if exist "node_modules" goto bauen' not to match /if exist\s+"?node_modules"?\s+goto/i

FAIL test/server/starter.test.ts > Der Doppelklick-Starter > setzt die Marke erst, nachdem npm install geglueckt ist
AssertionError: expected -1 to be greater than 48
```

### B7 — Strg+C ist kein Fehler

**Stelle:** vorher `quizbude-starten.cmd:74` (`if not "%ENDE%"=="0" goto serverkaputt`), jetzt `quizbude-starten.cmd:81-91`.

**Änderung und Begründung.** Strg+C beendet Node mit `0xC000013A`. Beide Schreibweisen, die cmd dafür führt (`-1073741510` und `3221225786`), gehen jetzt auf dasselbe Ziel `:fertig` wie der Exit 0. Jeder andere Code führt weiter in `:serverkaputt`.

**Rücknahmeprobe** (beide Zweige entfernt): **1 Test rot.**

```
FAIL test/server/starter.test.ts > Der Doppelklick-Starter > haelt Strg+C fuer ein normales Ende, nicht fuer einen Fehler
AssertionError: expected undefined to be 'fertig' // Object.is equality
```

### T1 — der Familienriegel ist einzeln gebunden

**Stelle:** `network.ts:188` (`if (!isIPv4(entry)) continue;`).

Der bestehende IPv6-Test band die Oktettform, nicht die Familie: `fe80::1` fällt schon an den vier punktgetrennten Zahlen heraus. Der neue Test stellt eine Adresse hin, die das Zahlenformat erfüllt und trotzdem als `IPv6` gemeldet wird — nur der Familienriegel hält sie auf.

**Rücknahmeprobe** (Zeile ersatzlos gestrichen): **1 Test rot.**

```
FAIL test/server/network.test.ts > Die Adresse fuer die Gaeste > nimmt nur, was die Karte selbst als IPv4 meldet
AssertionError: expected [ { iface: 'WLAN', …(2) } ] to deeply equal []
```

### Die drei Mutationen, die beim Prüfer grün blieben

| | Mutation | vorher | jetzt | Fehlermeldung im Wortlaut |
|---|---|---|---|---|
| W1 | Exit-Code 1 → 0 (`startup.ts:114`) | 150/150 grün | **9 Tests rot** | `expected +0 to be 1 // Object.is equality` |
| W2 | Portnachführung beim Ausweichen entfernt (`startup.ts:169`) | 150/150 grün | **1 Test rot** | `expected [ 3000, 3001, 3001, 3001, 3001, …(15) ] to deeply equal [ 3000, 3001, 3002 ]` |
| W3 | Browser-Adresse fest verdrahtet (`startup.ts:44`) | 150/150 grün | **6 Tests rot** | `expected 'http://localhost:3000/host/' to be 'http://127.0.0.1:54321/host/' // Object.is equality` |

W2 ist die Probe, die der Prüfer als die gefährlichste bezeichnet hat: die Mutation ist am Gerät eine Endlosschleife. Die Fehlermeldung zeigt sie jetzt unmittelbar — `3000, 3001, 3001, 3001, …` statt `3000, 3001, 3002`.

### Leerprobe

Ein identischer Ersatz an `startup.ts:33`, danach **191/191 grün, Exit 0**. Die Prüfvorrichtung meldet nicht einfach immer rot.

## Was nur am Gerät prüfbar bleibt

- Der Doppelklick aus dem Explorer: dass sich das Fenster öffnet, offen bleibt und am Ende die Abschiedszeile zeigt. Die beiden `.cmd`-Befunde sind an ihrem Kontrollfluss gebunden, nicht an ihrer Ausführung — `cmd.exe` lässt sich im Testlauf nicht sinnvoll fahren, ohne Pakete zu holen, zu bauen und einen Server zu starten.
- Dass ein echtes Gasthandy `http://192.168.0.160:<port>/play/` im WLAN erreicht.
- Der Windows-Firewall-Dialog beim allerersten Start und der Haken bei „Privat".
- Dass sich der Standardbrowser wirklich öffnet. Gebunden ist, **welche** Adresse er bekommt und dass unter ihr geantwortet wird; der `spawn` selbst wurde nicht scharf ausgelöst.
- Strg+C im echten Fenster samt der Rückfrage „Batchvorgang abbrechen (J/N)?". Gebunden ist nur, dass beide Codes in den normalen Ausgang führen.
- **Einmalig:** der nächste Doppelklick auf diesem Rechner läuft einmal durch `npm install`, weil die Marke aus B6 noch fehlt. Danach ist Ruhe. Das ist Absicht und nicht nachgeholfen worden — sonst wäre der Fix am Gerät nicht mehr zu beobachten.

## Begründete Abweichungen, einzeln benannt

1. **Die Bühne heißt jetzt `127.0.0.1`, nicht mehr `localhost`.** Das folgt zwingend aus der IPv4-Bindung und ist für den Gastgeber sichtbar. Alternative wäre gewesen, `localhost` zu lassen und auf die Rückfall-Logik der Browser zu setzen — das wäre eine Wette gewesen, und der Test „ist unter der Adresse erreichbar, die der Gastgeber vorgelesen bekommt" hätte sie nicht entscheiden können.
2. **IPv6 wird nicht zusätzlich bedient.** Begründung oben bei B1. Die Folge — ein reiner IPv6-Client kommt nicht durch — ist genannt, nicht verschwiegen.
3. **`startup.ts` enthält neben reinen Funktionen auch die Verdrahtung (`createRuntime`).** Das weicht vom sonstigen Schnitt des Projekts ab, ist aber der Kern des Rulings: genau die Naht zwischen den reinen Funktionen war offen. Die Entscheidungen sind trotzdem rein und einzeln prüfbar; `createRuntime` führt nur aus.
4. **`RuntimeDeps` hat ein Feld `sequence`, das nur Tests setzen.** Ohne es müsste jeder Socket-Test die echte 3000 belegen und wäre auf einem Entwicklerrechner unzuverlässig. Das Feld ist als solches kommentiert.
5. **Der Banner-Schwellwert liegt bei 0, nicht höher.** Die Frage, *ob* eine negativ bewertete Karte überhaupt als „die Adresse" angeboten werden soll, hat der Prüfer ausdrücklich dem Nutzer zugeschrieben. Diese Welle ändert nur die Form der Aussage, nicht die Reihung — die Entscheidung bleibt offen.
6. **`main.ts` druckt kein nacktes `undefined` mehr** hinter Meldungen ohne Anlass (`main.ts:59-64`). Kleine Zugabe, am Gerät beim B2-Nachstellen aufgefallen.

## Folgeaufgaben — ausdrücklich nicht in diesem Paket

- **Vertrauensmaß im Banner, zweite Stufe:** ob eine negativ bewertete Karte überhaupt angeboten wird, ist eine Nutzerentscheidung (siehe Abweichung 5).
- **Öffentliche IPv4:** ein Rechner mit öffentlicher IPv4 liest weiterhin „Keine Adresse im lokalen Netz gefunden - ist das WLAN an?" — die Frage geht in die falsche Richtung. Teil derselben Lücke wie B3, aber eine andere Entscheidung.
- **`tools/build-needed.mjs` hat weiterhin kein Tor** (T3, zweite Hälfte). Die Datei ist `.mjs` und steht in keinem `include`; weder `tsc` noch ein Test fasst sie an. Sechs Lagen hat der Prüfer von Hand gefahren.
- **UNC-Pfad im Starter:** liegt der Ordner auf `\\server\freigabe`, scheitert `cd /d` still. Restrisiko, vom Prüfer als solches eingeordnet.
- **Windows-MAC-Randomisierung:** ein echtes WLAN mit zufälliger Hardwareadresse wird von `isVirtualMac` als virtuell gewertet. In allen geprüften Paarungen gewinnt es trotzdem; das Merkmal ist dort aber wertlos.
- **Mobiler Hotspot und Gast-WLAN:** beide Lagen trägt die Reihung, beide sind die Fälle, in denen der Gastgeber die zweite Zeile braucht.
- **QR-Code:** unverändert offen, ausdrücklich nicht im Paket.

## Arbeitsbaum

Jede Mutation lief über eine binäre Sicherungskopie und wurde byteweise zurückgespielt; nach jeder Probe wurde die Gleichheit mit der Kopie geprüft (vierzehnmal `identisch: True`). Nach der letzten Probe:

```
npx tsc --noEmit   Exit 0
npm test           21 Dateien, 191 Tests, Exit 0
npm run build      Exit 0
```
