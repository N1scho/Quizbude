# Bericht zur sechsten Fix-Welle — N1, N2, N3

**Umsetzer:** ein Agent · **HEAD bei Beginn:** `a36033a` · **HEAD am Ende:** `a779761` ·
**Arbeitsbaum am Ende:** sauber · **Datum:** 2026-10-21

Drei Befunde des Nachreviews der fünften Welle (`docs/nachreview-welle5.md`), ein Commit je
Befund. Die Veröffentlichung von `standalone/quizbude.html` hat der Umsetzer nicht angefasst.

| Commit | Befund |
|---|---|
| `223ec81` | N1 — der Deckel der Abtrag-Schleife ist weg |
| `f903d7f` | N2 — die erste Frage verschwindet nicht mehr still |
| `ddc15b2` | N3 — B2 und B3 hängen nicht mehr an Textwächtern |
| `a779761` | die beiden unverfolgten Berichte in den Baum |

---

## 1. N1 — der Deckel der Abtrag-Schleife

**Geändert:** `packages/core/src/questions/parse.ts:424` → `for (;;)` statt
`for (let runde = 0; runde < 8; runde += 1)`, dazu der Kommentar darüber
(`parse.ts:410-438`) mit dem Terminierungsbeleg. `standalone/quizbude.html` mit
`node tools/standalone-parser.mjs --schreiben` nachgezogen. Tests:
`test/core/parse.test.ts`, drei neue Zusagen im Block „Die Nachsichten gekreuzt"
(`:376-434`).

**Gewählter Weg:** der erste der beiden angebotenen — Deckel entfernen, Terminierung dem
Abbruch bei unveränderter Zeile überlassen. Grund: der zweite Weg (Deckel behalten, Überlauf
melden) hätte eine Fehlermeldung durch `leseBeschriftung`, `leseAntwort` und beide Türen
(Zeilenformat und JSON) plumpsen lassen müssen — und hätte den Laufzeitbefund unten nicht
mitgelöst, sondern festgeschrieben.

### Gemessen: Eingabe → Ausgabe

Jeweils `Frage? | 20` über der Antwortzeile, Probe nach der Messung entfernt.

```
                     vor der Welle (a36033a)                 nach der Welle
haekchen x8    ok=true  labels=["Merkur","Venus"]       ok=true  labels=["Merkur","Venus"]
haekchen x9    ok=true  labels=["✅ Merkur","Venus"]     ok=true  labels=["Merkur","Venus"]
haekchen x12   ok=true  labels=["✅✅✅✅ Merkur","Venus"] ok=true  labels=["Merkur","Venus"]
haekchen x20   ok=true  labels=["✅…(12×)… Merkur",…]    ok=true  labels=["Merkur","Venus"]
haekchen x100  ok=true  labels=["✅…(92×)… Merkur",…]    ok=true  labels=["Merkur","Venus"]
json x9        ok=true  labels=["✅ Merkur","Venus"]     ok=true  labels=["Merkur","Venus"]
stern + x9     ok=true  labels=["✅ Merkur","Venus"]     ok=true  labels=["Merkur","Venus"]
```

`correctIndex` ist in allen Fällen 0, `fehler` leer.

### Terminierungsbeleg, am Regex begründet

Die Schleife bricht ab, sobald eine Runde nichts mehr abträgt (`rest === vorher`). Sie läuft
also genau so lange, wie jede Runde mindestens ein Zeichen entfernt. Das hängt daran, dass
**keine** der vier beteiligten Regexe auf dem leeren String greifen kann — die vier sind
`BESCHRIFTUNG`, `PUNKT`, `MARKIERUNG` und `LEERKASTEN`:

