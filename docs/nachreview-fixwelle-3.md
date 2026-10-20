# Nachreview der dritten Fix-Welle

**Stand:** 2026-10-20 · **Branch:** `durchstich` · **Geprüfter Diff:** `be8b19e..33731ac`
**Commits:** `b3fe3fa`, `60c54f7`, `09ef2c9`, `d353907`, `155b2ae`, `1231fa5`, `33731ac`
**Grundlage, als Behauptung behandelt:** `docs/bericht-fixwelle-3.md`

Rein lesend, abgesehen von vierzehn Mutationsproben, die alle byteweise zurückgenommen sind.
Keine Zahl aus dem Umsetzerbericht übernommen. Kein Fix, kein Commit, kein `git add`, kein
`stash`, kein Branch-Wechsel. `standalone/` nicht angefasst.

---

## 0. Urteil in einem Absatz

Alle sechs Punkte halten. B1/B3, B2 und B5 sind durch eigene Rücknahmeproben **bewiesen**, B4
durch eigene Messung belegt, R2 durch die Probe, die der Umsetzer ausdrücklich nicht gefahren hat
— sie bestätigt seine korrigierte Beschreibung. Kein Falsch-Grün gefunden: in keiner der
vierzehn Proben blieb etwas grün, das rot werden musste, und keine harmlose Schreibweise fiel zu
Unrecht. Zum ersten Mal in diesem Projekt ist eine Welle nicht an ihrem eigenen Lexer gescheitert
— weil zwei der drei Riegel diesmal gar keiner mehr sind: einer fährt echtes Verhalten, einer
benutzt den TypeScript-Parser. Die verbliebenen Lücken sind schmal und verlangen, dass jemand
den Typprüfer bewusst aushebelt. Ein **Befund niedriger Schwere** bleibt: der eine Weg, den B5
gebaut hat, ist von keinem Test gebunden — man kann `loadQuestion` aus `demoQuiz.ts` entfernen
und alle 118 Tests bleiben grün.

---

## 1. Die Tore, selbst gemessen

Am Stand `33731ac`, sauberer Arbeitsbaum, vor und nach allen Proben identisch:

```
$ npx vitest run
 Test Files  15 passed (15)
      Tests  118 passed (118)

$ npx tsc --noEmit
(keine Ausgabe)   Exit 0

$ npm run build
 Exit 0
```

Die Zahlen des Umsetzerberichts stimmen. Die Verteilung ist in sich schlüssig: `wire.test.ts` 2,
`question.test.ts` 7, `demoQuiz.test.ts` 2, `session.test.ts` 4→5, `purity.test.ts` 21→22 ergibt
genau die behaupteten 105 + 13 = 118.

Eine Zahl im Bericht ist falsch (siehe Hinweis H1): `packages/core/src` enthält **18** Dateien,
am Ausgangspunkt waren es 17 — nicht „16 statt 15", wie Abschnitt 4 des Berichts schreibt. Das
ist nachgezählt (`git ls-tree -r be8b19e` gegen `find`) und passt auch zur Testzahl: 18 + 4 = 22.

---

## 2. B1 und B3 — E1 am Verhalten statt am Quelltext

`test/host/wire.test.ts` fährt die **echte** `connect()` aus `apps/host-web/src/wire.ts:26`; nur
`socket.io-client` ist per `vi.mock` ersetzt. Das ist keine Nachbildung, und es ist nicht nur aus
dem Import geschlossen, sondern dadurch belegt, dass jede Mutation **in wire.ts** den Test rot
macht — eine Nachbildung bliebe davon unberührt. Die Verdrahtung in `wire.test.ts:87` ist
zeichengleich mit `apps/host-web/src/App.tsx:109`.

### Probe 1 — die wörtliche Nachstellung

`apps/host-web/src/wire.ts:42`, eingefügt in den bestehenden `connect`-Handler:
`send({ t: 'host:create' });`

```
FAIL  session.test.ts > host:create steht in der ganzen Buehne an genau einer Stelle
  AssertionError: expected { 'App.tsx': 1, 'wire.ts': 1 } to deeply equal { 'App.tsx': 1 }
FAIL  wire.test.ts > schickt ueber eine ganze Sitzung genau ein host:create
  AssertionError: expected [ { kanal: 'quizbude', …(1) }, …(5) ] to have a length of 1 but got 6
FAIL  wire.test.ts > schickt beim Verbinden von sich aus nur Uhrproben
  AssertionError: expected [ 'host:create', 'clock:ping' ] to deeply equal [ 'clock:ping' ]
```

