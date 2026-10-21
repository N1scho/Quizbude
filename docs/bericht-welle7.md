# Bericht zur siebten Fix-Welle — die Befunde des Nachreviews der sechsten

**Umsetzer:** ein Agent · **Ausgangs-HEAD:** `b4d0dbb` · **Branch:** `durchstich` ·
**Datum:** 2026-10-21 · **Geprüft wird diese Welle nicht von mir.**

| Befund | Stand | Commit |
|---|---|---|
| **B-1** — dreizeiliges Vorwort lässt den Upload scheitern (Regress der sechsten Welle) | behoben | `053b5c8` |
| **B-2** — eine erste Frage mit einer Antwortzeile verschwindet still | behoben, dieselbe Stelle | `053b5c8` |
| **B-3** — der Verweis auf die Leitung ist ungebunden | gebunden | `4fd9113` |
| **B-4** — gewachter Text im toten Zweig (`main.ts`) | gebunden, nicht umgebaut | `142a72e` |
| **B-5** — `perMessageDeflate: false` von keinem Test gebunden | gebunden, am laufenden Server | `da3603f` |

Alle fünf sind erledigt. B-4 und B-5 haben das Ruling mit einem Vorbehalt getroffen, der in
Abschnitt 5 und 6 steht; dazu kommt eine begründete Abweichung in Abschnitt 8, die den Nutzer
betrifft.

---

## 1. B-1 und B-2 — dieselbe Klausel, ein Fix

### Was geändert wurde

| Stelle | Was |
|---|---|
| `packages/core/src/questions/parse.ts:515-557` | neu: `BEIWERK_ZEICHEN`, `wirktWieBeiwerk`, `istVorwort` |
| `packages/core/src/questions/parse.ts:653-694` | `trenneBeiwerk`: die Klausel `erste.antworten.length <= 1` ist weg, an ihrer Stelle steht eine Schleife über `istVorwort`; der falsche Kommentar ist ersetzt |
| `packages/core/src/questions/parse.ts:1075-1098` | JSON-Tür: derselbe Maßstab auf denselben Blöcken, mit Fehler statt Hinweis |
| `packages/core/src/questions/parse.ts:1137-1146` | `parseQuiz` führt die Fehler der JSON-Tür mit und verrechnet sie in `ok` |
| `standalone/quizbude.html` | Kern mit `--schreiben` nachgezogen, Riegel danach ohne `--schreiben` grün |
| `test/core/parse.test.ts:318-416` | vier neue Zusagen |

### Warum nicht an der Zeilenzahl

Das Ruling gab das Ergebnis vor, nicht den Weg. Der Weg, den der Auftrag nahelegt — den
zweiten Maßstab „auf den Fall zuschneiden, den N2 meinte" — gibt es nicht: **keine Zeilenzahl
trennt die beiden Fälle.** Ein dreizeiliges Vorwort hat genau so zwei Antwortzeilen wie eine
erste Frage mit zwei Antworten, ein zweizeiliges genau so eine wie eine erste Frage mit einer.
Jede Entscheidung nach der Zahl muss eine der beiden Richtungen falsch entscheiden; genau das
war die Geschichte von N2 (erst still verloren, dann laut blockiert).