| Regex | Quelle | kürzester Treffer |
|---|---|---|
| `BESCHRIFTUNG` | `/^([A-Za-z]\|\d{1,2})[).:]\s+/` | 3 Zeichen: ein Zeichen aus der ersten Klasse, eines aus `).:`, mindestens ein Leerraum (`\s+`) |
| `PUNKT` | `/^(-\|–\|•\|·\|●\|■)\s+/` | 2 Zeichen: Aufzählungszeichen plus mindestens ein Leerraum (`\s+`) |
| `MARKIERUNG` | `/^(\*\|\+\|✅\|✔\|✓\|☑\|\[\s*[xX]\s*\])\s*/` | 1 Zeichen: jede Alternative der Gruppe verlangt mindestens ein Zeichen, der `[x]`-Zweig mindestens drei; nur das nachgestellte `\s*` darf leer bleiben |
| `LEERKASTEN` | `/^(\[\s*\]\|☐\|❌\|✗)\s*/` | 1 Zeichen, aus demselben Grund |

Alle vier sind mit `^` verankert, alle vier tragen also einen **Präfix** ab. Jede Runde liefert
damit entweder ein echt kürzeres `rest` oder ein zeichengleiches — und im zweiten Fall bricht
sie. Die Zahl der Runden ist nach oben durch `roh.length` begrenzt; eine Endlosschleife gibt es
unter keiner Eingabe. Der `fluchtweg`-Rückgabepfad innerhalb der Schleife verlässt sie ohnehin.

Zwei Dinge, die der Beleg ausdrücklich **nicht** behauptet: `istMarkiert` kann nicht `true`
liefern, ohne dass `MARKIERUNG` greift (es testet dieselbe Regex) — ein „markiert, aber nichts
abgetragen" ist ausgeschlossen. Und die beiden `while`-Schleifen am Zeilenende sind unberührt;
sie verkürzen `rest` ebenfalls in jedem Durchlauf echt.

### Laufzeit im ungünstigsten Fall

Der ungünstigste Fall, den `MAX_UPLOAD_BYTES = 1_000_000` zulässt: ein Häkchen sind drei Bytes
in UTF-8, 333 333 davon füllen die ganze erlaubte Datei mit einer einzigen Antwortzeile.
Gemessen durch `parseQuiz`, nicht an der Schleife allein:

```
nach der Welle   x1 000     0,3 ms
                 x16 000    4,4 ms
                 x100 000  20,6 ms
                 x333 333  67,5 ms      <- Dateideckel, linear
```

**Der Deckel war nicht nur offen, er war teuer.** Vor der Welle blieb hinter acht Runden der
Rest des Markierungslaufs stehen, und `MARKIERUNG_ENDE` (`/\s*(✅|✔|✓|☑)+\s*$/`, ohne
`^`-Verankerung) suchte ihn von jeder Zeichenstelle aus neu ab — quadratisch:

```
vor der Welle    x16 000    641 ms
                 x32 000   2 285 ms
                 x64 000   9 102 ms
                 x333 333  245 s        <- direkt gemessen, s. Mutationsprobe unten
```

Die 245 s sind keine Hochrechnung: der neue Laufzeittest hat unter der zurückgedrehten
Mutation genau so lange gebraucht, bevor er fiel.

### Mutationsprobe

| Datei:Zeile | Mutation | Ergebnis |
|---|---|---|
| `parse.ts:424` | `for (;;)` → `for (let runde = 0; runde < 8; runde += 1)` (der Zustand von `a36033a`) | **rot**: alle drei neuen Zusagen. „die neunte, die zwanzigste und die zweihundertste Markierung" und „nichts Gruenes traegt ein Markierungszeichen im Label" fallen in 8 bzw. 3 ms, „der Abtrag bleibt auch am Dateideckel bezahlbar" nach 245 526 ms |

Rücknahme über eine Sicherungskopie im Scratchpad, nicht über `git checkout`:
`cmp` meldet `zeichengleich: packages/core/src/questions/parse.ts`.

---

## 2. N2 — die erste Frage verschwindet nicht mehr still

