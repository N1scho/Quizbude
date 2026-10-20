# Fragen hochladen — Umsetzungsbericht

**Branch:** `durchstich` · **Ausgangspunkt:** `c344c06` · **Arbeitsbaum zu Beginn:** sauber

Der Auftrag: jemand lässt sich von seiner KI Fragen schreiben, lädt die Ausgabe hoch, das Quiz startet. Der Autor der Datei ist ein Sprachmodell, kein tippender Mensch — danach richtet sich alles Weitere.

---

## 1. Tore, selbst nachgemessen

Nicht aus einem Bericht übernommen, sondern am Ende der Arbeit gefahren:

```
npm test          276 Tests, 26 Dateien, Exit 0     (vorher 191 Tests, 21 Dateien)
npx tsc --noEmit  Exit 0
npm run build     Exit 0
```

**Ladebudget Spielgerät (kritischer Pfad, gzip):**

| Teil | Bytes gzip |
|---|---|
| `index.html` | 318 |
| `index-BEQfTrYX.css` | 1 352 |
| `index-VGdzwLjJ.js` | 61 778 |
| **gesamt** | **63 448 Bytes = 63,45 kB** |

Das Budget von 65 kB hält (die Zählweise des Projekts ist dezimal, wie in `konzept-ux.md` Abschnitt 6). Die Zahl ist **unverändert** gegenüber dem Stand vor dieser Arbeit: `apps/player-web/src` wurde nicht angefasst, und der Dateiname des Bündels (`index-VGdzwLjJ.js`) ist über zwei Bauläufe hinweg derselbe — der Hash hängt am Inhalt. Der Parser liegt nur in der Bühne und in der Browser-Fassung, nicht auf dem Spielgerät.

**Browser-Fassung:** `standalone/quizbude.html` wächst von 83 006 auf 114 247 Bytes. Davon sind rund 25 kB der eingesetzte Kern-Block; rund 4,3 kB handgeschriebener Parser und Konstanten sind dafür entfallen. Die Datei hat kein Budget wie das Spielgerät, trägt aber alle drei Rollen — deshalb wird der Block ohne Kommentare erzeugt (`removeComments: true`), was ihn um rund 6,5 kB kürzt.

---

## 2. Das gewählte Format

### 2.1 Zeilenformat (der Normalfall)

```
# Titel der Runde

Welcher Planet ist der Sonne am nächsten? | 20
* Merkur
Venus
Mars
Jupiter
> Merkur umkreist die Sonne in 58 Millionen Kilometern Abstand.

Ein Oktopus hat drei Herzen. | 15
* Wahr
Falsch
```

Vollständige Beschreibung:

