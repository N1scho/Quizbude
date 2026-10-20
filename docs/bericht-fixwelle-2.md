# Zweite Fix-Welle — NR1 bis NR3 und die beiden Nutzerentscheidungen

**Stand:** 2026-10-20 · **Branch:** `durchstich` · **Ausgangspunkt:** `6847509` · **Diff:** `6847509..5c13d20` (sechs Commits)

Beauftragt war eine eng begrenzte Welle: die drei Befunde des Nachreviews schließen und die beiden
Nutzerentscheidungen umsetzen. Nichts darüber hinaus. `nachreview-fixwelle.md` wurde gelesen und als
Begründung der Befunde genommen; jede Zahl unten ist selbst gemessen.

---

## 0. Ergebnis in einem Absatz

Alle drei Befunde sind geschlossen, beide Nutzerentscheidungen sind umgesetzt. Sieben Rücknahmeproben
wurden gefahren, sieben wurden rot; dazu zwei Gegenproben, die belegen, dass der jeweils *alte* Zustand
grün geblieben wäre — das ist der eigentliche Beweis, dass der neue Test bindet und nicht nur mitläuft.
Produktivcode wurde an genau einer Stelle angefasst (dem Lesefenster, R1); die Abbildung in `outbound.ts`
ist unverändert, weil sie richtig war — es fehlte die Bindung, nicht das Verhalten.

| | Thema | Stelle | Commit |
|---|---|---|---|
| R1 | Lesefenster dynamisch, Mindestdauer 10 s | `constants.ts:36`, `reading.ts:33` | `d0959a4` |
| NR1 | E1-Wächter unabhängig von der Anführungsart | `test/host/session.test.ts:77` | `85cfa50` |
| NR2 | Audience auf Socket.IO-Räume gebunden | `test/server/outbound.test.ts` (neu) | `209767e` |
| NR3 | Importprüfung über Zeilengrenzen | `test/core/purity.test.ts:32-52` | `4960558` |
| — | Bericht des Prüfers gesichert | `docs/nachreview-fixwelle.md` | `73ae59e` |
| R2 | Ladebudget 65 kB gzip | `konzept-ux.md:404` | `5c13d20` |

---

## 1. R1 — Das Lesefenster ist dynamisch, mit Mindestdauer 10 s

**Stelle:** `packages/core/src/engine/constants.ts:25-36`, `packages/core/src/engine/reading.ts:14-34`

**Was geändert.** `READING_MAX_MS` entfällt ersatzlos, auch als Export aus `packages/core/src/index.ts`
(der den Namensraum per `export *` weiterreicht). `READING_MIN_MS` steigt von 4 000 auf **10 000 ms**.
Die Kappung nach oben in `reading.ts` fällt weg; aus
`Math.min(Math.max(Math.round(raw), READING_MIN_MS), READING_MAX_MS)` wird
`Math.max(Math.round(raw), READING_MIN_MS)`. Die Formel selbst ist unberührt.

**Warum.** Das ist die Entscheidung des Nutzers, nicht eine Ableitung. Der Zusammenhang, der sie begründet,
stand schon im Durchstich-Bericht als F2: die Kappung bei 10 s war unter der Annahme 120 Zeichen Fragetext
hergeleitet, gesetzt sind 200 Zeichen. Damit griff sie als Regel statt als Ausnahme und nahm ausgerechnet
den langen Fragen die Lesezeit, die sie brauchen. Den Rhythmus schützt jetzt der Host: die Leertaste gibt
jederzeit früher frei.

**Nachgezogen.** `constants.ts:26-32` und der Funktionskommentar `reading.ts:14-25` beschreiben die neue
Regel. In `docs/konzept-ux.md` Abschnitt 3 sind Formelkasten (`:293`), die drei Beispielrechnungen und der
Absatz zur Unter- und Obergrenze ersetzt. Zusätzlich die Zeitleiste desselben Abschnitts: sie zeigte die
Ankündigung bei T−8,0 und das Lesefenster ab T−5,0, also ein Fünf-Sekunden-Fenster, das es nicht mehr geben
kann. Sie steht jetzt auf T−13,0 / T−10,0 mit dem ausdrücklichen Hinweis, dass das die **Mindestdauer**
ist. Der Vorbehalt „Countdown ,3·2·1' nur wenn Lesefenster ≥ 7 s" ist mit der Mindestdauer immer erfüllt
und als solcher benannt, statt als tote Verzweigung stehenzubleiben.

