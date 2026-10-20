# Nachreview der zweiten Fix-Welle

**Stand:** 2026-10-20 · **Branch:** `durchstich` · **Geprüfter Diff:** `6847509..be8b19e`
(`d0959a4`, `85cfa50`, `209767e`, `4960558`, `73ae59e`, `5c13d20`, `be8b19e`)

Geprüft wurde ausschließlich dieser Diff. Der Umsetzerbericht `docs/bericht-fixwelle-2.md` wurde gelesen
und durchgehend als Behauptung behandelt: jede Zahl ist selbst nachgemessen, jede behauptete Absicherung
selbst mutiert. Siebzehn Proben, alle über Sicherungskopien im Scratchpad gefahren und byteweise
zurückgespielt; kein `git add`, kein `stash`, kein Branch-Wechsel, kein Reset.

---

## 0. Urteil in einem Absatz

R1 und NR2 sind **bewiesen** — bei R1 binden beide Hälften der Entscheidung getrennt, bei NR2 fällt jede
der drei geforderten Mutationen, die schwerste mit echtem Fragetext auf einem echten Spielergerät. NR3 ist
für die Mehrzeiligkeit **bewiesen**, hat aber beim Umbau eine neue Lücke aufgerissen, die der alte Code
nicht hatte. NR1 ist nur **teilweise bewiesen**: innerhalb von `App.tsx` greift der Wächter jetzt über
jede Anführungsart, aber derselbe Rückfall eine Datei weiter — in `apps/host-web/src/wire.ts`, wo bereits
ein `connect`-Handler steht — lässt alle 105 Tests grün. R2 ist widerspruchsfrei bis auf eine Zahl im
normativen Dokument. Falsch-Grün in den neuen Tests selbst: keines.

---

## 1. Befunde

### B1 — ernst · Der E1-Wächter sieht nur `App.tsx`; der naheliegendste Rückfall liegt in `wire.ts`

`test/host/session.test.ts:65-68` liest genau eine Datei: `apps/host-web/src/App.tsx`. In
`apps/host-web/src/wire.ts:41` steht aber bereits ein eigener `connect`-Handler:

```ts
socket.on('connect', () => {
  for (let i = 0; i < 3; i += 1) setTimeout(ping, i * 120);
});
```

Das ist die natürlichste Stelle im ganzen Host-Code, um beim Verbinden etwas zu senden — `send` ist dort
im Gültigkeitsbereich, der Handler existiert schon. Eine Zeile dort genügt, um E1 vollständig
wiederherzustellen: bei jeder Wiederverbindung ein zweiter Raum, neue Codeanzeige, leere Lobby, die
Spielergeräte tot im alten Raum.

**Mutation** `apps/host-web/src/wire.ts:42`, eingefügt im bestehenden Handler:

```ts
    send({ t: 'host:create' });
```

**Ergebnis:** `Test Files 12 passed (12)` / `Tests 105 passed (105)`, `npx tsc --noEmit` Exit 0. Kein Tor
sagt ein Wort. Der NR1-Fix hat die Lücke von „andere Anführungszeichen" auf „andere Datei" verschoben —
genau das Muster, das diesem Projekt schon zweimal passiert ist.

Die Folgeaufgabe 3 des Umsetzerberichts benennt die allgemeine Schwäche des Textwächters, aber nicht
diese: sie nennt den Handler über eine Konstante, nicht den Dateizuschnitt. Der Dateizuschnitt ist der
billiger auszulösende Fall.

### B2 — ernst · NR3 schließt eine Lücke und reißt eine neue auf: `/*` in einem String blendet den Wächter

`test/core/purity.test.ts:38-40`:

```ts
function ohneKommentare(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}
```

Die Blockkommentar-Entfernung läuft über die **ganze Datei** und kennt keine String-Grenzen. Ein `/*` in
einem Stringliteral eröffnet damit einen Kommentar, der bis zum nächsten `*/` alles frisst — echte
Importe eingeschlossen.