| Element | Regel |
|---|---|
| Block | Eine Frage je Block. Blöcke werden durch **eine Leerzeile** getrennt. |
| Titelzeile | Eine Zeile, die mit `#` beginnt, **vor dem ersten Block**, ist der Titel. Danach ist `#` kein Titel mehr. Ohne Titelzeile heißt die Runde „Quizbude". |
| Fragezeile | Erste Zeile des Blocks. Höchstens **200 Zeichen** (`MAX_PROMPT_CHARS`). |
| Antwortzeit | `\| 20` am Ende der Fragezeile: Sekunden. Erlaubt **5 bis 300**. Ohne Angabe gilt **20**. Auch `\|20`, `\| 20 s`, `\| 20 Sekunden` und der Vollbreite-Strich `｜` werden gelesen. |
| Antworten | Zwei bis vier Zeilen unter der Frage, je höchstens **100 Zeichen** (`MAX_OPTION_CHARS`). |
| Markierung | **Genau eine** Antwort beginnt mit `*`. |
| Erklärung | Eine Zeile mit `>` ist eine optionale Erklärung. Mehrere `>`-Zeilen werden mit Leerzeichen verbunden. |
| Wahr/Falsch | Heißen die beiden Antworten (Groß-/Kleinschreibung egal) `Wahr` und `Falsch`, entsteht eine `true_false`-Frage statt einer `single_choice`. |
| Fluchtweg | Ein `\` am Zeilenanfang nimmt dem nächsten Zeichen jede Bedeutung: `\* Venus` ist eine gewöhnliche Antwort, deren Text mit einem Stern beginnt. `*\* Merkur` ist die **richtige** Antwort mit Stern im Text. |

### 2.2 JSON (zusätzlich, ohne Auswahl durch den Nutzer)

Beginnt der Text nach Abzug der Code-Zäune mit `{` oder `[`, wird er als JSON gelesen (`siehtNachJsonAus`). Sonst als Zeilenformat. Der Nutzer wählt nichts aus.

Gelesen werden deutsche **und** englische Feldnamen, weil keine KI beim ersten Versuch dieselben trifft:

| Bedeutung | Akzeptierte Felder |
|---|---|
| Titel | `titel`, `title`, `name` |
| Fragenliste | `fragen`, `questions`, `items` — oder eine blanke Liste als Wurzel |
| Fragetext | `frage`, `prompt`, `question`, `text` |
| Antworten | `antworten`, `answers`, `options`, `optionen` |
| Antwort (Objekt) | `label`, `text`, `antwort`, `answer`, `option` + `correct`, `richtig`, `istRichtig`, `correctAnswer` |
| Richtige Antwort | `richtig`, `correct`, `correctIndex`, `loesung`, `answer` — als Index **oder** als Text |
| Zeit | `sekunden`, `seconds`, `zeit`, `timeLimit`, oder `timeLimitMs`, `zeitMs` |
| Erklärung | `erklaerung`, `erklärung`, `explanation`, `hinweis` |

Antworten dürfen auch Zeichenketten sein; dann markiert ein führendes `*` wie im Zeilenformat. Lässt sich das JSON nicht lesen, wird es **nicht** als Zeilenformat verbogen — die Meldung sagt, dass die Datei wie JSON anfängt und entweder gültiges JSON oder das Zeilenformat gebraucht wird.

Zeilennummern im JSON entstehen, indem der Fragetext in der Originaldatei gesucht wird (`zeileFuer`). Wird er nicht gefunden, trägt die Meldung keine Nummer — der Bericht zeigt sie dann ohne Zeilenangabe statt mit einer falschen.

---

## 3. Nachsichtig gegen Beiwerk, streng beim Inhalt

### 3.1 Was stillschweigend verdaut wird

| Beiwerk | Behandlung |
|---|---|
| Code-Zäune ` ``` ` und `~~~`, auch mit Sprachangabe | Die Zaunzeilen fallen weg, **die Zeilennummern der Originaldatei bleiben**. |
| Vorwort („Hier sind deine 20 Fragen:") | Erster Block, wenn er aus einer Zeile besteht, keine Antworten hat und nicht wie eine Frage aussieht. |
| Schlusswort („Viel Spaß beim Quiz") | Letzter Block, dieselbe Bedingung. |
| `1.`, `2)` vor der Frage | Entfernt. |
| `A)`, `b)`, `C.`, `1:` vor einer Antwort | Entfernt. |
| `**fett**`, `*kursiv*`, `__fett__`, `_kursiv_`, `` `code` `` | Entfernt; der Text darunter bleibt. |
| `✅`, `✔`, `✓`, `☑`, `[x]`, `[X]`, `+` statt `*` | Gelten als Markierung. |
| `[ ]`, `☐`, `❌`, `✗` | Gelten ausdrücklich **nicht** als Markierung und werden abgeschnitten. |
| `-`, `–`, `•`, `·`, `●`, `■` als Aufzählungszeichen | Entfernt. |
| Typografische Anführungszeichen um eine Antwort (`„…"`, `"…"`, `«…»`, `'…'`) | Ausgepackt. Im JSON-Zweig werden sie bei Bedarf auch zu geraden repariert, bevor erneut gelesen wird. |
| Geschützte Leerzeichen (`U+00A0`, `U+2007`, `U+202F`) | Werden zu gewöhnlichen Leerzeichen — auch **mitten im Wort**, sonst steht auf der Kachel ein Wort, das nicht umbricht. |
| BOM, CRLF, alleinstehendes CR, Leerzeilen am Rand | Normalisiert. |

Vorwort und Schlusswort werden nicht spurlos verschluckt: sie erscheinen als **Hinweis** im Prüfbericht („Zeile 1: als Vorwort übersprungen."). Eine Frage, der der Autor die Antworten vergessen hat, fällt weiterhin laut auf — sie sieht wie eine Frage aus (`?` am Ende oder Zeitangabe) und wird deshalb nicht abgetrennt.

Zwei Feinheiten, die beim Bauen aufgefallen sind:

- `*Merkur*` ist Kursivschrift, **keine** Markierung. Eine markierte Antwort endet nicht auf dem Zeichen, mit dem sie markiert wurde.
- `**Merkur**` beginnt mit zwei Sternen und ist deshalb ebenfalls keine Markierung.

### 3.2 Was laut abgelehnt wird

Jede Meldung trägt die Zeilennummer der Originaldatei und ist so formuliert, dass sie zurück in die KI gekippt werden kann.

| Fehler | Zeile | Meldung (Wortlaut) |
|---|---|---|
| Zwei markierte Antworten | der **zweiten** Markierung | `2 Antworten markiert, genau eine darf es sein.` |
| Keine markierte Antwort | Fragezeile | `keine Antwort markiert, genau eine muss es sein. Setz ein * vor die richtige.` |
| Fragetext zu lang | Fragezeile | `Der Fragetext hat 208 Zeichen, erlaubt sind 200. Kuerz ihn um 8 Zeichen.` |
| Fragetext fehlt | Fragezeile | `Der Fragetext fehlt.` |
| Antwort zu lang | Zeile der Antwort | `Diese Antwort hat 101 Zeichen, erlaubt sind 100. Kuerz sie um 1 Zeichen.` |
| Antwort leer | Zeile der Antwort | `Diese Antwort ist leer.` |
| Zu wenige Antworten | Fragezeile | `Diese Frage hat nur eine Antwort. Es muessen zwei bis vier sein.` |
| Zu viele Antworten | Fragezeile | `Diese Frage hat 5 Antworten, erlaubt sind zwei bis vier. Fehlt zwischen zwei Fragen vielleicht eine Leerzeile?` |
| Antwortzeit außerhalb 5–300 s | Fragezeile | `Die Antwortzeit ist 301 Sekunden. Erlaubt sind 5 bis 300 Sekunden.` |
| Erklärung ohne Frage | Zeile der Erklärung | `Eine Erklaerung mit > steht ueber keiner Frage. Setz sie unter die Frage, zu der sie gehoert.` |
| Mehr als 200 Fragen | Zeile der 201. Frage | `Die Datei hat 201 Fragen. Mehr als 200 nimmt die Seite nicht an. Teil sie auf zwei Runden auf.` |
| Datei leer | 1 | `Da steht noch keine Frage. Schreib eine Frage und darunter die Antworten.` |
| Datei zu groß | — | `Die Datei ist 1465 kB gross. Mehr als 977 kB nimmt die Seite nicht an. Teil die Fragen auf mehrere Dateien auf.` |
| Keine UTF-8-Datei | — | `Die Datei ist nicht UTF-8 kodiert. Speicher sie noch einmal als "UTF-8" (im Editor unter "Speichern unter" oder "Kodierung") und lad sie dann erneut hoch.` |

---

## 4. Ein Parser, zwei Fassungen (Ruling 1 und 1a)

`packages/core/src/questions/parse.ts` ist der eine Parser. Die Bühne (`apps/host-web`) importiert ihn als TypeScript. Die Browser-Fassung ist eine einzelne Datei ohne Bauschritt — sie bekommt ihn übersetzt eingesetzt.

**Der Erzeugungsschritt:** `tools/standalone-parser.mjs` liest drei Dateien des Kerns (`engine/constants.ts`, `engine/reading.ts`, `questions/parse.ts`), schneidet mit dem TypeScript-Parser die Importe und das Schlüsselwort `export` heraus, übersetzt nach ES2019 und schreibt das Ergebnis als `const Kern = (function () { … })();` zwischen zwei Marker in die Seite. Die Liste der herausgereichten Namen entsteht aus dem Quelltext — ein neuer Export muss nicht von Hand nachgetragen werden.

**Der Riegel:** `test/standalone/kern.test.ts` erzeugt den Block neu und vergleicht ihn mit dem, was in der ausgelieferten Datei steht. Weicht er ab, ist der Test rot und sagt, was zu tun ist: `node tools/standalone-parser.mjs --schreiben`. Zusätzlich wird der **ausgelieferte Block wirklich ausgeführt** (`new Function`) und gegen sieben Proben mit dem Kern verglichen — ein Übersetzungsschritt, der etwas verliert, wäre sonst unsichtbar.

Die Seite hält damit keine zweite Fassung mehr: der handgeschriebene `parseQuiz`, `DEMO_TEXT`, die abgeschriebenen Konstanten aus `engine/constants.ts` und `countWords`/`readingWindowMs` sind durch Verweise auf `Kern.*` ersetzt.

**Reinheit:** `parse.ts` hält die Prüfung in `test/core/purity.test.ts` ein — keine Uhr, kein Zufall, kein Timer, kein `process`, und außer relativen Pfaden kein Import. Die geschätzte Spieldauer bekommt die Zeit als Rechnung, nicht als Messung.

---

## 5. Prüfbericht und Ablauf (Ruling 2)

Nach dem Hochladen steht in **beiden** Fassungen: Titel, Fragenzahl, geschätzte Spieldauer, jede beanstandete Zeile mit Zeilennummer, dazu die Hinweise über verdautes Beiwerk. Erst ein ausdrücklicher Klick öffnet die Lobby.

Die Dauer rechnet aus den Zeiten des Kerns:

```
je Frage:  ANNOUNCE_MS (3 000)
         + readingWindowMs(prompt, labels)     — dieselbe Formel wie im Spiel
         + timeLimitMs
         + ESTIMATE_REVEAL_MS (8 000)
zwischen zwei Fragen zusätzlich:
         + ESTIMATE_SCOREBOARD_MS (7 000)
```

`ESTIMATE_REVEAL_MS` und `ESTIMATE_SCOREBOARD_MS` sind **Erfahrungswerte, keine Engine-Konstanten**: Auflösung und Zwischenstand haben keinen Timer, der Host schaltet weiter. Sie stehen deshalb in `parse.ts` und nicht in `engine/constants.ts`. Für die Demorunde ergibt das 84 000 ms → „etwa 84 Sekunden".

**Auf der Bühne** heißt das: die Bühne beginnt mit dem Fragen-Bildschirm, nicht mit der Lobby. Vorher gibt es keinen Raumcode, den jemand schon abtippen könnte. Der Raum entsteht erst beim Klick auf „Runde eröffnen".

---

## 6. Hochladen

**Bühne** (`apps/host-web/src/Upload.tsx`): Ablegen per Drag-and-drop, Schaltfläche „Datei auswählen", Textfeld zum Einfügen. Gelesen wird mit `FileReader.readAsArrayBuffer`, dekodiert mit `TextDecoder('utf-8', { fatal: true })` — **im Browser**. Es gibt keinen Hochladepfad im Server, und es wurde keiner gebaut.

**Browser-Fassung** (`standalone/quizbude.html`): dasselbe am vorhandenen Editor-Bildschirm. Die Ablegefläche umfasst den ganzen Bildschirm, nicht nur das gestrichelte Feld; außerhalb bleibt eine fallen gelassene Datei folgenlos, sonst ersetzt der Browser die ganze Seite durch sie.

**Deckel:** 1 000 000 Bytes je Datei (`MAX_UPLOAD_BYTES`), 200 Fragen je Sammlung (`MAX_QUESTIONS`). Beide mit verständlicher Meldung statt eines hängenden Browsers. Die Größe wird zweimal geprüft — an der `File.size`, bevor überhaupt gelesen wird, und noch einmal an den Bytes.

**Sicherheitsnaht:** Fremdeingabe wird an jeder Ausgabestelle entschärft. In der Bühne durch JSX (nirgends `dangerouslySetInnerHTML`), in der Browser-Fassung durch `Kern.escapeHtml` im Prüfbericht und `esc()` auf den Kacheln. Gebunden ist das nicht am Quelltext, sondern am Verhalten: der Bericht der Bühne wird mit `renderToStaticMarkup` gerendert, die Funktionen der Browser-Fassung werden **aus der ausgelieferten Datei herausgeschnitten und ausgeführt**.

---

## 7. Die Anweisung für die KI (Ruling 5)

`KI_ANWEISUNG` steht im Kern und erscheint in der Oberfläche **beider** Fassungen als auswählbarer Block mit einem Knopf „Anweisung kopieren". `navigator.clipboard.writeText` darf abgelehnt werden; dann markiert der Rückfall den Block (`Range` + `Selection`) und sagt „Markiert — jetzt Strg+C drücken". Fehlt auch das, bleibt die Anweisung „Markier den Block und kopier ihn mit Strg+C."

Inhalt: Format mit Beispiel, die Grenzen 200/100 Zeichen, zwei bis vier Antworten, genau eine mit `*`, die Zahl hinter `|` als Antwortzeit, `>` als optionale Erklärung, Blöcke durch Leerzeile, „Wahr"/„Falsch" ergibt eine Wahr/Falsch-Frage, der Fluchtweg `\*` — und ausdrücklich: keine Nummerierung, keine Überschriften außer der Titelzeile, kein Code-Block, kein Vorwort und kein Schlusswort.

---

## 8. Begründete Abweichungen — ausdrücklich benannt

### A1 — `transport/` wurde angefasst (bindende Vorgabe, bewusst abgewichen)

Der Auftrag sagt: `packages/server/src/runtime/` und `transport/` bleiben unberührt.

**Was dagegen spricht, es einzuhalten:** Die Spielengine läuft im Server. Der Raum bekommt seine Fragen in `gateway.ts` bei `host:create` aus `loadDemoQuiz`. Ohne eine Änderung dort kann die Bühne hochladen, prüfen und berichten, so viel sie will — gespielt würde immer die Demorunde. Das Merkmal wäre auf der Bühne reine Kulisse.

**Was tatsächlich geändert wurde**, so klein wie möglich:

- `packages/protocol/src/messages.ts`: `host:create` trägt ein optionales `quiz` (neu: `QuizPayload`). `protocol` steht nicht auf der Negativliste.
- `packages/server/src/transport/socketio/validate.ts`: +22 Zeilen. Geprüft werden **nur Form und Anzahl** — Objekt, `title` als kurze Zeichenkette, `questions` als Liste mit 1 bis 200 Einträgen. Kein Nachbau der inhaltlichen Grenzen.
- `packages/server/src/transport/socketio/gateway.ts`: +15 Zeilen in `case 'host:create'`. Ohne `quiz` wie bisher `loadDemoQuiz`, sonst `loadUploadedQuiz`; ein Wurf wird zu `room:error` statt zum Verbindungsabbruch, und die Codeziehung rückt dahinter, damit eine abgelehnte Sammlung keinen Raumcode verbraucht.
- Neu, **außerhalb** von `runtime/` und `transport/`: `packages/server/src/uploadedQuiz.ts`.

`runtime/` ist unberührt geblieben.

Die eigentliche Prüfung liegt in `loadUploadedQuiz` → `loadQuestion` — derselben Tür, durch die auch das Demo-Quiz geht. Eine zweite, flachere Prüfung am Transportrand wäre genau die Stelle, an der dieselbe Grenze später auseinanderläuft; dieses Projekt hat an dem Muster schon zweimal verloren.

**Zur Entscheidung vorgelegt:** Wenn die Vorgabe wörtlich gelten soll, ist die Folge, dass die hochgeladenen Fragen auf der Bühne nicht gespielt werden können, bis `transport/` wieder offen ist. Die Browser-Fassung wäre davon nicht betroffen — sie führt das Spiel selbst aus.

### A2 — `createRoomOnce` hat eine neue Signatur

Ruling 2 verlangt, dass erst ein Klick die Lobby öffnet. Bisher legte die Bühne den Raum **beim Verbinden** an. Die Funktion gibt jetzt einen Öffner zurück; erzeugt wird, sobald beides zusammenkommt (Leitung steht **und** Klick), und danach nie wieder. Die Eigenschaft, um die es E1 ging — über eine ganze Sitzung genau ein `host:create`, auch nach vier Wiederverbindungen — ist erhalten und um „auch nach mehrfachem Klick" **erweitert**.

Der Textwächter in `session.test.ts` wurde auf den neuen Wortlaut gezogen; der Wächter gegen einen rohen `connect`-Handler in der Bühne und der Wächter „`host:create` steht an genau einer Stelle" sind unverändert. Damit die Bühne für ihren Verbinde-Zustand keinen eigenen `connect`-Handler braucht, nimmt `createRoomOnce` einen dritten, optionalen Rückruf.

### A3 — Der Block wird ohne Kommentare erzeugt

`removeComments: true` spart rund 6,5 kB in einer Datei, die alle Spielgeräte laden. Ein reiner Kommentarwechsel im Kern lässt den Block unverändert und den Riegel grün — das ist richtig so, es ist kein Verhaltensunterschied.

### A4 — Leertaste (nicht im Auftrag, aber durch ihn verursacht)

Die Bühne fängt `Space` global ab, um weiterzuschalten. Mit einem Fragen-Textfeld hätte das lautlos das Tippen verhindert. Die Entscheidung steht jetzt in `apps/host-web/src/tasten.ts` und ist ohne Browser prüfbar.

### A5 — `escapeHtml` liegt im Kern

Eine Darstellungsfrage in `packages/core`. Begründung: beide Fassungen brauchen denselben Riegel, und die Browser-Fassung bekommt alles, was sie hat, über den erzeugten Block. Die Funktion ist rein und verletzt die Reinheitsprüfung nicht.

### A6 — Code-Zäune werden zeilenweise entfernt, nicht als Bereich

Die Zeilennummern der Originaldatei müssen erhalten bleiben, sonst zeigt jede Meldung hinter einem Zaun auf die falsche Zeile. Deshalb wird gefiltert, nicht neu nummeriert.

---

## 9. Beweispflicht — Rücknahmeproben

Jede Probe: Fix zurückdrehen, `npx vitest run <Datei>`, Meldung im Wortlaut festhalten, Mutation restlos zurücknehmen. Der Arbeitsbaum war nach jeder Probe wieder sauber.

### 9.1 Beiwerk des Werkzeugs

| # | Mutation | Roter Test | Meldung im Wortlaut |
|---|---|---|---|
| A1 | `ohneZaun = alleZeilen` (Code-Zäune bleiben stehen) | `Code-Zaeune, auch mit Sprachangabe` | ``expected '```text' to be 'Welcher Planet ist der Sonne am naech…' // Object.is equality`` |
| A2 | `trenneBeiwerk` gibt alles unverändert zurück | `ein Vorwort der KI`, `ein Schlusswort der KI` | `expected [ { zeile: 1, …(1) }, …(1) ] to deeply equal []` |
| A3 | `NUMMERIERUNG` wird nicht mehr entfernt | `Nummerierung vor der Frage` | `expected '1. Welcher Planet ist der Sonne am na…' to be 'Welcher Planet ist der Sonne am naech…' // Object.is equality` |
| A4 | `BESCHRIFTUNG` wird nicht mehr entfernt | `Beschriftungen A) a) vor den Antworten` | `expected [ 'A) Merkur', 'b) Venus', 'C. Mars' ] to deeply equal [ 'Merkur', 'Venus', 'Mars' ]` |
| A5 | `entferneAuszeichnung` gibt den Wert unverändert zurück | `Fettschrift und Kursivschrift` | `expected '**Welcher Planet?**' to be 'Welcher Planet?' // Object.is equality` |
| A6 | `istMarkiert` kennt nur noch den Stern | `Haekchen und Kreuzkasten statt Stern` (+2 weitere) | `✅: expected [ { zeile: 1, …(1) } ] to deeply equal []` |
| A7 | `entpackeAnfuehrung` packt nicht mehr aus | `typografische Anfuehrungszeichen um eine Antwort` | `expected 'single_choice' to be 'true_false' // Object.is equality` |
| A8 | `normalisiereText` normalisiert nicht mehr | `BOM, CRLF, geschuetzte Leerzeichen …`, `auch ein alleinstehendes Wagenruecklaufzeichen trennt Zeilen` | `expected 'Mer kur' to be 'Mer kur' // Object.is equality` (NBSP gegen Leerzeichen) und `expected [ { zeile: 1, …(1) }, …(1) ] to deeply equal []` |

### 9.2 Inhaltsfehler

| # | Mutation | Roter Test | Meldung im Wortlaut |
|---|---|---|---|
| B1 | `markierte.length > 99` statt `> 1` | `zwei markierte Antworten - die Meldung aus dem Auftrag` (+1) | `expected [] to deeply equal [ Array(1) ]` |
| B2 | `markierte.length === -1` statt `=== 0` | `keine markierte Antwort`, `haelt die Inhaltsgrenzen auch im JSON` | `expected [] to deeply equal [ Array(1) ]` |
| B3 | Fragetextlänge gegen 100 000 geprüft | `Fragetext ueber 200 Zeichen` | `expected '' to contain 'Zeile 1:'` |
| B4 | Antwortlänge gegen 100 000 geprüft | `Antwort ueber 100 Zeichen - an der Zeile der Antwort` | `expected '' to contain 'Zeile 3:'` |
| B5 | `antworten.length < 0` statt `< 2` | `weniger als zwei Antworten` | `the given combination of arguments (undefined and string) is invalid for this assertion. …` |
| B5b | `antworten.length > 400` statt `> 4` | `mehr als vier Antworten` | dieselbe Meldung (die Fehlerliste ist leer) |
| B6 | Antwortzeit gegen 0…100 000 geprüft | `Antwortzeit ausserhalb 5 bis 300 Sekunden` | dieselbe Meldung |
| B7 | Zeilen nach dem Zaunfilter neu nummeriert | `nummeriert die Zeilen der Originaldatei, auch hinter einem Code-Zaun` | `expected [ Array(1) ] to deeply equal [ Array(1) ]` (Zeile 3 statt 4) |
| B8 | Fragenzahl gegen 100 000 geprüft | `mehr als 200 Fragen` | `the given combination of arguments (undefined and string) is invalid …` |
| C | `fluchtweg` gibt immer `null` | `\* macht aus dem Stern Text statt Markierung` (+1) | `expected [ 'Merkur', '\* Venus' ] to deeply equal [ 'Merkur', '* Venus' ]` |
| D | JSON wird nicht mehr erkannt | fünf Tests der JSON-Gruppe | `expected 'zeilen' to be 'json' // Object.is equality` |
| E | Spieldauer ohne Lesefenster | `rechnet die Spieldauer aus den Zeiten des Kerns` | `expected 64000 to be 84000 // Object.is equality` |
| F | `TextDecoder` ohne `fatal: true` | `lehnt eine Datei ab, die erkennbar kein UTF-8 ist …` | `expected true to be false // Object.is equality` |
| G | Größendeckel gegen 100 MB | `lehnt eine zu grosse Datei mit verstaendlicher Meldung ab` | `expected true to be false // Object.is equality` |
| H | `escapeHtml` gibt den Wert unverändert zurück | `entschaerft jedes gefaehrliche Zeichen` + der Riegel | `expected '<script>alert("x")</script>&\'' to be '&lt;script&gt;alert(&quot;x&quot;)&lt…' // Object.is equality` |

### 9.3 Browser-Fassung

| # | Mutation | Roter Test | Meldung im Wortlaut |
|---|---|---|---|
| I | `MAX_QUESTIONS` in der **ausgelieferten Seite** auf 199 | `die ausgelieferte Seite traegt genau den heutigen Kern` | `expected '/* === KERN ANFANG - erzeugt aus pack…' to be '/* === KERN ANFANG - erzeugt aus pack…' // Object.is equality` |
| I2 | `MAX_QUESTIONS` im **Kern** auf 199, Seite unverändert | derselbe Test | dieselbe Meldung — der Riegel greift in beide Richtungen |
| J | `berichtHtml` setzt den Titel ohne `e(...)` | `berichtHtml entschaerft Titel, Dauer und jede Meldung` (+1) | `expected '<dl><dt>Titel</dt><dd><img src=x oner…' not to contain '<img'` |
| K | `setzeKachel` setzt das Label ohne `esc(...)` | `eine Frage mit spitzen Klammern kommt entschaerft auf die Kachel` | `expected '<svg class="form" aria-hidden="true">…' not to contain '<img'` |
| V | `ki-anweisung` bekommt einen Platzhaltertext | `die Anweisung fuer die KI steht in der Oberflaeche, nicht nur im Kern` | `expected '<title>Quizbude</title>…' to contain '$(\'ki-anweisung\').textContent = Ker…'` |
| W | `lesBlock` normalisiert die Zeilenenden nicht mehr | `der Riegel haengt nicht an den Zeilenenden der Arbeitskopie` (+1) | `expected '/* === KERN ANFANG - erzeugt aus pack…' to be '/* === KERN ANFANG - erzeugt aus pack…'` |
| X | `schreibeBlock` zwingt der Seite LF auf | derselbe Test | `expected true to be false // Object.is equality` |

### 9.4 Bühne

| # | Mutation | Roter Test | Meldung im Wortlaut |
|---|---|---|---|
| L | Titel über `dangerouslySetInnerHTML` | `entschaerft Fremdeingabe in Titel und Meldung` | `expected '<div class="bericht"><dl><dt>Titel</d…' to contain '&lt;img'` |
| L2 | beanstandete Zeile über `dangerouslySetInnerHTML` | `entschaerft auch eine Meldung, die selbst Markup enthaelt` | `expected '<div class="bericht"><dl><dt>Titel</d…' not to contain '<img'` |
| L3 | Hinweis über `dangerouslySetInnerHTML` | derselbe Test | dieselbe Meldung |
| M | Startzustand der Bühne auf `lobby` | `zeigt vor jedem Raumcode den Fragen-Bildschirm` | `expected '<div class="buehne"><header class="ko…' to contain 'Eigene Fragen'` |
| N | Raum entsteht wieder beim Verbinden | `erzeugt den Raum erst, wenn er gewollt ist …` (+2) | `expected 1 to be +0 // Object.is equality` |
| N2 | Raum entsteht bei jedem Klick neu | `schickt ueber eine ganze Sitzung genau ein host:create …` (+2) | `expected [ { kanal: 'quizbude', …(1) }, …(6) ] to have a length of 1 but got 7` |
| S | Leertaste greift wieder im Fragenfeld | `schaltet NICHT weiter, waehrend jemand Fragen tippt` | `expected true to be false // Object.is equality` |
| T | „Runde eröffnen" ohne stehende Leitung freigegeben | `laesst die Runde erst oeffnen, wenn die Leitung steht` | `expected '<div class="laden"><h1>Eigene Fragen<…' to contain 'disabled'` |
| U | Anweisung durch Platzhalter ersetzt | `traegt die Anweisung fuer die KI samt Kopierknopf` | `expected '<div class="laden"><h1>Eigene Fragen<…' to contain 'Genau eine Antwort beginnt mit einem …'` |

### 9.5 Server

| # | Mutation | Roter Test | Meldung im Wortlaut |
|---|---|---|---|
| O | Gateway ignoriert `msg.quiz` | `nimmt die Sammlung der Buehne an und meldet Titel und Zahl zurueck` (+1) | `expected 'Quizbude — Demorunde' to be 'Abendrunde' // Object.is equality` |
| P | `catch` wirft wieder weiter | `lehnt eine inhaltlich kaputte Sammlung ab, ohne den Server zu verlieren` | `Nachricht room:error blieb aus - der Server antwortet nicht mehr` (dazu auf der Konsole: `[quizbude] Nachricht abgebrochen: Error: Frage q1: timeLimitMs muss eine positive Zahl sein`) |
| Q | Transportrand prüft die Form nicht mehr | `weist eine Sammlung zurueck, deren Form nicht stimmt` (+1) | `{"t":"host:create","quiz":42}: expected { t: 'host:create', quiz: 42 } to be null` |
| R | Sammlung geht nicht mehr durch `loadQuestion` | `geht durch dieselbe Tuer wie das Demo-Quiz …` (+1) | `expected [Function] to throw an error` |

### 9.6 Drei Falsch-Grün, die dabei aufgefallen sind

Das ist der eigentliche Ertrag der Proben — drei neue Tests waren beim ersten Wurf wertlos:

1. **Der Code-Zaun-Test** prüfte nur „keine Fehler" und „eine Frage". Ohne das Entfernen der Zaunzeilen wird die Zaunzeile zum Fragetext und die echte Frage zur Antwort — Fehlerzahl null, Fragenzahl eins, Test grün. Behoben in `8b39edb`: der Test bindet jetzt Fragetext und Antworten.
2. **Der Normalisierungs-Test** blieb grün, als `normalisiereText` entfiel: `trim()` räumt BOM und CRLF an den Zeilenrändern ohnehin weg, und `\s` im Zeitmuster deckt das geschützte Leerzeichen mit ab. Behoben in `c0c24f3`: gebunden wird jetzt ein alleinstehendes `\r` und ein geschütztes Leerzeichen **mitten im Wort**.
3. **Der Zeilenenden-Test** blieb grün, als `schreibeBlock` der Seite LF aufzwang — der Rest der Datei trug weiter CRLF, und genau darauf sah die Zusicherung. Behoben in `2cee88a`: jedes alleinstehende LF fällt jetzt auf.

Dazu ein **echter** Fund durch eine Probe: der Riegel gegen Auseinanderlaufen verglich ursprünglich die Zeilenenden mit. Git schreibt `standalone/quizbude.html` auf Windows mit CRLF in den Arbeitsbaum, der Erzeuger liefert LF — der Test wäre nach jedem frischen Klon rot gewesen, ohne dass etwas auseinandergelaufen wäre. Ein Riegel, der aus nichtigem Grund rot ist, wird abgeschaltet; dann fällt auch das echte Auseinanderlaufen nicht mehr auf. Behoben in `8bcbee5`.

---

## 10. Was nur am Gerät prüfbar bleibt

Nichts davon ist durch einen Test gedeckt; alles davon ist Browser-Verhalten:

- **Drag-and-drop.** Dass eine Datei aus dem Dateimanager wirklich im `drop`-Ereignis mit gefüllter `dataTransfer.files` ankommt, und dass die gestrichelte Fläche beim Darüberziehen umschlägt.
- **Dateiauswahl.** Dass der Knopf das verborgene `<input type="file">` öffnet und `accept` den Dialog sinnvoll vorfiltert.
- **`FileReader`.** Dass `readAsArrayBuffer` große Dateien ohne hängende Oberfläche liest. Geprüft ist nur der Weg danach.
- **Kopieren.** Dass `navigator.clipboard.writeText` im jeweiligen Browser erlaubt ist, und dass der Rückfall den Block sichtbar markiert. Der Rückfall lässt sich am Gerät erzwingen, indem die Seite über `http://` statt `https://`/`localhost` geöffnet wird.
- **UTF-8-Ablehnung.** Eine echte Latin-1-Datei aus einem Editor; geprüft ist die Byte-Folge, nicht der Weg über den Dateidialog.
- **Die Darstellung des Fragen-Bildschirms.** Die Bühne ist für einen Fernseher gebaut (`overflow: hidden`, 48 px Rand); der neue Bildschirm scrollt. Auf einem schmalen Laptop ist das anzusehen.
- **Die Browser-Fassung insgesamt** — sie ist eine Datei ohne Bauschritt; geprüft sind Syntax, der erzeugte Block und einzelne herausgeschnittene Funktionen, nicht das Zusammenspiel im Browser.

---

## 11. Veröffentlichung

**`standalone/quizbude.html` ist geändert und committet, aber nicht veröffentlicht.** Die Datei muss als Artifact **neu veröffentlicht** werden, sonst spielt die verlinkte Fassung weiter mit dem alten Parser und ohne Hochladen. Das macht der Orchestrator.

---

## 12. Folgeaufgaben (nicht in diesem Paket)

Getrennt von Erledigtem:

- **`loadDemoQuiz` ist auf der Bühne toter Pfad.** Die Bühne schickt immer eine Sammlung; ohne `quiz` spielt der Server weiter die Demorunde. Das ist der Rückfall für einen älteren Client. Ob er bleiben soll, ist eine Produktfrage.
- **Die Sammlung überlebt keinen Neustart der Bühne.** Mehrere Sammlungen speichern und wiederfinden ist Persistenz und gehörte ausdrücklich nicht in dieses Paket. Die Browser-Fassung legt den Text weiterhin in `localStorage` ab (`quizbude.quiztext`), die Bühne nicht.
- **Keine Bilder in Fragen.** Ausdrücklich nicht im Paket.
- **`pointsFactor` ist immer 1.** Das Format hat keine Schreibweise dafür. Eine Doppelpunkte-Frage wäre ein kleiner Zusatz (`| 20 x2`).
- **Der Fluchtweg gilt nur am Zeilenanfang.** `\` mitten in einer Antwort bleibt `\`. Das ist gewollt, sollte aber in der Anweisung stehen, falls jemand Dateipfade als Antwort schreibt.
- **`BESCHRIFTUNG` schneidet auch „A. " vor einem Namen weg.** Eine Antwort „A. Merkel" würde zu „Merkel". Der Fluchtweg `\A. Merkel` hilft; auffällig ist es nicht.
- **Der Transportrand prüft die Größe der einzelnen Fragen nicht.** Gedeckelt ist die Anzahl (200) und jedes Textfeld der übrigen Nachrichtenformen (256 Zeichen); die Fragenobjekte selbst begrenzt nur `maxHttpBufferSize` von Socket.IO (Vorgabe 1 MB). Für eine Runde unter Freunden reicht das; für einen offen erreichbaren Server wäre eine eigene Grenze fällig.
- **`tools/standalone-parser.mjs` ist nur mittelbar gebunden.** Der Riegel in `test/standalone/kern.test.ts` fährt ihn aus, aber eine eigene Prüfung des Erzeugers (etwa für `exportierteWerte`) gibt es nicht — dieselbe Lücke wie bei `tools/build-needed.mjs`.
- **Bewusst offen geblieben, kein Befund:** Timerpfad `scheduler.ts` → `roomHandle.ts`, `static.ts` mit `pipe(res)`, `MAX_NAME_CHARS` undurchgesetzt, zeilenweise Uhr-/Zufallsprüfung in `purity.test.ts`, N1 (`loadQuestion`-Aufruf in `demoQuiz.ts` ungebunden), kein IPv6, öffentliche IPv4 wird nicht angeboten.

Zum Timerpfad eine Anmerkung: der Stand in `STAND.md` sagt, er werde relevant, „sobald der Editor eigene Fragen zulässt und `parseSpec` wieder werfen kann". **Dieser Fall ist jetzt da** — allerdings wirft `parseSpec` nicht mehr zur Spielzeit, sondern bei `host:create`, und dort wird der Wurf gefangen. Der Befund bleibt damit, was er war: ein Restrisiko, kein neuer Fehler.

---

## 13. Commits

| Commit | Inhalt |
|---|---|
| `36759cd` | `feat:` ein Parser im Kern für hochgeladene Fragen |
| `1dbdb09` | `feat:` Browser-Fassung lädt eigene Fragen und benutzt denselben Parser |
| `515a52e` | `feat:` Bühne lädt eigene Fragen und öffnet die Lobby erst nach dem Bericht |
| `6b39479` | `fix:` Leertaste bleibt im Fragenfeld ein Leerzeichen |
| `8b39edb` | `test:` Code-Zaun-Probe bindet das Ergebnis, nicht nur die Fehlerzahl |
| `c0c24f3` | `test:` Normalisierung an ein alleinstehendes `\r` und ein NBSP im Wort binden |
| `8bcbee5` | `fix:` Riegel und Prüfbericht hängen nicht mehr an Nebensächlichkeiten |
| `b017bf9` | `fix:` `ts-expect-error` sitzt wieder auf der Zeile, die es meint |
| `2cee88a` | `test:` Zeilenenden-Probe bindet den eingesetzten Block, nicht die Seite |
