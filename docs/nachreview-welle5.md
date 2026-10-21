# Nachreview der fünften Fix-Welle — `d89a05f..a36033a`

**Prüfer:** frischer Agent, rein lesend · **HEAD bei Beginn und Ende:** `a36033a` ·
**Arbeitsbaum bei Beginn und Ende:** nur `?? docs/review-fragen-upload.md` · **Datum:** 2026-10-21

Geprüft wurde ausschließlich der Diff dieser Welle. 26 eigene Mutationsproben, alle über
Sicherungskopien im Scratchpad, keine über `git`. Acht Probedateien unter `test/` angelegt,
ausgeführt und restlos entfernt.

---

## 1. Urteil

Sieben der acht Behebungen tragen und sind mutationsgeprüft — aber die Welle hat zwei neue Löcher
gerissen: eine erste Frage ohne Markierung verschwindet jetzt **stillschweigend** bei grünem
Prüfbericht, und B1 kehrt ab der neunten Markierung in derselben Zeile zurück.

| Befund | Ampel | Begründung in einem Satz |
|---|---|---|
| **B1** | **teilweise** | Bis acht Markierungen sauber, ab neun bleibt das Häkchen sichtbar im Label stehen und `ok` bleibt `true` (N1) |
| **B2** | **behoben** | Der Zustandsautomat trägt jede der dreizehn geprüften Reihenfolgen; die Verdrahtung in `App.tsx` ist aber nur durch Text gebunden (N3) |
| **B3** | **behoben** | Die 6 MB tragen die ungünstigste erlaubte Datei nachgemessen mit 43 570 B Luft; die Verdrahtung in `main.ts` ist nur durch Text gebunden (N3) |
| **B4** | **behoben** | Beide Türen (Zeilenformat und JSON) und beide Seiten (Parser und Transportrand) einzeln mutationsgeprüft |
| **B5** | **teilweise** | Der Leitfall und alle Unterfälle gehen grün — aber derselbe Fix lässt die erste Frage verschwinden (N2) |
| **B6** | **behoben** | `A) ✅`, `- ✅`, `Merkur ✅`, Fett, Aufzählung und Kreuzungen davon lesen genau eine Markierung |
| **B10** | **behoben** | Beide Fassungen in beide Richtungen gebunden, beide Mutationen rot |
| **B12** | **behoben** | `esc` ist identisch mit `Kern.escapeHtml`, Ladereihenfolge gebunden, keine der 20 `innerHTML`-Stellen ungeschützt |

**Nicht reif für die Veröffentlichung** — siehe Abschnitt 5.

---

## 2. Meine Mutationsproben

Alle Mutationen über `cp` aus Sicherungskopien zurückgespielt und mit `cmp` als zeichengleich
belegt (Abschnitt 6 zeigt die Sammelprüfung über alle acht berührten Dateien). „Riegel" meint
`test/standalone/kern.test.ts` → „die ausgelieferte Seite trägt genau den heutigen Kern" plus
„der Riegel hängt nicht an den Zeilenenden der Arbeitskopie"; der fällt bei **jeder** Änderung an
`parse.ts` mit und ist unten nicht jedes Mal einzeln aufgeführt.

