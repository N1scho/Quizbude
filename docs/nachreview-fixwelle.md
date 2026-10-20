# Nachreview — Fix-Welle Durchstich Quizbude

**Stand:** 2026-10-20 · **Branch:** `durchstich` · **Geprüfter Diff:** `2d14013` → `6847509` (neun Commits)
**Rolle:** unabhängige Prüfung, rein lesend bis auf Mutationsproben, die restlos zurückgenommen wurden.
`docs/bericht-fixwelle.md` wurde gelesen und als Behauptung behandelt. Keine Zahl und kein Probenergebnis
daraus ist übernommen; alles unten ist selbst gemessen.

---

## 0. Urteil

Alle sechs Befunde sind behoben, und alle sechs sind durch Tests gebunden, die bei zurückgedrehtem Fix rot
werden. Zwölf Rücknahmeproben wurden gefahren, zwölf wurden rot. Kein einziges Falsch-Grün in den neuen
Tests: die Proben treffen jedes Mal die **Ursache**, nicht eine Begleiterscheinung — bei E4 fällt
ausdrücklich die Gnadenfrist, bei E2 fällt der Textleck-Test unabhängig von der Scope-Tabelle, und bei B2
unterscheidet der Test nachweisbar zwischen fehlender Validierung und fehlendem `try/catch`.

Zwei der Fixes sind allerdings an ihrem Rand nicht dicht. Der E1-Wächter läuft am gleichen Fehler auf wie
E3 — ein Regex, der nur eine Schreibweise kennt —, und die Kette aus E2 endet eine Schicht vor dem Ziel:
die letzte Abbildung von Empfängerkreis auf Zustellweg liegt in `outbound.ts` und ist von keinem Test und
von keinem Typ gedeckt. Beide habe ich mutiert und belegt. Der Umsetzer hat die zweite Lücke selbst als F1
benannt; das ändert nichts daran, dass sie das zentrale Gesetz des Projekts trägt.

---

## 1. Die sechs Rücknahmeproben

Alle Proben über Sicherungskopien im Scratchpad, nicht über `git checkout` oder `git stash`. Der
Git-Zustand blieb während aller Proben unberührt; `git status --short` war nach jeder Rücknahme leer.

### B1 — Der HTTP-Pfad übersteht jede Anfrage · **bewiesen**

Der Fix hat zwei Hälften, beide einzeln mutiert.

**Probe B1a** — `packages/server/src/http/static.ts:42-50`: den `try/catch` um `decodeURIComponent`
entfernt und auf `const pathname = decodeURIComponent(url.pathname);` zurückgedreht.

```
Tests 5 failed | 5 passed (10)
AssertionError: promise rejected "URIError: URI malformed" instead of resolving
Caused by: URIError: URI malformed
FAIL  test/server/http.test.ts > beantwortet /play/% mit 400, statt zu werfen
FAIL  test/server/http.test.ts > beantwortet /play/%zz mit 400, statt zu werfen
FAIL  test/server/http.test.ts > beantwortet /play/abc% mit 400, statt zu werfen
FAIL  test/server/http.test.ts > beantwortet /play/%E0%A4%A mit 400, statt zu werfen
FAIL  test/server/http.test.ts > beantwortet /host/% mit 400, statt zu werfen
```

Die Meldung ist wörtlich die aus dem Durchstich-Review. Der Test bindet die Ursache: er prüft mit
`resolves.toBe(true)`, dass der Wurf gar nicht erst entsteht, statt nur den Statuscode abzufragen.

**Probe B1b** — `packages/server/src/http/requestListener.ts:28-35`: den `.catch`-Block gestrichen.

```
Tests 1 failed | 9 passed (10)
FAIL  test/server/http.test.ts > beantwortet eine abgelehnte Auslieferung mit 500,
      statt den Prozess zu beenden
Unhandled Rejection — Error: Probe: kaputt
```

Beide Hälften sind getrennt gebunden. Die erste Probe lässt den `.catch` stehen und fällt trotzdem — der
zweite Riegel verdeckt den ersten also nicht.

### B2 — Eingangsvalidierung am Transportrand · **bewiesen**

Drei Proben, weil der Fix aus drei Teilen besteht.