**Mutation** am Kopf von `packages/core/src/engine/reading.ts:1-3`:

```ts
const muster = '/*';
import { randomUUID } from 'node:crypto';
const ende = '*/';
```

**Ergebnis:** `Tests 21 passed (21)`. `core` importiert in dieser Probe wirklich `node:crypto`, und der
Wächter `importiert ausser protocol kein weiteres Paket` schweigt.

Entscheidend für die Einordnung: **die alte zeilenweise Fassung hätte diesen Import gefunden.** Seite an
Seite gemessen, beide Fassungen auf denselben Quelltext:

| Probe | alt (zeilenweise) | neu (ganze Datei) |
|---|---|---|
| `/*` im String vor dem Import | `["node:crypto"]` | `[]` ← **Regression** |
| mehrzeiliger dynamischer Import | `[]` | `["node:crypto"]` ← Fix wirkt |
| `//` im String, Import auf derselben Zeile | `[]` | `[]` (altbekannt) |
| Import nur im Template-Literal | `["node:crypto"]` | `["node:crypto"]` (fällt rot, also harmlos) |

Der Tausch ist nicht neutral: eine mehrzeilige Importschreibweise ist unauffällig und wahrscheinlich, ein
`/*` im String seltener — aber die Lücke ist jetzt dort, wo der Wächter *stiller* ist. Der Selbsttest
`:106-115` deckt beide Richtungen nicht ab; er prüft den Blockkommentar nur in seiner gutartigen Form.

### B3 — gering · Leerraum zwischen `.on` und `(` entgeht dem E1-Wächter weiterhin