**Was nicht betroffen war.** `step.ts:335,354,390` nutzt `readingWindowMs` als Zahl und rechnet
`answersOpenAt = announceUntil + reading`; kein Aufrufer kennt eine Obergrenze. `test/core/playthrough.test.ts:87`
vergleicht gegen `readingWindowMs(...)` selbst und ist gegen die Änderung immun. In `apps/*` steht keine
Annahme über die Fensterlänge (geprüft). Die 10-s-Kappung als Obergrenze stand sonst nur noch in den
rückblickenden Dokumenten `bericht-durchstich.md` und `review-durchstich.md`, die ausdrücklich nicht
angefasst wurden.

**Neuer Test:** `test/core/reading.test.ts`, vier Fälle — Formelwert knapp über der Mindestdauer (10 300 ms),
die ungekappte lange Frage (15 300 ms), die Mindestdauer bei der kürzesten Frage und beim Rohwert knapp
darunter (9 900 → 10 000 ms), und das Fehlen eines toten `READING_MAX_MS` im Namensraum von `core`.

### Rücknahmeprobe R1a — Fix vollständig zurückgedreht

`READING_MIN_MS` zurück auf 4 000, `READING_MAX_MS = 10000` wieder da, Kappung in `reading.ts` wieder
eingezogen:

```
 ❯ test/core/reading.test.ts (4 tests | 4 failed)
   × Lesefenster > rechnet nach der Formel, sobald sie ueber der Mindestdauer liegt
     → expected 10000 to be 10300 // Object.is equality
   × Lesefenster > kappt lange Fragen NICHT - sie bekommen die volle berechnete Zeit
     → expected 10000 to be 15300 // Object.is equality
   × Lesefenster > haelt die Mindestdauer von 10 s auch bei der kuerzesten Frage
     → expected 4000 to be 10000 // Object.is equality
   × Lesefenster > kennt keine Konstante fuer eine Obergrenze mehr
     → expected [ 'createRng', …(37) ] to not include 'READING_MAX_MS'
```

### Rücknahmeprobe R1b — nur die Obergrenze wieder eingezogen

Mindestdauer bleibt bei 10 000, nur die Kappung kommt zurück. Damit ist belegt, dass die beiden Hälften
der Entscheidung getrennt gebunden sind:

```
 ❯ test/core/reading.test.ts (4 tests | 3 failed)
   × Lesefenster > rechnet nach der Formel, sobald sie ueber der Mindestdauer liegt
     → expected 10000 to be 10300 // Object.is equality
   × Lesefenster > kappt lange Fragen NICHT - sie bekommen die volle berechnete Zeit
     → expected 10000 to be 15300 // Object.is equality
   × Lesefenster > kennt keine Konstante fuer eine Obergrenze mehr
     → expected [ 'createRng', …(37) ] to not include 'READING_MAX_MS'
```

Der Test zur Mindestdauer bleibt hier grün — richtig, denn die Mindestdauer stand in dieser Probe ja. Der
Test bindet also die Ursache und nicht die Begleiterscheinung.

---

## 2. NR1 — Der E1-Wächter kennt jede Anführungsart

**Stelle:** `test/host/session.test.ts:77` (vorher `:71`)