| # | Datei:Zeile | Mutation | Ergebnis |
|---|---|---|---|
| M1 | `parse.ts:424` | `runde < 8` → `runde < 1` | **rot**: „liest in jeder Mischform genau eine Markierung", „kein Markierungszeichen bleibt in einer Beschriftung stehen", „dieselbe Mischform im JSON", „Beschriftungen A) a) vor den Antworten", Leitfall B5 |
| M2 | `parse.ts:425-437` | Reihenfolge **innerhalb** der Schleife umgedreht (erst Markierung prüfen, dann Schreibweise abtragen) | **grün** (nur Riegel) — und das Verhalten über 35 gekreuzte Eingaben **zeichengleich**; siehe Abschnitt 4.1 |
| M3 | `parse.ts:427` | `istMarkiert(rest)` → `istMarkiert(roh)` (der alte B6-Fehler) | **rot**: zwei B1/B6-Tests, „Fettschrift und Kursivschrift" |
| M4 | `parse.ts:364` | `MARKIERUNG_ENDE` auf `/\s*(QQQ)+\s*$/` | **rot**: zwei B1/B6-Tests |
| M5 | `parse.ts:364` | `MARKIERUNG_ENDE` um `\*` und `\+` erweitert | **rot**: „Stern und Plus am Zeilenende sind Auszeichnung, keine Markierung" |
| M6 | `parse.ts:541` | Titelgrenze im Zeilenformat abgeschaltet (`* 99`) | **rot**: „ein zu langer Titel, mit Zeilennummer (B4)" **und** „nimmt genau den Titel an, den der Parser grün prüft (B4)" |
| M7 | `validate.ts:85` | Transportrand nimmt ein Zeichen weniger an | **rot**: „nimmt genau den Titel an, den der Parser grün prüft (B4)" |
| M8 | `parse.ts:830` | Titelgrenze im JSON abgeschaltet | **rot**: „die Titelgrenze gilt auch im JSON" |
| M9 | `parse.ts:514` | `if (kannFrageSein(aktuell)) titelErlaubt = false;` → `titelErlaubt = false;` | **rot**: drei B5-Tests, darunter der Leitfall |
| M10 | `parse.ts:608` | Vorwort-Maßstab zurück auf `erste.antworten.length === 0` | **rot**: „ein mehrzeiliges Vorwort, auch vor der Titelzeile" |
| M11 | `parse.ts:979` | `if (von <= 0) return null;` immer wahr | **rot**: „JSON im Code-Zaun wird auch unter einem Vorwort als JSON gelesen" |
| M12 | `session.ts:87` | `abgelehnt` löst den Riegel nicht (`erzeugt = erzeugt`) | **rot**: 3 Tests |
| M13 | `session.ts:68` | Doppelklick-Schutz entfernt (`erzeugt ||` weg) | **rot**: 5 Tests, darunter `test/host/wire.test.ts` |
| M14 | `App.tsx:116` | `oeffne.current?.abgelehnt();` gelöscht | **rot**: „die Buehne benutzt den Wachter auch wirklich" (Textwächter) |
| M15 | `App.tsx:116` | Zeile bleibt **wörtlich** stehen, wird aber tot: `if (message.code === 'niemals') oeffne.current?.abgelehnt();` | **grün 309/309, tsc 0** → N3 |
| M16 | `session.ts:83` | `wunsch = { arg };` → `if (wunsch === null) wunsch = { arg };` | **rot**: „vor der Leitung gewinnt der letzte Zuruf, nicht der erste" |
| M17 | `session.ts:91` | `wunsch = null;` in `abgelehnt` → `void 0;` | **rot**: „eine Ablehnung schickt von sich aus gar nichts nach" |
| M18 | `Upload.tsx:262` | `disabled={!bericht.ok \|\| !bereit}` → `disabled={!bereit}` | **rot**: „laesst die Runde erst oeffnen, wenn der Pruefbericht gruen ist (B10)" |
| M19 | `standalone/quizbude.html:2789` | `\|\| !geprueft.ok` gestrichen | **rot**: „ein Bericht mit Fehlern bleibt folgenlos" |
| M20 | `standalone/quizbude.html:2252` | `const esc = Kern.escapeHtml;` → eigene, zeichengleiche Fassung | **rot**: „die Seite haelt auch keine zweite Fassung des Escapings (B12)" |
| M21 | `standalone/quizbude.html:544` | `MAX_TITLE_CHARS = 256` → `255` von Hand **im Kern-Block** | **rot**: Riegel; `node tools/standalone-parser.mjs` meldet „ist NICHT aktuell", Exit 1 |
| M22 | `main.ts:42` | `maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,` gelöscht | **rot**: „main.ts setzt den Puffer wirklich" (Textwächter) |
| M23 | `main.ts:43` | zweites `maxHttpBufferSize: 1e6,` dahinter | **grün 309/309**, aber `tsc` TS1117 → durch das Typsystem gefangen |
| M24 | `main.ts:43` | `...{ maxHttpBufferSize: 1e6 },` dahinter | **grün 309/309**, aber `tsc` TS2783 und `npm run build` Exit 2 |
| M25 | `main.ts:46` | eine Zeile nach der Konstruktion: `io.engine.opts.maxHttpBufferSize = 1e6;` | **grün 309/309, tsc 0, build 0** → N3 |
| M26 | `validate.ts:47` | `WIRE_ESCAPE_FACTOR = 6` → `2` | **rot**: zwei B3-Tests |

**Was ich nicht mutieren konnte, und warum**

- **N1 und N2 (die beiden neuen Löcher).** Das sind Fehler, keine gebrochenen Zusagen — es gibt
  nichts zurückzudrehen. Belegt durch Messung mit minimalen Eingaben (Abschnitt 3) und, für N2,
  durch die Gegenrechnung mit dem Maßstab von vor der Welle (M10-Variante).