**Probe B2a** — `packages/server/src/transport/socketio/gateway.ts:86-87`: Validierung entfernt, blanker
Cast zurück (`const msg = raw as ClientMessage;`), `try/catch` bleibt stehen.

```
Tests 2 failed | 1 passed (3)
[quizbude] Nachricht abgebrochen: TypeError: raw.toUpperCase is not a function
[quizbude] Nachricht abgebrochen: TypeError: Cannot read properties of null (reading 't')
Error: Nachricht clock:pong blieb aus - der Server antwortet nicht mehr
FAIL  test/server/gateway.test.ts > ueberlebt player:join mit roomCode als Zahl
      und laesst die Runde bestehen
FAIL  test/server/gateway.test.ts > verwirft jede missgebildete Nachrichtenform, ohne zu sterben
```

`TypeError: raw.toUpperCase is not a function` ist wörtlich der ursprüngliche Absturz. Entscheidend ist,
dass der Test trotz bestehendem `try/catch` rot wird: er prüft nicht nur, dass der Server überlebt, sondern
dass **derselbe Socket danach noch eine Antwort bekommt**. Ohne diese Unterscheidung hätte das `try/catch`
die fehlende Validierung verdeckt — genau das Falsch-Grün-Muster, das hier vermieden wurde.

**Probe B2b** — `gateway.ts:47-54`: `try/catch` entfernt, Validierung bleibt.

```
Tests 1 failed | 2 passed (3)
FAIL  test/server/gateway.test.ts > ein Fehler in der Verarbeitung kostet die Verbindung,
      nicht den Server
Error: Test timed out in 5000ms.
Unhandled Errors — Error: Probe: innerer Fehler
```

Die beiden Hälften sind also unabhängig voneinander gebunden.

**Probe B2c** — `packages/server/src/transport/socketio/validate.ts:38-40`: `isShortString` auf
`return true;` entschärft.

```
Tests 7 failed
FAIL  test/server/gateway.test.ts > ueberlebt player:join mit roomCode als Zahl …
FAIL  test/server/gateway.test.ts > verwirft jede missgebildete Nachrichtenform …
FAIL  test/server/validate.test.ts > weist roomCode als Zahl zurueck - das ist B2
      AssertionError: expected { t: 'player:join', …(2) } to be null
FAIL  test/server/validate.test.ts > weist join ohne Felder zurueck
FAIL  test/server/validate.test.ts > weist join mit Array als Name zurueck
FAIL  test/server/validate.test.ts > weist join zu lang zurueck
```

**Fachliche Prüfung.** `validate.ts` deckt alle sieben Formen der `ClientMessage`-Union ab; ich habe sie
gegen `packages/protocol/src/messages.ts:18-32` abgeglichen, keine fehlt. Die begründete Abweichung des
Umsetzers — `normalizeCode` **nicht** mit `String(raw)` total zu machen — ist fachlich richtig und nicht
nur plausibel: ein zweiter Riegel an dieser Stelle hätte Probe B2a grün werden lassen und damit den
eigentlichen Wächter untestbar gemacht. `normalizeCode` (`packages/server/src/runtime/codes.ts:28-30`)
steht unverändert und bekommt jetzt nur noch geprüfte Zeichenketten.

Kein neuer Fehlerpfad: `isIndex` lässt negative und sehr große Ganzzahlen durch, aber
`packages/core/src/questions/singleChoice.ts:95-96` fängt beides sauber mit `out_of_range` ab. Ein
256-Zeichen-`roomCode` läuft durch `normalizeCode` in ein `unknown_room`, nicht in einen Wurf.

### E1 — Die Bühne erzeugt den Raum genau einmal · **bewiesen, Wächter aber durchlässig**

**Probe E1a** — `apps/host-web/src/App.tsx:109`: zurück auf
`wire.socket.on('connect', () => wire.send({ t: 'host:create' }));`.

```
Tests 1 failed | 3 passed (4)
FAIL  test/host/session.test.ts > die Buehne benutzt den Wachter auch wirklich
AssertionError: expected 'import { useCallback, useEffect, useM…'
                to contain 'createRoomOnce(wire.socket, () => wir…'
```

