# Bericht der dritten Fix-Welle

**Stand:** 2026-10-20 · **Branch:** `durchstich` · **Ausgangspunkt:** `be8b19e`
**Grundlage:** `docs/nachreview-fixwelle-2.md` (Prüferbericht, unverändert committet als `b3fe3fa`)

Fünf Befunde (B1–B5), zwei Rulings (R1, R2). Jede Zahl in diesem Bericht ist selbst gemessen.
Jeder Fix hat eine Rücknahmeprobe, bei B1, B2 und B5 zusätzlich die im Auftrag wörtlich
beschriebene Nachstellung. Kein `git add -A`, kein Branch-Wechsel, kein Reset, kein `stash`.

---

## 0. Urteil in einem Absatz

B1 und B2 waren beide vom selben Typ: ein Wächter, der so tut, als könne ein regulärer Ausdruck
Quelltext zerlegen. Beide sind jetzt nicht mehr nur enger gefasst, sondern anders gebaut — B1
bekommt zusätzlich einen Verhaltenstest, B2 einen echten Parser. Damit ist dieses Projekt zum
ersten Mal nicht in der Lage, dieselbe Lücke ein viertes Mal an einer neuen Stelle aufzureißen.
B3 ist eine Zeile, B4 eine Zahl, B5 eine durchgesetzte Grenze, die bisher nur definiert war. R1
bleibt unangetastet: keine Kappung des Lesefensters kehrt zurück. R2 ist eine korrigierte
Beschreibung, kein Umbau.

---

## 1. Die Tore, selbst gemessen

Am Stand nach der letzten Änderung, sauberer Arbeitsbaum:

```
$ npx vitest run
 Test Files  15 passed (15)
      Tests  118 passed (118)
 Exit: 0

$ npx tsc --noEmit
(keine Ausgabe)   Exit: 0

$ npm run build
 Exit: 0
 apps/player-web/dist  index.html   0.50 kB │ gzip:  0.31 kB
                       index-*.css  3.83 kB │ gzip:  1.32 kB
                       index-*.js 193.59 kB │ gzip: 61.82 kB
```

| | vorher (`be8b19e`) | nachher |
|---|---|---|
| Tests | 105 | **118** |
| Testdateien | 12 | **15** |
| `tsc --noEmit` | Exit 0 | Exit 0 |
| `npm run build` | Exit 0 | Exit 0 |

Verteilung der neuen Tests: `test/host/wire.test.ts` 2 (neu), `test/core/question.test.ts` 7 (neu),
`test/server/demoQuiz.test.ts` 2 (neu), `test/host/session.test.ts` 4 → 5, `test/core/purity.test.ts`
21 → 22. Der 22. Purity-Test ist kein neuer Test, sondern die neue Quelldatei
`packages/core/src/questions/load.ts`, die der Reinheitswächter jetzt mitprüft — der Wächter
erzeugt einen Fall je Datei in `packages/core/src`.

---

## 2. B1 — E1 hing an einem Textwächter, der eine Datei las

**Stelle:** `apps/host-web/src/wire.ts:41-43` (der bestehende `connect`-Handler) in Verbindung mit
`test/host/session.test.ts:64-78` (der Wächter, der nur `App.tsx` las).

**Änderung:** Commit `60c54f7`.

1. **Neuer Verhaltenstest** `test/host/wire.test.ts`. Er fährt die echte `connect()` aus `wire.ts`
   gegen einen aufzeichnenden Socket (`socket.io-client` ist über `vi.mock` ersetzt), verdrahtet
   `createRoomOnce` genau wie `App.tsx:109` und feuert `connect` fünfmal — genau das tut
   `socket.io-client` bei jeder Wiederverbindung. Gebunden ist die Ursache: über eine ganze
   Sitzung geht **genau ein** `host:create` auf die Leitung, gleich aus welchem Modul es käme.
   Zweiter Test, noch näher an der Ursache: die Leitung schickt beim Verbinden von sich aus
   **nur** `clock:ping`.