Entschieden wird deshalb am **Satzzeichen**: ein Vorwort trägt in *jeder* seiner Zeilen einen
Doppelpunkt oder ein Ausrufezeichen („Klar!", „Hier sind deine Fragen:", „Viel Spass!"), eine
Frage und ihre Antworten tragen keines von beiden. Dazu bleibt die alte Bedingung
`!kannFrageSein` bestehen.

Tragend ist dabei nicht das Satzzeichen, sondern ein Satz darüber, der im Kommentar steht:
**eine richtig geschriebene Frage trägt ihre Markierung und kann damit nie Vorwort sein.**
`kannFrageSein` ist schon wahr, sobald eine Antwort markiert ist. Das Satzzeichen entscheidet
also nur über Blöcke, bei denen der Autor die Markierung vergessen hat — und dort entscheidet
es im Zweifel laut: was kein Beiwerk-Zeichen trägt, bleibt stehen und wird von `pruefeUndBaue`
mit der Zeilennummer der Originaldatei beanstandet (Ruling 4).

### Die Belegtabelle, je Zeile beide Türen

Gemessen am Ausgangs-HEAD `b4d0dbb` und am Stand dieser Welle, mit derselben Eingabe. Kopf der
Eingabe plus Leerzeile plus einmal `Welcher Planet ist rot? | 20 / * Mars / Venus` (Tür
„Zeilen") beziehungsweise dieselbe Frage als JSON im Code-Zaun (Tür „JSON").

| Kopf der Eingabe | vorher Zeilen | vorher JSON | einig? | **jetzt Zeilen** | **jetzt JSON** | **einig?** |
|---|---|---|---|---|---|---|
| `Hier sind deine Fragen:` | ok=true, Vorwort | ok=true, Vorwort | ja | ok=true, Vorwort | ok=true, Vorwort | **ja** |
| `Klar!` + `Hier sind deine Fragen:` | ok=true, Vorwort | ok=true, Vorwort | ja | ok=true, Vorwort | ok=true, Vorwort | **ja** |
| `Klar!` + `Hier sind deine Fragen:` + `Viel Spass!` | **ok=false** | ok=true | **nein** | ok=true, Vorwort | ok=true, Vorwort | **ja** |
| fünf Vorwortzeilen | **ok=false** | ok=true | **nein** | ok=true, Vorwort | ok=true, Vorwort | **ja** |
| `Klar!` — Leerzeile — `Hier sind deine Fragen:` | ok=false | ok=true | **nein** | ok=true, 2× Vorwort | ok=true, Vorwort | **ja** |
| Vorwort ohne Satzzeichen (`Klar` / `Hier sind deine Fragen` / `Viel Spass`) | ok=false | ok=true | **nein** | ok=false, Zeile 1 | ok=false, Zeile 1 | **ja** |
| `Nenne den kleinsten Planeten` (0 Antwortzeilen) | **ok=true, still weg** | ok=true, still weg | ja | ok=false, Zeile 1 | ok=false, Zeile 1 | **ja** |
| `Nenne den kleinsten Planeten` + `Merkur` (1 Antwortzeile) | **ok=true, still weg** | ok=true, still weg | ja | ok=false, Zeile 1 | ok=false, Zeile 1 | **ja** |
| `Nenne den kleinsten Planeten` + `Merkur` + `Venus` | ok=false | **ok=true** | **nein** | ok=false, Zeile 1 | ok=false, Zeile 1 | **ja** |

Vorher waren die beiden Türen bei **fünf von neun** Köpfen verschiedener Meinung, jetzt bei
keinem. Wörtlich, am Stand dieser Welle:

```
Vorwort 3 Zeilen         ZEILEN ok=true  n=1 quelle=zeilen hinweise=["Zeile 1: als Vorwort uebersprungen."] fehler=[]
Vorwort 3 Zeilen         JSON   ok=true  n=1 quelle=json   hinweise=["Zeile 1: als Vorwort uebersprungen."] fehler=[]
erste Frage, 1 Antwort   ZEILEN ok=false n=2 quelle=zeilen hinweise=[] fehler=[
    "1: Diese Frage hat nur eine Antwort. Es muessen zwei bis vier sein.",
    "1: keine Antwort markiert, genau eine muss es sein. Setz ein * vor die richtige."]
erste Frage, 1 Antwort   JSON   ok=false n=1 quelle=json   hinweise=[] fehler=[
    "1: Ueber den Fragen steht Text, der kein Vorwort ist. Loesch ihn - die Fragen stehen darunter."]
```

Die Eingabe des Nachreviews, wörtlich:

```
'Klar!\nHier sind deine Fragen:\nViel Spass!\n\nWelcher Planet ist rot? | 20\n* Mars\nVenus'
  vor der Welle 6: ok=true  n=1  hinweise=["Zeile 1: als Vorwort uebersprungen."]
  bei b4d0dbb:     ok=false n=2  fehler=["1: keine Antwort markiert, …"]
  jetzt:           ok=true  n=1  hinweise=["Zeile 1: als Vorwort uebersprungen."]  fehler=[]
```

### Grün geblieben, einzeln nachgesehen

- **B5-Leitfall** (Vorwort + Zaun + Nummerierung + `A)` + Fett + Häkchen + Schlusswort in einer
  Eingabe): `ok=true`, eine Frage, Titel `Abendrunde`, Hinweise `Zeile 1: Vorwort` /
  `Zeile 12: Schlusswort`. Zusätzlich gemessen: **derselbe Leitfall mit dreizeiligem Vorwort**
  ist jetzt ebenfalls `ok=true` (bei `b4d0dbb` war er `ok=false`).
- **mehrzeiliges Vorwort, auch vor der Titelzeile** (`Klar!` / `Hier sind deine Fragen:` /
  `# Abendrunde`): unverändert grün.
- **JSON im Zaun mit Vorwort** (`Klar, hier ist die Datei:`): unverändert grün, `quelle=json`.
- **Zeilennummern hinter Vorwort und Zaun**: unverändert, `Zeile 6` und die beiden Hinweise.
- **N2-Alttest** („die erste Frage verschwindet nicht, nur weil ihr die Markierung fehlt"):
  unverändert grün, alle drei Fälle.

Keine Alt-Zusage ist geändert oder entfernt worden. 318 Alttests, alle grün.

### Der falsche Kommentar

`parse.ts:634-637` behauptete: „ein Vorwort hat hoechstens eine Folgezeile … eine Frage hat
mindestens zwei Antworten - sonst beanstandet `pruefeUndBaue` sie ohnehin mit eigener
Zeilennummer". Beide Hälften waren falsch (B-1 war der Gegenbeweis zur ersten, `trenneBeiwerk`
entfernte den Block vor `pruefeUndBaue` zur zweiten). Der Satz steht nicht mehr da. An seiner
Stelle steht, was der Code wirklich tut, einschließlich der Begründung, warum nicht gezählt
wird, und des Terminierungsarguments der Schleife (jede Runde entfernt einen Block, der letzte
bleibt immer stehen).

### Mutationsproben, selbst gefahren

| # | Datei:Zeile | Mutation | Ergebnis | Rücknahme |
|---|---|---|---|---|
| **M-A** | `parse.ts:554-555` | `istVorwort` auf `!kannFrageSein` zurückgedreht (Zustand vor der sechsten Welle) | **rot** — vier Zusagen, darunter der N2-Alttest; 62/66 | `cmp` zeichengleich |
| **M-B** | `parse.ts:690` | genau die Klausel der sechsten Welle wieder eingesetzt (`kannFrageSein(erste) \|\| erste.antworten.length > 1`) | **rot** — vier Zusagen, darunter „das dreizeilige Vorwort des Nachreviews, woertlich (B-1)"; 62/66 | `cmp` zeichengleich |
| **M-C** | `parse.ts:1083` | JSON-Tür wieder still (`if (istVorwort(b))` → `if (b !== undefined)`) | **rot** — genau eine Zusage: „die JSON-Tuer entscheidet dieselben Koepfe gleich"; 65/66 | `cmp` zeichengleich |

M-A und M-B zusammen belegen, dass der Fix **in beide Richtungen** trägt: die alte Lösung
(B-2 offen) und die neue der sechsten Welle (B-1 offen) fallen beide.

---

## 2. B-3 — die Naht zwischen Bühne und Verdrahtung

### Was geändert wurde

Neu: `test/host/buehne.test.ts` (199 Zeilen). `apps/host-web/src/App.tsx` ist **unverändert** —
der Umbau der sechsten Welle wird gebunden, nicht angefasst.

Der Test ruft `App` als Funktion, führt ihre Effekte wirklich aus, holt den Rückruf `onStart`
aus dem erzeugten Elementbaum — also genau den, den der Knopf „Fragen prüfen" trägt — und
zählt, was auf der Leitung ankommt. Ohne DOM geht das, weil eine Attrappe von `react` die Haken
selbst führt: `useEffect` sammelt die Effekte ein, statt sie zu verwerfen. Genau das war die
Ursache der Lücke — `renderToStaticMarkup` führt keinen Effekt aus, und deshalb war diese Naht
bisher unerreichbar. Keine neue Abhängigkeit: die Attrappe von `socket.io-client` ist dieselbe
wie in `wire.test.ts`, `requestAnimationFrame` und `window` bekommen Stellvertreter, damit
wirklich jeder Effekt der Komponente läuft und nicht nur der eine.

Zwei Zusagen:

1. „ein Klick auf ‚Fragen pruefen' schickt wirklich einen Raumbefehl hinaus" — genau ein
   `host:create` auf `WIRE_CHANNEL`, mit dem Titel der Sammlung.
2. „nach dem Abraeumen geht kein Raumbefehl mehr hinaus" — die Gegenprobe, damit die erste
   Zusage nicht auch dann grün bliebe, wenn die Bühne ihre Leitung nach dem Abräumen
   weiterbenutzte.

### Die verlangte Mutation

```
M-D  apps/host-web/src/App.tsx:193   `leitung.current = gelegt;` auskommentiert,
                                     der gewachte Text `verdrahte({` bleibt wörtlich stehen
```

| | bei `b4d0dbb` | jetzt |
|---|---|---|
| `npm test` | **318/318 grün** | **rot**: 323/324 |
| rote Zusage | keine | „Die Buehne haelt ihre Verdrahtung fest (B-3) › ein Klick auf ‚Fragen pruefen' schickt wirklich einen Raumbefehl hinaus" |
| `tsc --noEmit` | 0 | 0 |

Dazu die Gegenprobe zur Gegenprobe:

```
M-E  apps/host-web/src/App.tsx:196   `leitung.current = null;` im Aufräumer auskommentiert
     → rot, genau die zweite Zusage („nach dem Abraeumen geht kein Raumbefehl mehr hinaus")
```

Rücknahme beider Mutationen über eine Sicherungskopie im Scratchpad, mit `cmp` als
zeichengleich belegt — kein `git checkout`, kein `git stash`. `App.tsx` ist in dieser Welle
inhaltlich unverändert; `git status` zeigt sie nicht.

**Was dieser Test nicht bindet, ausdrücklich:** er bindet die *Naht*, nicht den Browser. Dass
React im echten Browser die Haken so führt wie die Attrappe, ist eine Annahme über React, keine
Messung. Die Darstellung der Bühne, die Dateiablage und die Lesbarkeit des Prüfberichts bleiben
nur am Gerät prüfbar — daran ändert diese Welle nichts.

---

## 3. B-4 — der Textwächter über `main.ts`

### Was geändert wurde

`test/server/socketBuffer.test.ts:97-124`. `packages/server/src/main.ts` ist **unverändert** —
kein Umbau, wie das Ruling es für den Fall vorsieht, dass es ohne nicht geht.

Statt

```ts
expect(quelle).toContain('attachGateway(createSocketServer(http))');
expect(quelle).not.toContain('new Server(');
```

steht dort jetzt

```ts
const importe = importSpezifizierer(quelle, 'main.ts');
expect(importe).not.toContain('socket.io');
expect(importe).toContain('./transport/socketio/server.js');
```

`importSpezifizierer` ist der vorhandene Helfer aus `test/quelltext.ts`, der den
TypeScript-Parser benutzt statt eines regulären Ausdrucks — derselbe Helfer, den dieses Projekt
schon einmal gebaut hat, nachdem zwei Textwächter am Lexer versagt hatten. Er sieht statische
Importe, `require`, dynamisches `import(…)` und `import x = require(…)`, und er sieht sie
unabhängig vom lokalen Aliasnamen.

### Warum das die Lücke wirklich schließt

Die Umgehung des Nachreviews war nicht, dass irgendein Text fehlte, sondern dass sich `main.ts`
einen **zweiten Socket-Server beschaffen** konnte. Dafür braucht es `Server` aus `socket.io`.
Gezählt wird deshalb nicht mehr, wie die Zeile aussieht, sondern ob die Modulkante überhaupt
existiert. Ohne diesen Import gibt es in `main.ts` kein `Server` — und damit auch keinen toten
Zweig, in dem sich etwas verstecken ließe.

### Die Mutation, zweimal gefahren

```
M-F  packages/server/src/main.ts   `import { Server as S } from 'socket.io';` dazu,
     `const registry = AUS ? attachGateway(createSocketServer(http))
                           : attachGateway(new S(http, { perMessageDeflate: false, cors: … }));`
     — der gewachte Text bleibt wörtlich im toten Zweig stehen
```

| | alter Wächter (`b4d0dbb`) | neuer Wächter |
|---|---|---|
| `npm test` | **318/318 grün** (Messung des Nachreviews, M5) | **rot**: 325/326 |
| rote Zusage | keine | „main.ts kommt an keinen eigenen Socket-Server heran (B-4)" |
| `tsc --noEmit` | 0 | 0 |

Einmal vor dem Commit gefahren, einmal am endgültigen Stand wiederholt; beide Male dasselbe
Bild. Rücknahme über Sicherungskopie, `cmp` zeichengleich.

### Mein Vorbehalt

**Das ist kein Verhaltenstest, und ich nenne ihn auch nicht so.** Das Ruling verlangt „durch
Verhalten binden, soweit das ohne neuen Umbau geht". Es geht nicht: `main.ts` fährt beim bloßen
Import einen echten Server hoch, öffnet einen Browser und hängt sich an `process.on`. Es am
Verhalten zu binden hieße, entweder `main.ts` zu zerschneiden (ausdrücklich nicht erwünscht,
die Datei ist gerade erst umgebaut worden) oder im Testlauf einen gebauten `dist/main.js` als
eigenen Prozess zu starten und seinen Handschlag zu messen — ein neues Gerüst, das die Welle
nicht klein hält und von `npm run build` abhinge.

Der Wächter bleibt also quelltextlesend. Was sich geändert hat, ist die **Bauart**: er liest
nicht mehr einen Textschnipsel, sondern die Importkante, und er liest sie mit einem Parser. Die
eine Umgehung, die ihm noch bliebe, ist umständlich genug, um nicht aus Versehen zu passieren:
`socket.io` in einem lokalen Modul re-exportieren und von dort importieren. Wer das tut, baut
den Server absichtlich um.

---

## 4. B-5 — `perMessageDeflate: false`

### Was geändert wurde

`test/server/socketBuffer.test.ts:7-8` (zwei Importe) und `:225-292` (Helfer plus zwei
Zusagen). `packages/server/src/transport/socketio/server.ts` ist **unverändert**.

Gebunden wird **am laufenden Server**, wie das Ruling es verlangt — und nicht an der
abgelesenen Option: ein roher Upgrade-Versuch mit `node:http` bietet
`Sec-WebSocket-Extensions: permessage-deflate; client_max_window_bits` an, und gemessen wird,
was in der Antwort des Servers steht. Nur `node:http` und `node:crypto`, keine neue
Abhängigkeit, kein Zugriff auf `io.engine.opts`.

Gemessen, beide Richtungen:

```
createSocketServer                              sec-websocket-extensions: (fehlt)
new Server(h, { perMessageDeflate: true, … })   sec-websocket-extensions: permessage-deflate
```

Die zweite Zeile ist die Gegenprobe und steht als eigene Zusage im Baum — ohne sie bliebe die
erste auch dann grün, wenn der Handschlag die Erweiterung überhaupt nie meldete.

### Die Mutation

```
M-G  packages/server/src/transport/socketio/server.ts:25   `perMessageDeflate: false` → `true`
```

| | bei `b4d0dbb` | jetzt |
|---|---|---|
| `npm test` | **318/318 grün** (Messung des Nachreviews, M4) | **rot**: 325/326 |
| rote Zusage | keine | „Der Server handelt keine Kompression aus (B-5) › bietet der Client permessage-deflate an, nimmt der Abend es nicht" |

Zweimal gefahren (vor dem Commit und am endgültigen Stand), beide Male dasselbe. Rücknahme über
Sicherungskopie, `cmp` zeichengleich.

**Grenze der Messung:** gemessen ist die Aushandlung, nicht der Speicherverbrauch. Dass eine
ausgehandelte Kompression je Verbindung sechsstellige Byte-Beträge kostet, steht in Konzept 6.6
und ist hier nicht nachgewogen.

---

## 5. Nachgemessene Tore, wörtlich

Am endgültigen Stand, nach der Rücknahme aller sieben Mutationen:

```
git status --short
?? docs/nachreview-welle6.md        (vor dem Bericht-Commit; danach leer)

npm test
 Test Files  28 passed (28)
      Tests  326 passed (326)
test exit=0

npx tsc --noEmit
tsc exit=0

node tools/standalone-parser.mjs          ← OHNE --schreiben
[quizbude] standalone/quizbude.html ist aktuell.
riegel exit=0

npm run build
dist/index.html                 0.41 kB │ gzip:  0.29 kB     (Bühne)
dist/assets/index-BP45TIl4.css  6.37 kB │ gzip:  1.97 kB     (Bühne)
dist/assets/index-MLP1Uj26.js 211.47 kB │ gzip: 68.37 kB     (Bühne)
dist/index.html                 0.50 kB │ gzip:  0.31 kB     (Spielergerät)
dist/assets/index-BEQfTrYX.css  3.83 kB │ gzip:  1.32 kB     (Spielergerät)
dist/assets/index-VGdzwLjJ.js 193.59 kB │ gzip: 61.82 kB     (Spielergerät)
build exit=0
```

**Ladebudget des Spielergeräts: 0,31 + 1,32 + 61,82 = 63,45 kB gzip** gegen 65 kB — unverändert
gegenüber `b4d0dbb`, und zwar bis auf den Dateinamen: `index-VGdzwLjJ.js` und
`index-BEQfTrYX.css` tragen denselben Hash wie vor der Welle. Das Spielergerät hat diese Welle
nicht angefasst; am Upload-Parser ändert sich nur, was auf der Bühne und in der Browser-Fassung
läuft.

**Riegel ohne `--schreiben`:** „ist aktuell", Exit 0 — bestätigt. Der Kern wurde einmal mit
`--schreiben` nachgezogen (im Commit `053b5c8` enthalten), danach nicht mehr.

**Testzahl:** 318 → 326. Acht neue `it(`, keine entfernte, keine geänderte Alt-Zusage; die eine
umgeschriebene Zusage in `socketBuffer.test.ts` (B-4) ist dieselbe Zusage mit anderer Bauart
und anderem Namen, nicht eine weniger.

---

## 6. Arbeitsweise, zur Nachprüfung

- Fünf Commits, einer je Befund (B-1 und B-2 sind dieselbe Stelle und teilen sich einen).
- Jede Datei **namentlich** gestagt, die Staging-Liste vor jedem Commit geprüft. Kein
  `git add -A`, kein `git add -u`, kein `git add .`, kein Branch-Wechsel, kein Rebase, kein
  `git stash`.
- Rücknahme aller Mutationen über Sicherungskopien im Scratchpad, jede mit `cmp` als
  zeichengleich belegt. Die eine Ausnahme: `test/server/socketBuffer.test.ts` wurde zwischen
  den beiden Commits einmal mit `git checkout --` auf HEAD zurückgesetzt, um B-4 und B-5
  sauber zu trennen — das betraf nur meine eigene, noch nicht committete Arbeit, keine
  Mutationsprobe.
- Nicht angefasst, wie beauftragt: `MAX_SOCKET_MESSAGE_BYTES`, der `App.tsx`-Umbau,
  `[x]` am Zeilenende, die quadratische Bremse, mehrzeiliges Schlusswort, der Fluchtweg hinter
  einem Aufzählungszeichen, die B7/B8/B9/B11-Familie, die ganze zweite Welle. Keine neue
  Abhängigkeit. `standalone/quizbude.html` ist nicht veröffentlicht und nicht im Browser
  geöffnet worden.
- Zwei Probedateien (`test/_probe*.test.ts`) haben nur der Messung gedient und sind gelöscht;
  sie sind in keinem Commit.

---

## 7. Begründete Abweichungen und Widerspruch

### 7.1 Ein Vorwort ohne Satzzeichen fällt jetzt laut

Der Preis des Satzzeichen-Maßstabs: ein Vorwort, dessen Zeilen **kein** `:` und kein `!`
tragen — `Klar` / `Hier sind deine Fragen` / `Viel Spass` — gilt nicht mehr als Vorwort und
lässt den Upload mit einer Meldung auf Zeile 1 scheitern. Vor der sechsten Welle wäre es still
übersprungen worden.

Das ist eine Abweichung von Ruling 1 in seinem Wortlaut („ein Vorwort beliebiger Zeilenzahl
wird als Vorwort erkannt") und zugleich die Anwendung von Ruling 4 („lieber laut fallen als
still entfernen"). Beide Rulings lassen sich für diesen Kopf nicht gleichzeitig erfüllen, weil
derselbe Block auch eine erste Frage ohne Markierung sein kann. Ich habe Ruling 4 den Vorrang
gegeben, weil das Ruling es ausdrücklich als Tiebreaker benennt.

**Was das für den Nutzer heißt:** die Meldung lautet in diesem Fall „Zeile 1: keine Antwort
markiert …" und steht über seinem eigenen Höflichkeitssatz — also derselbe irreführende
Meldungstext wie bei B-1, nur für eine deutlich seltenere Form. Ob das reicht, ist eine
Produktentscheidung und gehört dem Nutzer; eine Meldung „diese Zeile sieht aus wie Beiwerk,
aber auch wie eine Frage ohne Markierung" wäre ein eigenes Paket.

### 7.2 Mehrere Vorwortblöcke hintereinander

Der Auftrag spricht von einem Vorwort „ohne Leerzeile". Ich habe die Erkennung trotzdem als
Schleife gebaut, sodass auch `Klar!` — Leerzeile — `Hier sind deine Fragen:` als Vorwort
durchgeht. Grund: Ruling 3. Die JSON-Tür nimmt mehrere Blöcke über dem JSON ohnehin an; ohne
die Schleife wären die beiden Türen bei genau dieser Form wieder verschiedener Meinung gewesen.
Die Schleife ist nach oben nicht gedeckelt, terminiert aber zwingend (jede Runde entfernt einen
Block) und kann den letzten Block nie entfernen.

### 7.3 Die JSON-Tür hat einen neuen Fehlerpfad bekommen

Um Ruling 3 zu erfüllen, meldet die JSON-Tür jetzt einen **Fehler**, wenn über dem JSON etwas
steht, das kein Vorwort ist. Das ist ein neuer Weg, auf dem ein Upload scheitern kann, den es
bei `b4d0dbb` nicht gab. Ich halte ihn für richtig — eine im Zeilenformat geschriebene Frage
über einem JSON-Block verschwand vorher still —, aber er ist eine Erweiterung gegenüber dem
engsten Fix und gehört deshalb benannt. Eine Titelzeile mit `#` über dem JSON bleibt
ausdrücklich erlaubt (`zuBloecken` macht daraus gar keinen Block); das ist eigens geprüft.

### 7.4 Widerspruch zum Auftrag in einem Punkt

Der Auftrag nennt als Weg unter anderem, „den zweiten Maßstab auf den Fall zuschneiden, den N2
meinte". Das halte ich für nicht machbar, und das ist kein Geschmacksurteil: die beiden Fälle
sind nach Zeilen- und Antwortzahl **ununterscheidbar**. Jeder Maßstab, der nur zählt, muss eine
Richtung falsch entscheiden. Wer die Stelle später wieder anfasst, sollte diesen Satz zuerst
prüfen — er ist der eigentliche Befund hinter B-1 und B-2.

### 7.5 Was ich nicht mutieren konnte

Dasselbe wie im Nachreview: die Darstellung der Browser-Fassung. Gebunden ist der ausgelieferte
Parser-Kern über Byte-Gleichheit plus Ausführen (`test/standalone/kern.test.ts`, 15 Zusagen
grün). Über Leinwand, Prüfbericht und Dateiablage im echten Browser sagt diese Welle nichts.