**Urteil: bewiesen.** Drei Riegel, davon zwei am Verhalten.

### Probe 2 — über eine Konstante, in doppelten Anführungszeichen

`wire.ts:1` `const BEFEHL = "host:create";`, `wire.ts:43` `send({ t: BEFEHL });`. Dieselben drei
Tests fallen, mit denselben Meldungen. Der Parser unterscheidet Anführungsarten nicht — die
Lücke, an der dieses Projekt zweimal gescheitert ist, ist damit strukturell geschlossen und nicht
nur breiter gefasst.

### Probe 3 — zusammengesetzt, also kein zusammenhängendes Textliteral

`wire.ts:42-43`:
```ts
    const befehl = 'host' + ':create';
    send({ t: befehl } as ClientMessage);
```

```
✓ test/host/session.test.ts (5 tests)          ← der Textwaechter ist blind
FAIL wire.test.ts > schickt ueber eine ganze Sitzung genau ein host:create
  AssertionError: expected [ … ] to have a length of 1 but got 6
FAIL wire.test.ts > schickt beim Verbinden von sich aus nur Uhrproben
  AssertionError: expected [ 'host:create', 'clock:ping' ] to deeply equal [ 'clock:ping' ]
```

Das ist die interessanteste Probe der Welle und sie geht zugunsten des Umsetzers aus: genau da,
wo der Textwächter nichts mehr sieht, greift der Verhaltenstest. Die beiden Riegel decken
unterschiedliche Lücken ab, das war der erklärte Zweck.

### Probe 4 — dieselbe Zeile in einer dritten Datei

`apps/host-web/src/main.tsx`, eine zweite Leitung mit eigenem `connect`-Handler und wörtlichem
Literal:

```
✓ test/host/wire.test.ts (2 tests)             ← der Verhaltenstest ist blind
FAIL  session.test.ts > host:create steht in der ganzen Buehne an genau einer Stelle
  AssertionError: expected { 'App.tsx': 1, 'main.tsx': 1 } to deeply equal { 'App.tsx': 1 }
```

Spiegelbildlich zu Probe 3: der Dateizuschnitt, an dem die zweite Welle scheiterte, ist zu.

### Probe 5 — die verbliebene Lücke, benannt

Beide Ausweichwege **kombiniert**: dritte Datei *und* zusammengesetzt.
`main.tsx:15-18`, `const befehl = 'host' + ':create';` plus
`zweiteLeitung.send({ t: befehl } as import('@quizbude/protocol').ClientMessage)`:

```
 Test Files  15 passed (15)
      Tests  118 passed (118)
```

E1 ist dabei vollständig wiederhergestellt — bei jeder Wiederverbindung entsteht ein zweiter
Raum — und alle Tore schweigen. **Das ist kein Befund, sondern ein benanntes Restrisiko**, und
zwar aus einem belegbaren Grund: ohne die ausdrückliche Typzusicherung lehnt der Typprüfer die
Schreibweise ab. Ich habe den Cast entfernt und gemessen:

```
apps/host-web/src/main.tsx(16,24): error TS2322: Type 'string' is not assignable to type
  '"host:create" | "host:start" | "host:advance" | "player:join" | "player:answer" |
   "clock:ping" | "clock:pong"'.
```

Die beiden echten Rückfälle dieses Projekts waren Schreibvarianten, die jeder versehentlich tippt
— andere Anführungszeichen, Leerraum vor der Klammer, Nachbardatei. Ein `as ClientMessage` auf
einem zusammengesetzten Befehlsnamen ist keine davon; `tsc --noEmit` ist hier der dritte Riegel.

**B1: bewiesen. B3: bewiesen** — die Zeile `session.test.ts:99`
(`not.toMatch(/\.on\s*\(\s*['"\`]connect['"\`]/)`) trägt nachweislich, Probe 1 und 2 fallen über
sie mit.

### Zur begründeten Abweichung des Umsetzers