2. **Der Textwächter bleibt, aber nicht als einziger Riegel** und nicht mehr auf eine Datei
   beschränkt. Neu in `session.test.ts`: `host:create` kommt in **allen** Quelldateien der Bühne
   (`apps/host-web/src/**/*.{ts,tsx}`) an genau einer Stelle vor, nämlich einmal in `App.tsx`.

**Begründete Abweichung vom Auftrag.** Der Auftrag stellte frei, den Wächter „über alle
Quelldateien der Bühne" zu ziehen. Wörtlich genommen — also das Verbot eines rohen
`connect`-Handlers auf alle Dateien ausgedehnt — wäre er sofort rot geworden: `wire.ts` braucht
einen `connect`-Handler für die Uhrproben, das ist kein Rückfall, sondern die Funktion. Gebunden
wird deshalb nicht der Handler, sondern der Befehl: `host:create`. Das trifft die Nachstellung des
Prüfers unmittelbar und ist zugleich das, worauf es sachlich ankommt.

**Zweite begründete Abweichung.** Gezählt wird nicht der Text, sondern das Textliteral im Code.
`session.ts` erklärt `host:create` in seinem Kopfkommentar, ohne es zu senden; ein roher
Textvergleich hätte entweder diese Erklärung mitgezählt oder eine Ausnahme gebraucht, die selbst
wieder ein Loch wäre. Dafür zerlegt `test/quelltext.ts` den Quelltext mit dem TypeScript-Parser
(siehe B2) und liefert die Textliterale. Kommentare sind dort keine Literale.

### Nachstellung des Prüfers, wörtlich gefahren

Eingefügt in `apps/host-web/src/wire.ts:42`, im bestehenden Handler:

```ts
    send({ t: 'host:create' });
```

Alle drei neuen Riegel fallen:

```
× Die Leitung der Buehne > schickt ueber eine ganze Sitzung genau ein host:create - auch nach vier Wiederverbindungen
  AssertionError: expected [ { kanal: 'quizbude', …(1) }, …(5) ] to have a length of 1 but got 6

× Die Leitung der Buehne > schickt beim Verbinden von sich aus nur Uhrproben
  AssertionError: expected [ 'host:create', 'clock:ping' ] to deeply equal [ 'clock:ping' ]

× Raum genau einmal je Sitzung > host:create steht in der ganzen Buehne an genau einer Stelle
  AssertionError: expected { 'App.tsx': 1, 'wire.ts': 1 } to deeply equal { 'App.tsx': 1 }

  Test Files  2 failed | 11 passed (13)
       Tests  3 failed | 105 passed (108)
```

Mutation byteweise zurückgenommen (Sicherungskopie im Scratchpad), `git status --short` für
`wire.ts` danach leer.

**Urteil: behoben und bewiesen.** Die Bedingung des Auftrags — „Dein Fix gilt erst als erledigt,
wenn die eingefügte Zeile in `wire.ts` rot wird" — ist erfüllt, und zwar dreifach, davon zweimal
am Verhalten.

---

## 3. B3 — Leerraum vor der Klammer

**Stelle:** `test/host/session.test.ts:77` (am Ausgangspunkt), jetzt `:81`.