**Probe E1b** — `apps/host-web/src/session.ts:22`: `if (created) return;` gestrichen, der Wächter feuert
bei jeder Verbindung.

```
Tests 2 failed | 2 passed (4)
FAIL  test/host/session.test.ts > erzeugt bei jeder Wiederverbindung KEINEN zweiten Raum
      AssertionError: expected 4 to be 1
FAIL  test/host/session.test.ts > haelt zwei Sitzungen auseinander
      AssertionError: expected [ 'a', 'a', 'b', 'b' ] to deeply equal [ 'a', 'b' ]
```

Beide Hälften binden. Die Lücke steht unter Befund NR1.

### E2 — Nachrichtenart und Empfängerkreis gebunden · **bewiesen, zweifach**

**Probe E2a** — `packages/core/src/engine/step.ts:383`: `scope: 'host'` → `scope: 'all'` bei
`stage:question_prepared`.

```
Tests 2 failed | 2 passed (4)
FAIL  test/core/audience.test.ts > stellt jede Nachrichtenart nur an ihren
      erlaubten Empfaengerkreis zu
  + "stage:question_prepared ging an 'all', erlaubt ist host"
FAIL  test/core/audience.test.ts > laesst weder Fragetext noch Antworttext noch
      Erklaerung an ein Spielergeraet
  + "stage:question_prepared an 'all' enthaelt \"Welcher Planet ist der Sonne am naechsten?\""
  + "stage:question_prepared an 'all' enthaelt \"Merkur\""   (und sechs weitere)

tsc: step.ts(381,7): error TS2322: Type '{ kind: "send"; to: { scope: "all"; }; message:
     { t: "stage:question_prepared"; … } }' is not assignable to type 'Effect'.
```

**Probe E2b** — `step.ts:747`: dasselbe bei `stage:reveal`.

```
Tests 3 failed | 1 passed (4)
FAIL  … stellt jede Nachrichtenart nur an ihren erlaubten Empfaengerkreis zu
  + "stage:reveal ging an 'all', erlaubt ist host"
FAIL  … laesst weder Fragetext noch Antworttext noch Erklaerung an ein Spielergeraet
  + "stage:reveal an 'all' enthaelt \"Merkur umkreist die Sonne in rund 58 Millionen
     Kilometern Abstand.\""   (und neun weitere)
FAIL  … schickt die Loesung ausschliesslich an die Buehne

tsc: 1 Fehler
```

Beide Mutationen waren im Durchstich-Review grün geblieben. Beide Tore greifen jetzt unabhängig: der Test
auch dort, wo jemand die Typen mit aufweicht, der Compiler auch dort, wo niemand den Test laufen lässt.

**Der Test bindet die Ursache, nicht eine Begleiterscheinung.** Das war beim ersten Review die
entscheidende Schwachstelle. `test/core/audience.test.ts:170-192` sammelt die verbotenen Texte in einem
**ersten** vollständigen Durchlauf über alle Zustellungen und sucht erst in einem **zweiten** Durchlauf
nach Lecks. Die Reihenfolge von Beobachtung und Prüfung kann sich also nicht verschieben — genau der
Fehler, der beim Durchstich einen Test grün ließ, obwohl der löschende Effekt erst nach der Assertion lief.

**Zusatzprobe E2c (Exhaustivität).** Der Test behauptet in Zeile 28-31, eine neue Nachrichtenart zwinge
zu einer Entscheidung. Ich habe `{ readonly t: 'stage:hinweis'; readonly text: string }` in
`packages/protocol/src/messages.ts` eingefügt:

```
test/core/audience.test.ts(32,7): error TS2741: Property '"stage:hinweis"' is missing
in type '{ … }' but required in type 'Readonly<Record<…>>'.
```

Die Behauptung trägt — `tsconfig.json` nimmt `test/**/*.ts` in das Programm auf, der `Record`-Typ ist
also ein echtes Tor und keine Dokumentation. Geprüft mit `tsc --listFiles`.

