# Review Fragen-Upload — `c344c06..42ade60`

**Prüfer:** frischer Agent, rein lesend · **HEAD bei Beginn und Ende:** `d89a05f` ·
**Arbeitsbaum bei Beginn und Ende:** sauber · **Datum:** 2026-10-21

Das abgebrochene Review hat keinen Bericht hinterlassen; dieses hier ist vollständig neu.
Beide geparkten Proben wurden wiederbelebt, gemessen und restlos entfernt.

---

## 1. Urteil

Der Kern ist sauber gebaut und der Riegel gegen Auseinanderlaufen hält in beide Richtungen —
aber drei Fehler erreichen den Nutzer: ein grüner Prüfbericht kann eine Nutzlast erzeugen, die
der Server stillschweigend verwirft oder die die Verbindung abreißt, nach jeder Ablehnung kann
die Bühne es **nie wieder versuchen**, und eine der häufigsten KI-Schreibweisen (`* ✅ Merkur`)
geht grün durch und schreibt die richtige Antwort sichtbar auf die Leinwand.

| # | Prüfpunkt | Ampel |
|---|---|---|
| 1 | Stiller Abwurf am Transportrand (Titel > 256) | **rot** — Vermutung bestätigt, siehe B4 |
| 2 | Autorisierung am Transportrand | **gelb** — kein Unterschieben möglich, aber der Riegel ist ungebunden (B11) und der Socket-Zustand wird überschrieben (B9) |
| 3 | Escaping in beiden Fassungen | **grün** — mutationsgeprüft, beide Fassungen |
| 4 | Der Riegel `tools/standalone-parser.mjs` | **grün** — hält in beide Richtungen und auch gegen eine vierte Quelldatei; Grenze benannt |
| 5 | Zeilennummern nach entferntem Vorwort/Zaun | **grün** — Vermutung des Auftrags **widerlegt**, gemessen |
| 6 | Oberflächen gebunden oder nur die reinen Funktionen | **gelb** — beide Oberflächen werden wirklich gerendert bzw. ausgeführt, aber das `ok`-Tor ist in **beiden** Fassungen ungebunden (B10) |
| 7 | Probe gegen echte KI-Ausgaben | **rot** — jede Nachsicht einzeln getestet, die Kombination bricht (B1, B5, B6) |
| 8 | Mutationsproben | 10 gefahren, 7 rot, 3 grün (= drei ungebundene Zusagen) |

---

## 2. Befunde

### B1 — blockierend: `* ✅ Merkur` geht grün durch und verrät die Antwort auf der Leinwand

**Belegstelle:** `packages/core/src/questions/parse.ts:373-375` (und `:334` `MARKIERUNG`)

`leseAntwort` entfernt die Markierung **genau einmal** (`rest.replace(MARKIERUNG, '')`, Zeile 375).
Eine zweite Markierung bleibt im Beschriftungstext stehen.

Gemessen:

```
### Stern + Haekchen   Eingabe: 'F? | 20\n* ✅ Merkur\nVenus'
  ok=true labels=["✅ Merkur","Venus"] correctIndex=0
  fehler=[]
```

**Fehlszenario:** Die Anweisung in `KI_ANWEISUNG` verlangt einen Stern vor der richtigen Antwort.
Ein Sprachmodell setzt den Stern **und** zusätzlich ein Häkchen — das ist die häufigste Mischform.
Der Prüfbericht sagt „Alles in Ordnung", die Runde startet, und auf der Kachel steht
„✅ Merkur". Jeder im Raum sieht die richtige Antwort, bevor er tippt. Die Runde ist still
verdorben; nichts meldet etwas.

**Vorschlag:** In `leseAntwort` die Markierung in einer Schleife abtragen, solange `MARKIERUNG`
greift, und `BESCHRIFTUNG`/`PUNKT` **vor** dem Markierungstest entfernen statt danach (siehe auch
B6 — dieselbe Wurzel). Eine Falsch-Grün-Probe dazu: eine Antwort, deren Beschriftung nach dem
Parsen noch ein Markierungszeichen enthält, muss rot werden.