**Änderung:** Commit `60c54f7`. `/\.on\(\s*['"`]connect['"`]/` → `/\.on\s*\(\s*['"`]connect['"`]/`.

### Rücknahmeprobe

Damit die Probe wirklich **diese** Zeile prüft und nicht die `toContain`-Zusicherung darüber,
bleibt die echte `createRoomOnce`-Zeile stehen und der Rückfall kommt als zusätzliche Zeile dazu
(`apps/host-web/src/App.tsx:110`):

```ts
    wire.socket.on ('connect', () => wire.send({ t: 'host:create' }));
```

Mit dem Fix:

```
× Raum genau einmal je Sitzung > die Buehne benutzt den Wachter auch wirklich
  AssertionError: expected 'import { useCallback, useEffect, useM…' not to match /\.on\s*\(\s*['"`]connect['"`]/

× Raum genau einmal je Sitzung > host:create steht in der ganzen Buehne an genau einer Stelle
  AssertionError: expected { 'App.tsx': 2 } to deeply equal { 'App.tsx': 1 }

       Tests  2 failed | 3 passed (5)
```

Gegenprobe, dieselbe Mutation, aber die alte Regex ohne `\s*` vor der Klammer, nur dieser eine
Test ausgeführt:

```
✓ test/host/session.test.ts (5 tests | 4 skipped)
       Tests  1 passed | 4 skipped (5)
```

Das `\s*` ist also tragend und nicht nur Kosmetik. Beide Mutationen zurückgenommen.

**Urteil: behoben und bewiesen.**

---

## 4. B2 — `/*` im Stringliteral blendete die Importprüfung

**Stelle:** `test/core/purity.test.ts:38-40` am Ausgangspunkt (`ohneKommentare`).

**Änderung:** Commit `09ef2c9`. Statt einer dritten Regex zerlegt jetzt der **TypeScript-Parser**
den Quelltext. Die Zerlegung liegt in `test/quelltext.ts` (`importSpezifizierer`, `textliterale`);
`specifiersOf` in `purity.test.ts` reicht nur noch durch.

**Begründung der Bauart.** Der Auftrag stellte frei, bei einer Regex zu bleiben oder den Quelltext
echt zu zerlegen. Die Regex-Variante trägt hier nicht: um `/*` im String zu überstehen, muss die
Erkennung String-Grenzen kennen; wer String-Grenzen kennt, hat einen Lexer gebaut — und zwar einen
handgeschriebenen, bei dem als nächstes das Regex-Literal (`/https:\/\//` enthält `//`) oder das
Template mit `${}` die vierte Lücke liefert. Genau dieses Muster — Lücke schließen, Lücke
aufreißen — hat dieses Projekt jetzt dreimal getroffen. TypeScript liegt als
Entwicklungsabhängigkeit ohnehin im Projekt (`typescript@^5.6.3`, Wurzel-`devDependencies`).

**Zu den Auflagen des Auftrags:**

- *`packages/core` bleibt rein.* Der Parser läuft im Test, der core **liest**. Er wird nicht von
  core geladen. `packages/core/src/index.ts` und jede Datei darunter importieren unverändert
  nichts außer `@quizbude/protocol` und relativen Pfaden — der Wächter selbst beweist das bei
  jedem Lauf, jetzt über 16 statt 15 Dateien.
- *Keine neue Laufzeitabhängigkeit im Produktivpaket.* `typescript` steht in den
  `devDependencies` der Wurzel und wird ausschließlich von `test/quelltext.ts` importiert.
  `npm run build` bleibt Exit 0, die Bündelgrößen sind unverändert (61,57 / 61,82 kB gzip).

**Was der Selbsttest jetzt abdeckt** (`purity.test.ts`, „die Importpruefung erkennt jede
Schreibweise"): beide Lücken gleichzeitig — mehrzeilige Importe in drei Formen **und** das
Kommentarzeichen im Stringliteral in beiden Spielarten (`/*` und `//`) — dazu die Gegenrichtung:
ein Importsatz, der nur in einem String oder Template steht, ist kein Import. Der frühere
Falsch-Positiv-Fall „Import nur im Template-Literal" ist damit aufgelöst: ein echtes
`import(\`node:crypto\`)` wird als Import erkannt, ein Importsatz *im Text* nicht.

### Nachstellung des Prüfers, wörtlich gefahren

Drei Zeilen am Kopf von `packages/core/src/engine/reading.ts`:

```ts
const muster = '/*';
import { randomUUID } from 'node:crypto';
const ende = '*/';
```

```
× Purity von core > importiert ausser protocol kein weiteres Paket
  AssertionError: expected [ Array(1) ] to deeply equal []
  - Array []
  + Array [
  +   "C:\\Users\\nikol\\quiz\\packages\\core\\src\\engine\\reading.ts: node:crypto",
  + ]
       Tests  1 failed | 20 passed (21)
```

**Gegenprobe, dass der Fix das Tragende ist:** dieselbe Mutation in `reading.ts`, aber
`specifiersOf` vorübergehend auf die alte Fassung (`SPECIFIER_RE` plus `ohneKommentare`)
zurückgedreht, nur der Wächtertest ausgeführt:

```
✓ test/core/purity.test.ts (21 tests | 20 skipped)
       Tests  1 passed | 20 skipped (21)
```

Alt grün, neu rot, bei identischem Produktivcode. Beide Mutationen zurückgenommen.

**Urteil: behoben und bewiesen.**

---

## 5. B5 — `MAX_PROMPT_CHARS` war definiert und wurde nirgends durchgesetzt

**Stelle:** `packages/core/src/engine/constants.ts:39`; durchgesetzt wird jetzt in
`packages/core/src/questions/load.ts`, aufgerufen in `packages/server/src/demoQuiz.ts:49-52`.

**Änderung:** Commit `d353907`.

**R1 ist unangetastet.** Kein `READING_MAX_MS` kehrt zurück, `reading.ts` ist unverändert, die
Formel ist unverändert, das Lesefenster bleibt nach oben offen. Durchgesetzt wird die
**Textlänge**, nicht die Fensterdauer.

**Was gebaut ist.** `loadQuestion(raw, registry)` ist der eine Weg, auf dem Quizinhalt zu einer
`LoadedQuestion` wird: `id`, `type` (muss in der Registry stehen), `timeLimitMs`, `pointsFactor`,
`prompt` über `parsePrompt` und die Spezifikation über `registry.get(type).parseSpec` — also genau
die Stelle und genau die Form, in der `singleChoice.ts:44` schon `MAX_OPTION_CHARS` durchsetzt.
Zu langer Text wirft, er wird nicht gekürzt.

**Begründete Abweichung vom Auftrag.** Der Auftrag verlangte die Grenze „dort, wo Quizinhalte ins
System kommen". Eine bloße `parsePrompt`-Funktion hätte das erfüllt — und hätte dieselbe Schwäche
gehabt, die B5 überhaupt erst ausmacht: eine Prüfung, an die jemand denken muss. Deshalb ist der
**ganze** Frageeintrag durch eine Tür geführt. Der Quiz-Editor der zweiten Welle kann die Grenze
dann nicht mehr umgehen, ohne an `loadQuestion` vorbeizubauen, und das fiele im Review auf.

**Hält das Demo-Quiz die Grenze?** Ja. `demo-1` hat 40 Zeichen, `demo-2` 28 — beide weit unter 200.
`test/server/demoQuiz.test.ts` prüft beides: dass `loadDemoQuiz()` durch die Prüfung geht und dass
jeder Fragetext die Grenze einhält.

**Warum die Grenze tragend ist, im Test festgehalten.** `test/core/question.test.ts` rechnet beide
Richtungen vor: die 2000-Zeichen-Frage des Befunds ergibt ein Lesefenster über 150 s und wird
abgelehnt; der längste zulässige Fragetext hat höchstens 100 Wörter, das Fenster steht damit auch
im schlimmsten Fall bei höchstens 42 s. Ohne Zeichengrenze gäbe es diese Schranke nicht — das ist
der Zusammenhang, den der Prüfer benannt hat.

### Rücknahmeproben

**Probe 1 — die Längengrenze zurückgedreht** (`load.ts`, `prompt.length > MAX_PROMPT_CHARS`
gestrichen, nur `< 1` bleibt):

```
× Der Fragetext beim Laden > faellt bei einem Zeichen mehr laut auf, statt still zu kuerzen
  AssertionError: expected [Function] to throw an error
× Der Fragetext beim Laden > ist die Grenze, die das offene Lesefenster baendigt
  AssertionError: expected [Function] to throw an error
       Tests  2 failed | 5 passed (7)
```

**Probe 2 — ein zu langer Fragetext im Demo-Quiz** (`demo-2` auf 328 Zeichen verlängert):

```
× Das Demo-Quiz > geht durch die Pruefung beim Laden
  AssertionError: expected [Function] to not throw an error but 'Error: Frage demo-2: prompt muss 1..200 Zeichen haben, hat 328' was thrown
× Das Demo-Quiz > haelt die Zeichengrenze jeder Frage ein
  Error: Frage demo-2: prompt muss 1..200 Zeichen haben, hat 328
       Tests  2 failed (2)
```

**Probe 3 — derselbe zu lange Text, aber die Verdrahtung zurückgedreht** (`demoQuiz.ts` baut die
`LoadedQuestion` wieder von Hand, ohne `loadQuestion`):

```
✓ Das Demo-Quiz > geht durch die Pruefung beim Laden
× Das Demo-Quiz > haelt die Zeichengrenze jeder Frage ein
  AssertionError: expected 329 to be less than or equal to 200
       Tests  1 failed | 1 passed (2)
```

Probe 3 ist der aufschlussreiche Fall und wurde deshalb gefahren, obwohl der Auftrag sie nicht
verlangt: sie zeigt, dass die beiden Zusicherungen **getrennt** binden. Der erste Test hängt an
der Verdrahtung und wird grün, sobald sie fehlt; der zweite hängt an der Zahl und hält auch dann.
Hätte es nur den ersten gegeben, wäre eine zurückgebaute Verdrahtung still durchgegangen. (329
statt 328, weil die handgebaute Fassung den Text nicht trimmt.)

Alle drei Mutationen zurückgenommen.

**Urteil: behoben und bewiesen.**

---

## 6. B4 — die Zahl unter „Kritischer Pfad unter 65 kB"

**Stelle:** `docs/konzept-ux.md:404`; zusätzlich `docs/STAND.md:14` und `:35`.

**Selbst gemessen**, `npm run build` Exit 0, Ausgabe für `apps/player-web/dist` (die
Beitrittsseite):

```
dist/index.html                 0.50 kB │ gzip:  0.31 kB
dist/assets/index-BEQfTrYX.css  3.83 kB │ gzip:  1.32 kB
dist/assets/index-VGdzwLjJ.js 193.59 kB │ gzip: 61.82 kB
```

0,31 + 1,32 + 61,82 = **63,45 kB**. Abstand zum Budget: **1,55 kB**.

**Änderung:** Commit `155b2ae`. Die Zeile sagt jetzt ausdrücklich, dass das Budget den **ganzen
kritischen Pfad** meint und nicht nur das JavaScript-Bündel, nennt die gemessenen 63,45 kB mit
ihrer Aufteilung und den Abstand von 1,55 kB.

**Begründete Abweichung vom Auftrag.** Dieselbe falsche Zahl stand an zwei weiteren Stellen, in
`STAND.md:14` („gzip 61,82 kB" als Build-Ergebnis) und `STAND.md:35` („Gemessen sind 61,82 kB …
knapp zwei Kilobyte Abstand"). `STAND.md` ist kein rückblickendes Dokument im Sinne der
Negativliste (`bericht-*`, `review-*`, `nachreview-*`, `aenderung-*`), sondern der laufende Stand
— eine dort stehengelassene Zahl hätte dem Konzept sofort widersprochen. Beide mitgezogen.

`konzept-architektur.md:1181` nennt nur das Budget (65 kB) und die daraus abgeleitete Rechnung,
keinen Messwert — unberührt. Die rückblickenden Dokumente sind unberührt; `git log --stat` zeigt
unter `docs/` in dieser Welle nur `konzept-ux.md`, `STAND.md` und die beiden Berichte.

**Rücknahmeprobe:** keine möglich und keine vorgetäuscht. Es gibt keinen Test über Prosa in
`docs/`. Die Zahl ist durch Nachrechnen aus der Build-Ausgabe belegt, nicht durch einen Test.

**Urteil: behoben, belegt durch eigene Messung.**

---

## 7. R2 — die Beschreibung der Ping-Pong-Sperre

**Stelle:** `test/server/outbound.test.ts:158-163` am Ausgangspunkt (der Kopfkommentar von
`sperre`).

**Änderung:** Commit `1231fa5`. **Der Test ist unverändert**, die Sperre steht, kein Umbau. Nur der
Kommentar sagt jetzt, was wirklich gilt: dass die Mutation „`scope === 'host'` zusätzlich an
`channels.players`" auch mit entfernten `sperre`-Aufrufen in drei Läufen hintereinander gleich rot
fiel, weil die leckende Nachricht der erwarteten auf demselben Socket vorausgeht und deshalb schon
im Mitschnitt steht, wenn das `await` zurückkommt. Der Beweis ist nicht die Sperre, sondern dass
das Leck mit echten Texten beobachtet wurde. Die Sperre bleibt als Gürtel zum Hosenträger.

Lauf nach der Änderung: `test/server/outbound.test.ts` 7 passed (7).

**Rücknahmeprobe:** keine. Eine Kommentarzeile bindet nichts; eine Probe hier wäre Theater. Der
Befund des Prüfers wurde nicht nachgefahren, sondern als gemessen übernommen — ausdrücklich
benannt, weil das die einzige Stelle dieses Berichts ist, an der eine fremde Messung ungeprüft
übernommen wird. Sie ändert nichts am Verhalten des Tests.

**Urteil: korrigiert.**

---

## 8. Erledigt

| | Befund | Commit |
|---|---|---|
| — | Prüferbericht `nachreview-fixwelle-2.md` unverändert gesichert | `b3fe3fa` |
| B1 | E1 ans Verhalten gebunden, Textwächter über die ganze Bühne | `60c54f7` |
| B3 | `\s*` auch vor der Klammer | `60c54f7` |
| B2 | Importprüfung über den TypeScript-Parser | `09ef2c9` |
| B5 | `MAX_PROMPT_CHARS` beim Laden durchgesetzt | `d353907` |
| B4 | kritischer Pfad mit 63,45 kB | `155b2ae` |
| R2 | Beschreibung der Sperre korrigiert | `1231fa5` |

---

## 9. Folgeaufgaben — nicht angefasst

**Bewusst offen, laut Auftrag nur zu dokumentieren:**

1. **Timerpfad ohne örtliche Fehlerbehandlung.** `packages/server/src/runtime/scheduler.ts` ruft
   `onFire` im `setTimeout`-Rückruf ohne `try/catch`; von dort geht es über `roomHandle.ts` direkt
   in `step`. Aufgefangen wird ein Wurf nur vom Prozessnetz in `main.ts`. **Mit B5 wird das
   dringender, nicht lockerer:** `loadQuestion` wirft jetzt an der Autorenzeit — sobald der Editor
   Inhalte von außen annimmt, ist das ein Wurf, der einen echten Pfad nimmt.
2. **Stream-Fehler hinter dem `.catch`.** `static.ts` gibt nach `createReadStream(file).pipe(res)`
   sofort `true` zurück; das `.catch` im Request-Pfad kann einen Stream-Fehler strukturell nicht
   erreichen. Ein `.on('error')` auf dem Lesestrom schließt das.

**Neu in dieser Welle gesehen, nicht behoben:**

3. **`MAX_NAME_CHARS = 16` ist ebenso undurchgesetzt wie `MAX_PROMPT_CHARS` es war.** Die einzige
   Prüfung eines Spielernamens ist `isShortString` in
   `packages/server/src/transport/socketio/validate.ts:72`; die Konstante aus `constants.ts:41`
   kommt im ganzen Quelltext nicht vor. Der Auftrag beschränkte B5 ausdrücklich auf
   `MAX_PROMPT_CHARS`, deshalb hier nur notiert. Der Namensfilter der zweiten Welle ist der
   Moment, in dem das zählt — und `parsePrompt` ist die Form, in der es dann zu lösen wäre.
4. **Die Uhr-, Zufalls- und Timerprüfung in `purity.test.ts` läuft weiterhin zeilenweise über eine
   Regex.** Das ist für `Date.now` und `Math.random` tragfähig, solange niemand den Ausdruck über
   eine Zeilengrenze schreibt (`Date` Zeilenumbruch `.now()` würde durchlaufen). Seit B2 liegt die
   parserbasierte Zerlegung in `test/quelltext.ts` daneben; dieselbe Prüfung ließe sich darauf
   stellen. Nicht in dieser Welle, weil der Auftrag B2 auf die Importprüfung beschränkte.

**Aus dem Nachreview übernommen, unverändert offen:**

5. **`scope: 'all'` ist am echten Server ungebunden.** Nur die aufzeichnende Hälfte deckt ihn ab,
   weil `room:answers_open` frühestens 13 s nach dem Start entsteht. Sauber lösbar mit einer
   steuerbaren Uhr im Scheduler.
6. **Die Mindestdauer von 10 s ist gerechnet, nicht erlebt.** Zehn Sekunden stehende Bühne bei
   „Wahr oder falsch?" — das ist am Gerät zu entscheiden, von keinem Test.

**Älter, aus Review und erster Welle:** Raum-TTL und Drosselung, die Token als Kulisse,
`MIN_TIME_FACTOR` ohne Wirkung.

---

## 10. Begründete Abweichungen vom Auftrag, vollständig

1. **B1, Zuschnitt des Textwächters.** Nicht „kein roher `connect`-Handler in allen Dateien",
   sondern „`host:create` genau einmal in allen Dateien". Grund: `wire.ts` braucht einen
   `connect`-Handler, die wörtliche Fassung wäre sofort und zu Unrecht rot geworden. Abschnitt 2.
2. **B1, Zählweise.** Gezählt werden Textliterale im Code, nicht Zeichenketten in der Datei, damit
   das Kopfkommentar von `session.ts` nicht mitzählt und keine Ausnahmeliste nötig wird.
   Abschnitt 2.
3. **B2, Bauart.** Echte Zerlegung statt Regex, über den TypeScript-Parser, ausgelagert nach
   `test/quelltext.ts` und von B1 mitbenutzt. Der Auftrag stellte das frei; die Begründung, warum
   eine Regex hier nicht trägt, steht in Abschnitt 4.
4. **B4, Umfang.** `STAND.md:14` und `:35` mitgezogen, weil dort dieselbe falsche Zahl stand und
   `STAND.md` nicht zu den rückblickenden Dokumenten gehört. Abschnitt 6.
5. **B5, Umfang.** `loadQuestion` für den ganzen Frageeintrag statt nur einer Prüffunktion für den
   Fragetext, damit die Grenze nicht wieder davon abhängt, dass jemand an sie denkt. Abschnitt 5.
6. **B5, zusätzliche Probe.** Probe 3 (langer Text **und** zurückgebaute Verdrahtung) war nicht
   verlangt; sie trennt die beiden Zusicherungen und hat gezeigt, dass die Zahlprüfung auch ohne
   die Verdrahtung hält. Abschnitt 5.
7. **R2, keine Rücknahmeprobe.** Ein Kommentar bindet nichts. Die Messung des Prüfers wurde
   übernommen statt nachgefahren — die einzige fremde Zahl in diesem Bericht. Abschnitt 7.
8. **Testdateien 12 → 15 statt 12 → 13.** Der Auftrag verlangte nur, dass die Testzahl steigt. Die
   drei neuen Dateien trennen die Zuständigkeiten: Verhalten der Leitung (`test/host/wire.test.ts`),
   Laden einer Frage in core (`test/core/question.test.ts`), Demo-Quiz im Server
   (`test/server/demoQuiz.test.ts`).

---

## 11. Arbeitsbaum

Jede Mutation lief über eine Sicherungskopie im Scratchpad und wurde byteweise zurückgespielt;
`git status --short` war nach jeder Rücknahme für die betroffene Datei leer. Gestaged wurde
ausschließlich Pfad für Pfad und namentlich, die Staging-Liste vor jedem Commit mit
`git diff --cached --name-only` geprüft. Kein `git add -A`, kein `git add -u`, kein `git add .`,
kein Merge, kein Rebase, kein Branch-Wechsel, kein Reset, kein `stash`.

Unverändert geblieben, wie beauftragt: `packages/server/src/transport/socketio/outbound.ts`,
`PLAYER_HARD_CAP`, `packages/core/src/engine/reading.ts`, `scheduler.ts`, `roomHandle.ts`,
`static.ts` und alles aus der zweiten Welle.