- **Die Reihenfolge innerhalb der Abtrag-Schleife (M2).** Nicht bindbar, weil nicht wirksam — das
  ist die Selbstmeldung des Umsetzers, und sie ist richtig (Abschnitt 4.1).
- **Alles am Gerät.** Doppelklick aus dem Explorer, echtes Gasthandy, das Ablegen einer Datei im
  Browser, die Darstellung der Browser-Fassung, die Lesbarkeit des Prüfberichts auf der Leinwand.
  `standalone/quizbude.html` wurde **nicht** im Browser geöffnet und **nicht** veröffentlicht.

---

## 3. Neue Befunde, die die Welle selbst eingebaut hat

### N1 — blockierend: ab der neunten Markierung ist B1 zurück

**Belegstelle:** `packages/core/src/questions/parse.ts:424` (`for (let runde = 0; runde < 8; runde += 1)`)

Die Schleife trägt je Runde **eine** Markierung ab und bricht nach acht Runden ab. Was dann noch
vorn steht, bleibt im sichtbaren Beschriftungstext — ohne dass irgendetwas meldet. Gemessen
(Probe danach entfernt, Eingabe jeweils hinter `F? | 20`):

```
   ok   | haekchen x8       ok=true ci=[0] labels=["Merkur","Venus"]
!! LECK | haekchen x9       ok=true ci=[0] labels=["✅ Merkur","Venus"]
!! LECK | haekchen x12      ok=true ci=[0] labels=["✅✅✅✅ Merkur","Venus"]
!! LECK | hundert haekchen  ok=true ci=[0] labels=["✅✅…(92×)… Merkur","Venus"]
!! LECK | json haekchen x9  ok=true ci=[0] labels=["✅ Merkur","Venus"]
```