**Fachliche Prüfung der Typkopplung.** `packages/core/src/engine/effects.ts:38-58` teilt `SendEffect` in
vier Fälle. Die Richtung ist richtig gewählt: `HostBoundMessage` ist über `stage:${string}` offen, eine
neue Bühnennachricht fällt also automatisch auf die sichere Seite; `PlayersBoundMessage` und
`AllBoundMessage` sind geschlossene Aufzählungen, eine neue Nachricht an die Geräte erfordert einen
ausdrücklichen Eintrag. Der Kommentar in `packages/protocol/src/views.ts:9-13` wurde korrekt erweitert
statt abgeschwächt — er benennt jetzt beide Achsen und sagt, wo die zweite hängt. Das deckt sich mit dem,
was ich oben gemessen habe.

Die Lücke am Ende der Kette steht unter Befund NR2.

### E3 — Die Purity-Prüfung erfasst jede Importform · **bewiesen, Rand offen**

**Probe E3a** — `test/core/purity.test.ts:29`: das alte Muster `/from\s+'([^']+)'/g` eingesetzt.

```
Tests 1 failed | 20 passed (21)
FAIL  test/core/purity.test.ts > die Importpruefung erkennt jede Schreibweise
AssertionError: expected [] to deeply equal [ 'node:crypto' ]
```

Das ist aber nur der Selbsttest des Musters. Die eigentliche Frage ist, ob der Wächter einen **echten**
Fremdimport in `core` fängt. Dafür habe ich alle fünf Mutationen aus dem Durchstich-Review einzeln als
erste Zeile in `packages/core/src/engine/reading.ts` eingesetzt:

| Mutation | Durchstich-Review | jetzt gemessen |
|---|---|---|
| `import "node:crypto";` | grün ✗ | **1 Test rot** |
| `import 'node:crypto';` | grün ✗ | **1 Test rot** |
| `import { randomUUID } from "node:crypto";` | grün ✗ | **1 Test rot** |
| `export const load = () => import('node:crypto');` | grün ✗ | **1 Test rot** |
| `export const load2 = () => import("node:crypto");` | ungeprüft | **1 Test rot** |

Roter Test jedes Mal: `Purity von core > importiert ausser protocol kein weiteres Paket`. Alle vier
offenen Schreibweisen sind geschlossen.

**Probe E3b (Falsch-Grün-Riegel).** Mit einem absichtlich toten Muster (`/froms+'([^']+)'/g`, ohne
Backslash) fallen **zwei** Tests: `die Importpruefung erkennt jede Schreibweise` und
`die Importpruefung findet in core ueberhaupt Importe` (`expected 0 to be greater than 20`). Ein Wächter,
der nichts mehr findet, ist also nicht mehr still grün. Dieser Riegel ist der wertvollste Teil des Fixes.

Der verbleibende Rand steht unter Befund NR3.

### E4 — `onDisconnect` rechnet auf der Uhr der Eingabe · **bewiesen**

**Probe E4** — `packages/core/src/engine/step.ts:287`: `maybeSettle(next, at, deps)` zurück auf
`maybeSettle(next, next.lastInputAt, deps)`. Nur diese eine Zeile; Zeile 596 trägt dasselbe Muster, stand
aber schon vor der Welle auf `at` und wurde bewusst nicht angefasst.

```
Tests 2 failed (2)
FAIL  test/core/disconnect.test.ts > rechnet die Atempause auf der Uhr der Eingabe,
      nicht auf dem letzten Zeitstempel
AssertionError: expected 9700 to be 24700 // Object.is equality

FAIL  test/core/disconnect.test.ts > laesst die Gnadenfrist fuer Nachzuegler nach
      der Trennung noch laufen
AssertionError: expected 11200 to be greater than 24400
```

Die Zahlen reproduzieren die Probe P1 des Durchstich-Reviews punktgenau: `settleAt` 9 700 statt 24 700,
also 14 700 ms in der Vergangenheit. Der **zweite** Test trägt die eigentliche Folge und nicht nur das
Symptom: `lateUntil` liegt mit 11 200 vor dem Moment der Trennung bei 24 400, die 1,5-Sekunden-Gnadenfrist
ist also verbraucht, bevor sie beginnt. Damit bindet der Test die Ursache.

**Fachliche Prüfung.** Die Reinheit von `core` bleibt unberührt: `at` ist der Feldwert, der ohnehin mit
jeder Eingabe hereinkommt (`applyEvent`, `step.ts:150`), keine neue Uhr. Die Purity-Prüfung lief in allen
Proben grün. Kein neuer Fehlerpfad.