`test/host/session.test.ts:77`: `expect(app).not.toMatch(/\.on\(\s*['"`]connect['"`]/)`. Zwischen `.on`
und der Klammer steht kein `\s*`.

**Mutation** in `apps/host-web/src/App.tsx:110`:

```ts
    wire.socket.on ('connect', () => wire.send({ t: 'host:create' }));
```

**Ergebnis:** `Tests 4 passed (4)`. Die vier anderen geprüften Schreibweisen fallen korrekt:

| Rückfall in `App.tsx:110` | Ergebnis |
|---|---|
| `.on('connect', …)` einfache Anführungszeichen | `1 failed \| 3 passed (4)` — rot |
| `.on("connect", …)` doppelte | `1 failed \| 3 passed (4)` — rot |
| ``.on(`connect`, …)`` Backtick | `1 failed \| 3 passed (4)` — rot |
| `.on(\n  'connect',\n  …\n)` mit Umbruch | `1 failed \| 3 passed (4)` — rot |
| `.on ('connect', …)` Leerzeichen vor der Klammer | **4 passed (4)** — grün |
| `socket['on']('connect', …)` Klammerzugriff | 4 passed (4) — grün |
| `socket.on(EV, …)` über eine Konstante | 4 passed (4) — grün (im Bericht benannt) |

Die Fehlermeldung in den roten Fällen lautet jedes Mal wörtlich:

```
AssertionError: expected 'import { useCallback, useEffect, useM…' not to match /\.on\(\s*['"`]connect['"`]/
```

Das Projekt hat weder eslint noch prettier — nichts erzwingt, dass die Klammer direkt am `.on` klebt.
Dieselbe Begründung, mit der NR1 die Anführungszeichen geöffnet hat, gilt für den Leerraum davor.

### B4 — gering · `konzept-ux.md:404` nennt den Bündelwert als gemessenen kritischen Pfad

Die Zeile heißt „**Kritischer Pfad unter 65 kB**" und nennt dann „Gemessen sind 61,82 kB". 61,82 kB ist
das JavaScript-Bündel allein. Selbst gemessen mit `npm run build` (Exit 0), Ausgabe für
`apps/player-web/dist` — das ist die Beitrittsseite:

```
dist/index.html                 0.50 kB │ gzip:  0.31 kB
dist/assets/index-BEQfTrYX.css  3.83 kB │ gzip:  1.32 kB
dist/assets/index-VGdzwLjJ.js 193.59 kB │ gzip: 61.82 kB
```

0,31 + 1,32 + 61,82 = **63,45 kB**. Die Rechnung des Umsetzers stimmt also auf die Stelle genau — nur
steht sie in seinem Bericht und nicht im Konzept. Im normativen Dokument steht weiterhin eine Zahl, die
den Abstand zum Budget mit 3,18 kB doppelt so groß aussehen lässt, wie er mit 1,55 kB ist. Das ist keine
Entscheidung, die der Prüfer trifft, aber es ist eine Zahl, die unter ihrer eigenen Überschrift falsch
gelesen wird.

### B5 — gering, latent · R1 macht `MAX_PROMPT_CHARS` tragend, ohne dass es durchgesetzt wird

`packages/core/src/engine/constants.ts:39` definiert `MAX_PROMPT_CHARS = 200`. Die Konstante wird nirgends
verwendet — gesucht über `packages/`, `apps/`, `test/`: der einzige Treffer außerhalb der Definition ist
`MAX_OPTION_CHARS` in `packages/core/src/questions/singleChoice.ts:44`. Die Antwortlängen werden geprüft,
die Fragelänge nicht.

Bis `d0959a4` war das folgenlos: `READING_MAX_MS` deckelte das Lesefenster bei 10 s, egal wie lang der
Fragetext war. Ohne Deckel wächst das Fenster linear mit der Wortzahl und ohne Obergrenze — 800 Wörter
ergeben 321,5 s stehende Bühne. Die Entscheidung „kein Deckel" ist nicht verhandelbar und steht hier auch
nicht zur Debatte; der Hinweis ist, dass sie die unerzwungene Zeichengrenze von einer Notiz in eine
tragende Zusicherung verwandelt hat. Der Quiz-Editor der zweiten Welle ist der Moment, in dem das zählt.
Der Umsetzerbericht führt `MAX_PROMPT_CHARS ohne Durchsetzung` unter Folgeaufgabe 5 weiter, ohne diesen
neuen Zusammenhang zu nennen; `reading.ts:14-25` und `constants.ts:26-32` nennen ihn ebenfalls nicht.

---

## 2. Die Proben im Einzelnen

### R1 — Lesefenster dynamisch, Mindestdauer 10 s — **bewiesen**

Der Produktivcode-Diff umfasst genau zwei Dateien (`git diff 6847509..HEAD -- packages/`):
`constants.ts` und `reading.ts`. `READING_MAX_MS` kommt im gesamten Repository außerhalb von Berichten
und dem Test `test/core/reading.test.ts:47-48` nicht mehr vor; `packages/core/src/index.ts` reicht
`engine/constants.js` per `export *` weiter, ein toter Export wäre also sichtbar — und ist es auch, siehe
R1c.

| Probe | Mutation | Ergebnis |
|---|---|---|
| R1a | `constants.ts:36` zurück auf `4000` + `READING_MAX_MS = 10000`, `reading.ts:33` wieder `Math.min(…)` | **4 failed (4)** |
| R1b | nur die Kappung zurück, `READING_MIN_MS` bleibt 10 000 | **3 failed \| 1 passed (4)** |
| R1c | nur ein toter Export `READING_MAX_MS`, Verhalten unverändert | **1 failed \| 3 passed (4)** |
| R1d | nur `READING_MIN_MS` auf 4 000, keine Kappung | **1 failed \| 5 passed (6)** |

Fehlermeldungen im Wortlaut (R1a):

```
AssertionError: expected 10000 to be 10300 // Object.is equality
AssertionError: expected 10000 to be 15300 // Object.is equality
AssertionError: expected 4000 to be 10000 // Object.is equality
AssertionError: expected [ 'createRng', …(37) ] to not include 'READING_MAX_MS'
```

R1b und R1d zusammen sind der eigentliche Beweis: die beiden Hälften der Entscheidung — Mindestdauer und
Wegfall des Deckels — sind **getrennt** gebunden. R1c zeigt, dass auch der tote Export für sich allein
fällt; der Wächter hängt nicht am Verhalten. Die Zahlen des Umsetzerberichts zu R1a und R1b stimmen mit
den selbst gemessenen überein.

**Rechnet `step.ts` mit dem neuen Fenster?** Ja. `packages/core/src/engine/step.ts:335-341`:
`readingWindowMs(loaded.prompt, body.options.map(o => o.label))`, dann
`answersOpenAt = announceUntil + reading`, `answersCloseAt = answersOpenAt + timeLimitMs`. Kein Aufrufer
kennt eine Obergrenze. `test/core/playthrough.test.ts:87` vergleicht gegen `readingWindowMs` selbst und
blieb in allen vier R1-Proben grün — korrekt, der Test ist gegen die Formel immun.

**Stehengebliebene Annahmen „höchstens 10 s"?** Geprüft über `apps/`, `packages/` und die normativen
Dokumente. In `apps/host-web/src/App.tsx:298-303` und `apps/player-web/src/App.tsx:358-361` rechnet alles
gegen die übertragenen Zeitstempel `announceUntil` / `answersOpenAt` / `answersCloseAt` — keine fest
verdrahtete Fensterlänge. In den Dokumenten ist außerhalb der rückblickenden Berichte keine 10-s-Kappung
mehr auffindbar.

**Die mitgezogenen Dokumentstellen, einzeln geprüft:**

Die Zeitleiste `konzept-ux.md:272-275` steht jetzt auf T−13,0 bis T−10,0 für die Ankündigung und T−10,0
für den Beginn des Lesefensters. Das ist richtig: `ANNOUNCE_MS = 3000` plus `READING_MIN_MS = 10000` ergibt
13 s vor der Freigabe, und der einleitende Satz `:268` sagt ausdrücklich, dass die Tabelle die
**Mindestdauer** zeigt und eine längere Frage den Anfang nach vorn schiebt. Der Countdown-Vorbehalt
„nur wenn Lesefenster ≥ 7 s" ist korrekt aufgelöst — 10 ≥ 7 gilt immer, die Verzweigung wäre tot gewesen.

Die Beispielrechnungen `konzept-ux.md:296` sind alle vier nachgerechnet und stimmen:
8 Wörter + 4×1 Wort = 1,5 + 3,2 + 0,6 = 5,3 → Mindestdauer 10 s · 20 Wörter + 4×3 Wörter = 1,5 + 8,0 +
1,8 = 11,3 s · 30 Wörter + 4×3 Wörter = 1,5 + 12,0 + 1,8 = 15,3 s · 6 Wörter + 2×1 Wort = 1,5 + 2,4 + 0,3
= 4,2 → Mindestdauer 10 s. Der mittlere und der dritte Wert decken sich mit
`test/core/reading.test.ts:19,31` (10 300 bzw. 15 300 ms).

Die Beispielrechnung in `konzept-architektur.md:1181` stimmt ebenfalls: 20 × 65 kB = 1,3 MB, 500 × 65 kB =
32,5 MB. Dass sie überhaupt mitgezogen wurde, war über den Auftrag hinaus und ist richtig so — die beiden
normativen Konzepte hätten sonst zwei verschiedene Budgets genannt.

### NR1 — Wächter unabhängig von der Anführungsart — **teilweise bewiesen**

Innerhalb von `App.tsx` bewiesen: vier Schreibweisen rot (siehe Tabelle in B3), darunter die doppelten
Anführungszeichen, an denen der alte Wächter scheiterte, und der Zeilenumbruch. Die Behauptung des
Berichts, die Meldung sei in allen Proben dieselbe, stimmt wörtlich.

Nicht bewiesen ist die Zusage, die der Testname gibt — „die Buehne benutzt den Wachter auch wirklich".
Der Leerraum vor der Klammer (B3) und vor allem die zweite Datei (B1) bleiben offen.

### NR2 — Audience auf Socket.IO-Räume gebunden — **bewiesen**

`git diff 6847509..HEAD -- packages/` umfasst ausschließlich `constants.ts` und `reading.ts`. Die
Behauptung „Produktivcode unverändert" für `outbound.ts` stimmt.

| Probe | Mutation in `packages/server/src/transport/socketio/outbound.ts` | Ergebnis |
|---|---|---|
| NR2a | `:22` `host` zusätzlich an `channels.players` | **3 failed \| 4 passed (7)** |
| NR2b | `:26` `all` nur noch an die Bühne | **2 failed \| 5 passed (7)** |
| NR2c | `:27` Einzelspieler an Bühne und alle Spieler | **3 failed \| 4 passed (7)** |

NR2a fällt an drei Stellen, die schwerste am echten Server und mit echtem Text:

```
AssertionError: expected [ …(10) ] to deeply equal []
+ Array [
+   "Anna sah in stage:question_prepared: \"Welcher Planet ist der Sonne am nächsten?\"",
+   "Anna sah in stage:question_prepared: \"Venus\"", … (acht weitere)
+ ]
```

**Zur Frage, ob der Lauf am echten Server wirklich zustellt, bevor geprüft wird.** Er tut es — aber nicht
wegen der Ping-Pong-Sperre. Zusatzprobe: dieselbe NR2a-Mutation mit entfernten `sperre`-Aufrufen
(`test/server/outbound.test.ts:196-198`), drei Läufe hintereinander: **3 failed \| 4 passed (7)** in allen
drei. Die zehn Lecks stehen also schon in `annaSah`/`berndSah`, bevor `await anna.await(
'player:question_prepared')` zurückkommt — die leckende Nachricht geht demselben Socket voraus. Die Sperre
ist damit ein Gürtel zum Hosenträger, nicht das tragende Element. Der Beweis ist nicht die Sperre, sondern
dass das Leck mit echten Texten tatsächlich beobachtet wurde. Das ist kein Mangel, aber der Bericht stellt
die Sperre als den Riegel dar, der sie hier nicht ist.

Die Reihenfolge von Beobachtung und Assertion ist sauber gebaut: `test/server/outbound.test.ts:211-228`
sammelt die verbotenen Texte aus der Nachricht an die Bühne, prüft mit `expect(verboten.size)
.toBeGreaterThan(4)`, dass überhaupt etwas gesammelt wurde, und sucht erst danach in allen bereits
aufgezeichneten Nutzlasten. Der Mitschnitt läuft ab Verbindungsaufbau (`:150-156`), nicht erst ab der
Prüfung. Hier kann sich nichts verschieben.

Ungebunden bleibt `scope: 'all'` am echten Server. NR2b fällt nur in der ersten Hälfte, nicht im
Servertest — der Bericht benennt das selbst und die Begründung trägt: `room:answers_open` entsteht
frühestens 13 s nach dem Start, und die Zustandsmaschine kennt kein Überspringen des Lesefensters.

### NR3 — Importprüfung über Zeilengrenzen — **bewiesen, mit Regression**

| Probe in `packages/core/src/engine/reading.ts:1` | Ergebnis |
|---|---|
| mehrzeiliger dynamischer Import `import(\n "node:crypto"\n)` | **1 failed \| 20 passed (21)** |
| mehrzeiliges `from`, Umbruch vor dem Spezifizierer | **1 failed \| 20 passed (21)** |
| `from` + Umbruch + doppelte Anführungszeichen | **1 failed \| 20 passed (21)** |
| Import nur im Template-Literal | 1 failed (Falsch-Positiv, fällt rot — unschädlich) |
| `/*` in einem String vor dem Import | **21 passed (21)** ← B2 |
| `//` in einem String, Import auf derselben Zeile | 21 passed (21) — altbekannt, nicht neu |

Fehlermeldung im Wortlaut für den mehrzeiligen dynamischen Import:

```
× Purity von core > importiert ausser protocol kein weiteres Paket
AssertionError: expected [ Array(1) ] to deeply equal []
+ Array [
+   "C:\\Users\\nikol\\quiz\\packages\\core\\src\\engine\\reading.ts: node:crypto",
+ ]
     Tests  1 failed | 20 passed (21)
```

Es fällt der **Wächter**, nicht nur der Selbsttest — das ist der Unterschied, den der Bericht in seiner
Gegenprobe beschreibt, und er stimmt.

Nicht angefasst von NR3 und deshalb nur zur Kenntnis: die Prüfung auf Uhr, Zufall und Timer in
`test/core/purity.test.ts:75-81` läuft weiterhin zeilenweise mit der alten Kommentarentfernung. Das ist
konsistent, weil diese Muster keine Zeilengrenze überschreiten.

### R2 — Ladebudget 65 kB — **korrekt bis auf B4**

Beide normativen Dokumente nennen jetzt 65 kB (`konzept-ux.md:404`, `konzept-architektur.md:1181`), beide
Beispielrechnungen sind mitgezogen und stimmen. Die rückblickenden Dokumente sind unberührt: der Diff
`6847509..HEAD` fasst unter `docs/` nur `STAND.md`, `konzept-ux.md`, `konzept-architektur.md` und die
beiden neuen Berichte an — `bericht-durchstich.md`, `review-durchstich.md`, `bericht-fixwelle.md` und
`aenderung-2026-10-19-teilnehmerzahl.md` sind nicht im Diff. `STAND.md:14,35,84` ist in sich stimmig.
Einziger Widerspruch ist die Zahl aus B4.

---

## 3. Die drei vom Umsetzer vorgelegten Punkte

1. **Beispielrechnung in `konzept-architektur.md:1181` mitgezogen.** Richtig und notwendig. Ohne sie
   nennten die beiden normativen Konzepte zwei verschiedene Budgets. Die Zahlen stimmen.
2. **Zeitleiste T−13,0 / T−10,0 und der Countdown-Vorbehalt.** Beides richtig. 3 000 ms Ankündigung plus
   10 000 ms Mindest-Lesefenster ergeben genau T−13,0, und „≥ 7 s" ist mit einer Mindestdauer von 10 s
   immer erfüllt — die Verzweigung wäre tot gewesen, die Auflösung ist die ehrlichere Variante.
3. **63,45 kB statt 61,82 kB.** Selbst nachgemessen, stimmt auf die Stelle: 0,31 + 1,32 + 61,82 = 63,45 kB
   gzip für `apps/player-web/dist`. Der Punkt ist richtig vorgelegt — nur steht er im Bericht und nicht im
   Konzept, siehe B4.

---

## 4. Die Tore, selbst gemessen

Am Stand `be8b19e`, sauberer Arbeitsbaum, jeweils selbst ausgeführt:

```
$ npm test
 Test Files  12 passed (12)
      Tests  105 passed (105)

$ npx tsc --noEmit
(keine Ausgabe)   Exit: 0

$ npm run build
 apps/host-web/dist   index-D_YtcsRv.js   192.63 kB │ gzip: 61.57 kB
 apps/player-web/dist index-VGdzwLjJ.js   193.59 kB │ gzip: 61.82 kB
                      index-BEQfTrYX.css    3.83 kB │ gzip:  1.32 kB
                      index.html            0.50 kB │ gzip:  0.31 kB
 Exit: 0
```

Die Zahlen des Umsetzerberichts (105 / 12, Exit 0, 61,82 kB) stimmen. Die behauptete Verteilung auf die
Dateien wurde stichprobenartig gegen den Lauf geprüft und stimmt ebenfalls: `outbound.test.ts` 7,
`reading.test.ts` 4, `purity.test.ts` 21.

---

## 5. Restrisiken und Testlücken

- **`scope: 'all'` ist am echten Server ungebunden.** Nur die aufzeichnende Hälfte deckt ihn. Solange
  `room:answers_open` frühestens 13 s nach dem Start entsteht, kostet ein Servertest dafür mehr, als er
  bringt. Sauber lösbar mit einer steuerbaren Uhr im Scheduler.
- **Die Ping-Pong-Sperre ist nicht der Riegel, als der sie beschrieben ist.** Sie schadet nicht, aber wer
  sich auf sie verlässt, verlässt sich auf eine Zusage, die in dieser Probe nichts getragen hat.
- **`specifiersOf` erkennt einen Import in einem Template-Literal als Import.** Fällt rot, also
  ungefährlich — aber der Selbsttest `:106-115` deckt den Fall nicht ab, und wer ihn später trifft, wird
  ihn für einen Fehler des Wächters halten.
- **Die Mindestdauer von 10 s ist nur gerechnet, nicht erlebt.** Zehn Sekunden stehende Bühne bei „Wahr
  oder falsch?" mit sechs Wörtern — die Formel ergäbe dort 4,2 s. Das ist am Gerät zu entscheiden, von
  keinem Test.
- **Bewusst offen und kein Befund dieser Welle:** der Timerpfad `scheduler.ts` → `roomHandle.ts` ohne
  örtliche Fehlerbehandlung und `static.ts` mit `createReadStream(file).pipe(res)` hinter dem `.catch`.

---

## 6. Folgeaufgaben

Getrennt von den Befunden, keine davon in diesem Review angefasst.

1. Den E1-Wächter vom Dateizuschnitt lösen (B1) — entweder über alle Dateien in `apps/host-web/src`
   außer `session.ts` prüfen, oder, haltbarer, die Bühne selbst gegen einen doppelten Verbindungsaufbau
   testen statt ihren Quelltext zu lesen.
2. Die Kommentarentfernung in `purity.test.ts` string-fest machen oder den Blockkommentar-Schritt wieder
   fallen lassen und stattdessen `\s` statt eines Zeilenwechsels im Muster erlauben (B2).
3. `MAX_PROMPT_CHARS` durchsetzen, bevor der Quiz-Editor Fragetexte von außen annimmt (B5).
4. Die Zahl in `konzept-ux.md:404` auf den gemessenen Gesamtpfad stellen oder die Überschrift auf das
   Bündel beziehen (B4). Das ist eine Entscheidung des Nutzers, keine des Prüfers.

---

## 7. Arbeitsbaum

Alle siebzehn Proben sind über Sicherungskopien zurückgespielt und byteweise gegengeprüft:

```
$ md5sum packages/server/src/transport/socketio/outbound.ts packages/core/src/engine/constants.ts \
         packages/core/src/engine/reading.ts test/core/purity.test.ts test/host/session.test.ts \
         apps/host-web/src/App.tsx apps/host-web/src/wire.ts test/server/outbound.test.ts
5f2ddc741c9cd643f8a6cc7e72468d4f  outbound.ts
80c5663603513509a8658e57a6bcca53  constants.ts
8212ea437d9c1fe90ce8a0d38e9735f1  reading.ts
68cbef54612745fb2f31ee01f50c9298  purity.test.ts
8b8fbe9911eb3c85008d54ff6b308834  session.test.ts
a4b4e87cbef95e793428de9a22b7266f  App.tsx
3301957f7524f559bfab8134a53c7d60  wire.ts
0996a102a913d64aca414a8af763947e  outbound.test.ts

$ git status --short --untracked-files=all
(leer)

$ git rev-parse --short HEAD
be8b19e
```

Kein `git add`, kein Commit, kein `stash`, kein Branch-Wechsel, kein Reset. Dieses Dokument ist angelegt
und nicht committet.