Er hat den weiten Wächter nicht auf rohe `connect`-Handler gezogen, sondern auf den Befehl
`host:create`, und zählt Textliterale statt Zeichenketten. **Beides ist fachlich richtig, nicht
nur plausibel.** `wire.ts:41` braucht seinen `connect`-Handler für die Uhrproben — die wörtliche
Auftragsfassung wäre ohne jeden Rückfall rot geworden, also ein Wächter, der nur noch
weggeschaltet werden kann. Und `apps/host-web/src/session.ts:5` nennt `host:create` im
Kopfkommentar: ein roher Textvergleich hätte eine Ausnahmeliste gebraucht, und eine Ausnahmeliste
ist wieder genau das Loch, das zu schließen war. Dass Kommentare beim Parser keine Literale sind,
ist in Probe 1 mitbewiesen — `session.ts` taucht in keinem `treffer`-Objekt auf.

---

## 3. B2 — Importprüfung über den TypeScript-Parser

`test/quelltext.ts:36-59` liefert die Modulspezifizierer, `purity.test.ts:46-48` reicht nur noch
durch. Zehn Proben, jede am Kopf von `packages/core/src/engine/reading.ts`, jede einzeln gefahren
und zurückgenommen.

| # | Probe | erwartet | gemessen |
|---|---|---|---|
| a | `const muster = '/*';` + echter Import + `const ende = '*/';` | rot | **rot** |
| b | `const url = /https:\/\//;` + echter Import | rot | **rot** |
| c | mehrzeiliger dynamischer Import | rot | **rot** |
| d | Importsatz **nur** im Template-Literal | grün | **grün** |
| e | `// @ts-ignore` über echtem Import | rot | **rot** |
| f | mehrzeiliges `require(…)` | rot | **rot** |
| g | Syntaxfehler **vor** einem echten Import | rot | **rot** |
| h | Import nach totem `if (false) {}` | rot | **rot** |
| i | `const r = require; r('node:crypto')` | — | grün |
| j | `const m = 'node:crypto'; import(m)` | — | grün |

Die Fehlermeldung ist in a, b, c, e, g, h wortgleich:

```
FAIL  purity.test.ts > importiert ausser protocol kein weiteres Paket
  AssertionError: expected [ Array(1) ] to deeply equal []
       Tests  1 failed | 21 passed (22)
```

Probe d ist die wichtige Gegenrichtung und bleibt sauber grün (22/22): eine harmlose Erwähnung
wird nicht zum Falsch-Positiv. Probe g ist der Fall, den ich am meisten gesucht habe — ein
fehlertoleranter Parser, der an einer kaputten Stelle aufgibt und danach still nichts mehr
findet, wäre exakt die vierte Lücke dieses Projekts gewesen. Er gibt nicht auf.

Die Proben i und j stehen ohne Urteil in der Tabelle, weil sie keine Rückfälle sind, die jemand
schreibt: j ist im Kopfkommentar von `quelltext.ts:32-34` ausdrücklich als Grenze benannt, i
wäre ein `require` unter falschem Namen. Beide bleiben als Restrisiko notiert, nicht als Befund.

**Zu den Auflagen des Auftrags, selbst geprüft:**

- *Keine Laufzeitabhängigkeit.* `typescript` kommt im ganzen Quelltext genau einmal vor:
  `test/quelltext.ts:1`. `packages/core/package.json` führt als `dependencies` ausschließlich
  `@quizbude/protocol`. `npm run build` ist Exit 0 und liefert unveränderte Bündelgrößen
  (61,57 / 61,82 kB gzip).
- *`typescript` war schon da.* `git show be8b19e:package.json` zeigt `"typescript": "^5.6.3"` in
  den Wurzel-`devDependencies`; `git log -- package.json` nennt als einzigen Commit `54fe48a`,
  das Workspace-Gerüst. Die Abhängigkeit ist nicht in dieser Welle entstanden.

**Urteil: bewiesen.**

---

## 4. B5 — `MAX_PROMPT_CHARS` beim Laden

### Die Abweichung des Umsetzers

Er führt den **ganzen** Frageeintrag durch `loadQuestion` (`packages/core/src/questions/load.ts:39`)
statt nur den Fragetext durch eine Prüffunktion. Das ist richtig und nicht bloß vertretbar: B5
war kein fehlender Vergleich, sondern eine Grenze, an die jemand denken musste. Eine freistehende
`parsePrompt` hätte dieselbe Eigenschaft behalten. Die gebaute Form ist zudem die, die
`singleChoice.ts:44` für `MAX_OPTION_CHARS` längst benutzt — der Fix fügt kein neues Muster
hinzu, er zieht den Fragetext in das vorhandene.