### B2 — blockierend: nach einer Ablehnung kann die Bühne nie wieder eröffnen

**Belegstellen:** `apps/host-web/src/session.ts:44` und `:56`, `apps/host-web/src/App.tsx:112-117`
und `:135-139`

`createRoomOnce` setzt `erzeugt = true` beim **Absenden**, nicht beim Zustandekommen des Raums
(`session.ts:46`), und `wunsch` wird nur beim allerersten Aufruf gesetzt (`session.ts:56`,
`if (wunsch === null)`). Jeder weitere Klick ist folgenlos.

Gemessen (Probe gegen `createRoomOnce`, danach entfernt):

```
### gesendet=["erster Versuch"]
```

— bei drei Aufrufen, einer davon nach einer simulierten Wiederverbindung.

**Fehlszenario:** `App.tsx:112-117` behandelt `room:error` ausdrücklich so, dass der Nutzer zurück
auf den Fragen-Bildschirm kommt und etwas ändern kann. Er ändert etwas, klickt „Runde eröffnen",
`starte` setzt `stage` auf `connecting` (`App.tsx:137`) — und `oeffne` schickt nichts. Die Bühne
zeigt „Bühne verbindet sich …" bis zum Neuladen der Seite. Der Fehlerpfad, den dieselbe Welle
eingebaut hat, ist damit in der Praxis tot. Dasselbe trifft jede Wiederverbindung nach B3.

**Widerspruch im Paket:** `test/host/session.test.ts` hält ausdrücklich fest „erzeugt bei jeder
Wiederverbindung und **jedem weiteren Klick** KEINEN zweiten Raum". Diese Zusage und der
`room:error`-Pfad widersprechen sich; eine von beiden ist falsch.

**Vorschlag:** Den Riegel an das eingetroffene `room:created` hängen statt an das Absenden — oder
`createRoomOnce` einen ausdrücklichen Rücksetzer geben, den der `room:error`-Zweig ruft. `wunsch`
bei jedem Aufruf überschreiben, sonst ginge beim Nachreichen die korrigierte Fassung verloren.

### B3 — blockierend: eine erlaubte Datei reißt die Verbindung ab, ohne ein Wort

**Belegstellen:** `packages/core/src/questions/parse.ts:40` (`MAX_UPLOAD_BYTES = 1_000_000`) gegen
`packages/server/src/main.ts:34-39` (kein `maxHttpBufferSize`, Vorgabe von Socket.IO ist 1e6 Bytes)

Gemessen, laufender Server:

```
### Grosse Datei: datei=985088 B (<= 1 000 000 erlaubt), ok=true, draht=1015643 B
  Antwort=KEINE verbunden=false raeume=0
```

**Fehlszenario:** Eine Datei unter dem angekündigten Deckel („Höchstens 1 MB",
`Upload.tsx:208`) wird grün geprüft. Die Nutzlast am Draht ist durch JSON-Gerüst und Escapes
größer als die Datei (hier +3,1 %) und überschreitet die Puffergrenze. Socket.IO trennt die
Verbindung. Der Nutzer sieht keine Meldung, keinen Raumcode, nichts — und wegen B2 hilft auch
die selbsttätige Wiederverbindung nicht.

**Vorschlag:** Die beiden Grenzen aneinander binden: entweder `maxHttpBufferSize` ausdrücklich
über `MAX_UPLOAD_BYTES` plus Gerüstaufschlag setzen, oder `MAX_UPLOAD_BYTES` so weit senken, dass
die serialisierte Nutzlast sicher darunter bleibt. In beiden Fällen gehört ein Test dazu, der die
Nutzlastgröße misst, nicht die Dateigröße.

### B4 — blockierend: ein zu langer Titel wird grün geprüft und dann stillschweigend verworfen