**Geändert:** `packages/core/src/questions/parse.ts:638-644` (vorher `:608`) — zusätzlich
`erste.antworten.length <= 1`, wie vom Nachreview probeweise gemessen. Der irreführende
Kommentar bei `trenneBeiwerk` ist mitgezogen (er sagte „Eine Frage, die der Autor ohne
Antworten gelassen hat, fällt weiterhin laut auf" — richtig, nur ging es um die Markierung,
nicht um die Antworten). `standalone/quizbude.html` nachgezogen. Test:
`test/core/parse.test.ts`, eine neue Zusage im Block „Vorwort und Titelzeile zusammen (B5)".

### Gemessen: Eingabe → Ausgabe

```
Eingabe: 'Nenne den kleinsten Planeten\nMerkur [x]\nVenus\n\nWelcher Planet ist rot? | 20\n* Mars\nVenus'
  vor der Welle:  ok=true  n=1  hinweise=["Zeile 1: als Vorwort uebersprungen."]  fehler=[]
  nach der Welle: ok=false n=2  hinweise=[]
                  fehler=["1:keine Antwort markiert, genau eine muss es sein. Setz ein * vor die richtige."]

Dasselbe für "Markierung vergessen" (Merkur/Venus/Mars ohne Zeichen) und für `**Merkur**`
als Markierungsversuch - beide vorher ok=true n=1, jetzt ok=false n=2 mit Fehler auf Zeile 1.
```

### Der B5-Leitfall und die beiden Nachbarfälle sind weiter grün

Selbst nachgemessen nach dem Fix, nicht aus dem Nachreview übernommen:

```
mehrzeiliges Vorwort       'Klar!\nHier sind deine Fragen:\n\n# Abendrunde\n\nWelcher Planet ist rot? | 20\n* Mars\nVenus'
                           -> ok=true n=1 titel="Abendrunde" hinweise=["Zeile 1: als Vorwort uebersprungen."] fehler=[]

B5-Leitfall                Vorwort + Code-Zaun + Nummerierung + A)-Beschriftung + Fett + Haekchen
                           'Klar! Hier sind deine Fragen:\n\n```\n# Abendrunde\n\n1) Welcher Planet ist rot? | 20\nA) **Mars** ✅\nB) Venus\n```'
                           -> ok=true n=1 labels=["Mars","Venus"] ci=[0] hinweise=["Zeile 1: als Vorwort uebersprungen."] fehler=[]

JSON im Zaun mit Vorwort   'Klar! Hier ist das JSON:\n\n```json\n{"title":"T",…}\n```'
                           -> ok=true n=1 labels=["A","B"] hinweise=["Zeile 1: als Vorwort uebersprungen."] fehler=[]
```

Dazu der ganze Block als Testlauf: `test/core/parse.test.ts` fährt 62 Zusagen, alle grün —
darunter „Vorwort und Titelzeile, mit und ohne Leerzeile dazwischen", „ein mehrzeiliges
Vorwort, auch vor der Titelzeile", „eine Ueberschrift nach einer echten Frage ist kein Titel
mehr", „JSON im Code-Zaun wird auch unter einem Vorwort als JSON gelesen", „kaputtes JSON unter
einem Vorwort wird nicht zu JSON erklaert" und „der Leitfall des Reviews, alle Nachsichten in
EINER Eingabe".

### Mutationsprobe

| Datei:Zeile | Mutation | Ergebnis |
|---|---|---|
| `parse.ts:643` | `&& erste.antworten.length <= 1` wieder gestrichen | **rot**: „die erste Frage verschwindet nicht, nur weil ihr die Markierung fehlt (N2)", und nur sie (61 von 62 grün) |

Rücknahme mit `cmp` belegt: `zeichengleich: packages/core/src/questions/parse.ts`.

---

## 3. N3 — die Verdrahtung hängt nicht mehr an Textwächtern

Hier ist der Auftrag an einer Stelle nicht wörtlich umsetzbar gewesen; die Abweichung steht in
Abschnitt 6.1 und 6.2. Umgesetzt ist in beiden Fällen die Sache: ein Verhaltenstest, der die
genannte Mutation rot macht.

### 3.1 B2 — die Bühne

**Geändert:** `apps/host-web/src/App.tsx`. Die Verdrahtung — Leitung, Raumsitzung und der
Empfang der Serverantworten — steht jetzt als `verdrahte()` (`App.tsx:52-169`) neben der
Komponente statt in ihrem `useEffect`. Die Komponente hält nur noch den Verweis darauf
(`App.tsx:171-203`). `Stage` ist exportiert, dazu `Buehnenansicht` und `Buehnenleitung`.
Die JSX ist unberührt.

**Test:** `test/host/wire.test.ts`, neuer Block „Die verdrahtete Buehne (B2/N3)" mit drei
Zusagen. Er benutzt den Socket-Doppelgänger, der in dieser Datei schon stand (`vi.mock` auf
`socket.io-client` plus `feuere`), wie der Auftrag es verlangt.

Der Leitfall, gemessen am Verhalten statt am Text:

```
socket.feuere('connect')
leitung.starte({ title: 'erste Fassung' })        -> 1 host:create auf der Leitung
socket.feuere('quizbude', { t: 'room:error', code: 'quiz_invalid', message: '…' })
                                                  -> stufen = ['connecting','upload']
                                                     serverfehler = [null, 'Die Sammlung taugt nicht.']