### Gibt es einen Weg an `loadQuestion` vorbei?

Heute **nein**. Der einzige Produktivpfad, auf dem Quizinhalt in einen Raum kommt, ist
`gateway.ts:106` → `loadDemoQuiz` → `demoQuiz.ts:53` → `loadQuestion`. `createGame` hat genau
zwei Aufrufer: `gateway.ts:123` und `test/core/fixture.ts:85`. Handgebaute `LoadedQuestion`
gibt es nur in der Testfixtur.

Aber: **der Weg ist von keinem Test gebunden.** Siehe Befund N1.

### Rücknahmeproben

**P1 — Längengrenze zurückgedreht** (`load.ts:26`, `prompt.length > MAX_PROMPT_CHARS` gestrichen):

```
FAIL  question.test.ts > faellt bei einem Zeichen mehr laut auf, statt still zu kuerzen
  AssertionError: expected [Function] to throw an error
FAIL  question.test.ts > ist die Grenze, die das offene Lesefenster baendigt
  AssertionError: expected [Function] to throw an error
       Tests  2 failed | 7 passed (9)
```

**P4 — zu langer Fragetext im Demo-Quiz, Verdrahtung steht** (`demo-2` auf 329 Zeichen):

```
FAIL  demoQuiz.test.ts > geht durch die Pruefung beim Laden
  AssertionError: expected [Function] to not throw an error but
  'Error: Frage demo-2: prompt muss 1..200 Zeichen haben, hat 329' was thrown
FAIL  demoQuiz.test.ts > haelt die Zeichengrenze jeder Frage ein
       Tests  2 failed (2)
```

**P3 — zu langer Text **und** Verdrahtung zurückgebaut** (`demoQuiz.ts:53` baut die
`LoadedQuestion` von Hand):

```
✓   demoQuiz.test.ts > geht durch die Pruefung beim Laden
FAIL demoQuiz.test.ts > haelt die Zeichengrenze jeder Frage ein
  AssertionError: expected 329 to be less than or equal to 200
```

Die Zusatzprobe des Umsetzers ist damit bestätigt: die beiden Zusicherungen binden getrennt.

**Urteil: bewiesen.**

### Ruling R1 unangetastet — geprüft

`git log be8b19e..HEAD -- packages/core/src/engine/reading.ts` ist leer; die Datei ist Zeile für
Zeile die alte. `READING_MAX_MS` kommt im Quelltext nirgends vor,
`packages/core/src/engine/constants.ts:36` führt nur `READING_MIN_MS = 10000`, und
`reading.ts:33` endet unverändert auf `Math.max(Math.round(raw), READING_MIN_MS)` — nach oben
offen. `test/core/reading.test.ts:48` hält den Wegfall zusätzlich fest. Durchgesetzt wurde die
Textlänge, nicht die Fensterdauer. **R1 ist unberührt.**

---

## 5. B4 — die Dokumentzahl

Selbst gebaut, `npm run build` Exit 0, `apps/player-web/dist` enthält genau drei Dateien:

```
dist/index.html                 0.50 kB │ gzip:  0.31 kB
dist/assets/index-BEQfTrYX.css  3.83 kB │ gzip:  1.32 kB
dist/assets/index-VGdzwLjJ.js 193.59 kB │ gzip: 61.82 kB
```

0,31 + 1,32 + 61,82 = **63,45 kB**, Abstand zum Budget **1,55 kB**. `docs/konzept-ux.md:404`
nennt genau diese Aufteilung. Eine Rücknahmeprobe gibt es hier nicht und der Umsetzer täuscht
auch keine vor — richtig so.

**Die Abweichung — `STAND.md` mitgezogen — war richtig.** `docs/STAND.md:14` und `:50` trugen
dieselbe falsche Zahl; wäre sie stehen geblieben, hätte der laufende Stand dem Konzept
widersprochen. `STAND.md` ist ein Fortschreibungs-, kein Rückblickdokument.