**Belegstellen:** `packages/core/src/questions/parse.ts:440-444` (Titel ohne Längengrenze),
`packages/server/src/transport/socketio/validate.ts:64` (`isShortString(title)`, 256 Zeichen),
`packages/server/src/transport/socketio/gateway.ts:87-88` (`if (msg === null) return;`)

Die Vermutung des Auftrags ist **bestätigt**. Gemessen:

```
### Titel 300 am Draht: Antwort=KEINE verbunden=true raeume=0
### Titel 300: bericht.ok=true titelLaenge=300 parseClientMessage=null
```

**Fehlszenario:** `# <300 Zeichen>` als Titelzeile. Der Prüfbericht sagt „Alles in Ordnung", der
Knopf ist frei, der Klick erzeugt **weder** `room:created` **noch** `room:error`. Die Bühne
hängt in `connecting`. Dass der Transportrand hier schweigt, ist beabsichtigt und getestet
(`test/server/uploadedQuiz.test.ts:108-125`) — der Fehler ist, dass die Bühne überhaupt eine
Nutzlast erzeugen kann, die dort durchfällt.

**Vorschlag:** Die Titelgrenze im Parser durchsetzen, als Fehler mit Zeilennummer im
Prüfbericht, gegen dieselbe Konstante wie am Transportrand. Dann ist der Fall sichtbar, bevor
irgendetwas gesendet wird.

### B5 — sollte: Vorwort plus Titelzeile macht aus dem Titel eine kaputte Frage

**Belegstellen:** `packages/core/src/questions/parse.ts:440` (`titelErlaubt && text.startsWith('#')`)
und `:447-448` (`if (aktuell === null) { titelErlaubt = false;`)

Gemessen:

```
### Titel allein       ok=true  titel="Abendrunde" prompts=["F?"]
### Vorwort allein     ok=true  titel="Quizbude"   prompts=["F?"]
### Vorwort + Titel    ok=false titel="Quizbude"   prompts=["# Abendrunde","F?"]
  fehler=[{"zeile":3,"Diese Frage hat keine Antwort. Es muessen zwei bis vier sein."},
          {"zeile":3,"keine Antwort markiert, genau eine muss es sein."}]
```

**Fehlszenario:** Die typische KI-Antwort beginnt mit „Klar! Hier sind deine Fragen:" und darunter
`# Abendrunde`. Das Vorwort wird zwar als Beiwerk erkannt — aber es hat vorher `titelErlaubt` auf
`false` gesetzt, also wird die Titelzeile als Fragetext gelesen, bleibt ohne Antworten und
erzeugt zwei Fehler. Der Nutzer liest „Diese Frage hat keine Antwort" über einer Zeile, die gar
keine Frage ist. Jede Nachsicht für sich funktioniert; die Kombination bricht.

**Vorschlag:** `titelErlaubt` erst dann aufgeben, wenn ein Block mit Antworten erkannt wurde —
oder die Titelerkennung auf jeden alleinstehenden `#`-Block anwenden, unabhängig von der
Position.

### B6 — sollte: `A) ✅ Merkur` und `- ✅ Merkur` verlieren die Markierung

**Belegstelle:** `packages/core/src/questions/parse.ts:373-384` — `istMarkiert(rest)` prüft die
rohe Zeile, `BESCHRIFTUNG` und `PUNKT` werden erst danach entfernt (Zeilen 381, 384).

Gemessen:

```
### Beschriftung + Haekchen   'F? | 20\nA) ✅ Merkur\nB) Venus'
  ok=false labels=["✅ Merkur","Venus"]
  fehler=[{"zeile":1,"keine Antwort markiert, genau eine muss es sein. Setz ein * vor die richtige."}]
### Punkt + Haekchen          'F? | 20\n- ✅ Merkur\n- Venus'   → dasselbe
### Haekchen am Zeilenende    'F? | 20\nMerkur ✅\nVenus'       → dasselbe
```