leitung.starte({ title: 'korrigierte Fassung' })  -> 2 host:create, das zweite traegt
                                                     quiz.title = 'korrigierte Fassung'
```

Dazu die Gegenprobe („ohne die Ablehnung bleibt es bei einem Raum"): drei Klicks und eine
Wiederverbindung ohne `room:error` ergeben weiterhin genau **ein** `host:create`. Ohne sie
wäre der Leitfall auch dann grün, wenn der Doppelklick-Schutz ganz verschwände.

### 3.2 B3 — der Server

**Geändert:** neu `packages/server/src/transport/socketio/server.ts` mit
`createSocketServer(http)`. `packages/server/src/main.ts:38` nimmt den Server von dort
(`attachGateway(createSocketServer(http))`) und hat damit **kein `io` mehr im
Gültigkeitsbereich**. `test/server/harness.ts:45` baut den Server nicht mehr von Hand nach,
sondern nimmt denselben — das war das „zieh nach, was fehlt" aus dem Auftrag: das Harness
führte die Maße ein zweites Mal.

**Test:** `test/server/socketBuffer.test.ts`, neuer Block „Der Server, den der Abend
hochfaehrt (N3)" mit zwei Zusagen. Gemessen wird der Server aus `createSocketServer`, an der
**ungünstigsten** erlaubten Datei (Steuerzeichen, Faktor 6,022 — nicht die freundliche Datei
des Pakets), und zwar zuerst am echten Draht und erst danach am abgelesenen
`io.engine.opts.maxHttpBufferSize`:

```
traegt den Puffer wirklich                 ergebnis='angekommen'  puffer=6065536
und die Messung wuerde es merken, wenn
ihn jemand hinter dem Aufbau herunterdreht ergebnis='getrennt'    puffer=1000000
```

Die zweite Zusage ist die Gegenprobe zur Messung selbst: sie setzt genau die Zeile des
Nachreviews ein und belegt, dass eine Absenkung **hinter** der Konstruktion am echten Draht
ankommt. Ohne sie wäre nicht gezeigt, dass die erste überhaupt etwas messen kann.

### 3.3 Die beiden Mutationen des Nachreviews, gefahren

| # | Datei:Zeile | Mutation | Ergebnis |
|---|---|---|---|
| M15 | `App.tsx:144` (`room:error`-Zweig) | `sitzung.abgelehnt();` → `if (message.code === 'niemals') sitzung.abgelehnt();` — die Zeile bleibt wörtlich stehen und wird tot | **rot**: „nach einer Ablehnung des Servers geht ein zweiter Raumbefehl wirklich hinaus" — `expected [ { kanal: 'quizbude', …(1) } ] to have a length of 2 but got 1`. `tsc` Exit 0, also wirklich vom Test gefangen und nicht vom Typsystem. 317 von 318 grün |
| M25 | `main.ts`, eine Zeile hinter der Konstruktion | `io.engine.opts.maxHttpBufferSize = 1e6;` — wörtlich wie im Nachreview | **nicht mehr schreibbar**: `main.ts(39,1): error TS2304: Cannot find name 'io'`, `tsc` Exit 2, `npm run build` Exit 2 |
| M25' | `server.ts:21` (`createSocketServer`) | derselbe Eingriff dort, wo der Server jetzt entsteht | **rot**: „traegt den Puffer wirklich - gemessen an engine.io, nicht an der Konstante" — `expected 'getrennt' to be 'angekommen'`. `tsc` Exit 0. 317 von 318 grün |

M25 ist damit nicht nur gebunden, sondern geschlossen: in `main.ts` gibt es kein `io` mehr, auf
das sich eine solche Zeile stützen könnte. M25' ist die ehrliche Nachfolgerin — der Eingriff an
der Stelle, an die er nach dem Umzug gehört — und die ist rot, und zwar **am Verhalten** (am
echten Draht), nicht nur an der abgelesenen Zahl. Die Reihenfolge der beiden `expect` in dieser
Zusage ist eigens so gewählt; beim ersten Anlauf stand der Ableser vorn, und die Mutation fiel
dann an der Zahl statt an der Nachricht.

### 3.4 Rücknahme, mit `cmp` belegt

```
zeichengleich: apps/host-web/src/App.tsx
zeichengleich: packages/server/src/main.ts
zeichengleich: packages/server/src/transport/socketio/server.ts
```

Kein `git checkout`, kein `git stash`. Die Sicherungskopien lagen im Scratchpad der Sitzung.

---

## 4. Geänderte Alt-Zusagen — einzeln begründet

Keine ist ersatzlos gefallen. Zehn neue `it(` stehen einer entfernten gegenüber, 309 → 318.
Kein `describe(` entfernt.

**1. `expect(app).toContain('oeffne.current?.abgelehnt()')`** in `test/host/session.test.ts`
→ ersetzt durch `expect(app).toContain('verdrahte({')` (`:222`).

Die alte Zusage ist genau die, deren Durchlässigkeit N3 ausmacht: das Nachreview hat ihren Text
wörtlich stehen lassen und tot gemacht. Nach dem Umbau wäre sie zusätzlich zur Lügnerin
geworden — sie hätte ihren Text im **Kommentar** über `verdrahte` gefunden, in dem genau diese
Mutation als Warnung zitiert ist. Das ist mir im Lauf aufgefallen: nach dem Umbau blieb
`session.test.ts` zunächst grün, obwohl `oeffne.current` im Code gar nicht mehr existiert. Die
Stelle trägt jetzt zwei Dinge: den Verhaltenstest aus 3.1 und die kleine, ehrliche Frage, ob
die Komponente überhaupt durch die gebundene Verdrahtung geht. Begründung steht im Wortlaut im
Test.

**2. `it('main.ts setzt den Puffer wirklich, und zwar aus dieser Konstante')`** in
`test/server/socketBuffer.test.ts` → umbenannt in `it('main.ts baut keinen eigenen
Socket-Server mehr, sondern nimmt den gebundenen')`; zwei der drei `expect` ausgetauscht
(`maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES` und
`from './transport/socketio/validate.js'` → `attachGateway(createSocketServer(http))` und
`not.toContain('new Server(')`).

Dieselbe Begründung: die alte Zusage ist genau der Wächter, den M25 unterlaufen hat. Was sie
schützen sollte, schützt jetzt das Typsystem (M25 ist TS2304) und der Verhaltenstest aus 3.2.
Was bleibt, ist die kleine Frage, ob `main.ts` wirklich den gebundenen Server nimmt — und dass
es keinen zweiten baut.

**3. Die Signatur von `schicke()`** in `test/server/socketBuffer.test.ts` nimmt jetzt einen
Bauer (`(http) => Server`) statt einer Puffergröße. Rein mechanisch: dieselben beiden
Alt-Zusagen („mit der Vorgabe von Socket.IO reisst eine erlaubte Datei die Verbindung ab",
„mit dem gesetzten Puffer kommt dieselbe Datei an") fahren dieselben beiden Server, nur über
den neuen Weg. Ohne das ließe sich der echte Server der Produktion nicht durch dieselbe Probe
schicken.

---

## 5. Nachgemessene Tore, wörtlich

Selbst gefahren nach dem letzten Commit, bei sauberem Arbeitsbaum:

```
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

git status --short
(ende)

git log --oneline -5
a779761 docs: Review und Nachreview des Fragen-Uploads in den Baum
ddc15b2 test: die Verdrahtung von B2 und B3 haengt nicht mehr an Textwaechtern
f903d7f fix: die erste Frage verschwindet nicht mehr, wenn ihr die Markierung fehlt
223ec81 fix: der Abtrag der Markierungen hat keinen Deckel mehr
a36033a docs: Ladebudget der Buehne mit den Zahlen von vite statt eigener Messung
```

Der Riegel ist **ohne** `--schreiben` grün. Mit `--schreiben` lief er zweimal, nach N1 und nach
N2; danach meldete er jedes Mal von sich aus „ist aktuell".

**Ladebudget** (Spielergerät, kritischer Pfad, aus den Zahlen von vite):

```
dist/index.html                 0.50 kB │ gzip:  0.31 kB
dist/assets/index-*.css         3.83 kB │ gzip:  1.32 kB
dist/assets/index-*.js        193.59 kB │ gzip: 61.82 kB
                                          -------------
                                           63,45 kB gzip   (Budget 65 kB, 1,55 kB Abstand)
```

Unverändert gegenüber `a36033a`. Diese Welle hat am Spielergerät nichts angefasst; die
Umbauten liegen in `apps/host-web` (Bühne) und `packages/server`.

---

## 6. Abweichungen vom Auftrag und Widerspruch

### 6.1 „Ein Test am gerenderten `App`" geht in diesem Projekt nicht

Der Auftrag sagt: „Prüfe, wie `test/host/` bestehende Tests am gerenderten `App` aufzieht, und
folge dem vorhandenen Weg, statt einen neuen zu erfinden."

**Es gibt keinen solchen Weg.** Nachgesehen und nachgemessen:

- `test/host/upload.test.ts` rendert `Upload` und `Bericht`, nicht `App`, und zwar mit
  `renderToStaticMarkup` aus `react-dom/server`. `App` wird in keinem Test gerendert.
- `renderToStaticMarkup` führt **keine** Effekte aus. Die ganze Verdrahtung lag im
  `useEffect` — ein gerendertes `App` hätte weder eine Leitung noch eine Raumsitzung gehabt.
- `vitest.config.ts` setzt `environment: 'node'`. Es gibt kein DOM, und weder `jsdom` noch
  `happy-dom` noch `@testing-library/react` noch `react-test-renderer` liegen im Baum. Neue
  Abhängigkeiten sind im Auftrag ausgeschlossen, zu Recht.

Umgesetzt ist deshalb die Sache statt des Wortlauts: die Verdrahtung ist aus dem `useEffect`
herausgelöst, damit ein Verhaltenstest sie überhaupt hochfahren kann. Das ist mehr
Produktivcode, als der Auftrag für N3 („je ein Verhaltenstest") vorgesehen hat — ohne diesen
Schritt ist die Zusage aber nicht erreichbar, und ein Test, der sich die Verdrahtung selbst
zusammenstöpselt, bindet genau das nicht, worum es geht. Die Mutation M15 ist der Beleg, dass
der Umbau trägt: sie ist rot, bei `tsc` Exit 0.

Die JSX und das Verhalten der Komponente sind unberührt; `starte`, `advance` und die
Uhr-Schleife rufen dieselben Dinge, nur über den Verweis statt über zwei Refs.

### 6.2 Für B3 ist der Puffer geschlossen worden, nicht nur gebunden

Der Auftrag verlangt „einen Test, der den wirksamen Puffer am laufenden Server misst … rot
wird, wenn der Puffer nach dem Aufbau wieder heruntergesetzt wird."

Ein Test allein kann das für `main.ts` nicht leisten. `main.ts` fährt beim Import den echten
Server hoch, öffnet einen Browser und bindet einen Port; kein Test im Baum rührt die Datei an,
und sie als Prozess zu starten setzte einen vorherigen `npm run build` voraus — ein Test, der
von der Reihenfolge der Tore abhängt, ist ein Falsch-Grün-Erzeuger. Jeder Server, den ein Test
selbst baut, ist nicht der Server aus `main.ts`.

Deshalb der Umzug: die Maße stehen jetzt an einer Stelle, die ein Test wirklich hochfahren kann,
und `main.ts` reicht den Server nur noch durch. Dass es dort danach kein `io` mehr gibt, ist
kein Nebeneffekt, sondern der Punkt — M25 lässt sich dort nicht mehr schreiben (TS2304). Was
bliebe, wäre ein zweiter `new Server(…)` in `main.ts`; dagegen steht die verbliebene
Textzusage `not.toContain('new Server(')`. Die nenne ich ausdrücklich als das, was sie ist:
ein Textwächter, der das letzte Restloch deckt. Ganz zu schließen wäre es nur, indem `main.ts`
den HTTP-Server gar nicht mehr selbst in der Hand hält — das ist ein eigenes Paket und
ausdrücklich nicht diese Welle.

`MAX_SOCKET_MESSAGE_BYTES = 6_065_536` ist unangetastet. Der neue Test rechnet nicht mit der
Zahl, er misst gegen sie.

### 6.3 Die Zusicherung aus dem N1-Ruling gilt nicht in voller Breite — und ich habe sie nicht erzwungen

Das Ruling lautet: „Nach deiner Welle darf **keine** Eingabe ein Markierungszeichen im
sichtbaren Label hinterlassen." Für die Häkchenklasse (`✅ ✔ ✓ ☑`) und die leeren Kästen
(`☐ ❌ ✗`) gilt das jetzt — vorn in beliebiger Zahl, hinten in beliebiger Zahl, in beiden
Türen. Für **zwei** Formen gilt es nicht, und beide sind älter als diese Welle:

```
'F? | 20\n* Venus\nMerkur [x]'   -> ok=true  labels=["Venus","Merkur [x]"]
'F? | 20\n* Venus\nMerkur [X]'   -> ok=true  labels=["Venus","Merkur [X]"]
'F? | 20\n* Merkur ✅ und Venus\nVenus'
                                 -> ok=true  labels=["Merkur ✅ und Venus","Venus"]
```

Der zweite Fall ist der Nebenbefund, den das Nachreview selbst als inhaltlich richtig beurteilt
hat — mitten im Text ist ein Häkchen Text. Der **erste** ist neu gemessen und wiegt schwerer:
`[x]` am Zeilenende gilt nach dem Ruling der fünften Welle ausdrücklich nicht als Markierung
(`MARKIERUNG_ENDE` kennt nur die Häkchen, „`[x]` gehört vor die Antwort"), wird deshalb auch
nicht abgetragen — und steht sichtbar auf der Kachel. Hier markiert es sogar die **falsche**
Antwort: wer `* Venus` und `Merkur [x]` schreibt, bekommt Venus als richtig gewertet und
„Merkur [x]" auf die Leinwand.

Ich habe das **nicht** behoben. Es hieße, ein ausdrückliches Ruling der fünften Welle
umzudrehen, und der Auftrag sagt „Keine neuen Themen". Es gehört dem Nutzer vorgelegt
(Abschnitt 7).

### 6.4 Ein pauschaler Riegel „ok = false, wenn ein Markierungszeichen im Label steht" wäre falsch

Der Vollständigkeit halber, weil das Ruling ihn als zweiten Weg nahelegt: ein solcher Riegel
würde jede Antwort beanstanden, in deren Text ein Häkchen vorkommt — `Merkur ✅ und Venus`
oben, aber auch eine Frage wie „Welches Zeichen bedeutet Zustimmung?" mit der Antwort `✓`. Das
ist Inhalt des Autors, kein Rauschen des Werkzeugs. Der neue Test bindet deshalb die
Zusicherung in der Form, in der sie stimmt: nichts Grünes mit einem Markierungszeichen **am
Anfang** der Beschriftung.

---

## 7. Was dem Nutzer gehört

Drei Punkte, alle gemessen, keiner behoben.

1. **`[x]` am Zeilenende steht sichtbar auf der Kachel — und markiert die falsche Antwort.**
   Messung in 6.3. Zwei Wege: `MARKIERUNG_ENDE` um `\[\s*[xX]\s*\]` erweitern (dann markiert
   `Merkur [x]` wie `Merkur ✅`, und das Ruling der fünften Welle fällt), oder die Form am
   Zeilenende abtragen, ohne zu markieren (wie `LEERKASTEN_ENDE` es mit `☐` tut) — dann bleibt
   das Label sauber und die Frage fällt mit „keine Antwort markiert" auf. Der zweite Weg ändert
   das Ruling nicht, nur seine Folge. **Das ist eine Produktentscheidung.**

2. **Ein langer Markierungslauf mitten in einer Zeile bremst den Parser quadratisch.**
   `MARKIERUNG_ENDE` ist nicht nach vorn verankert; für `Merkur ✅×n Venus` sucht die
   Regex-Maschine von jeder Zeichenstelle aus neu. Selbst gemessen, unverändert vor und nach
   dieser Welle:

   ```
   n=16 000    543 ms
   n=32 000  2 160 ms
   n=64 000  9 007 ms      -> am Dateideckel (n=333 333) rund vier Minuten
   ```

   Der Parser läuft **im Browser des Gastgebers**; vier Minuten heißen dort ein eingefrorener
   Tab ohne Meldung. N1 hat den Fall mit dem Lauf **vorn** nebenbei mitgelöst (dort ist nach
   dem Abtrag nichts mehr zu suchen), der Fall mitten in der Zeile bleibt. Er ist durch diese
   Welle nicht schlechter geworden. Gehört in ein eigenes Paket, zusammen mit der Frage, ob der
   Parser überhaupt eine Zeilenlänge kennen sollte.

3. **Unverändert offen, wie vom Auftrag vorgegeben:** das mehrzeilige Schlusswort fällt weiter
   durch, und der Fluchtweg greift weiter nicht hinter einem Aufzählungszeichen
   (`- \* Venus` → Label `\* Venus`). Beide bestätigt das Nachreview, beide sind hier nicht
   angefasst. Der erste hängt an derselben Wurzel wie N2: der Vorwort-Prüfstein steht jetzt auf
   zwei Beinen (`kannFrageSein` **und** Antwortzahl), der Schlusswort-Prüfstein weiter nur auf
   `antworten.length === 0`.

---

## 8. Was diese Welle nicht geprüft hat

`standalone/quizbude.html` ist **nicht** veröffentlicht und **nicht** im Browser geöffnet
worden. Der Riegel belegt, dass der ausgelieferte Kern-Block aus dem heutigen Kern stammt, und
`test/standalone/kern.test.ts` fährt ihn wirklich aus — das ist keine Aussage über die
Darstellung, das Ablegen einer Datei im echten Browser oder die Lesbarkeit des Prüfberichts auf
der Leinwand.

Ebenso ungeprüft: ein echtes Gasthandy, eine KI-Ausgabe aus einem echten Chatfenster, und der
Start aus dem Explorer. Nichts davon ersetzt einen Spieleabend.

B7, B8, B9 und B11 sind unberührt. An der zweiten Welle (SQLite, Reconnect, Auswertungsseite,
QR-Code) ist nichts angefasst.