---

## 2. Befunde

### NR1 — Der E1-Wächter kennt nur eine Schreibweise · **mittel**

`test/host/session.test.ts:71`

```ts
expect(app).not.toMatch(/socket\.on\(\s*'connect'/);
```

Dieser negative Wächter ist der einzige Test, der die Bühne mit der Regel verbindet; die drei übrigen
prüfen nur `createRoomOnce` für sich. Er kennt einfache Anführungszeichen. **Probe:** den Aufruf von
`createRoomOnce` in `apps/host-web/src/App.tsx:109` stehen lassen und daneben die ursprüngliche
Regression in doppelten Anführungszeichen wieder einbauen:

```ts
createRoomOnce(wire.socket, () => wire.send({ t: 'host:create' }));
wire.socket.on("connect", () => wire.send({ t: 'host:create' }));
```

Gemessen:

```
test/host/session.test.ts   Tests 4 passed (4)
npx tsc --noEmit            0 Fehler
```

Der Befund E1 ist damit vollständig wiederhergestellt — jede Wiederverbindung der Bühne legt einen zweiten
Raum an, die Spielergeräte hängen im alten —, und alle Tore bleiben grün.

Das ist dieselbe Fehlerklasse, die E3 in derselben Welle behoben hat: ein Regex-Wächter ist nur so breit
wie seine Schreibweise. Das Projekt hat weder eslint noch prettier (`package.json` kennt nur `build`,
`typecheck`, `test`, `start`), es zwingt also nichts zu einfachen Anführungszeichen.

### NR2 — Die Audience-Abbildung im Transport ist von keinem Tor gedeckt · **mittel**

`packages/server/src/transport/socketio/outbound.ts:20-27`

Die Typkopplung aus E2 bindet Nachricht an `Audience`. Welcher Socket.IO-Raum hinter einer `Audience`
steht, entscheidet danach allein diese eine Zuweisungskette. **Probe:** eine Zeile geändert —

```ts
effect.to.scope === 'host'
  ? io.to(channels.host).to(channels.players)   // statt: io.to(channels.host)
```

Gemessen:

```
npm test            Test Files 10 passed (10)   Tests 94 passed (94)
npx tsc --noEmit    0 Fehler
```

Fragetext, Antworttexte und die Lösung gehen an jedes Spielergerät, und kein Tor sagt ein Wort. Das ist
dasselbe Leck, gegen das E2 angetreten ist — nur eine Schicht weiter außen. Der Umsetzer hat die Lücke
selbst als Folgeaufgabe F1 benannt; das ist richtig beschrieben, ändert aber nichts an der Bewertung: die
Zusage „Frage- und Antworttexte erreichen das Spielergerät nie" (`konzept-ux.md` Abschnitt 0) ist nach der
Welle an genau einer ungeprüften Stelle aufhängbar statt an fünf. Das ist eine deutliche Verbesserung und
trotzdem ein offener Pfad zum zentralen Gesetz des Projekts.

Der im Umsetzerbericht vorgeschlagene Test — Bühne und Spieler getrennt gegen den echten Server, jede
Nachricht beim richtigen Empfänger — ist die richtige Antwort; `test/server/harness.ts` bringt dafür
bereits alles mit.

### NR3 — Die Purity-Prüfung arbeitet zeilenweise · **niedrig**

`test/core/purity.test.ts:29` und `:33`

`specifiersOf` zerlegt die Quelle in Zeilen und wendet `SPECIFIER_RE` auf jede einzeln an. Ein
Importspezifizierer auf einer anderen Zeile als sein Schlüsselwort entgeht dem Muster. **Probe:** in
`packages/core/src/engine/reading.ts`

```ts
export const load = () => import(
  "node:crypto"
);
```

Gemessen: `Tests 21 passed (21)` — `core` importiert `node:crypto`, der Wächter schweigt.

Der Test heißt `die Importpruefung erkennt jede Schreibweise` (Zeile 78) und der Kommentar in Zeile 26-28
sagt „Jede Importform". Beides ist in dieser Form nicht mehr wahr. Dass kein Formatierer im Projekt läuft,
macht umgekehrt einen solchen Umbruch unwahrscheinlich; deshalb niedrig und nicht mittel. Der Riegel aus
Probe E3b (`findet in core ueberhaupt Importe`) greift hier nicht, weil die übrigen Importe weiterhin
gefunden werden.