**Fehlszenario:** Der Nutzer hat die richtige Antwort markiert, bekommt aber „keine Antwort
markiert … Setz ein * vor die richtige" zu lesen, und das Häkchen bleibt zusätzlich im
Antworttext stehen. `test/core/parse.test.ts:109-131` prüft `A)`-Beschriftungen und Häkchen
**einzeln**; die Kombination ist nirgends geprüft — und genau sie kommt in echten KI-Ausgaben vor
(`docs/proben-abbruch/probe-parser-ki-ausgaben.ts.txt`, erster Fall).

**Vorschlag:** siehe B1 — Reihenfolge umdrehen und wiederholt abtragen. Ein Test, der die
Nachsichten **kreuzt** statt sie aufzuzählen.

### B7 — sollte: `loadQuestion` lässt Zahl und Erklärung ohne Obergrenze durch

**Belegstellen:** `packages/core/src/questions/load.ts:53-61` (`timeLimitMs`, `pointsFactor` nur
„positiv und endlich"), `packages/core/src/questions/singleChoice.ts:58` (`explanation` beliebig
lang), dazu der Verweis in `validate.ts:52-59`, der die inhaltliche Prüfung ausdrücklich an core
abgibt.

Gemessen:

```
### Rand  timeLimitMs=9007199254740991 pointsFactor=1e+308 explanationLaenge=500000
### Antwortzeit 9e15 ms angenommen: 6VFPVR / 1 Frage(n)
```

