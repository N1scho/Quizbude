# Nachreview der sechsten Fix-Welle — Diff `a36033a..b4d0dbb`

**Prüfer:** ein frischer Agent, rein lesend · **HEAD:** `b4d0dbb` · **Datum:** 2026-10-21 ·
**Arbeitsbaum am Ende:** sauber (außer dieser Datei) · **Geprüft:** ausschließlich der Diff der
sechsten Welle, 14 Dateien, +1935/−135

---

## 1. Urteil

**Die Welle trägt: N1 und N3 sind geschlossen und mutationsgeprüft, N2 ist in seinem Kern
behoben, aber nicht in seiner Klasse — und hat in der Gegenrichtung einen neuen, lauten
Ausfall erzeugt, den niemand gemessen hatte.**

| Befund | Ampel | Begründung in einem Satz |
|---|---|---|
| **N1** — Deckel der Abtrag-Schleife | **grün** | Terminierung unter jeder geprüften Eingabe, 280 Kreuzproben ohne ein einziges grünes Label mit Markierungszeichen, Mutation rot in beiden Fassungen |
| **N2** — die erste Frage verschwindet still | **gelb** | Für ≥ 2 Antwortzeilen behoben und gebunden; für **genau eine** Antwortzeile verschwindet die erste Frage weiter still, und ein **drei- oder mehrzeiliges Vorwort** lässt jetzt den ganzen Upload scheitern |
| **N3** — Verdrahtung hing an Textwächtern | **grün** | Beide Mutationen des Vorreviews selbst gefahren, beide rot, eine davon am echten Draht; die benannten Restlöcher sind real, aber nicht schlimmer als vorher |

Der Umsetzerbericht ist in allen von mir nachgemessenen Zahlen richtig — einschließlich der
245 s, die ich unabhängig mit 248 127 ms reproduziert habe. Er ist in zwei Punkten
unvollständig: die Gegenrichtung von N2 ist nur bis zum **zweizeiligen** Vorwort gemessen, und
die Zusicherung im Quelltextkommentar (`parse.ts:634-637`) ist nachweislich falsch.

---

## 2. Der `App.tsx`-Umbau

### 2.1 War er nötig? — Ja, und die Begründung des Umsetzers hält der Nachprüfung stand

Alle vier Teilbehauptungen selbst nachgemessen, nicht übernommen:

| Behauptung | Nachgemessen |
|---|---|
| `App` wird in keinem Test gerendert | `grep -rn "from '.*App"` über `test/` liefert genau einen Treffer: `test/host/wire.test.ts:5`, und der importiert `verdrahte`, nicht `App`. `test/host/upload.test.ts` rendert `Upload` und `Bericht`. |
| `renderToStaticMarkup` führt keine Effekte aus | richtig (Eigenschaft von `react-dom/server`); die gesamte Verdrahtung lag im `useEffect` |
| kein DOM im Baum | `vitest.config.ts` setzt `environment: 'node'`; weder `jsdom` noch `happy-dom` noch `@testing-library/react` noch `react-test-renderer` stehen in `package.json`, `apps/host-web/package.json` oder dem Baum |
| ein kleinerer Weg hätte genügt | **nein, und das ist der entscheidende Punkt** |

Zum letzten: der naheliegende kleinere Weg wäre, nur den Nachrichten-Schalter als Fabrik
herauszulösen (`baueEmpfaenger(ansicht, sitzung)`) und Leitung plus Raumsitzung im Test selbst
zusammenzustecken. Genau das bindet N3 aber nicht. N3 ist der Befund, dass die **Naht** zwischen
`connect()` und `createRoomOnce()` ungebunden war — ein Test, der diese Naht selbst knüpft,
prüft seine eigene Fassung davon. Die gewählte Schnittführung (`verdrahte` umfasst Leitung,
Raumsitzung und Empfang in einem Stück) ist die kleinste, die den Befund trifft. Von den
+223 Zeilen in `App.tsx` sind rund 100 verschobener Schalter, rund 40 Kommentar und rund 20
die beiden Schnittstellen `Buehnenansicht`/`Buehnenleitung`; neue Logik entsteht nicht.

### 2.2 Hat er das Verhalten der Bühne verändert? — In einem Punkt, und der ist unerreichbar

Zustandsfluss Schritt für Schritt, alt gegen neu, Zeile für Zeile aus dem Diff:

| Weg | vorher | nachher | gleich? |
|---|---|---|---|
| **Verbindungsaufbau** | `connect(…)`, dann `createRoomOnce(wire.socket, send, () => setBereit(true))` | identisch, nur `ansicht.bereit()` als Zwischenschicht (`App.tsx:153-157`, `:189`) | **ja** — und jetzt zum ersten Mal gebunden (`wire.test.ts` „gibt den Oeffnen-Knopf erst frei") |
| **`room:created`** | `setCode`, dann `setStage({k:'lobby'})` | `ansicht.code`, dann `ansicht.stage` (`App.tsx:95-97`) | **ja**, gleiche Reihenfolge |
| **`room:error`** | `oeffne.current?.abgelehnt()`, `setServerfehler`, `setStage({k:'upload'})` | `sitzung.abgelehnt()`, `ansicht.serverfehler`, `ansicht.stage` (`App.tsx:144-146`) | **ja**, gleiche Reihenfolge — und jetzt am Verhalten gebunden (M1) |
| **Phasenwechsel** (`question_prepared`, `answer_count`, `reveal`, `scoreboard`, `podium`, `finished`) | je ein `setStage`/`setAnswered` | Feld für Feld dieselben Nutzlasten, dieselbe Reihenfolge (`App.tsx:98-139`) | **ja** |
| **Spielerliste** | `setRoster(message.players)` | `ansicht.roster(message.players)` | **ja** |
| **Rundenende** | `setStage({k:'finished'})` | identisch | **ja** |
| **Wiederverbindung mitten im Spiel** | `connect` → `verbunden=true`, `onConnect()`, `vielleicht()`; `erzeugt` schon `true` → kein zweites `host:create` | `session.ts` ist unberührt, der Weg identisch | **ja** — gebunden durch die Alt-Zusage (vier Wiederverbindungen) **und** die neue Gegenprobe |
| **Uhr / `advance`** | über `wireRef.current` | über `leitung.current` (`App.tsx:206-208`, `:235-247`) | **ja**, nur umbenannt; JSX unberührt |
| **Klick, bevor die Verdrahtung steht** | `setServerfehler(null)` + `setStage({k:'connecting'})` liefen **auch ohne** Sitzung, nur `oeffne.current?.oeffne()` fiel aus | `leitung.current?.starte(quiz)` fällt **ganz** aus (`App.tsx:201`) | **nein** |

Der eine Unterschied ist **unerreichbar und zugleich die bessere Wahl**: der Knopf ist bis
`bereit` deaktiviert (`test/host/upload.test.ts:129`), `bereit` wird erst im `onConnect` der
Sitzung gesetzt, und die Sitzung entsteht im Mount-Effekt vor jedem Klick. Vorher wäre die
Bühne in diesem Fall in „Bühne verbindet sich …" hängen geblieben, jetzt passiert gar nichts.
Beabsichtigt ist der Unterschied nicht (der Bericht nennt ihn nicht), begründbar ist er.

**Zwei Restrisiken, die der Umbau neu einträgt** (beide ohne Befundrang, beide gemessen bzw.
aus dem Quelltext belegt):

- `App.tsx:144` ruft `sitzung.abgelehnt()`, `sitzung` entsteht erst in `App.tsx:153`. Der
  Kommentar bei `App.tsx:90-92` begründet das richtig — der Rückruf kann frühestens nach einer
  Serverantwort laufen, und die braucht eine Runde der Ereignisschleife. Vorher war die Stelle
  durch `?.` wurfsicher, jetzt wäre ein synchron zugestelltes `room:error` ein
  `ReferenceError`. Mit `socket.io-client` nicht erreichbar.
- Die Naht zwischen Komponente und Verdrahtung ist jetzt die ungebundene Stelle — siehe
  Befund **B-3**. Das ist Muster 2 dieses Projekts: der Fix verschiebt die Lücke eine Schicht
  nach außen, statt sie zu schließen.

---

## 3. `server.ts` und `main.ts`

`main.ts` tut mit `server.ts` zusammen genau das, was `main.ts` vorher allein tat. Zeile für
Zeile verglichen: `perMessageDeflate: false` (`server.ts:25`), `maxHttpBufferSize:
MAX_SOCKET_MESSAGE_BYTES` (`server.ts:29`), `cors: { origin: true }` (`server.ts:30`) — alle
drei unverändert übernommen. `io` wird in `main.ts` an keiner anderen Stelle gebraucht
(nachgesehen: die ganze Datei, 74 Zeilen); `registry` kommt aus `attachGateway` wie vorher.
`MAX_SOCKET_MESSAGE_BYTES` ist unangetastet: `validate.ts:63` steht unverändert auf
`MAX_UPLOAD_BYTES * WIRE_ESCAPE_FACTOR + WIRE_FRAME_BYTES` = 6 065 536; `validate.ts` ist von
dieser Welle nicht berührt.

**Der Puffer ist am echten Draht wirksam — gemessen, nicht gelesen.** Mutation M3 dreht ihn
hinter dem Aufbau auf `1e6` herunter, und die Zusage fällt **am Verhalten** zuerst
(`expected 'getrennt' to be 'angekommen'`), nicht an der abgelesenen Zahl. Die vom Umsetzer
eigens gewählte Reihenfolge der beiden `expect` trägt also wirklich.

Zwei Nebensachen dazu:

- `test/server/harness.ts:45` nimmt denselben Server. Damit laufen **alle** Transporttests
  jetzt gegen die echten Maße. Dass das trägt, zeigt M3 nebenbei mit: unter dem gesenkten
  Puffer bleiben die Transporttests grün (sie schicken kleine Nachrichten) — die eine Zusage,
  die groß schickt, fällt.
- `perMessageDeflate: false` ist die „harte Betriebsvorgabe aus Konzept 6.6" und von **keinem**
  Test gebunden (M4: `false` → `true`, 318/318 grün, `tsc` 0). Das war vor der Welle genauso;
  es ist kein Verlust, aber es ist eine Lücke, die jetzt an einer einzigen, gut sichtbaren
  Stelle steht und billig zu schließen wäre (siehe **B-5**).

---

## 4. Meine Mutationsproben

Alle acht selbst gefahren, keine vom Umsetzer übernommen. Rücknahme ausnahmslos über
Sicherungskopien im Scratchpad und mit `cmp` belegt — kein `git checkout`, kein `git stash`.

| # | Datei:Zeile | Mutation | Roter Test | Rücknahme |
|---|---|---|---|---|
| **M1** | `App.tsx:144` | `sitzung.abgelehnt();` → `if (message.code === 'niemals') sitzung.abgelehnt();` (Zeile bleibt, Wirkung stirbt) | **rot** — `wire.test.ts` › „nach einer Ablehnung des Servers geht ein zweiter Raumbefehl wirklich hinaus", 317/318, `tsc` 0 | `cmp` zeichengleich |
| **M2** | `App.tsx:193` | `leitung.current = gelegt;` → Kommentarzeile | **GRÜN** — 318/318, `tsc` 0, `build` 0, Riegel 0 → Befund **B-3** | `cmp` zeichengleich |
| **M3** | `server.ts:21-31` | `(io.engine as …).opts.maxHttpBufferSize = 1e6;` hinter der Konstruktion, `return io;` | **rot** — `socketBuffer.test.ts` › „traegt den Puffer wirklich", `expected 'getrennt' to be 'angekommen'`, 317/318, `tsc` 0 | `cmp` zeichengleich |
| **M4** | `server.ts:25` | `perMessageDeflate: false` → `true` | **GRÜN** — 318/318, `tsc` 0 → Befund **B-5** | `cmp` zeichengleich |
| **M5** | `main.ts:22,38` | `import { Server as S } from 'socket.io'` plus `const registry = AUS ? attachGateway(createSocketServer(http)) : attachGateway(new S(http, { perMessageDeflate: false }));` — der gewachte Text bleibt wörtlich im toten Zweig stehen | **GRÜN** — 318/318, `tsc` 0, `build` 0 → Befund **B-4** | `cmp` zeichengleich |
| **M6** | `parse.ts:424` | `for (;;)` → `for (let runde = 0; runde < 8; runde += 1)` (Zustand von `a36033a`) | **rot** — fünf Zusagen: die drei N1-Zusagen (`Stern und 8 Haekchen: expected [ '✅ Merkur', 'Venus' ]`) **und** zwei in `kern.test.ts` (Byte-Gleichheit). Die Laufzeit-Zusage fiel nach **248 127 ms** | `cmp` zeichengleich |
| **M7** | `parse.ts:640-643` | `&& erste.antworten.length <= 1` gestrichen | **rot** — `parse.test.ts` › „die erste Frage verschwindet nicht, nur weil ihr die Markierung fehlt (N2)", und nur sie (61/62), `tsc` 0 | `cmp` zeichengleich |
| **M8** | `outbound.ts:21` | `scope 'host'` zusätzlich in den Spielerraum (`io.to(channels.host).to(channels.players)`) — Gesetz 0 gegen das neue Harness | **rot** — drei Zusagen, darunter „haelt Buehnen-, Spieler- und Geraetenachrichten auseinander" mit **10 Lecktexten** | `cmp` zeichengleich |

**Was ich nicht mutieren konnte und warum:** die Darstellung der Browser-Fassung. Der Auftrag
untersagt ausdrücklich, `standalone/quizbude.html` zu veröffentlichen oder im Browser zu
öffnen. Gebunden ist der ausgelieferte **Parser-Kern** (Byte-Gleichheit plus Ausführen, M6 ist
dort rot) — über Leinwand, Prüfbericht und Dateiablage im echten Browser sagt diese Welle
nichts, und ich auch nicht.

---

## 5. Neue Befunde dieser Welle

### B-1 · mittel · neu durch diese Welle · `parse.ts:643` und dieselbe Stelle in `standalone/quizbude.html:862-865`

**Ein Vorwort aus drei oder mehr Zeilen ohne Leerzeile dazwischen lässt den ganzen Upload
scheitern.** Der neue zweite Maßstab `erste.antworten.length <= 1` trifft nicht nur die erste
Frage, sondern auch jedes Vorwort, das mehr als eine Folgezeile hat — denn ein mehrzeiliger
Block hat genau dann „zwei Antworten", wenn er drei Zeilen lang ist.

Gemessen, dieselbe Eingabe vor und nach der Welle (vor = M7 aktiv, also der Zustand von
`a36033a`):

```
'Klar!\nHier sind deine Fragen:\nViel Spass!\n\nWelcher Planet ist rot? | 20\n* Mars\nVenus'
  vor der Welle:  ok=true   n=1  hinweise=["Zeile 1: als Vorwort uebersprungen."]  fehler=[]
  nach der Welle: ok=false  n=2  prompts=["Klar!","Welcher Planet ist rot?"]
                  fehler=["1: keine Antwort markiert, genau eine muss es sein.
                           Setz ein * vor die richtige."]
```

Dasselbe Bild beim fünfzeiligen Vorwort, beim dreizeiligen Vorwort **mit** Titelzeile und beim
B5-Leitfall mit dreizeiligem Vorwort — alle vier vorher `ok=true`, jetzt `ok=false`.

Zweierlei macht das schwerer, als es klingt. Erstens die Meldung: der Nutzer liest „Zeile 1:
keine Antwort markiert, genau eine muss es sein. Setz ein * vor die richtige." und darunter
steht als Frage 1 sein eigener Satz „Klar!". Dass er die drei Höflichkeitszeilen löschen soll,
sagt ihm niemand. Zweitens die Inkonsistenz: dieselbe Eingabe mit JSON im Code-Zaun bleibt
`ok=true` (gemessen), weil die JSON-Tür ihr Vorwort strukturell bestimmt
(`parse.ts:1028-1029`) und von der Zeilenzahl gar nichts wissen will. Die beiden Türen des
Parsers sind in derselben Frage jetzt verschiedener Meinung.

**Vorschlag ohne Umsetzung:** entweder den zweiten Maßstab auf den Fall zuschneiden, den N2
meinte (etwa: eine markierte oder antwortzahlplausible erste Frage schützen, statt jedes
mehrzeilige Beiwerk zur Frage zu erklären), oder das Vorwort im Zeilenformat wie in der
JSON-Tür strukturell bestimmen. Die Entscheidung, welcher der beiden Schäden schwerer wiegt —
eine still fehlende Frage oder ein blockierter Upload mit irreführender Meldung — ist eine
Produktentscheidung und gehört dem Nutzer.

### B-2 · mittel · N2 nur teilweise geschlossen · `parse.ts:643`, falsche Zusicherung in `parse.ts:634-637`

**Eine erste Frage mit genau einer Antwortzeile verschwindet weiter still.** Gemessen am
heutigen HEAD:

```
'Nenne den kleinsten Planeten\nMerkur\n\nWelcher Planet ist rot? | 20\n* Mars\nVenus'
  -> ok=true  n=1  hinweise=["Zeile 1: als Vorwort uebersprungen."]  fehler=[]

derselbe Block an ZWEITER Stelle
  -> ok=false n=2  fehler=["5: Diese Frage hat nur eine Antwort. …",
                           "5: keine Antwort markiert, genau eine …"]
```

Das ist genau die Asymmetrie, die N2 ausmachte, nur eine Antwortzeile schmaler. Der Kommentar
im Quelltext behauptet das Gegenteil:

> „eine Frage hat mindestens zwei Antworten - sonst beanstandet `pruefeUndBaue` sie ohnehin
> mit eigener Zeilennummer" (`parse.ts:636-637`)

`pruefeUndBaue` sieht den ersten Block nie: `trenneBeiwerk` entfernt ihn davor. Für den
**zweiten** Block stimmt der Satz, für den ersten nicht. Dasselbe gilt für den Satz „ein
Vorwort hat hoechstens eine Folgezeile" (`parse.ts:634-635`) — B-1 ist der Gegenbeweis.

**Vorschlag ohne Umsetzung:** zusammen mit B-1 behandeln; beide hängen an derselben Zeile.

### B-3 · mittel · Restrisiko, nicht neu, aber umgezogen · `App.tsx:193`

**Die Naht zwischen Komponente und Verdrahtung ist nur durch einen Textwächter gebunden.**
M2 entfernt `leitung.current = gelegt;` und lässt den gewachten Text `verdrahte({` wörtlich
stehen: **318/318 grün, `tsc` 0, `npm run build` 0, Riegel 0.** Am Gerät wäre die Bühne damit
tot — `starte` fällt folgenlos aus, es entsteht nie ein Raum, „Fragen prüfen" tut nichts, und
die gemeinsame Uhr steht. Keine Meldung, kein Hinweis, alle vier Tore schweigen.

Das ist **kein** Rückschritt: dieselbe Mutation war vor der Welle an der entsprechenden Stelle
(`oeffne.current = createRoomOnce(…)`) genauso ungebunden. Es ist Muster 2 dieses Projekts —
die Lücke ist eine Schicht nach außen gewandert, nicht verschwunden. Der Umsetzer benennt es
selbst, wörtlich, im Test (`session.test.ts:220-221`: „Hier bleibt nur die Frage, ob die
Komponente ueberhaupt durch die gebundene Verdrahtung geht") — gebunden ist diese Frage
dadurch nicht.

**Vorschlag ohne Umsetzung:** nicht den Textwächter verbreitern. Ein Riegel zweiter Bauart
wäre `App` selbst gegen einen Doppelgänger von `verdrahte` zu fahren — das verlangt aber einen
Effektlauf und damit entweder eine neue Abhängigkeit oder eine andere Schnittführung. Gehört
in ein eigenes Paket, zusammen mit der Frage, ob die Bühne überhaupt je am echten Browser
gebunden werden soll.

### B-4 · niedrig · Restrisiko, vom Umsetzer selbst benannt, von mir bestätigt · `main.ts:38`, `socketBuffer.test.ts:110-111`

Der verbliebene Textwächter in `main.ts` ist umgehbar, und zwar genau nach Muster 16 („Zeile
bleibt, Wirkung zieht um"). M5 lässt `attachGateway(createSocketServer(http))` wörtlich in
einem toten Zweig stehen und routet den Live-Pfad über `new S(http, …)` — `new Server(` kommt
nicht vor, also greift auch `not.toContain('new Server(')` nicht. **318/318 grün, `tsc` 0,
`build` 0**, und B3 wäre am Spieleabend vollständig zurück.

Abschnitt 6.2 des Umsetzerberichts nennt genau das als „das letzte Restloch" und sagt, es ganz
zu schließen hieße, `main.ts` den HTTP-Server aus der Hand zu nehmen. Das ist richtig; ich
bestätige den Punkt mit einer Messung statt mit einer Einschätzung. Kein Fix in dieser Welle
nötig.

### B-5 · niedrig · Testlücke, nicht neu · `server.ts:25`

`perMessageDeflate: false` ist als „harte Betriebsvorgabe aus Konzept 6.6" kommentiert und von
keinem Test gebunden (M4 grün). Vor der Welle war es ebenso ungebunden — aber jetzt steht die
Entscheidung an genau einer Stelle, an der ein Verhaltenstest schon hochfährt
(`socketBuffer.test.ts` › „Der Server, den der Abend hochfaehrt"), und wäre dort mit einer
Zeile mitzunehmen. Kein Befund gegen diese Welle; eine billige Gelegenheit, die offen bleibt.

### Keine Befunde, ausdrücklich

- **N1 terminiert unter jeder von mir geprüften Eingabe.** Die Begründung des Umsetzers am
  Regex stimmt, ist aber nicht der tragende Teil: tragend ist, dass alle vier Regexe mit `^`
  verankert sind und durch `''` ersetzt werden, `rest` also in jeder Runde echt kürzer oder
  zeichengleich wird — im zweiten Fall bricht die Schleife. Dreizehn adversarielle Eingaben
  gefahren (50 000 × `*`, 50 000 × `[x]`, 333 333 × `✅`, 50 000 × `a) `, 50 000 × `- `,
  30 000 × `A) - ✅ [x] + `, 50 000 × `☐`, 50 000 Leerzeichen, 50 000 Rückstriche, 50 000 × `[ `,
  50 000 × `[ x ]`, 200 000 × `+`, Fluchtweg hinter 500 Häkchen) — **keine hängt, Maximum
  65 ms.** Eine Eingabe, die den Terminierungsbeleg widerlegt, habe ich nicht gefunden.
- **Kein Markierungszeichen bleibt im sichtbaren Label eines grünen Ergebnisses.** 280
  Kreuzproben: zehn Zeichen (`✅ ✔ ✓ ☑ [x] [X] + ☐ ❌ ✗`) × sieben Zahlen (1, 2, 8, 9, 10, 20,
  100) × vier Formen (Zeilenformat, JSON, am Zeilenende, vorn **und** hinten zugleich) —
  **null Treffer**. Was nicht grün wird, fällt laut auf (`*`-Lauf → „keine Antwort markiert",
  Label behält die Sterne, aber `ok=false`).
- **Gesetz 0 hält.** `test/server/outbound.test.ts` › „haelt Buehnen-, Spieler- und
  Geraetenachrichten auseinander" läuft jetzt gegen das umgebaute Harness und damit gegen den
  echten `createSocketServer`. M8 belegt, dass die Zusage dabei nicht stumm geworden ist: zehn
  Lecktexte, drei rote Zusagen. Die Welle berührt weder `protocol`, noch `gateway.ts`, noch
  `outbound.ts`, noch das Spielergerät.
- **Die beiden ausgeklammerten Punkte sind durch diese Welle nicht schlimmer geworden** —
  selbst nachgemessen: `'F? | 20\n* Venus\nMerkur [x]'` → `ok=true`, `labels=["Venus","Merkur
  [x]"]`, `correctIndex=0` (unverändert); Markierungslauf mitten in der Zeile 541 ms / 2 217 ms
  / 9 256 ms bei 16 000 / 32 000 / 64 000 Häkchen (die Zahlen des Umsetzers waren 543 / 2 160 /
  9 007 — gleiche Größenordnung, unverändert).

### Folgeaufgabe, älter als diese Welle · `parse.ts:157`

`entferneAuszeichnung` trägt denselben gedeckelten Reparaturlauf, den N1 gerade abgeschafft hat
— `for (let runde = 0; runde < 3; runde += 1)` — und er fällt ebenso nach oben offen aus.
Gemessen:

```
'F? | 20\n* Venus\n' + '*'×n + 'Merkur' + '*'×n
  n=2,4,6   -> ok=true  labels=["Venus","Merkur"]
  n=8       -> ok=true  labels=["Venus","**Merkur**"]
  n=16      -> ok=true  labels=["Venus","**********Merkur**********"]
```

Grün, und die Sterne stehen auf der Kachel. Das verrät keine Antwort (`**` gilt ausdrücklich
als Fettdruck, nicht als Markierung, `istMarkiert` `parse.ts:375`), ist also kein B1-Rückfall
— aber es ist dasselbe Muster an der Nachbarstelle, und die Welle hat es nicht mitgenommen.
Gehört auf die Liste, nicht in diese Welle.

---

## 6. Falsch-Grün-Suche

**Wo gesucht:** jeder quelltextlesende Wächter des Projekts, jeweils gegen Kommentare in seiner
Zieldatei geprüft, nicht nur gegen Code.

| Wächter | Zieldatei | Kommt der gesuchte Text dort in einem Kommentar vor? |
|---|---|---|
| `session.test.ts:208` `"wire.send({ t: 'host:create', quiz })"` | `App.tsx` | nein — einziger Treffer `App.tsx:155`, echter Code |
| `session.test.ts:209` `'createRoomOnce<QuizPayload>('` | `App.tsx` | nein — `App.tsx:153` echter Code; der Import in `:13` trägt die spitze Klammer nicht |
| `session.test.ts:222` `'verdrahte({'` | `App.tsx` | **nein** — einziger Treffer `App.tsx:185`, echter Code. Der Kommentar bei `App.tsx:76-88` nennt `verdrahte` nur ohne `({`. Die Falle ist an dieser Stelle **wirklich geschlossen** |
| `session.test.ts:223` `not.toMatch(/\.on\s*\(\s*['"\`]connect['"\`]/)` | `App.tsx` | greift nicht ins Leere — `App.tsx` hat keinen rohen connect-Handler mehr |
| `tasten.test.ts:41` `'if (!istWeiterTaste(e)) return;'` | `App.tsx` | nein — `App.tsx:251`, echter Code |
| `socketBuffer.test.ts:110` `'attachGateway(createSocketServer(http))'` | `main.ts` | nein — `main.ts:38`, echter Code. **Aber:** der Wächter ist durch „Text bleibt, Wirkung zieht um" umgehbar, siehe B-4 (M5) |
| `socketBuffer.test.ts:111` `not.toContain('new Server(')` | `main.ts` | nein — und `new S(` unterläuft ihn, siehe B-4 |

**Das vom Umsetzer gemeldete Falsch-Grün ist geschlossen.** Die alte Zusage
`toContain('oeffne.current?.abgelehnt()')` hätte ihren Text heute tatsächlich im Kommentar
`App.tsx:78` und `App.tsx:80` gefunden — die Zeichenkette steht dort wörtlich. Dass der
Umsetzer die Zusage nicht stehengelassen, sondern durch einen Verhaltenstest ersetzt hat, ist
die richtige Reihenfolge; M1 belegt, dass der Ersatz trägt.

**Dieselbe Falle anderswo im Diff: nicht gefunden.** Kein Wächter dieser Welle sucht Text, der
in einem Kommentar seiner Zieldatei vorkommt.

**Eine schwächere Stelle habe ich gefunden, sie zählt aber nicht als Falsch-Grün:**
`parse.test.ts` › „nichts Gruenes traegt ein Markierungszeichen im Label" iteriert über
`spec?.options ?? []`. Liefert der Parser für eine Eingabe gar keine Frage, läuft der
Schleifenrumpf nie und die Zusage ist für diesen Fall leer. Heute ist das folgenlos — unter M6
wurde genau diese Zusage rot, sie prüft also wirklich etwas. Die Schwäche ist, dass sie bei
einer **anderen** Regression (Parser liefert nichts mehr) schweigen würde. Nachbarzusage „die
neunte, die zwanzigste und die zweihundertste Markierung" fängt diesen Fall ab, weil sie
`spec.options.map(…)` ohne Fragezeichen anfasst.

---

## 7. Reif für die Veröffentlichung von `standalone/quizbude.html`?

**Ja.**

Begründung, und zwar als Vergleich mit dem, was heute verlinkt ist, nicht mit einem Ideal:

1. **Der Grund, aus dem das Vorreview die Veröffentlichung abgelehnt hat, ist weg.** Die
   verlinkte Fassung trägt N1 noch: ab der neunten Markierung in derselben Zeile steht die
   richtige Antwort sichtbar auf der Leinwand, bei grünem Prüfbericht. Das ist der einzige
   Schaden in dieser ganzen Liste, der die Runde unterwandert, statt sie zu stören. Er ist
   geschlossen, in **beiden** Fassungen (der Riegel belegt den gemeinsamen Kern, M6 ist in
   `kern.test.ts` rot), und 280 Kreuzproben finden keinen Rest.
2. **N2 ist in der verlinkten Fassung breiter offen als in der neuen.** Dort verschwindet jede
   erste Frage still, der nur die Markierung fehlt; neu betrifft es nur noch die erste Frage mit
   genau einer Antwortzeile (B-2). Enger ist besser, auch wenn es nicht zu ist.
3. **Was neu dazukommt, ist laut und nicht still.** B-1 blockiert den Upload mit einer
   irreführenden Meldung — ärgerlich, aber niemand spielt dadurch eine falsche Runde, und die
   Lage ist in Sekunden behebbar, sobald man sie versteht. Ein stiller Fehler im Feld wiegt
   schwerer als ein lauter.
4. **Die Veröffentlichung verschlechtert nichts.** Beide ausgeklammerten Punkte sind
   nachgemessen unverändert; Gesetz 0 hält; am Spielergerät hat diese Welle nichts angefasst
   (kritischer Pfad 63,45 kB gzip, unverändert).

**Was mit der Veröffentlichung mitgeht und in `STAND.md` gehört, bevor der Link hinausgeht:**
B-1 (dreizeiliges Vorwort blockiert den Upload) und B-2 (erste Frage mit einer Antwort
verschwindet still). Beide stecken im gemeinsamen Kern und damit in der Browser-Fassung. Wer
den Link weitergibt, sollte den Satz „Kein Vorwort und kein Schlusswort" aus der KI-Anweisung
diesmal ernst nehmen.

**Mein Ja gilt der Fassung, nicht der Oberfläche.** Gebunden ist der ausgelieferte
Parser-Kern. Darstellung, Dateiablage und Lesbarkeit des Prüfberichts im echten Browser hat
weder diese Welle noch dieses Nachreview geprüft — das ist nur am Gerät prüfbar.

---

## 8. Nachgemessene Tore, wörtlich

Vor den Proben, bei sauberem Arbeitsbaum:

```
git status --short
(leer)

npm test
 Test Files  27 passed (27)
      Tests  318 passed (318)

npx tsc --noEmit
tsc exit=0

node tools/standalone-parser.mjs
[quizbude] standalone/quizbude.html ist aktuell.
riegel exit=0

npm run build
dist/index.html                 0.50 kB │ gzip:  0.31 kB
dist/assets/index-VGdzwLjJ.js 193.59 kB │ gzip: 61.82 kB
dist/assets/index-BEQfTrYX.css  3.83 kB │ gzip:  1.32 kB
build exit=0
```

Nach der Rücknahme aller acht Mutationen, selbst gefahren:

```
git status --short
(leer)

npm test
 Test Files  27 passed (27)
      Tests  318 passed (318)

npx tsc --noEmit
tsc exit=0

node tools/standalone-parser.mjs
[quizbude] standalone/quizbude.html ist aktuell.
riegel exit=0

npm run build
build exit=0
```

Rücknahme jeder Mutation mit `cmp` gegen eine Sicherungskopie im Scratchpad belegt:
`App.tsx`, `parse.ts`, `main.ts`, `server.ts`, `outbound.ts` — jedes Mal zeichengleich. Kein
`git checkout`, kein `git stash`, kein `git add`, kein Commit, kein Branch-Wechsel.
`docs/proben-abbruch/` unberührt. `standalone/quizbude.html` weder verändert noch veröffentlicht
noch im Browser geöffnet.

**Nebenbei, für die nächste Probe:** der Arbeitsbaum ist **gemischt**, nicht durchgängig CRLF.
`parse.ts` ist CRLF, `App.tsx`, `main.ts`, `server.ts` und `outbound.ts` sind LF. Eine
Mutationsprobe, die das Zeilenende nicht je Datei prüft, findet ihren Suchtext nicht.

---

## 9. Zahlen, die ich nicht übernommen, sondern nachgemessen habe

| Behauptung des Umsetzers | Meine Messung |
|---|---|
| 318 Tests, 27 Dateien | 318 / 27 ✓ |
| „Zehn neue `it(` gegen eine entfernte, 309 → 318" | 10 hinzugefügte und 1 entfernte `it(`-Zeile im Diff, kein `describe(` entfernt; Gesamtzahl 266 → 275 (+9 netto, eine der zehn ist die umbenannte Alt-Zusage) ✓ |
| 245 s unter dem zurückgedrehten Deckel | 248 127 ms, unabhängig gemessen ✓ |
| 67,5 ms am Dateideckel nach der Welle | 65 ms ✓ |
| Quadratisch mitten in der Zeile: 543 / 2 160 / 9 007 ms | 541 / 2 217 / 9 256 ms ✓ |
| `MAX_SOCKET_MESSAGE_BYTES` unangetastet | `validate.ts:63` unverändert, Formel ergibt 6 065 536 ✓ |
| Ladebudget 63,45 kB gzip unverändert | 0,31 + 1,32 + 61,82 = 63,45 kB ✓ |
| Drei umgestellte Alt-Zusagen ohne Abdeckungsverlust | nachgelesen: die beiden Draht-Zusagen fahren über den neuen Bauer-Parameter dieselben zwei Server wie vorher; die entfernte Import-Zusage betraf einen Import, den es nicht mehr gibt ✓ |

**Zeilennummern des Vorreviews:** `scheduler.ts:21-24`, `static.ts:80` und
`requestListener.ts:28` stimmen weiter auf die Zeile. `validate.ts:72` zeigt eine Zeile über
`isShortString` (steht in `:73`) — die Datei und die betreffende `STAND.md`-Zeile sind von
dieser Welle nicht berührt, die Abweichung ist älter.

---

## 10. Begründeter Widerspruch gegen den Auftrag

Keiner in der Sache. Ein Hinweis zur Form: Prüfpunkt 3 verlangt, die Terminierung „am Regex"
nachzuprüfen. Das habe ich getan, halte die Beweisführung über die Regexe aber für den
schwächeren Teil des Belegs — sie muss für jede künftig hinzugefügte Regex neu geführt werden.
Tragend und robust gegen Erweiterung ist das Argument über die Monotonie: solange jede
Ersetzung in dieser Schleife ein `^`-verankertes Muster durch `''` ersetzt, ist `rest` nach
jeder Runde echt kürzer oder zeichengleich, und zeichengleich bricht ab. Wer dort einmal eine
nicht verankerte Regex oder einen nichtleeren Ersatz einträgt, reißt die Terminierung auf,
ohne dass der heutige Kommentar davor warnt. Das wäre der Satz, der im Kommentar stehen sollte.