---

## 3. Eigene Messung der drei Tore

Am Stand `6847509`, sauberer Arbeitsbaum, selbst ausgeführt — nicht aus dem Umsetzerbericht übernommen:

```
$ npm test
 Test Files  10 passed (10)
      Tests  94 passed (94)

$ npx tsc --noEmit
(keine Ausgabe)
Exit: 0

$ npm run build
Exit: 0
```

Verteilung der Dateien, selbst abgelesen: `test/server/http.test.ts` 10, `test/core/purity.test.ts` 21,
`test/core/scoring.test.ts` 16, `test/core/disconnect.test.ts` 2, `test/core/audience.test.ts` 4,
`test/core/playthrough.test.ts` 2, `test/core/answerWindow.test.ts` 9, `test/server/gateway.test.ts` 3,
`test/server/validate.test.ts` 23, `test/host/session.test.ts` 4. Summe 94, zehn Dateien. Die Zahlen des
Umsetzerberichts stimmen.

Das Paket `server` hatte null Tests und hat jetzt 36 in drei Dateien, davon drei gegen einen echten HTTP-
und Socket.IO-Server mit echten Clients. Das war die wichtigste Lücke des Durchstich-Reviews und sie ist
geschlossen.

Der Bauvorgang meldet für das Spielgerät weiterhin `193.59 kB │ gzip: 61.82 kB`. Das Ladebudget ist eine
Nutzerentscheidung und hier ausdrücklich kein Befund.

---

## 4. Restrisiken — gefunden, nicht behoben, keine Befunde dieser Welle

**R1 — Der Timerpfad hat keine örtliche Fehlerbehandlung.** `packages/server/src/runtime/scheduler.ts:21-24`
ruft `this.onFire(token)` in einem `setTimeout`-Rückruf ohne `try/catch` auf; von dort geht es über
`roomHandle.ts:42-57` direkt in `step`. Das ist nach der Welle der einzige Weg in `core`, der nicht lokal
abgesichert ist — der Transportrand ist es jetzt, der HTTP-Pfad auch. Aufgefangen wird ein Wurf nur noch
vom Prozessnetz in `main.ts:10`. Zusätzlich setzt `roomHandle.ts:54-56` im `finally` `running = false`,
während unverarbeitete Ereignisse in der Warteschlange liegen bleiben; sie werden erst beim nächsten
`dispatch` abgearbeitet. Relevant wird das genau dann, wenn der Editor eigene Fragen zulässt und
`parseSpec` wieder werfen kann.

**R2 — Die Auslieferung per Stream liegt hinter dem `.catch`.** `packages/server/src/http/static.ts:80`
gibt nach `createReadStream(file).pipe(res)` sofort `true` zurück; die Zusage aus `requestListener.ts:28`
kann einen Stream-Fehler deshalb strukturell nicht erreichen. `pipe` leitet Fehler der Quelle nicht an das
Ziel weiter — eigens nachgestellt: ein `createReadStream` auf einen fehlenden Pfad, in eine Senke gepiped,
erzeugt `uncaughtException: ENOENT`. Der Pfad ist erreichbar, weil `tryFile` (`static.ts:23-29`) erst
`stat` macht und danach geöffnet wird; zwischen beiden kann die Datei verschwinden, und unter vielen
gleichzeitigen Geräten ist `EMFILE` der realistischere Fall. Die Zeile ist älter als diese Welle; neu ist
die Zusage, der HTTP-Pfad überstehe jede Anfrage. Ein `.on('error')` auf dem Lesestrom schließt das.

**R3 — Das Prozessnetz hält den Server nach jedem unbehandelten Fehler am Leben.** `main.ts:10-15`
protokolliert und läuft weiter, auch wenn der Zustand danach unbestimmt ist. Für einen Spieleabend ist das
die richtige Abwägung — der Abend ist wichtiger als die Sauberkeit —, aber es ist eine Abwägung und keine
Lösung. Sie trägt nur, solange `console.error` jemand liest; das ist die Folgeaufgabe F6 des
Umsetzerberichts und richtig beschrieben.