**Fehlszenario:** Der Parser deckelt die Antwortzeit auf 5..300 s, aber die Grenze steht nur im
Parser. Eine handgebaute Nutzlast kommt mit `timeLimitMs: 9e15` durch bis in den Raum; `validate.ts`
prüft nur Form und Anzahl, `loadQuestion` nur das Vorzeichen. Der Kommentar in `validate.ts:10`
(„Hier wird jede Nachrichtenform vollständig geprüft") trifft für die Zahlen in der Sammlung nicht
zu. Keine laufende Last gemessen (CPU 0 ms in 2 s) — der Schaden ist eine Runde, die nicht
weitergeht, nicht ein brennender Server.

**Vorschlag:** `timeLimitMs` in `loadQuestion` gegen `MAX_ANSWER_SECONDS * 1000` prüfen und die
Erklärungslänge in `parseSpec` deckeln. Dann gilt die Grenze an der einen Tür, nicht nur im Parser
davor.

### B8 — sollte: `host:create` ohne Deckel, Räume werden nie freigegeben

**Belegstellen:** `packages/server/src/transport/socketio/gateway.ts:105-171` (kein Zähler, keine
Bindung an den Socket), `packages/server/src/runtime/roomRegistry.ts:20` (`remove` existiert und
wird **nirgends** gerufen — `grep -rn "\.remove("` über `packages/`, `apps/`, `test/` ergibt keinen
Treffer)

Gemessen:

```
### 300x host:create von EINEM Socket: raeume=300 in 807 ms, Speicher=17 MB
```

**Fehlszenario:** Die Registry war schon vorher ohne Aufräumen, aber bis zu dieser Welle kostete
ein Raum ein festes Demo-Quiz. Jetzt trägt jeder Raum bis zu knapp 1 MB fremden Inhalt, und jedes
verbundene Gerät darf beliebig viele anlegen. Im Heimnetz ist das kein Angriffsszenario, wohl aber
ein Speicherleck über einen langen Spieleabend.

**Vorschlag:** Räume beim Trennen des Gastgebers freigeben (`remove` endlich rufen) und
höchstens einen Raum je Socket zulassen. Letzteres löst B9 gleich mit.

### B9 — Hinweis: `host:create` überschreibt die Raumbindung eines Spieler-Sockets

**Belegstelle:** `packages/server/src/transport/socketio/gateway.ts:152-154`

`st.roomCode = code` wird gesetzt, ohne zu prüfen, ob der Socket bereits als Spieler in einem
anderen Raum hängt; `st.playerId` zeigt danach weiter auf den **alten** Raum. Der
`disconnect`-Zweig (`gateway.ts:58-67`) sucht die Spielerkennung dann im **neuen** Raum und findet
nichts.

Gemessen:

```
### Spieler als Gastgeber: eigenerRaum=F6296S titel=Mallorys Runde raeume=2
  alter Raum nachher=1 zustand=Mallory:true     (nach spieler.close(), 500 ms gewartet)
```

**Fehlszenario:** Ein Gerät tritt einer Runde bei und schickt danach selbst `host:create`.
Verschwindet es, erfährt die alte Runde nichts: der Name bleibt als verbunden im Namensraster
stehen, und die erwartete Antwortzahl zählt einen Geist mit, der nie antwortet. Braucht einen
gebauten Client — die ausgelieferte Spieler-Oberfläche schickt kein `host:create`.

**Vorschlag:** Beim Anlegen eines Raums eine bestehende Spielerbindung ausdrücklich auflösen
(oder `host:create` von einem Socket mit `playerId` ablehnen).

### B10 — sollte: „erst der Prüfbericht, dann die Lobby" ist in **beiden** Fassungen ungebunden

**Belegstellen:** `apps/host-web/src/Upload.tsx:245` (`disabled={!bericht.ok || !bereit}`),
`standalone/quizbude.html:2698` (`if (geprueft === null || !geprueft.ok){ … return; }`)

Zwei Mutationsproben, beide **grün** bei 276/276 (siehe Tabelle M1, M2): das `ok`-Tor lässt sich
aus beiden Fassungen entfernen, ohne dass ein Test fällt. In der Browser-Fassung ist dieses Tor
der **einzige** — dort steht kein `loadQuestion` dahinter, das eine kaputte Sammlung noch abfinge.
Eine Frage mit `options: []` käme direkt in die Runde.

**Vorschlag:** Je Fassung ein Test, der den Knopf bei `ok=false` gesperrt bzw. den Übernehmen-Pfad
folgenlos sieht. In `Upload.tsx` genügt ein Rendern mit einem fehlerhaften Text und die Zusage,
dass das Markup `disabled` trägt.

### B11 — sollte: der Riegel „nur der Gastgeber schaltet weiter" ist ungebunden

**Belegstelle:** `packages/server/src/transport/socketio/gateway.ts:223`

Mutationsprobe M10: `if (st.roomCode === undefined || st.isHost !== true) return;` zu
`if (st.roomCode === undefined) return;` — **276/276 grün**. Kein Test prüft, dass ein
Spielergerät die Runde nicht starten oder weiterschalten kann.

Die Zeile selbst stammt aus einer früheren Welle und ist heute richtig; zur Frage des Auftrags
(„kann ein Spielergerät der Bühne ein Quiz unterschieben?") lautet die gemessene Antwort **nein** —
`host:create` legt immer einen **neuen** Raum an, in einen bestehenden Raum kommt kein fremder
Inhalt. Aber der einzige Riegel, der das trägt, ist durch nichts abgesichert.

**Vorschlag:** Ein Verhaltenstest am Harness: ein beigetretener Spieler schickt `host:start`, die
Phase bleibt `LOBBY`.

### B12 — Hinweis: zweite, handgeschriebene Fassung der Escaping-Funktion

**Belegstellen:** `standalone/quizbude.html:2159` (`function esc(s)`) neben der ausgelieferten
`escapeHtml` im Kern-Block (`standalone/quizbude.html:547`, erzeugt aus
`packages/core/src/questions/parse.ts:111`)

Beide Fassungen sind heute zeichengleich, und `esc` ist für `setzeKachel` mutationsgeprüft (M8).
Der Riegel aus `tools/standalone-parser.mjs` deckt `esc` aber nicht ab: wird `escapeHtml` im Kern
einmal verbreitert, zieht `esc` nicht mit, und von den sieben `innerHTML`-Stellen, die `esc`
benutzen, ist nur eine einzige durch einen Test gebunden (M8 machte genau einen Test rot).

**Vorschlag:** In der Seite `const esc = Kern.escapeHtml;` statt einer eigenen Fassung.

---

## 3. Mutationsproben

Alle über Sicherungskopien im Scratchpad gefahren, nie über `git`. Jede Datei danach mit `cmp`
gegen die Kopie geprüft — alle sechs berührten Dateien zeichengleich, `git status --short` leer.

| # | Datei | Mutation | Ergebnis |
|---|---|---|---|
| M1 | `apps/host-web/src/Upload.tsx:245` | `disabled={!bericht.ok \|\| !bereit}` → `disabled={!bereit}` | **grün 276/276** → B10 |
| M2 | `standalone/quizbude.html:2698` | `if (geprueft === null \|\| !geprueft.ok)` → `if (geprueft === null)` | **grün 276/276** → B10 |
| M3 | `packages/core/src/questions/parse.ts:37` | `MAX_QUESTIONS = 200` → `199` | **rot**: `test/standalone/kern.test.ts:86` und `:94` |
| M4 | `standalone/quizbude.html:543` (im Kern-Block, von Hand) | `const MAX_QUESTIONS = 200;` → `150` | **rot**: `test/standalone/kern.test.ts:86` und `:94` |
| M5 | `packages/core/src/questions/parse.ts` (vierte Quelldatei) | `import { identityIndices } from '../rng.js'` und Aufruf in `siehtNachJsonAus`, danach `--schreiben` | **rot**: `kern.test.ts:112`, `:121`, `:138` (ReferenceError im ausgelieferten Block) |
| M6 | `packages/server/src/transport/socketio/validate.ts:64` | `isShortString(title)` → `typeof title !== 'string'` | **rot**: `test/server/validate.test.ts:104` |
| M7 | `packages/server/src/uploadedQuiz.ts:38` | `loadQuestion(raw, registry)` → `raw as LoadedQuestion` | **rot**: `test/server/uploadedQuiz.test.ts:38` und `:100` |
| M8 | `packages/server/src/transport/socketio/gateway.ts:113` | `loadUploadedQuiz(msg.quiz, …)` → `loadDemoQuiz(…)` | **rot**: `test/server/uploadedQuiz.test.ts:75` und `:100` |
| M9 | `standalone/quizbude.html:2160` | `esc` gibt die Eingabe unverändert zurück | **rot**: `kern.test.ts:227` (genau ein Test) |
| M10 | `apps/host-web/src/Upload.tsx:39` | `<dd>{bericht.titel}</dd>` → `dangerouslySetInnerHTML` | **rot**: `test/host/upload.test.ts:77` |
| M11 | `packages/server/src/transport/socketio/gateway.ts:223` | `st.isHost !== true` entfernt | **grün 276/276** → B11 |

**Was ich nicht mutieren konnte, und warum:**

- **B2 (Wiederholung nach `room:error`).** Es gibt keinen Test, den eine Mutation rot machen
  könnte — `test/host/session.test.ts` hält das Gegenteil als Zusage fest. Statt einer Mutation
  eine Messung gegen `createRoomOnce` (siehe oben), danach entfernt.
- **B3 (Dateideckel gegen Drahtpuffer).** Kein Test berührt die Nutzlastgröße; es gibt nichts
  zurückzudrehen. Belegt durch die laufende Probe gegen den gebauten Server.
- **B1, B5, B6 (Parser-Kombinationen).** Das sind Fehler, keine gebrochenen Zusagen — es gibt
  keine Zusage, die man zurückdrehen könnte. Belegt durch Messung mit minimalen Eingaben.
- **B7, B8, B9.** Dieselbe Lage: keine Zusage, kein Test, nur Verhalten. Belegt durch die
  wiederbelebten Proben.
- **Alles am Gerät.** Doppelklick aus dem Explorer, Firewall-Dialog, echtes Gasthandy, das
  Ablegen einer Datei im echten Browser, die Darstellung der Browser-Fassung. Nicht prüfbar aus
  der Suite; `standalone/quizbude.html` wurde nicht veröffentlicht.

---

## 4. Was die geparkten Proben gemessen haben

Beide Proben wurden nach `test/` kopiert, auf `.test.ts` enden gelassen, ausgeführt und **restlos
entfernt** (`git status --short` danach leer, mit `cmp`/`ls` geprüft).

### `probe-transportrand.ts.txt` — die heiße Spur

| Probe | Vermutung | Gemessene Wahrheit |
|---|---|---|
| Titel > 256 am Draht | weder `room:created` noch `room:error` | **bestätigt**: `Antwort=KEINE verbunden=true raeume=0` |
| Spielergerät schickt `host:create` | darf es? | **ja** — aber nur ein **eigener** Raum (`raeume=2`), kein Unterschieben. Nebenbefund: der alte Raum sieht den Abgang nicht (`Mallory:true` nach `close()`) → B9 |
| Räume häufen sich an | unbegrenzt? | **bestätigt**: `raeume=300` von einem Socket in 807 ms, 17 MB → B8 |
| Antwortzeit ohne Obergrenze | Last am Server? | `timeLimitMs=9e15` wird angenommen, Raum entsteht — aber **keine Last**: `CPU in 2 s: user=0 ms sys=0 ms`. Die Vermutung „frisst CPU" ist widerlegt; der Befund ist die fehlende Grenze (B7), nicht die Last |
| Nutzlast über 1 MB | ? | **neuer blockierender Befund**: erlaubte Datei (985 088 B, `ok=true`) → Draht 1 015 643 B → `verbunden=false`, keine Meldung → B3 |

### `probe-parser-ki-ausgaben.ts.txt` — Parser gegen echte KI-Ausgabe

- **Der Leitfall fällt.** „Vorwort + Zaun + Nummerierung + `A)` + Fett + Häkchen" ergibt
  `ok=false`, drei Fehler und **drei** statt zwei Fragen — die Titelzeile `# Abendrunde` wird zur
  Frage (B5), und `A) ✅ Merkur` verliert die Markierung (B6). Jede Nachsicht einzeln ist
  getestet und funktioniert; die Kombination nicht.
- **Zeilennummern stimmen.** Die Vermutung des Auftrags ist **widerlegt**: bei Eingabe mit Vorwort
  (Zeile 1), Zaun (Zeile 3) und zwei markierten Antworten (Zeilen 5 und 6) meldet der Parser
  `zeile: 6` und als Hinweise „Zeile 1 … Vorwort" und „Zeile 9 … Schlusswort" — alles Nummern der
  **Originaleingabe**. `parseQuiz` filtert die Zaunzeilen aus einer Liste, die die Nummer bei sich
  trägt (`parse.ts:829-833`), und `trenneBeiwerk` entfernt nur Blöcke. Kein Befund.
- **Mehrzeiliges Vorwort fällt** (zweite Zeile wird zur einzigen Antwort) — Unterfall von B5.
- **JSON im Zaun geht**, JSON im Zaun **mit** Vorwort fällt in das Zeilenformat zurück, weil die
  Erkennung auf dem bereinigten Text ohne Vorwortabzug arbeitet (`parse.ts:856`). Unterfall von B5.
- **Fluchtweg, Grenzfälle 200/201 Zeichen, 4/301 Sekunden, zwei/fünf Antworten, gemischte
  Zeilenenden, typografische Anführung, NBSP** — alle wie dokumentiert.
- **Dauerschätzung** plausibel: 41 s für eine Vierfachfrage, „etwa 6 Minuten" für 5 s + 300 s.
- **Größe:** 200 Fragen à 4,2 kB Erklärung = 861 888 B Datei → 897 243 B Draht, `loadUploadedQuiz`
  in 1 ms. Unter der Grenze also unauffällig — der Bruch liegt dicht darüber (B3).

### Eigene Zusatzprobe: Gesetz 0 für hochgeladene Fragen

Weil der Fragetext jetzt aus fremder Hand kommt, habe ich die wichtigste Zusage des Projekts
eigens gemessen (Probe danach entfernt): Fragetext, Antworttext und Erklärung als eindeutige
Marker durch Upload → Raum → Spielergerät.

```
### Spielergeraet sah 3 Nachrichten
  Fragetext enthalten: false
  Antworttext enthalten: false
  Erklaerung enthalten: false
  Arten: player:joined, player:question_prepared, player:answer_rejected
```

Das Gesetz hält auch für hochgeladene Inhalte. (Die REVEAL-Phase wurde dabei nicht erreicht — das
Lesefenster war noch offen; für die Aufklärung trägt weiterhin
`test/core/audience.test.ts:174-178`.)

---

## 5. Nachgemessene Tore

Selbst gefahren, nach Rücknahme aller Mutationen und Proben, wörtlich:

```
npm test
 Test Files  26 passed (26)
      Tests  276 passed (276)

npx tsc --noEmit
tsc exit=0

npm run build
build exit=0

git status --short
(leer — 0 Zeilen)

git log --oneline -1
d89a05f docs: Haltepunkt und die unfertigen Proben des abgebrochenen Reviews
```

Die Ausgangszahlen des Auftrags (276/26, Exit 0, Exit 0, sauber) sind damit bestätigt und
wiederhergestellt. `docs/proben-abbruch/` ist unberührt (zwei Dateien, unverändert).

**Konventionen:** Es gibt keine Repo-`CLAUDE.md`. Die globale `C:\Users\nikol\CLAUDE.md` regelt
Orchestrierung, nicht Produktivcode — kein wörtlich zitierbarer Verstoß durch diesen Diff.

---

## 6. Folgeaufgaben außerhalb dieses Pakets

1. **`RoomRegistry.remove` ist toter Code** (`packages/server/src/runtime/roomRegistry.ts:20`,
   kein einziger Aufrufer im ganzen Baum). Stammt aus einer früheren Welle; gehört zur
   Aufräum-/Reconnect-Arbeit der zweiten Welle.
2. **Kein Test bindet die Gastgeber-Autorisierung** (B11) — die Zeile ist älter als dieser Diff,
   die Lücke gehört in das nächste Transport-Paket.
3. **Veröffentlichung von `standalone/quizbude.html`** erst nach B1 und B10: die Browser-Fassung
   hat kein `loadQuestion` hinter dem `ok`-Tor, und B1 verrät dort genauso die Antwort.
4. **Zweite Welle unberührt** (SQLite, Reconnect, Auswertungsseite, QR-Code) — nicht geprüft,
   ausdrücklich außerhalb des Auftrags.

## 7. Restrisiken und Test-Lücken

- Die Oberflächen sind **gerendert** gebunden, aber nur im guten Fall. Weder die gesperrte
  Schaltfläche noch der Weg zurück nach `room:error` noch die Dateigrößen-Meldung hat einen Test.
- Von sieben `innerHTML`-Stellen der Browser-Fassung, die Fremdeingabe tragen, ist eine einzige
  mutationsgeprüft. Eine neue Ausgabestelle ohne `esc` fiele heute niemandem auf.
- Der Riegel aus `tools/standalone-parser.mjs` deckt den **Parser** ab, nicht die Oberflächen.
  Laufen `Upload.tsx` und der Editor der Seite fachlich auseinander, meldet das nichts — das ist
  so gebaut, bleibt aber die größte offene Flanke der Zwei-Fassungen-Konstruktion.
- Nichts davon ersetzt einen echten Spieleabend: das Ablegen einer Datei im Browser, eine
  KI-Ausgabe aus einem echten Chatfenster und die Frage, ob der Prüfbericht auf der Leinwand
  lesbar ist, bleiben ungeprüft.