**Kein rückblickendes Dokument wurde angefasst.** `git log --name-only be8b19e..HEAD -- docs`
nennt nur `konzept-ux.md`, `STAND.md`, `bericht-fixwelle-3.md` und `nachreview-fixwelle-2.md` —
letzteres als reine Neuanlage (`b3fe3fa`, 410 insertions, keine Löschung). `61,82` steht
weiterhin in `bericht-durchstich.md`, `bericht-fixwelle-2.md`, `nachreview-fixwelle.md` und
`nachreview-fixwelle-2.md`, dort korrekt als historischer Messwert. `konzept-architektur.md:1181`
nennt nur das Budget, keinen Messwert — zu Recht unberührt.

**Urteil: belegt durch eigene Messung.**

---

## 6. R2 — die Ping-Pong-Sperre

Der Umsetzer benennt dies als die einzige Stelle, an der er eine fremde Messung übernommen hat.
Ich habe sie nachgefahren, weil genau das der Prüfauftrag war.

**Probe:** `packages/server/src/transport/socketio/outbound.ts:22` von `io.to(channels.host)` auf
`io.to(channels.host).to(channels.players)` mutiert **und** die drei Aufrufe
`test/server/outbound.test.ts:205-207` entfernt. Drei Läufe hintereinander:

```
Lauf 1 / 2 / 3, jeweils identisch:
  FAIL  Audience auf Socket.IO-Raeume > stellt scope host ausschliesslich in den Buehnenraum zu
  FAIL  Audience auf Socket.IO-Raeume > stellt scope all an Buehne UND Spieler zu, an beide genau einmal
  FAIL  Audience auf Socket.IO-Raeume > laesst den Spielerraum nur bei players und all zu
  FAIL  Empfaengerkreis am echten Server > haelt Buehnen-, Spieler- und Geraetenachrichten auseinander
          AssertionError: expected [ …(10) ] to deeply equal []
       Tests  4 failed | 3 passed (7)
```

Kontrolllauf mit wiederhergestellter Sperre, gleiche Mutation: ebenfalls `4 failed | 3 passed`,
dieselben vier Namen. Der Test am echten Server fällt mit **zehn** beobachteten Lecktexten, ob
die Sperre steht oder nicht.

Die korrigierte Beschreibung in `test/server/outbound.test.ts:158-172` ist damit zutreffend, und
der Satz „Wer sie als Beweis anführt, führt eine Zusage an, die hier nichts getragen hat" ist
nachgemessen richtig. Die Sperre schadet nicht und darf stehen bleiben.

**Urteil: korrigiert und nachgeprüft.**

---

## 7. Befunde

### N1 — niedrig: der eine Weg ist gebaut, aber nicht verriegelt

**Stelle:** `packages/server/src/demoQuiz.ts:53` in Verbindung mit `test/server/demoQuiz.test.ts:11-22`.

**Probe:** `loadQuestion` aus `demoQuiz.ts:53` entfernt, die `LoadedQuestion` wieder von Hand
gebaut (`spec` weiterhin über `registry.get(type).parseSpec`), **Fragetexte unverändert legal**:

```
 Test Files  15 passed (15)
      Tests  118 passed (118)
```

Der Umsetzer hat diesen Fall in seiner Probe 3 nur zusammen mit einem überlangen Text gefahren
und daraus geschlossen, die beiden Zusicherungen bänden getrennt. Das stimmt — aber es heißt
auch: **nichts bindet die Verdrahtung selbst.** Wer sie entfernt, ohne gleichzeitig eine Grenze
zu reißen, kommt sauber durch alle Tore. Das ist dieselbe Form wie B5, eine Ebene höher: eine
Zusicherung, an die jemand denken muss.

Die Wirkung ist heute null, weil beide Demofragen weit unter der Grenze liegen. Sie wird
spürbar, sobald der Editor der zweiten Welle dazukommt — dann ist `loadQuestion` die Tür, deren
Benutzung niemand prüft. **Schweregrad niedrig**, weil kein Nutzer heute etwas davon merkt und
kein Pfad existiert, der die Tür bereits umgeht.

*Kein Fix in diesem Review, nur gemeldet.* Eine Zusicherung, die am Weg statt am Ergebnis hängt
— etwa ein Textwächter über `demoQuiz.ts` oder ein Markierungsfeld, das nur `loadQuestion` setzt
— schlösse sie.