**R4 — Ein innerer Fehler auf dem Bühnensocket macht die Runde stumm.** `gateway.ts:52-53` trennt bei jedem
Wurf die Verbindung. Trifft das die Bühne, verbindet sich der Client wieder, `createRoomOnce` lässt kein
zweites `host:create` durch, und der neue Socket betritt `hostRoom(code)` nie — die Bühne bekommt nichts
mehr und kann nicht weiterschalten, ohne dass irgendwo eine Meldung erscheint. Das ist **keine Regression**:
vorher starb der Prozess, was schlimmer ist, und Wiedereinstieg war ausdrücklich nicht beauftragt. Es ist
die Form, in der die fehlende Reconnect-Fähigkeit nach der Welle zutage tritt, und gehört in die
Entscheidung über die zweite Welle.

**R5 — `requestListener.ts:30-34` hängt bei bereits gesendetem Kopf an.** Wenn `headersSent` gilt und
`writableEnded` nicht, wird `'Interner Fehler'` an den laufenden Rumpf angehängt. Harmlos im Durchstich,
weil der einzige streamende Pfad `res` selbst beendet; benennenswert, sobald eine zweite Quelle schreibt.

**Nicht prüfbar und hier nicht geprüft:** alles am Gerät — Lesbarkeit aus drei Metern, `navigator.vibrate`,
Daumenreichweite, das Verhalten bei zwanzig gleichzeitigen Geräten. `test/server/gateway.test.ts` bindet
über `listen(0)` einen echten Port; in einer abgeschotteten Umgebung ohne Loopback fällt die Datei aus
(F5 des Umsetzerberichts, zutreffend).

---

## 5. Folgeaufgaben

Getrennt von den Befunden, nichts davon nebenbei behoben:

1. **NR2 schließen** — ein Test über den echten Server, der `outbound.ts` an die Zustellwege bindet. Von
   allem hier das Wichtigste, weil es die letzte ungeprüfte Stelle am zentralen Gesetz ist. `harness.ts`
   trägt den Aufbau bereits.
2. **NR1 schließen** — den negativen Wächter in `session.test.ts:71` auf beide Anführungszeichen
   erweitern, oder, haltbarer, die Verbindung zwischen Bühne und Wächter anders prüfen als über eine
   Textstelle im Quelltext.
3. **NR3 schließen** — `specifiersOf` über die ganze Datei laufen lassen statt zeilenweise, oder den
   Testnamen auf das beschränken, was er leistet.
4. **R1 und R2** — `try/catch` im Timer-Rückruf, `.on('error')` auf dem Lesestrom.
5. Unverändert offen aus dem Durchstich-Review: Raum-TTL und Drosselung (H5/F2), die Token als Kulisse
   (H3/F3), `MAX_PROMPT_CHARS` ohne Durchsetzung (H1/F4), `MIN_TIME_FACTOR` ohne Wirkung (H2/F4).
   Alle vier sind im Umsetzerbericht korrekt als nicht angefasst ausgewiesen.

Die beiden Nutzerentscheidungen — Kappung des Lesefensters bei 200 Zeichen, Ladebudget 61,82 kB — sind
hier nicht erneut aufgemacht.

---

## 6. Arbeitsbaum

Zwölf Mutationen gefahren, alle über Sicherungskopien im Scratchpad zurückgespielt. Kein `git add`, kein
Commit, kein `stash`, kein Branch-Wechsel, kein Reset. Nach der letzten Rücknahme und vor dem Schreiben
dieser Datei:

```
$ git status --short
$ git diff HEAD --stat
$ git status --porcelain | wc -l
0
$ git stash list | wc -l
0
$ git log --oneline -1
6847509 docs: Review-Bericht sichern und Arbeitsstand festhalten
```

Keine Ausgabe bei `git status --short` und bei `git diff HEAD --stat` ⇒ der Arbeitsbaum stand exakt auf
`HEAD`. Danach habe ich alle drei Tore auf diesem sauberen Stand gemessen (Abschnitt 3). Die einzige
Änderung seitdem ist diese Datei, die als unverfolgter Pfad liegen bleibt und nicht committet wurde.