**Fehlszenario:** genau das von B1 — der Prüfbericht sagt „Alles in Ordnung", die Runde startet,
auf der Kachel steht „✅ Merkur", jeder im Raum sieht die richtige Antwort, bevor er tippt. Die
Zahl neun ist aus echten KI-Ausgaben unwahrscheinlich; der Befund ist trotzdem blockierend,
**weil der Riegel nach oben offen statt geschlossen ausfällt**: der Deckel schützt die
Terminierung, lässt dafür aber genau den Schaden durch, gegen den die Welle angetreten ist. Die
Falsch-Grün-Probe des Umsetzers („kein Markierungszeichen bleibt in einer Beschriftung stehen")
prüft elf Mischformen, von denen keine die achte Runde erreicht.

**Nebenbefund derselben Stelle:** `Merkur ✅ und Venus` (Markierung mitten im Text) behält das
Häkchen im Label — dort ist das inhaltlich richtig (es ist Text, keine Markierung), zeigt aber,
dass die Zusicherung „kein Markierungszeichen im Label" nicht allgemein gilt.

**Vorschlag (nicht umgesetzt):** die Zeichenklassen wiederholbar machen statt die Runden zu
zählen — `MARKIERUNG` als `^((\*|\+|✅|✔|✓|☑|\[\s*[xX]\s*\])\s*)+` —, oder nach der Schleife
ausdrücklich fehlschlagen: greift `MARKIERUNG` dann noch, gehört ein Fehler mit Zeilennummer in
den Prüfbericht statt ein stilles Label. Beides schließt die Klasse, nicht den Fall.

### N2 — blockierend: die erste Frage verschwindet stillschweigend, wenn ihr die Markierung fehlt

**Belegstelle:** `packages/core/src/questions/parse.ts:608`
(`if (rest.length > 1 && erste !== undefined && !kannFrageSein(erste))`)

Der B5-Fix hat den Maßstab für „das ist Vorwort" von `antworten.length === 0` auf
`!kannFrageSein(…)` verbreitert. `kannFrageSein` verlangt ein Fragezeichen, eine Zeitangabe
**oder** eine erkannte Markierung. Ein erster Block, der alle drei nicht hat, gilt seitdem als
Vorwort und wird **verworfen**. Gemessen:

```
Eingabe: 'Nenne den kleinsten Planeten\nMerkur [x]\nVenus\nMars\n\nWelcher Planet ist rot? | 20\n* Mars\nVenus'
  nach der Welle:  ok=true  n=1  prompts=["Welcher Planet ist rot?"]
                   hinweise=["Zeile 1: als Vorwort uebersprungen."]  fehler=[]
  mit dem Maßstab von vor der Welle (M10-Variante, danach zurückgenommen):
                   ok=false n=2  fehler=["1:keine Antwort markiert, genau eine muss es sein."]
```

Dasselbe für „Markierung vergessen" und für `**Merkur**` als Markierungsversuch. Steht dieselbe
Frage an **zweiter** Stelle, fällt sie weiterhin laut auf (`ok=false`, Fehler auf ihrer Zeile) —
betroffen ist nur der erste Block.

**Fehlszenario:** Der Nutzer lädt zehn Fragen hoch, deren erste nicht auf ein Fragezeichen endet
(„Nenne den kleinsten Planeten") und deren Markierung der Parser nicht erkennt. Der Prüfbericht
meldet **neun** Fragen, „Alles in Ordnung", dazu einen Hinweis „Zeile 1: als Vorwort
übersprungen", den niemand als Verlustmeldung liest. Die Runde läuft mit neun Fragen. Der
Kommentar bei `trenneBeiwerk` (`parse.ts:593-598`) sagt ausdrücklich zu: „Eine Frage, die der
Autor ohne Antworten gelassen hat, fällt weiterhin laut auf." Das stimmt — nur fällt eine Frage,
der nur die **Markierung** fehlt, jetzt gar nicht mehr auf.

**Vorschlag (nicht umgesetzt), gemessen:** die Vorwort-Regel zusätzlich an der Antwortzahl
festmachen — `!kannFrageSein(erste) && erste.antworten.length <= 1`. Ein mehrzeiliges Vorwort
(„Klar!" / „Hier sind deine Fragen:") hat genau eine „Antwort", eine echte Frage mindestens zwei.
Probeweise eingesetzt: N2 verschwindet, **alle** B5-Tests bleiben grün (nur der Riegel fällt, wie
bei jeder Änderung an `parse.ts`); danach zurückgenommen.

### N3 — sollte: die Verdrahtung von B2 und B3 ist nur durch Text gebunden

**Belegstellen:** `apps/host-web/src/App.tsx:116` gegen `test/host/session.test.ts:212`
(`expect(app).toContain('oeffne.current?.abgelehnt()')`) und `packages/server/src/main.ts:42`
gegen `test/server/socketBuffer.test.ts:101`
(`expect(quelle).toContain('maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES')`)

Beide Fixes sind in ihrer reinen Funktion sauber gebunden (M12, M13, M16, M17, M26 alle rot). Die
**Wirkung** hängt aber an je einer Zeile Verdrahtung, und die ist nur dadurch gebunden, dass ein
bestimmter Textschnipsel in der Datei vorkommt. Zwei Proben, beide **grün bei 309/309 und
`tsc` Exit 0**:

```
M15  App.tsx:116  if (message.code === 'niemals') oeffne.current?.abgelehnt();
     → der ganze room:error-Pfad ist wieder folgenlos, der Wächter findet seinen Text trotzdem

M25  main.ts:46   io.engine.opts.maxHttpBufferSize = 1e6;   (eine Zeile nach der Konstruktion)
     → der Puffer steht wieder auf der Socket.IO-Vorgabe, B3 ist vollständig zurück
```

Zur Ehrenrettung des Typsystems: die **naheliegenden** Ausweichwege fängt es (M23 → TS1117,
M24 → TS2783 und `npm run build` Exit 2). Gegen „der Text bleibt stehen, die Wirkung zieht um"
hilft es nicht. Der Umsetzer nennt das für `main.ts` selbst als Folgeaufgabe 5; für `App.tsx`
nennt er es nicht, und dort ist es dieselbe Lage.

**Vorschlag (nicht umgesetzt):** für `main.ts` den schon vorgeschlagenen Umzug der Socket.IO-Optionen
nach `runtime/startup.ts`, damit ein Verhaltenstest sie lesen kann; für `App.tsx` ein Test, der
`App` mit einem Doppel-`Wire` rendert, `room:error` einspeist und misst, dass ein zweiter
`starte`-Ruf wieder `host:create` sendet. Beides ist ein eigenes Paket, kein Nachtrag zu dieser
Welle.

### N4 — Hinweis: `docs/STAND.md:98` führt B1 als „behoben"

`docs/STAND.md:98` (Tabellenzeile B1, „behoben, `e72eac3`") trifft nach N1 nicht mehr zu. Dieselbe
Zeile ist die, auf die sich die Veröffentlichungsentscheidung stützt.

---

## 4. Urteil über die vier Selbstmeldungen des Umsetzers

### 4.1 Die Abweichung bei B1 („Reihenfolge innerhalb der Schleife nicht tragend") — **richtig**

Der Umsetzer sagt, die vom Auftrag verlangte Reihenfolge (erst Beschriftung abtragen, dann
Markierung prüfen) sei durch die Schleife zu einer **stärkeren** Eigenschaft geworden und
deshalb von keinem Test rot zu bekommen — kein ungebundener Riegel, sondern eine Eigenschaft, die
es nicht mehr zu binden gibt. Geprüft auf Richtigkeit, nicht auf Plausibilität:

- **M2** dreht die Reihenfolge innerhalb der Schleife um. 309/309 grün (nur der Riegel fällt, weil
  `parse.ts` sich geändert hat).
- Entscheidend: ich habe unter der Mutation **dieselben 35 gekreuzten Eingaben** gefahren wie
  ohne sie und die Ausgaben verglichen. `diff` meldet ausschließlich Laufzeit-Millisekunden —
  `ok`, Beschriftung und `correctIndex` sind in allen 35 Fällen zeichengleich. Die Umordnung ist
  wirkungslos, die Behauptung also wahr.
- **Terminierung:** ja, unbedingt. Die Schleife ist auf acht Runden gedeckelt, die beiden
  `while`-Schleifen am Zeilenende verkürzen `rest` in jedem Durchlauf echt. Gemessen für eine
  Zeile aus 100 Häkchen: 0–1 ms. Der Deckel ist allerdings genau das Problem aus N1 — er sichert
  die Terminierung und öffnet dafür den Schaden.

### 4.2 Das selbst gefundene Falsch-Grün bei B2 — **richtig, und die Nachbesserung trägt**

Die nachgezogene Zusage „vor der Leitung gewinnt der letzte Zuruf, nicht der erste" ist wirklich
tragend: **M16** (`wunsch` wird nicht mehr überschrieben) macht genau sie rot, und nur sie. Keine
Scheinzusage.

Den Zustandsautomaten habe ich selbst gegen dreizehn Reihenfolgen gefahren
(Probe danach entfernt; gezählt werden abgesetzte `host:create` und ihr Inhalt):

```
Klick vor Verbindung                     x1 = ["v1"]
zwei Klicks vor Verbindung               x1 = ["v2"]
zwei Klicks vor erster Antwort           x1 = ["v1"]
Ablehnung dann Klick                     x2 = ["v1","v2"]
Ablehnung dann Wiederverbindung          x1 = ["v1"]
Ablehnung, Wiederverbindung, Klick       x2 = ["v1","v2"]
created dann Wiederverbindung (2x)       x1 = ["v1"]
created, Wiederverbindung, Klick         x1 = ["v1"]
Ablehnung mitten in Wiederverbindung     x1 = ["v1"]
Ablehnung ohne vorherigen Klick          x0 = []
zwei Ablehnungen, dann zwei Klicks       x3 = ["v1","v2","v3"]
vier Wiederverbindungen nach Klick       x1 = ["v1"]
Wortlaut der gelöschten Alt-Zusage       x1 = ["b"] bzw. x1 = ["a"]
```

Keine Reihenfolge erzeugt einen zweiten Raum; nach einer Ablehnung geht genau **ein** neuer
Versuch, und der trägt die korrigierte Fassung. Der Doppelklick-Schutz gilt vor und nach der
Ablehnung.

**Eine Kopplung, die dabei sichtbar wird und nirgends gebunden ist:** `abgelehnt()` löst den
Riegel in der Annahme, dass bei einer Ablehnung sicher kein Raum entstanden ist. Das stimmt heute
— `room:error` wird ausschließlich in `gateway.ts:113-119` gesendet, also im `catch` **vor**
`drawFreeCode` — aber nichts im Baum hält fest, dass das so bleiben muss. Schickt der Server
`room:error` eines Tages auch nach einem `room:created`, legt der nächste Klick einen zweiten Raum
an und die Runde ist tot. Das gehört zu B8/B11 und damit ausdrücklich nicht in diese Welle;
festgehalten als Restrisiko.

### 4.3 Die Zahl `MAX_SOCKET_MESSAGE_BYTES = 6_065_536` — **richtig, aber die Luft ist dünner als der Test zeigt**

Selbst gerechnet und selbst gemessen. Ich habe nicht die freundliche Datei des Umsetzers gebaut,
sondern die **ungünstigste**: minimaler Blockrumpf (`?\n*a\nb\n>…`), Rest Füllzeichen, Datei
exakt auf 1 000 000 Bytes, einmal mit einer und einmal mit 200 Fragen.

```
MAX_SOCKET_MESSAGE_BYTES=6065536
U+0001 Steuerzeichen       fragen=  1 datei=1000000 ok=true draht=6000182 faktor=6.000 rest=65354
U+0001 Steuerzeichen       fragen=200 datei=1000000 ok=true draht=6021966 faktor=6.022 rest=43570
U+0000 Null                fragen=200 datei=1000000 ok=true draht=6021966 faktor=6.022 rest=43570
Anfuehrungszeichen         fragen=200 datei=1000000 ok=true draht=2029966 faktor=2.030
umgekehrter Schraegstrich  fragen=200 datei=1000000 ok=true draht=2029966 faktor=2.030
U+007F DEL                 fragen=200 datei=1000000 ok=true draht=1031966 faktor=1.032
ae-Umlaut / Haekchen       fragen=200 datei=1000000 ok=true draht=1031966 faktor=1.032
Emoji (Ersatzpaar)         fragen=200 datei= 999600 ok=true draht=1031566 faktor=1.032
echter Draht, ungünstigste Datei, 1 Frage:   angekommen
echter Draht, ungünstigste Datei, 200 Fragen: angekommen
```

Sechs ist tatsächlich die längste Ersetzung, die JSON kennt: ein Steuerzeichen (1 Byte in der
Datei) wird zu `\uXXXX` (6 Bytes). Mehrbyte-UTF-8 wächst gar nicht, Anführungszeichen und
umgekehrte Schrägstriche verdoppeln, DEL und Ersatzpaare bleiben gleich. Lone Surrogates kann die
Datei nicht enthalten — `dekodiereUtf8` benutzt `TextDecoder('utf-8', { fatal: true })`.
**Der Puffer trägt also jede nach `MAX_UPLOAD_BYTES` erlaubte Datei.**

Zwei Einschränkungen, die im Paket nicht stehen:

1. Die Luft im Extremfall ist **43 570 B — 0,7 %**. Der Test des Pakets baut eine Datei von
   996 906 B mit 40 Byte Rumpf je Frage und misst dort 5 986 447 B; die Reserve wirkt dadurch
   größer, als sie ist. Wer `WIRE_FRAME_BYTES` je senkt oder dem Nutzlastgerüst ein Feld
   hinzufügt, muss gegen die **ungünstigste** Form rechnen, nicht gegen diese.
2. `MAX_UPLOAD_BYTES` wird nur auf die **Datei** angewendet (`Upload.tsx:116`, `datei.size`). Der
   eingefügte Text im Editor hat keine Grenze. Das ist älter als diese Welle und durch sie
   **besser** geworden (vorher riss es bei ~0,97 MB, jetzt bei ~6 MB), bleibt aber offen.

**Was der 6-MB-Puffer kostet** — selbst gemessen, acht Geräte schicken gleichzeitig je eine
Nachricht von rund 5,94 MB:

```
RSS vor den Verbindungen                        62 MB
RSS nach 8 Verbindungen, vor dem Senden         64 MB   (242 kB je Verbindung im Leerlauf)
RSS-Spitze waehrend 8 grossen Nachrichten      124 MB
```

Es gibt **keine** Vorbelegung: `maxHttpBufferSize` wird als `maxPayload` an `ws` weitergereicht
(`node_modules/engine.io/build/socket.js:82`) und ist dort eine Obergrenze, kein Puffer. Im
Leerlauf kostet eine Verbindung 242 kB, nicht 6 MB. Bezahlt wird nur, was wirklich unterwegs ist —
rund 7,5 MB je gleichzeitig eintreffender Großnachricht. Im Heimnetz ist das tragbar; die Welle
hat **keinen** Speicherdruck eingetauscht, sondern die Decke je Nachricht versechsfacht. Zusammen
mit dem offenen B8 (kein Deckel für `host:create`, Räume werden nie freigegeben) ist das derselbe
Topf — genau wie der Umsetzer schreibt.

### 4.4 Die zwei offenen Punkte — **beide bestätigt, beide zu Recht außerhalb**

```
mehrzeiliges Schlusswort:
  'F? | 20\n* A\nB\n\nViel Spass beim Quiz!\nSag Bescheid, wenn du mehr willst.'
  → ok=false n=2 hinweise=[] fehler=["5:Diese Frage hat nur eine Antwort. …","5:keine Antwort markiert, …"]

Fluchtweg hinter Aufzählungszeichen und Beschriftung:
  'F? | 20\n* Merkur\n- \* Venus'   → labels=["Merkur","\\* Venus"]
  'F? | 20\n* Merkur\nB) \* Venus'  → labels=["Merkur","\\* Venus"]
  (nackt dagegen richtig:  '\* Venus' → label "* Venus")
```

Beides gemessen und bestätigt. Beurteilung zum Umfang: **zu Recht draußen.** Das Schlusswort ist
im Auftrag nicht genannt (B5 spricht nur vom Vorwort), und der Fluchtweg war vorher genauso
kaputt — er ist durch diese Welle nicht schlechter geworden und ist als Zusage sogar neu
festgehalten („der Fluchtweg überlebt die neue Reihenfolge"). Anzumerken bleibt: beide hängen an
derselben Wurzel wie N2 — der Prüfstein steht jetzt an **einem** Rand (`kannFrageSein` fürs
Vorwort) und am anderen noch der alte (`antworten.length === 0` fürs Schlusswort). Wer N2 angeht,
sollte beide Ränder in einem Zug geradeziehen.

---

## 5. Reif für die Veröffentlichung von `standalone/quizbude.html`?

**Nein.**

Was an der Seite geprüft ist und hält:

- Der Kern-Block stammt wirklich vom Riegel. `node tools/standalone-parser.mjs` meldet „ist
  aktuell", Exit 0; eine Handänderung **im** Block (M21: `MAX_TITLE_CHARS` 256 → 255) macht den
  Riegel sofort rot („ist NICHT aktuell", Exit 1) und zwei Tests fallen. Außerhalb des Kern-Blocks
  ändert die ganze Welle an der Seite genau eine Zeile: `function esc(s){…}` →
  `const esc = Kern.escapeHtml;`.
- B12 hängt wirklich am Kern und nicht an der Ladereihenfolge: der Test vergleicht die
  Funktionsidentität (`expect(esc).toBe(kern['escapeHtml'])`) und bindet zusätzlich per
  Indexvergleich, dass die Zuweisung vor dem einzigen Aufruf auf oberster Ebene steht
  (`if (typeof document !== 'undefined') boot();`, `:2944`). Die Mutation „eigene Fassung wieder
  eingesetzt" ist rot.
- **Keine** `innerHTML`-Stelle ist durch die Umstellung ungeschützt geblieben. Ich habe alle 20
  Vorkommen durchgesehen: sieben führen Fremdeingabe und gehen durch `esc`
  (`:2238`, `:2258`, `:2335`, `:2458`, `:2489`, `:2514`, `:2572`), `berichtHtml` (`:2688`) zieht
  sich sein eigenes `const e = Kern.escapeHtml;` aus demselben Kern, der Rest sind feste Texte,
  Zahlen oder `innerHTML = ''`.
- Das `ok`-Tor der Seite ist jetzt in beide Richtungen gebunden (M19 rot).

Warum trotzdem nein:

1. **N1 trifft die Seite genauso** — es ist derselbe Kern. Dort wiegt es schwerer als in der
   Bühne: hinter dem `ok`-Tor der Browser-Fassung steht kein `loadQuestion`, und genau „die
   richtige Antwort steht sichtbar auf der Kachel" war der Grund, warum das Vorreview die
   Veröffentlichung an B1 geknüpft hat. B1 ist nicht vollständig behoben.
2. **N2 trifft die Seite genauso** — eine hochgeladene Sammlung verliert dort still ihre erste
   Frage, mit grünem Prüfbericht.
3. Veröffentlicht wird eine Datei, die nicht zurückgerufen werden kann. Beide Löcher sind
   Einzeiler; sie gehören vor die Veröffentlichung, nicht danach.

Nach N1 und N2 ist die Seite aus meiner Sicht reif — die Zwei-Fassungen-Konstruktion selbst ist in
dieser Welle sauber geblieben.

---

## 6. Nachgemessene Tore, wörtlich

Nach Rücknahme aller 26 Mutationen und Löschen aller acht Probedateien, selbst gefahren:

```
npm test
 Test Files  27 passed (27)
      Tests  309 passed (309)

npx tsc --noEmit
tsc exit=0

node tools/standalone-parser.mjs
[quizbude] standalone/quizbude.html ist aktuell.
riegel exit=0

npm run build
build exit=0

git status --short
?? docs/review-fragen-upload.md
(ende)

git log --oneline -1
a36033a docs: Ladebudget der Buehne mit den Zahlen von vite statt eigener Messung
```

Rücknahme jeder Mutation mit `cmp` gegen die Sicherungskopie belegt, nicht mit `git checkout`:

```
zeichengleich: packages/core/src/questions/parse.ts
zeichengleich: apps/host-web/src/session.ts
zeichengleich: apps/host-web/src/App.tsx
zeichengleich: apps/host-web/src/Upload.tsx
zeichengleich: packages/server/src/transport/socketio/validate.ts
zeichengleich: packages/server/src/main.ts
zeichengleich: standalone/quizbude.html
zeichengleich: test/server/harness.ts
```

`docs/proben-abbruch/` ist unberührt, `docs/review-fragen-upload.md` liegt unverändert und
unverfolgt.

**Gesetz 0, selbst nachgemessen** (Probe danach entfernt): Titel, Fragetext, Antworttext und
Erklärung als eindeutige Marker durch Upload → Raum → Spielergerät.

```
Spielergeraet sah 4 Nachrichten
  Arten: ["player:joined","player:question_prepared","clock:ping"]
  TITELMARKE enthalten: false
  FRAGEMARKE enthalten: false
  ANTWORTMARKE enthalten: false
  ANTWORTZWEI enthalten: false
  ERKLAERMARKE enthalten: false
```

Wie beim Vorreview wurde die REVEAL-Phase dabei nicht erreicht (das Lesefenster war noch offen);
für die Aufklärung trägt weiterhin `test/core/audience.test.ts:170-191`, das Fragetext,
Antworttext **und** Erklärung gegen jeden Nicht-Bühnen-Empfänger prüft und von dieser Welle nicht
angefasst ist.

**Zeilennummern der Originaleingabe, selbst nachgemessen** (Vorwort Zeile 1, Zaun Zeile 3, zwei
markierte Antworten Zeilen 5 und 6):

```
ok=false hinweise=["Zeile 1: als Vorwort uebersprungen.","Zeile 9: als Schlusswort uebersprungen."]
         fehler=["6:2 Antworten markiert, genau eine darf es sein."]
```

Unverändert richtig.

**Genau eine Alt-Zusage entfernt, selbst belegt:**

```
git diff d89a05f..a36033a -- test/ | grep -E "^-\s*it\("
-  it('erzeugt bei jeder Wiederverbindung und jedem weiteren Klick KEINEN zweiten Raum', () => {
```

Kein entferntes `describe(`, genau **ein** entferntes `expect(`
(`expect(schirm(false)).toContain('disabled')`, ersetzt durch den schärferen Knopf-Helfer),
34 neue `it(`. Die sechs Teile decken die Substanz der gelöschten Zusage ab — gemessen in
Abschnitt 4.2, beide Wortlaut-Reihenfolgen ergeben genau ein `host:create`. Aus der Abdeckung
gefallen ist nur ein Detail, und zwar absichtlich: früher galt bei zwei Klicks vor der Leitung die
Fassung des **ersten** Klicks, heute die des **letzten**. Das ist dokumentiert, begründet und
durch „vor der Leitung gewinnt der letzte Zuruf" eigens gebunden.

---

## 7. Konventionen

Es gibt keine Repo-`CLAUDE.md`. Die globale `C:\Users\nikol\CLAUDE.md` regelt Orchestrierung,
nicht Produktivcode. **Kein wörtlich zitierbarer Verstoß durch diesen Diff.** Kein Geheimnis im
Code, keine neue Datei mit sensiblem Inhalt, keine Berechtigungsfrage.

---

## 8. Restrisiken und Folgeaufgaben

1. **Die Vorwort-/Schlusswort-Prüfsteine stehen auseinander** (`parse.ts:608` gegen `:617`). N2,
   das mehrzeilige Schlusswort und der Fluchtweg hinter einem Aufzählungszeichen hängen an
   derselben Wurzel; sie gehören in einem Zug geradegezogen.
2. **`abgelehnt()` setzt voraus, dass `room:error` nie nach `room:created` kommt.** Heute wahr
   (`gateway.ts:113-119`), durch nichts gebunden. Gehört zum Transport-Paket.
3. **Nutzlastgröße ist nur für den Dateipfad gedeckelt**, nicht für eingefügten Text
   (`Upload.tsx:116`). Reißt die Verbindung weiterhin wortlos ab, nur erst ab ~6 MB.
4. **Verdrahtung ist Textwächter-Land** (N3). Zwei Stellen, beide mit grüner Probe belegt.
5. **B7, B8, B9, B11 sind unberührt** und ausdrücklich außerhalb dieser Welle. B8 und die
   versechsfachte Nachrichtendecke gehören zusammen.
6. **`docs/STAND.md:98`** führt B1 als behoben (N4).
7. **Nichts hiervon ersetzt einen Spieleabend.** Das Ablegen einer Datei im echten Browser, eine
   KI-Ausgabe aus einem echten Chatfenster, ein echtes Gasthandy und die Lesbarkeit des
   Prüfberichts auf der Leinwand bleiben ungeprüft.