**Was geändert.** Aus `/socket\.on\(\s*'connect'/` wird `/\.on\(\s*['"`]connect['"`]/`. Der Wächter hängt
damit nicht mehr an der Anführungsart, und `\s*` deckt zugleich einen Umbruch zwischen Klammer und
Ereignisnamen ab. Der Kommentar darüber benennt, warum: das Projekt hat weder eslint noch prettier, nichts
erzwingt einfache Anführungszeichen.

**Warum so.** Das Nachreview nennt als haltbarere Alternative, die Verbindung zwischen Bühne und Wächter
anders zu prüfen als über eine Textstelle im Quelltext. Das wäre ein Umbau von `App.tsx` samt
Testinfrastruktur für die Bühne und liegt außerhalb dieser Welle; hier ist die breitere Schreibweise
gewählt und die verbleibende Grenze offen benannt — ein Handler über eine Konstante
(`socket.on(EVENT, …)`) entginge dem Wächter weiterhin. Das steht unten als Folgeaufgabe.

### Rücknahmeprobe NR1 — drei Schreibweisen, drei Mal rot

Jedes Mal blieb der Aufruf von `createRoomOnce` in `apps/host-web/src/App.tsx:109` stehen und daneben kam
der rohe Handler dazu — also genau der Rückfall, den das Nachreview nachgestellt hat. Einfache
Anführungszeichen, doppelte, und der Backtick mit Umbruch:

```
   × Raum genau einmal je Sitzung > die Buehne benutzt den Wachter auch wirklich
     → expected 'import { useCallback, useEffect, useM…' not to match /\.on\(\s*['"`]connect['"`]/
```

Dieselbe Meldung in allen drei Proben, jedes Mal `Tests 1 failed | 3 passed (4)`.

### Gegenprobe NR1 — der alte Wächter wäre grün geblieben

Alter Regex plus Rückfall in doppelten Anführungszeichen:

```
 ✓ test/host/session.test.ts (4 tests)
      Tests  4 passed (4)
```

Damit ist belegt, dass der Fix selbst den Unterschied macht und nicht die Probe.

---

## 3. NR2 — Die Audience-Abbildung im Transport ist gebunden

**Stelle:** `packages/server/src/transport/socketio/outbound.ts:20-27` · **neuer Test:**
`test/server/outbound.test.ts`

**Produktivcode unverändert.** Die Abbildung ist richtig, wie das Nachreview bereits feststellt. Der Befund
war die fehlende Bindung, nicht ein falsches Verhalten. Ich habe keinen Fehler gefunden und entsprechend
keine Zeile geändert.

**Was dazugekommen ist.** Der Test bindet die letzte Abbildung von zwei Seiten:

1. **An der Abbildung selbst.** Ein aufzeichnendes `io` hält fest, in welche Räume `makeEffectSink`
   zustellen würde. Jeder der vier Scopes bekommt eine Nachricht, die der Typ dort zulässt, und wird gegen
   seine **exakte** Raumliste geprüft: `host` → nur der Bühnenraum, `players` → nur der Spielerraum, `all`
   → beide, jeder genau einmal, `player` → nur der Raum genau dieses Geräts. Dazu die Umkehrung der
   Tabelle, die genau die Mutation des Nachreviews trifft: `channels.players` darf nur von `players` und
   `all` erreicht werden.
2. **Am echten Server.** Bühne und **zwei** Spielergeräte über `harness.ts`, echtes HTTP, echtes Socket.IO.
   Zwei Spieler sind notwendig: Anna betritt den Spielerraum erst *nach* der Verarbeitung ihres eigenen
   Beitritts (`gateway.ts:166-181`), ein Leck beim ersten Beitritt wäre also gar nicht zustellbar. Erst
   Bernds Beitritt löst eine Roster-Nachricht aus, während Anna schon im Spielerraum sitzt.

**Gegen Falsch-Grün gebaut.** Zwei Vorkehrungen, beide aus der Geschichte dieses Projekts:

- **Reihenfolge.** Die Prüfung am Text — was die Bühne an Frage- und Antworttext bekommen hat, steht in
  keiner Nutzlast eines Spielergeräts — steht **vor** den Prüfungen auf Nachrichtenart. Sie ist die
  Ursache, alles andere ist die Form.
- **Sperre.** Vor jeder Prüfung läuft auf jedem Socket ein `clock:ping`/`clock:pong`. Socket.IO hält die
  Reihenfolge je Verbindung; nach dem Pong ist jede Nachricht zugestellt, die der Server vorher auf
  denselben Socket geschrieben hat. Ohne diese Sperre könnte die Prüfung vor dem Leck laufen — genau das
  Muster, das im Durchstich einen Test grün ließ, obwohl der löschende Effekt erst nach der Assertion lief.

**Was der Test nicht deckt.** Der Scope `all` ist nur in der ersten Hälfte gebunden, nicht am echten
Server: `room:answers_open` entsteht erst, wenn der Öffnen-Timer feuert, und das ist mit Ankündigung plus
Mindest-Lesefenster frühestens 13 s nach dem Start. Ein Test, der 13 Sekunden wartet, kostet mehr, als er
bringt; `host:advance` überspringt das Lesefenster in der Zustandsmaschine nicht (`step.ts:786-825`). Als
Folgeaufgabe unten benannt.

### Rücknahmeprobe NR2a — die Mutation des Nachreviews

`scope === 'host'` zusätzlich an `channels.players` gehängt:

```
 FAIL  Audience auf Socket.IO-Raeume > stellt scope host ausschliesslich in den Buehnenraum zu
 AssertionError: expected [ 'raum#host', 'raum#players' ] to deeply equal [ 'raum#host' ]

 FAIL  Audience auf Socket.IO-Raeume > laesst den Spielerraum nur bei players und all zu
 AssertionError: expected [ 'all', 'host', 'players' ] to deeply equal [ 'all', 'players' ]

 FAIL  Empfaengerkreis am echten Server > haelt Buehnen-, Spieler- und Geraetenachrichten auseinander
 AssertionError: expected [ …(10) ] to deeply equal []
 + Array [
 +   "Anna sah in stage:question_prepared: \"Welcher Planet ist der Sonne am nächsten?\"",
 +   "Anna sah in stage:question_prepared: \"Mars\"",
 +   "Anna sah in stage:question_prepared: \"Venus\"",
 +   "Anna sah in stage:question_prepared: \"Merkur\"",
 +   "Anna sah in stage:question_prepared: \"Jupiter\"",
 +   "Bernd sah in stage:question_prepared: \"Welcher Planet ist der Sonne am nächsten?\"",
 +   … (fünf weitere, dieselben Texte für Bernd)
 + ]
      Tests  3 failed | 4 passed (7)
```

Das ist dasselbe Leck, das im Nachreview 94 von 94 Tests grün gelassen hat — mit echtem Fragetext auf einem
echten Spielergerät.

### Rücknahmeprobe NR2b — `scope: 'all'` nur noch an die Bühne

```
 FAIL  Audience auf Socket.IO-Raeume > stellt scope all an Buehne UND Spieler zu, an beide genau einmal
 AssertionError: expected [ 'raum#host' ] to deeply equal [ 'raum#host', 'raum#players' ]

 FAIL  Audience auf Socket.IO-Raeume > laesst den Spielerraum nur bei players und all zu
 AssertionError: expected [ 'players' ] to deeply equal [ 'all', 'players' ]
      Tests  2 failed | 5 passed (7)
```

### Rücknahmeprobe NR2c — `scope: 'player'` an alle Geräte statt an eines

```
 FAIL  Audience auf Socket.IO-Raeume > stellt scope player ausschliesslich in den Raum genau dieses Geraets zu
 AssertionError: expected [ 'raum#players' ] to deeply equal [ 'raum#p#p-anna' ]

 FAIL  Audience auf Socket.IO-Raeume > laesst den Spielerraum nur bei players und all zu
 AssertionError: expected [ 'all', 'player', 'players' ] to deeply equal [ 'all', 'players' ]

 FAIL  Empfaengerkreis am echten Server > haelt Buehnen-, Spieler- und Geraetenachrichten auseinander
 Error: Nachricht player:joined blieb aus - der Server antwortet nicht mehr
      Tests  3 failed | 4 passed (7)
```

Der dritte Fall fällt am echten Server auf andere Art: Annas Beitrittsquittung erreicht sie nie mehr, weil
sie den Spielerraum zu diesem Zeitpunkt noch nicht betreten hat. Jeder der vier Scopes ist damit einzeln
gebunden.

---

## 4. NR3 — Die Importprüfung erkennt Importe über Zeilengrenzen

**Stelle:** `test/core/purity.test.ts:25-52` (Muster, Kommentarentfernung, `specifiersOf`) und `:86-104`
(Selbsttest)

**Was geändert.** `specifiersOf` lief Zeile für Zeile und wendete das Muster auf jede einzeln an; ein
Spezifizierer auf einer anderen Zeile als sein Schlüsselwort entging ihm. Jetzt werden zuerst die
Kommentare entfernt — Blockkommentare auch mehrzeilig, Zeilenkommentare mit `gm`, die Zeilenstruktur bleibt
dabei erhalten — und das Muster läuft danach **einmal über die ganze Datei**. Das `\s*` im Muster deckt den
Umbruch dann von selbst ab. Drei Fälle sind im Selbsttest dazugekommen: mehrzeiliger dynamischer Import,
mehrzeiliges `from`, mehrzeiliger Blockkommentar.

**Warum diese Variante.** Der Auftrag ließ die Wahl zwischen tragfähig machen und den Namen zurücknehmen.
Tragfähig machen ist hier billiger als es aussieht — die Kommentarentfernung war ohnehin schon da, sie
musste nur von „je Zeile" auf „ganze Datei" wechseln —, und der Testname `die Importpruefung erkennt jede
Schreibweise` hält danach, was er sagt. Eine Umbenennung hätte den Wächter dauerhaft schwächer gelassen als
seinen eigenen Anspruch.

### Rücknahmeprobe NR3 — ein echter mehrzeiliger Fremdimport in `core`

In `packages/core/src/engine/reading.ts` eingesetzt:

```ts
export const load = () => import(
  "node:crypto"
);
```

```
 × Purity von core > importiert ausser protocol kein weiteres Paket
 AssertionError: expected [ Array(1) ] to deeply equal []
 + Array [
 +   "C:\\Users\\nikol\\quiz\\packages\\core\\src\\engine\\reading.ts: node:crypto",
 + ]
      Tests  1 failed | 20 passed (21)
```

### Gegenprobe NR3 — zeilenweise Erkennung, derselbe Fremdimport

```
 × Purity von core > die Importpruefung erkennt jede Schreibweise
 AssertionError: expected [] to deeply equal [ 'node:crypto' ]
      Tests  1 failed | 20 passed (21)
```

Entscheidend ist hier, **welcher** Test fällt: der Selbsttest des Musters, nicht der Wächter. Der Wächter
`importiert ausser protocol kein weiteres Paket` blieb **grün**, obwohl `core` in dieser Probe wirklich
`node:crypto` importierte — genau der Befund des Nachreviews, hier selbst nachgestellt. Erst mit dem Fix
fällt der Wächter selbst.

---

## 5. R2 — Ladebudget der Beitrittsseite: 65 kB gzip

**Stelle:** `docs/konzept-ux.md:404`

Das Budget steigt von 60 auf **65 kB gzip**. Begründung im Dokument: gemessen sind 61,82 kB, der Abstand
von knapp zwei Kilobyte ist am Gerät nicht spürbar, und der Umbau, der ihn einspart — React raus —, kostet
mehr, als er bringt. **React bleibt, kein Umbau.** Die Beispielrechnung im selben Absatz (20 Geräte × 65 kB
= 1,3 MB, 500 Geräte = 32,5 MB) ist mitgezogen.

Die rückblickenden Dokumente `aenderung-2026-10-19-teilnehmerzahl.md`, `bericht-durchstich.md`,
`bericht-fixwelle.md`, `review-durchstich.md` und `nachreview-fixwelle.md` sind unberührt — sie halten
fest, was damals galt.

**Anmerkung zur Zahl.** Die 61,82 kB sind das JavaScript-Bündel. Mit Stylesheet (1,32 kB) und Dokument
(0,31 kB) liegt der kritische Pfad bei 63,45 kB gzip und damit weiterhin unter dem neuen Budget — aber mit
1,55 kB Luft statt mit 3,18 kB. Wer das Budget als Gesamtpfad liest, sollte das wissen; entschieden ist
hier nichts darüber, und die Zahl im Dokument steht wie beauftragt.

---

## 6. Die drei Tore, selbst gemessen

Am Stand `5c13d20`, sauberer Arbeitsbaum, selbst ausgeführt:

```
$ npm test
 Test Files  12 passed (12)
      Tests  105 passed (105)

$ npx tsc --noEmit
(keine Ausgabe)   Exit: 0

$ npm run build
 dist/assets/index-VGdzwLjJ.js   193.59 kB │ gzip: 61.82 kB   (Spielergeraet)
 dist/assets/index-D_YtcsRv.js   192.63 kB │ gzip: 61.57 kB   (Buehne)
 Exit: 0
```

Verteilung, selbst abgelesen: `purity.test.ts` 21, `validate.test.ts` 23, `scoring.test.ts` 16,
`http.test.ts` 10, `answerWindow.test.ts` 9, **`outbound.test.ts` 7**, `session.test.ts` 4,
`audience.test.ts` 4, **`reading.test.ts` 4**, `gateway.test.ts` 3, `disconnect.test.ts` 2,
`playthrough.test.ts` 2. Summe 105 in zwölf Dateien — elf Tests mehr als die 94 des Ausgangsstands, in zwei
neuen Dateien.

**Arbeitsbaum.** Sieben Mutationen und zwei Gegenproben, alle über Sicherungskopien im Scratchpad
zurückgespielt. Kein `git add -A`, kein `git add -u`, kein `git add .`; jeder Pfad einzeln und namentlich
gestaget und die Staging-Liste vor jedem Commit mit `git diff --cached --name-only` geprüft. Kein Merge,
kein Rebase, kein Branch-Wechsel, kein Reset, kein `stash`.

---

## 7. Folgeaufgaben — gefunden, nicht behoben

Nichts davon ist nebenbei angefasst worden.

1. **Die beiden Restrisiken des Nachreviews.** `scheduler.ts:21-24` → `roomHandle.ts:42-57` ohne örtliche
   Fehlerbehandlung, und `static.ts:80`, wo `createReadStream(file).pipe(res)` sofort `true` zurückgibt,
   sodass das `.catch` in `requestListener.ts:28` Stream-Fehler strukturell nicht erreicht. Beide sind
   älter als die letzte Welle und waren ausdrücklich vom Auftrag ausgenommen. `try/catch` im
   Timer-Rückruf, `.on('error')` auf dem Lesestrom.
2. **`scope: 'all'` am echten Server.** Die erste Hälfte des NR2-Tests bindet ihn, die zweite nicht —
   `room:answers_open` entsteht frühestens 13 s nach dem Start. Sauber lösbar nur mit einer steuerbaren
   Uhr im Scheduler oder einem Ereignis, das das Lesefenster überspringt (das UX-Konzept nennt die
   Leertaste des Hosts; die Zustandsmaschine kennt `HostSkippedPreview` noch nicht).
3. **Der E1-Wächter bleibt ein Textwächter.** Ein `socket.on(EVENT, …)` über eine Konstante entginge ihm
   weiterhin. Haltbarer wäre, die Bühne selbst gegen einen doppelten Verbindungsaufbau zu testen, statt
   ihren Quelltext zu lesen. Das ist ein Umbau und gehört in eine eigene Welle.
4. **Die Mindestdauer von 10 s ist nur gerechnet, nicht erlebt.** Zehn Sekunden stehende Zeit auf der
   Leinwand fühlen sich anders an, als sie sich rechnen — besonders bei „Wahr oder falsch?" mit sechs
   Wörtern, wo die Formel 4,2 s ergäbe. Das ist am Gerät zu prüfen und von keinem Test zu beantworten.
   Falls es zu lang wirkt: die Mindestdauer ist eine Zahl an einer Stelle.
5. Unverändert offen aus dem Durchstich-Review: Raum-TTL und Drosselung, die Token als Kulisse,
   `MAX_PROMPT_CHARS` ohne Durchsetzung, `MIN_TIME_FACTOR` ohne Wirkung.

---

## 8. Abweichungen vom Auftrag, ausdrücklich benannt

Drei, alle klein, alle hier zur Prüfung:

1. **Zwei Dokumentstellen über den Auftrag hinaus nachgezogen.** R2 nennt nur `konzept-ux.md` Abschnitt 6.
   Dieselbe Zahl stand als Beispielrechnung auch in `konzept-architektur.md:1181` („bei 60 kB und 20
   Geräten rund 1,2 MB"); sie ist mitgezogen, damit die beiden *normativen* Konzepte nicht auseinander
   laufen. Die rückblickenden Dokumente sind unberührt geblieben, wie beauftragt.
2. **Die Zeitleiste in `konzept-ux.md` Abschnitt 3 ist mitgeändert.** Der Auftrag nennt für R1 den
   Formelkasten und den Absatz zur Kappung. Die Zeitleiste darüber schrieb mit T−8,0/T−5,0 ein
   Fünf-Sekunden-Lesefenster fest, das es unter der Mindestdauer nicht mehr geben kann; sie wäre sonst
   eine stehengebliebene Falschaussage im selben Abschnitt gewesen.
3. **`test/core/reading.test.ts` ist eine neue Datei.** Für das Lesefenster gab es keinen eigenen Test;
   `playthrough.test.ts` prüft es nur gegen sich selbst. Eine neue Datei war billiger, als den
   Durchlauftest umzubauen.

Keine fachliche Abweichung: in keinem der drei Befunde habe ich den Auftrag für falsch gehalten.