### H1 — Hinweis: falsche Zahl im Umsetzerbericht

`docs/bericht-fixwelle-3.md`, Abschnitt 4, Aufzählungspunkt „`packages/core` bleibt rein":
„jetzt über **16 statt 15** Dateien". Gezählt sind es **18 statt 17**
(`find packages/core/src -name '*.ts'` gegen `git ls-tree -r be8b19e`). Die Testzahl bestätigt
18: 18 Dateien + 4 übrige Fälle = 22 Purity-Tests. Kein Code betroffen, aber der Bericht sagt in
seinem Vorspann „Jede Zahl in diesem Bericht ist selbst gemessen" — diese eine nicht.

---

## 8. Restrisiken aus diesem Diff — keine Befunde

1. **Dritte Datei plus zusammengesetzter Befehl.** Probe 5: E1 vollständig wiederhergestellt bei
   118/118 grün. Verlangt eine ausdrückliche Typzusicherung; ohne sie hält `tsc --noEmit`.
   Die Lücke ist damit von „jeder tippt das versehentlich" auf „jemand hebelt den Typprüfer
   bewusst aus" geschrumpft. Zu schließen wäre sie nur mit einem Verhaltenstest je Modul der
   Bühne — Aufwand gegen Nutzen spricht heute dagegen.
2. **`require` unter anderem Namen, dynamischer Import über eine Variable.** `quelltext.ts:32-34`
   benennt den zweiten Fall selbst. Beide sind in `core` keine Schreibweise, die jemand wählt.
3. **Die Verdrahtung in `demoQuiz.ts` ist ungebunden** — als Befund N1 geführt, hier nur als
   Querverweis.

---

## 9. Test-Lücken

- Der Verhaltenstest `wire.test.ts` deckt genau ein Modul ab. `App.tsx`, `main.tsx` und
  `shapes.tsx` hängen allein am Textwächter. Das ist bewusst so gebaut und heute angemessen;
  es ist der Punkt, an dem die nächste Lücke entstehen würde.
- `question.test.ts` prüft `loadQuestion` gründlich, aber kein Test prüft, **dass** ein
  Produktivpfad `loadQuestion` benutzt. Siehe N1.
- `scope: 'all'` bleibt am echten Server ungebunden (unverändert aus dem Vorgängerreview, als
  Folgeaufgabe dokumentiert).

---

## 10. Folgeaufgaben — unverändert offen, nicht in diesem Review bewertet

Die vier bewusst offenen Punkte stehen unverändert und sind im Umsetzerbericht Abschnitt 9 sowie
in `docs/STAND.md:57-78` dokumentiert: Timerpfad `scheduler.ts` → `roomHandle.ts` ohne örtliche
Fehlerbehandlung, `static.ts` mit sofortigem `true` nach `pipe`, `MAX_NAME_CHARS` undurchgesetzt,
zeilenweise Uhr-/Zufalls-/Timerprüfung in `purity.test.ts`. Dazu `scope: 'all'` am echten Server
und die Mindestdauer von 10 s, die gerechnet und nicht erlebt ist — **das bleibt eine Frage ans
Gerät, die kein Test beantwortet.**

Der Hinweis des Umsetzers, dass der Timerpfad durch B5 *dringender* wird, trifft zu:
`loadQuestion` wirft jetzt, und sobald der Editor Inhalte von außen annimmt, nimmt dieser Wurf
einen echten Pfad.

---

## 11. Arbeitsbaum

Vierzehn Mutationen in sieben Dateien (`wire.ts`, `main.tsx`, `reading.ts`, `load.ts`,
`demoQuiz.ts`, `outbound.ts`, `outbound.test.ts`), jede über eine Binärsicherung im Scratchpad
gefahren und byteweise zurückgespielt. Nach der letzten Rücknahme:

```
$ git status --short
?? standalone/

$ git diff --stat          (leer)
$ git diff --cached --stat (leer)
$ git rev-parse --short HEAD
33731ac

$ npx vitest run       118 passed (118), 15 Dateien
$ npx tsc --noEmit     Exit 0
```

Das unverfolgte `standalone/` lag schon vor dem Review dort und wurde nicht angefasst. Kein
Commit, kein `git add`, kein `stash`, kein Branch-Wechsel, kein Reset.
