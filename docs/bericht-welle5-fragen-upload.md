# Fix-Welle 5 — Befunde des Reviews zum Fragen-Upload

**Umsetzer:** ein Agent · **Ausgangs-HEAD:** `d89a05f` · **End-HEAD:** `c05b2c9` ·
**Branch:** `durchstich` · **Datum:** 2026-10-21

Behoben sind B1, B2, B3, B4, B5, B6, B10 und B12 aus `docs/review-fragen-upload.md`.
B7, B8, B9 und B11 sind ausdrücklich nicht Teil dieses Pakets und unberührt.

26 Mutationsproben gefahren, 24 rot, zwei grün: eine Leerprobe (die grün
bleiben soll) und eine, die eine tote Zeile in meinem eigenen ersten Entwurf
entlarvt hat (Abschnitt 5.1). Eine der 24 roten war beim ersten Durchgang
grün — ein Falsch-Grün in meinen eigenen neuen Tests, das daraufhin
geschlossen wurde (Abschnitt B2). Jede Probe ist zurückgenommen und die
berührte Datei mit `cmp` als zeichengleich belegt.

Sieben Commits, einer je Befund beziehungsweise je zusammengehöriger Gruppe:

```
e72eac3 fix: Markierungen gehen weder verloren noch bleiben sie im Text stehen   (B1, B6)
4f8cef9 fix: ein Vorwort nimmt der Titelzeile nicht mehr die Tuer                 (B5)
25e4409 fix: ein zu langer Titel faellt im Pruefbericht auf, nicht erst am Draht  (B4)
c2a5680 fix: der Puffer am Draht traegt jede erlaubte Fragendatei                 (B3)
e2593c2 fix: nach einer Ablehnung kann die Buehne wieder eroeffnen                (B2)
7b1024d test: erst der Pruefbericht, dann die Lobby - in beiden Fassungen gebunden (B10)
c05b2c9 fix: die Seite benutzt das Escaping des Kerns statt einer zweiten Fassung (B12)
```

---

## 1. Je Befund: was geändert wurde und wie es belegt ist

### B1 + B6 — Markierungen gehen verloren oder bleiben im Text stehen

**Geändert:** `packages/core/src/questions/parse.ts`

- `:356-371` — zwei neue Muster: `MARKIERUNG_ENDE` (`✅ ✔ ✓ ☑`, wiederholbar, am
  Zeilenende) und `LEERKASTEN_ENDE` (`☐ ❌ ✗`).
- `:395-455` — `leseAntwort` ist in `leseBeschriftung` zerlegt (`:403` bzw. `:452`). Der Abtrag läuft
  jetzt in einer Schleife, die in jeder Runde erst `BESCHRIFTUNG` und `PUNKT`
  abträgt und danach erst die Markierung prüft; sie endet, wenn nichts mehr
  greift. Danach dieselbe Prüfung am Zeilenende.
- `:757-761` — die JSON-Form benutzt `leseBeschriftung` statt einer eigenen,
  einmaligen Ersetzung.
- `standalone/quizbude.html` — Kern-Block neu geschrieben (`--schreiben`).

**Belegt durch Messung** (gemessene Eingabe → gemessene Ausgabe, Probe danach
entfernt). Vorher/nachher an denselben vier Eingaben des Reviews:

| Eingabe (hinter `F? \| 20`) | vorher | nachher |
|---|---|---|
| `* ✅ Merkur` / `Venus` | `ok=true labels=["✅ Merkur","Venus"]` | `ok=true labels=["Merkur","Venus"] ci=0` |
| `A) ✅ Merkur` / `B) Venus` | `ok=false`, „keine Antwort markiert" | `ok=true labels=["Merkur","Venus"] ci=0` |
| `- ✅ Merkur` / `- Venus` | `ok=false`, „keine Antwort markiert" | `ok=true labels=["Merkur","Venus"] ci=0` |
| `Merkur ✅` / `Venus` | `ok=false`, „keine Antwort markiert" | `ok=true labels=["Merkur","Venus"] ci=0` |

Dazu gemessen und grün: `**A)** ✅ **Merkur**`, `- A) ✅ Merkur`, `✅✅ Merkur`,
`Merkur ✅✅`, `* Merkur ✅`, `- [x] Merkur` / `- [ ] Venus`, `✔ Merkur` / `Venus ✗`.

**Ruling 3 gemessen:** `* Merkur` / `Venus *` → `ci=0` (der Stern hinten markiert
nicht), ebenso `Venus +`. `**Merkur**` / `Venus ✅` → `ci=1`.

**Ruling 4 gemessen:** `Merkur ☐` / `Venus ☐` → `ok=false`, „keine Antwort
markiert", `labels=["Merkur","Venus"]` — der leere Kasten markiert nicht und
steht auch nicht mehr auf der Kachel. Dasselbe für `❌` und `✗`.

**Ruling 5 (Fluchtweg) gemessen:** `* Merkur` / `\* Venus` → `labels=["Merkur","*
Venus"]`, und `*\* Merkur` / `Venus` → `labels=["* Merkur","Venus"] ci=0`. Beides
unverändert gegenüber vorher; gebunden in
`test/core/parse.test.ts` („der Fluchtweg ueberlebt die neue Reihenfolge").

**Tests:** `test/core/parse.test.ts`, neuer Block „Die Nachsichten gekreuzt, nicht
aufgezaehlt (B1/B6)" — sieben Tests. Die Nachsichten werden **gekreuzt**: elf
Mischformen laufen durch dieselbe Zusicherung.

**Falsch-Grün-Probe:** „kein Markierungszeichen bleibt in einer Beschriftung
stehen" prüft jede der elf Mischformen gegen
`/[✅✔✓☑☐❌✗]/u` auf **jedem** Label. Der Test fällt auch dann noch, wenn die
erwarteten Wörter (`Merkur`, `Venus`) einmal angepasst werden — er bindet den
Schaden (sichtbare Antwort auf der Leinwand), nicht den String.

**Mutationsproben (alle zurückgenommen, `cmp` zeichengleich):**

| Mutation | Ergebnis |
|---|---|
| Schleife auf eine Runde begrenzt (`runde < 1`) | **rot**, 4 Tests |
| `MARKIERUNG_ENDE.test` auf `false` | **rot**, 2 Tests |
| `LEERKASTEN_ENDE.test` auf `false && …` | **rot**, 3 Tests |
| `MARKIERUNG_ENDE` um `\*` und `\+` erweitert | **rot**, 3 Tests |
| Leerprobe (`void 0` eingefügt) | **grün** — wie erwartet |
| Vorab-Abtrag vor der Schleife entfernt | **grün** — die Zeile war tot, siehe Abschnitt 5.1 |

### B2 — nach einer Ablehnung kann die Bühne nie wieder eröffnen

**Geändert:**

- `apps/host-web/src/session.ts:25-33` — neue Schnittstelle `RoomSession<T>` mit
  `oeffne` (`:27`) und `abgelehnt` (`:32`).
- `:79-93` — `oeffne` (`:80`) überschreibt den Wunsch bei **jedem** Aufruf; `abgelehnt`
  löst den Riegel und setzt den Wunsch auf `null`.
- `apps/host-web/src/App.tsx:112-119` — der `room:error`-Zweig ruft
  `oeffne.current?.abgelehnt()` (`:116`); `:54` und `:140` sind an die
  Schnittstelle angepasst.

**Wahl der Lösung und ihre Begründung:** Der Riegel hängt weiterhin am
**Absenden**, nicht am eingetroffenen `room:created`. Hinge er am `room:created`,
wäre der Doppelklick-Schutz genau in dem Zeitfenster offen, in dem er gebraucht
wird — zwischen dem ersten Klick und der ersten Antwort des Servers; zwei schnelle
Klicks erzeugten dann zwei Räume. Gelöst wird der Riegel deshalb nur in dem einen
Fall, in dem sicher kein Raum entstanden ist: der ausdrücklichen Ablehnung.

**Abweichung vom Vorschlag des Reviews, begründet:** `abgelehnt` setzt zusätzlich
`wunsch = null`. Ohne das hätte eine spätere Wiederverbindung die abgelehnte
Sammlung von sich aus ein zweites Mal geschickt — der Nutzer sitzt dann auf dem
Fragen-Bildschirm und bekommt eine Fehlermeldung, die er nicht ausgelöst hat.
Gebunden in „eine Ablehnung schickt von sich aus gar nichts nach".

**Belegt durch Messung:** drei Aufrufe mit Ablehnung dazwischen ergeben
`gesendet=["kaputte-fassung","korrigierte-fassung"]` statt vorher
`gesendet=["erster Versuch"]`.

**Mutationsproben (zurückgenommen, `cmp` zeichengleich):**

| Mutation | Ergebnis |
|---|---|
| `abgelehnt` löst den Riegel nicht (`erzeugt = erzeugt`) | **rot**, 3 Tests |
| Doppelklick-Schutz entfernt (`erzeugt \|\|` weg) | **rot**, 5 Tests (darunter `test/host/wire.test.ts`) |
| `wunsch` wird nicht überschrieben (`if (wunsch === null)`) | zuerst **grün** → siehe unten, dann **rot** |
| `wunsch` bleibt nach Ablehnung stehen | **rot**, 1 Test |
| `App.tsx` ruft `abgelehnt` nicht | **rot**, 1 Test |

Die dritte Mutation war beim ersten Durchgang **grün**: weil `abgelehnt` den
Wunsch ohnehin auf `null` setzt, trug das Überschreiben auf dem Ablehnungspfad
nichts. Tragend ist es auf einem anderen Weg — zwei Klicks, **bevor** die Leitung
steht. Dafür ist der Test „vor der Leitung gewinnt der letzte Zuruf, nicht der
erste" nachgezogen worden; danach ist dieselbe Mutation **rot**. Das war ein
Falsch-Grün in meinen eigenen neuen Tests und ist der Grund, warum die Probe hier
zweimal steht.

### B3 — eine erlaubte Datei reißt die Verbindung ab

**Geändert:**

- `packages/server/src/transport/socketio/validate.ts:31-63` —
  `WIRE_ESCAPE_FACTOR = 6` (`:47`), `WIRE_FRAME_BYTES = 64 * 1024` (`:50`),
  `MAX_SOCKET_MESSAGE_BYTES = MAX_UPLOAD_BYTES * WIRE_ESCAPE_FACTOR + WIRE_FRAME_BYTES`
  (= 6 065 536 B), mit der Herleitung als Kommentar.
- `packages/server/src/main.ts:42` — `maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES`.
  Der Kommentar bei `perMessageDeflate: false` ist unberührt.
- `test/server/harness.ts:41-46` — dasselbe Maß wie in `main.ts`.

`MAX_UPLOAD_BYTES` ist **nicht** gesenkt; „Höchstens 1 MB" bleibt wahr.

**Woher der Faktor kommt — gemessen**, 200 Fragen, Datei 996 906 B, Nutzlast wie
am Draht serialisiert:

```
fuell="a"       datei=996906  draht=1027447  faktor=1.031
fuell="\""      datei=996906  draht=2019247  faktor=2.026
fuell="\\"      datei=996906  draht=2019247  faktor=2.026
fuell="\"\\"    datei=996706  draht=2018847  faktor=2.026
fuell="ä"       datei=996706  draht=1027247  faktor=1.031
fuell="✅"      datei=996906  draht=1027447  faktor=1.031
fuell="\u0001"  datei=996906  draht=5986447  faktor=6.005
```

Sechs ist damit nicht geschätzt, sondern die längste Ersetzung, die JSON kennt:
ein Steuerzeichen wird zu `\uXXXX`, also sechs Zeichen für ein Byte. Zeichen
außerhalb von ASCII wachsen gar nicht — sie stehen in der Datei wie in der
Nachricht als dieselben UTF-8-Bytes.

**Belegt am echten Draht**, nicht nur gerechnet
(`test/server/socketBuffer.test.ts`, „Am echten Draht gemessen"): dieselbe
Nutzlast gegen zwei echte Socket.IO-Server — mit der Vorgabe (1e6)
`getrennt`, mit `MAX_SOCKET_MESSAGE_BYTES` `angekommen`.

**Tests:** `test/server/socketBuffer.test.ts`, sechs Tests. Gemessen wird die
**Nutzlastgröße**, nicht die Dateigröße, über alle sieben Füllungen oben.

**Mutationsproben (zurückgenommen, `cmp` zeichengleich):**

| Mutation | Ergebnis |
|---|---|
| `maxHttpBufferSize` aus `main.ts` entfernt | **rot**, 1 Test |
| `WIRE_ESCAPE_FACTOR` auf 2 | **rot**, 2 Tests |

### B4 — zu langer Titel wird grün geprüft und dann stillschweigend verworfen

**Geändert:**

- `packages/core/src/questions/parse.ts:38-49` — `export const MAX_TITLE_CHARS = 256`
  mit Kommentar, der auf den Transportrand verweist.
- `:541-549` — Durchsetzung im Zeilenformat, als Fehler **mit Zeilennummer**.
- `:830-837` — Durchsetzung im JSON, mit der Zeile des Titels.
- `packages/server/src/transport/socketio/validate.ts:1`, `:76-86`, `:109` —
  `isTitle` prüft gegen dieselbe Konstante aus `@quizbude/core`.

**Wahl zwischen Import und Gleichheitstest, begründet:** Die bestehende
Importrichtung ist bereits `core → server` — `validate.ts:1` importierte schon
`MAX_QUESTIONS` aus `@quizbude/core`. Ein Import verletzt die Schichtung also
nicht, und derselbe Weg trägt. Deshalb Import, nicht Gleichheitstest. Die Zahl
steht jetzt genau einmal im Baum (`grep -rn "256"` über `validate.ts` findet nur
noch `MAX_FIELD_CHARS`, die generische Feldgrenze für Name und Raumcode — die
bleibt, weil sie etwas anderes meint).

**Belegt durch Messung:** `# <300 Zeichen>` ergab vorher `bericht.ok=true` bei
`titelLaenge=300`; jetzt `ok=false`, erster Fehler `zeile=1`, Text „Der Titel hat
300 Zeichen, erlaubt sind 256. Kuerz ihn um 44 Zeichen." Genau 256 Zeichen gehen
durch (`fehler=[]`).

**Tests:** `test/core/parse.test.ts` (drei Tests: zu lang mit Zeilennummer, genau
256, Grenze auch im JSON) und `test/server/validate.test.ts` („nimmt genau den
Titel an, den der Parser gruen prueft (B4)") — der eine Test misst **beide**
Seiten an **einer** Grenze.

**Mutationsproben (zurückgenommen, `cmp` zeichengleich):**

| Mutation | Ergebnis |
|---|---|
| Titelgrenze im Parser entfernt (`if (false)`) | **rot**, 2 Tests, darunter der Transportrand-Test |
| Transportrand nimmt ein Zeichen weniger an | **rot**, 1 Test |

Dass der Transportrand schweigt, ist unverändert; `test/server/uploadedQuiz.test.ts`
ist nicht angefasst.

### B5 — Vorwort plus Titelzeile macht aus dem Titel eine kaputte Frage

**Geändert:** `packages/core/src/questions/parse.ts`

- `:484-496` — neuer Prüfstein `kannFrageSein(b)`: ein Block kann eine Frage
  sein, wenn sein Text wie eine Frage wirkt **oder** eine Antwort markiert ist.
  Derselbe Maßstab entscheidet zweierlei.
- `:509-517` — `schliessen` gibt die Titelzeile nur auf, wenn der geschlossene
  Block eine Frage sein könnte.
- `:525-553` — die Titelzeile prüft zusätzlich den **offenen** Block und
  schließt ihn; ohne das Schließen würde die nächste Frage zur Antwort des
  Vorworts darüber.
- `:604-608` — `trenneBeiwerk` misst das Vorwort an `kannFrageSein` statt an der
  Antwortzahl. Das ist der Unterfall „mehrzeiliges Vorwort".
- `:938-997` — `lesbaresJson` (`:941`) und `jsonNachBeiwerk` (`:967`); `:1030-1034` — die
  JSON-Erkennung läuft auf dem **bereinigten** Text. `parseJson` bekommt weiter
  die ungekürzte Zeilenliste, damit die Zeilennummern stehen bleiben.

**Belegt durch Messung** (Probe danach entfernt):

| Eingabe | vorher | nachher |
|---|---|---|
| Titel allein | `ok=true titel="Abendrunde"` | `ok=true titel="Abendrunde"` |
| Vorwort allein | `ok=true titel="Quizbude"` | `ok=true titel="Quizbude"` |
| **Vorwort + Titel** | `ok=false prompts=["# Abendrunde","F?"]`, 2 Fehler auf Zeile 3 | `ok=true titel="Abendrunde" prompts=["F?"]` |
| Vorwort + Titel ohne Leerzeile | — | `ok=true titel="Abendrunde" prompts=["F?"]` |
| Mehrzeiliges Vorwort | fiel (zweite Zeile wurde Antwort) | `ok=true prompts=["F?"]` |
| Mehrzeiliges Vorwort + Titel | fiel | `ok=true titel="Abendrunde" prompts=["F?"]` |
| JSON im Zaun **mit** Vorwort | fiel ins Zeilenformat | `ok=true quelle=json titel="Abendrunde"` |
| kaputtes JSON mit Vorwort | — | `quelle=zeilen` (bleibt beim Zeilenformat) |
| Überschrift **nach** einer Frage | — | `titel="Quizbude"` (kein Titel mehr) |

**Der Leitfall des Reviews, gemessen** — Vorwort + Code-Zaun + Nummerierung +
`A)`-Beschriftung + Fett im Fragetext + Häkchen als Markierung + Schlusswort, in
einer Eingabe:

```
ok=true quelle=zeilen titel="Abendrunde"
prompts=["Welcher Planet ist der Sonne am naechsten?"]
labels=["Merkur","Venus","Mars"] correctIndex=0 timeLimitMs=20000
hinweise=["Zeile 1: als Vorwort uebersprungen.","Zeile 12: als Schlusswort uebersprungen."]
fehler=[]
```

Der Test fährt zusätzlich `loadQuestion` über jede herausgegebene Frage — der
Parser gibt nichts heraus, was der Kern danach ablehnt.

**Zeilennummern der Originaleingabe, gebunden:** Eingabe mit Vorwort (Zeile 1),
Zaun (Zeile 3) und zwei markierten Antworten (Zeilen 5 und 6) meldet weiterhin
`Zeile 6: 2 Antworten markiert …` und die Hinweise auf Zeile 1 und Zeile 9. Als
eigener Test festgehalten („die Zeilennummern zeigen die Originaleingabe, auch
hinter Vorwort und Zaun").

**Tests:** `test/core/parse.test.ts`, neuer Block „Vorwort und Titelzeile zusammen
(B5)" — sieben Tests.

**Mutationsproben (zurückgenommen, `cmp` zeichengleich):**

| Mutation | Ergebnis |
|---|---|
| Titelzeile fällt bei jedem Block (`kannFrageSein` weg) | **rot**, 3 Tests |
| Überschrift schließt den Block nicht (`schliessen()` weg) | **rot**, 1 Test |
| Vorwort nur ohne Antworten (alte Fassung) | **rot**, 1 Test |
| JSON unter Vorwort nicht erkannt (`alsJson = null`) | **rot**, 1 Test |
| `lesbaresJson` übergangen (jedes Vorwort + Klammer wird JSON) | **rot**, 3 Tests |

### B10 — „erst der Prüfbericht, dann die Lobby" war in beiden Fassungen ungebunden

**Geändert:**

- `apps/host-web/src/Upload.tsx:79-89` — neue, freiwillige Eigenschaft
  `anfangstext`; `:96-99` — sie setzt den Anfangszustand. `:254-258` — ein
  Kommentar am Tor, das selbst unverändert ist (`:262`).
- `test/host/upload.test.ts` — „laesst die Runde erst oeffnen, wenn der
  Pruefbericht gruen ist (B10)", dazu ein Helfer, der **genau** den
  Eröffnen-Knopf aus dem Markup schneidet, statt irgendein `disabled` zu suchen.
  Die bestehende Zusage „wenn die Leitung steht" ist auf denselben Helfer
  umgestellt (Verschärfung, keine Änderung der Zusage).
- `test/standalone/kern.test.ts` — neuer Block „Erst der Pruefbericht, dann die
  Lobby (B10)", drei Tests, dazu `quelleAusSeite` als Ausgliederung aus
  `stueckeAusSeite` (gleicher Quelltext-Schnitt, jetzt auch als Text abrufbar).

**Warum eine Naht in `Upload.tsx` und nicht nur ein Test:** Das Tor hängt am
Zustand der Komponente (`erg` aus `useState`), und der Anfangszustand war fest
`DEMO_TEXT`. Von außen war das Tor damit überhaupt nicht erreichbar — es gibt in
diesem Projekt kein DOM und keine Testbibliothek, nur
`renderToStaticMarkup`. Die Eigenschaft ist bewusst freiwillig und kein
Test-Sonderweg: die Browser-Fassung holt ihren Anfangstext aus demselben Grund
aus dem Speicher des Browsers (`erinnere('quiztext')`), die Bühne kann das später
genauso.

**Kein zusätzlicher Riegel hinter dem Tor.** Verlangt war er nicht, und ich halte
ihn auch nicht für nötig: in der Bühne steht hinter dem Tor noch `loadQuestion`
am Server, und in der Browser-Fassung ist das Tor jetzt an drei Tests gebunden,
in **beide** Richtungen — gesperrt bei `ok=false` **und** frei bei `ok=true`.
Ohne die Gegenrichtung bliebe ein Test auch bei einem immer gesperrten Tor grün.

**Meine eigenen Mutationsproben zu B10** — jede einzeln gefahren, danach die
Datei aus der Sicherungskopie zurückgespielt und mit `cmp` als zeichengleich
belegt:

| # | Datei | Mutation | Ergebnis |
|---|---|---|---|
| M1 | `apps/host-web/src/Upload.tsx` | `disabled={!bericht.ok \|\| !bereit}` → `disabled={!bereit}` | **rot**: `test/host/upload.test.ts` → „laesst die Runde erst oeffnen, wenn der Pruefbericht gruen ist (B10)" |
| M1b | `apps/host-web/src/Upload.tsx` | `disabled={!bericht.ok \|\| !bereit}` → `disabled={!bericht.ok}` | **rot**: „laesst die Runde erst oeffnen, wenn die Leitung steht" — die zweite Hälfte des Tors ist mitgebunden |
| M2 | `standalone/quizbude.html` | `if (geprueft === null \|\| !geprueft.ok)` → `if (geprueft === null)` | **rot**: `test/standalone/kern.test.ts` → „ein Bericht mit Fehlern bleibt folgenlos - kein Quiz, keine Buehne" |
| M2b | `standalone/quizbude.html` | die Torzeile ersatzlos gestrichen | **rot**: zwei Tests desselben Blocks |

Rücknahme belegt:

```
cp $SP/u.ok apps/host-web/src/Upload.tsx && cmp … && echo "zurueckgenommen: zeichengleich"
cp $SP/html.ok standalone/quizbude.html   && cmp … && echo "zurueckgenommen: zeichengleich"
node tools/standalone-parser.mjs → "standalone/quizbude.html ist aktuell."
```

Beide Mutationen waren vor dieser Welle grün bei 276/276 — das ist genau der
Befund, den das Review beschrieben hat.

### B12 — zweite, handgeschriebene Fassung der Escaping-Funktion

**Geändert:** `standalone/quizbude.html:2245-2252` (die Zuweisung auf `:2252`) — `function esc(s){…}` ist
ersetzt durch `const esc = Kern.escapeHtml;` mit Kommentar.

**Name nicht geraten, sondern geprüft:** der Kern-Block gibt `escapeHtml` wirklich
heraus (`standalone/quizbude.html:1312`, `escapeHtml: escapeHtml,`), und der Block
weist seinen Rückgabewert an `const Kern` zu (`:512`). Alle sieben
`esc`-Aufrufstellen stehen in Funktionsrümpfen; der einzige Aufruf auf oberster
Ebene ist `if (typeof document !== 'undefined') boot();` ganz am Dateiende
(`:2944`). `const` wird nicht hochgezogen wie eine Funktionsdeklaration — die
Ladereihenfolge trägt also, und ein Test bindet sie durch einen Indexvergleich.

**Belegt, dass das Umstellen wirkt:** `escapeHtml` im Kern um ein Zeichen
verbreitert (Backtick → `&#96;`), `node tools/standalone-parser.mjs --schreiben`,
dann den ausgelieferten Block und `esc` daraus ausgeführt:

```
### esc("`") = "&#96;"
```

Vorher hätte die handgeschriebene Fassung einen Backtick unverändert
durchgereicht. Beides danach zurückgenommen, `cmp` zeichengleich, Riegel grün.

**Mutationsproben (zurückgenommen, `cmp` zeichengleich):**

| Mutation | Ergebnis |
|---|---|
| eigene Fassung von `esc` wieder eingesetzt | **rot**, 2 Tests (darunter die Kachel-Probe) |
| `esc` als eigene Hülle (`(s) => Kern.escapeHtml(s)`) | **rot**, 1 Test — es muss dieselbe Funktion sein, nicht nur derselbe Name |

---

## 2. Geänderte Alt-Zusagen, jede einzeln begründet

**Genau eine Alt-Zusage ist geändert.** `git diff d89a05f..HEAD -- test/ | grep "^-  it("`
liefert genau eine Zeile:

```
-  it('erzeugt bei jeder Wiederverbindung und jedem weiteren Klick KEINEN zweiten Raum', () => {
```

**Zusage:** `test/host/session.test.ts` — „erzeugt bei jeder Wiederverbindung und
jedem weiteren Klick KEINEN zweiten Raum".

**Warum sie falsch war:** Sie widersprach dem `room:error`-Pfad, den dieselbe
Welle eingebaut hat. `App.tsx:112-117` schickt den Nutzer nach einer Ablehnung
ausdrücklich zurück auf den Fragen-Bildschirm, damit er etwas ändern kann — und
genau dieser Klick war durch die Zusage verboten. Eine von beiden musste falsch
sein; falsch war die Zusage, denn der Fehlerpfad ist das, was der Nutzer braucht.

**Wodurch sie ersetzt ist** — die Zusage ist in ihre Teile zerlegt, jeder Teil
einzeln gebunden:

1. „zwei schnelle Klicks vor der ersten Antwort erzeugen nur einen Raum"
2. „eine Wiederverbindung erzeugt keinen zweiten Raum"
3. „nach einer Ablehnung geht ein neuer Versuch - mit der korrigierten Fassung"
4. „eine Ablehnung schickt von sich aus gar nichts nach"
5. „nach der Ablehnung gilt der Doppelklick-Schutz wieder"
6. „vor der Leitung gewinnt der letzte Zuruf, nicht der erste"

Der Doppelklick-Schutz ist damit nicht schwächer, sondern an zwei Stellen
gebunden (1 und 5), und zusätzlich weiter über den Verhaltenstest
`test/host/wire.test.ts` („schickt ueber eine ganze Sitzung genau ein
host:create - auch nach vier Wiederverbindungen"), der nur in der Schreibweise
angepasst ist.

**Keine weiteren Zusagen geändert.** In `test/host/upload.test.ts` ist „laesst die
Runde erst oeffnen, wenn die Leitung steht" **verschärft** (prüft jetzt genau den
Eröffnen-Knopf statt irgendein `disabled` im Markup) — dieselbe Zusage, engerer
Griff. In `test/host/wire.test.ts` und `test/standalone/kern.test.ts` sind nur
Aufrufschreibweisen beziehungsweise ein Helfer angepasst.

---

## 3. Nachgemessene Tore, wörtlich

Selbst gefahren nach dem letzten Commit, nach Rücknahme aller Mutationen und
Proben:

```
npm test
 Test Files  27 passed (27)
      Tests  309 passed (309)

npx tsc --noEmit
tsc exit=0

npm run build
build exit=0

node tools/standalone-parser.mjs
[quizbude] standalone/quizbude.html ist aktuell.
riegel exit=0

git status --short
?? docs/review-fragen-upload.md
(sonst leer - die eine unverfolgte Datei ist der Reviewbericht, nicht von mir)

git log --oneline d89a05f..HEAD
c05b2c9 fix: die Seite benutzt das Escaping des Kerns statt einer zweiten Fassung
7b1024d test: erst der Pruefbericht, dann die Lobby - in beiden Fassungen gebunden
e2593c2 fix: nach einer Ablehnung kann die Buehne wieder eroeffnen
c2a5680 fix: der Puffer am Draht traegt jede erlaubte Fragendatei
25e4409 fix: ein zu langer Titel faellt im Pruefbericht auf, nicht erst am Draht
4f8cef9 fix: ein Vorwort nimmt der Titelzeile nicht mehr die Tuer
e72eac3 fix: Markierungen gehen weder verloren noch bleiben sie im Text stehen
```

**309 statt 276:** 275 der 276 Alttests sind unverändert grün, einer ist die
ausdrücklich korrigierte Zusage aus B2 (Abschnitt 2), und 34 Tests sind neu.

**Ladebudget**, von `vite build` selbst gemeldet (dieselbe Messung wie in
`docs/STAND.md`), Spielergerät:

```
dist/index.html                 0.50 kB │ gzip:  0.31 kB
dist/assets/index-BEQfTrYX.css  3.83 kB │ gzip:  1.32 kB
dist/assets/index-VGdzwLjJ.js 193.59 kB │ gzip: 61.82 kB
```

**63,45 kB gzip** für den gesamten kritischen Pfad — **unverändert** gegenüber dem
Ausgangsstand, 1,55 kB unter dem Budget von 65 kB. Das Budget ist nicht gerissen.
Der Grund für die Unveränderlichkeit ist nachgesehen und nicht vermutet: der
Parser steckt gar nicht im Spielerbündel
(`grep -c "keine Antwort markiert" apps/player-web/dist/assets/*.js` → `0`).
Gewachsen ist die Bühne (`apps/host-web`, von `vite build` gemeldet:
0,28 + 1,97 + 68,09 = 70,34 kB gzip) und die Browser-Fassung
(`standalone/quizbude.html`, 30,60 kB gzip, 117 537 B roh); für beide gilt
das Budget der Beitrittsseite nicht — es meint die Seite, die der Gast auf
sein Telefon lädt.

**Gesetz 0 auf dem Upload-Pfad, eigens nachgemessen** (Probe danach entfernt,
`git status --short` sauber): Fragetext, Antworttext, Erklärung und Titel als
eindeutige Marker durch Upload → Raum → Spielergerät.

```
### Spielergeraet sah 3 Nachrichten
    Arten: player:joined, player:question_prepared, player:answer_rejected
    Fragetext enthalten: false
    Antworttext enthalten: false
    Erklaerung enthalten: false
    Titel enthalten: false
```

Das Gesetz hält auch nach dieser Welle. Wie beim Review wurde die REVEAL-Phase
dabei nicht erreicht — das Lesefenster war noch offen; für die Aufklärung trägt
weiterhin `test/core/audience.test.ts`.

---

## 4. Was ich nicht behoben habe, und warum

**Ausdrücklich außerhalb des Pakets, unberührt:** B7 (keine Obergrenze für
`timeLimitMs`, `pointsFactor`, `explanation` in `load.ts`/`singleChoice.ts`), B8
(kein Deckel für `host:create`, Räume werden nicht freigegeben), B9
(Spielerbindung wird beim Anlegen eines Raums überschrieben), B11 (kein Test für
`st.isHost !== true`). `RoomRegistry.remove` bleibt toter Code. An der zweiten
Welle (SQLite, Reconnect, Auswertungsseite, QR-Code) ist nichts gemacht.
`docs/review-fragen-upload.md`, `docs/HALTEPUNKT.md` und `docs/proben-abbruch/`
sind unverändert. `standalone/quizbude.html` ist **nicht** veröffentlicht.

### Neue Folgeaufgaben, gemessen statt vermutet

1. **Ein mehrzeiliges Schlusswort fällt weiterhin.** Derselbe Fehlertyp wie der
   Unterfall von B5, aber am anderen Ende — und im Auftrag war ausdrücklich nur
   das Vorwort genannt. Gemessen:

   ```
   Eingabe: 'F? | 20\n* A\nB\n\nViel Spass beim Quiz!\nSag Bescheid, wenn du mehr willst.'
   → ok=false fragen=2 hinweise=[]
     fehler=["5:Diese Frage hat nur eine Antwort. …","5:keine Antwort markiert, …"]
   ```

   Einzeilig geht es (`hinweise=["Zeile 5: als Schlusswort uebersprungen."]`). Die
   Behebung ist eine Zeile: `trenneBeiwerk` misst das Schlusswort noch an
   `antworten.length === 0` statt an `kannFrageSein` — der Prüfstein liegt seit
   dieser Welle daneben. Ich habe es bewusst nicht mitgenommen, weil der Auftrag
   nur das Vorwort nennt und der Diff prüfbar bleiben soll.

2. **Der Fluchtweg greift nicht hinter einem Aufzählungszeichen.** Gemessen:

   ```
   'F? | 20\n* Merkur\n- \* Venus'   → labels=["Merkur","\\* Venus"]
   'F? | 20\n* Merkur\nB) \* Venus'  → labels=["Merkur","\\* Venus"]
   ```

   Der umgekehrte Schrägstrich bleibt im Antworttext stehen und landet so auf der
   Kachel. Das ist **nicht** durch meine Umstellung entstanden — vorher war das
   Ergebnis dasselbe, nachgemessen und als Test festgehalten (`der Fluchtweg
   ueberlebt die neue Reihenfolge` bindet die beiden Fälle des Auftrags). Die
   Behebung wären drei Zeilen: `fluchtweg` nach dem Abtrag von `BESCHRIFTUNG`
   und `PUNKT` noch einmal prüfen. Außerhalb des Pakets gelassen.

3. **Steuerzeichen kommen unverändert durch den Parser.** `'F\u0001? | 20\n* A\nB'`
   → `ok=true`. Das ist der Grund, warum `WIRE_ESCAPE_FACTOR` bei sechs stehen
   muss statt bei zwei: ein Byte wird beim Escapen zu `\uXXXX`. Würde der Parser
   Steuerzeichen ablehnen oder ersetzen — fachlich sinnvoll, sie gehören in
   keinen Fragetext —, ließe sich der Puffer auf rund ein Drittel senken
   (2 MB statt 6 MB). Das gehört zur Familie von B7 (Inhaltsgrenzen in
   `load.ts`/`parseSpec`) und ausdrücklich nicht in dieses Paket.

4. **`MAX_SOCKET_MESSAGE_BYTES` ist großzügig, und B8 ist offen.** 6 065 536 B je
   Nachricht heißt: ein verbundenes Gerät darf Nachrichten dieser Größe schicken,
   so oft es will. Im Heimnetz ist das kein Angriffsszenario, zusammen mit dem
   fehlenden Deckel für `host:create` (B8) und dem fehlenden Freigeben von Räumen
   ist es aber derselbe Topf. Wer B8 angeht, sollte 3 mitnehmen.

5. **`main.ts` bleibt nur durch einen Quelltext-Wächter gebunden.** Der neue Test
   liest `main.ts` und prüft, dass `maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES`
   dort steht. Das ist ein Wächter über Text, kein Verhaltenstest — genau die
   Bauart, die in diesem Projekt schon zweimal eine Lücke gegen eine andere
   getauscht hat. Das Verhalten selbst ist gebunden (zwei echte Socket.IO-Server,
   Abschnitt B3), nur die Verdrahtung nicht. Sauber lösen ließe sich das, indem
   die Socket.IO-Optionen wie die Startentscheidungen nach
   `runtime/startup.ts` wandern und `main.ts` sie nur noch durchreicht. Das ist
   ein eigenes Paket.

---

## 5. Begründete Abweichungen vom Auftrag

1. **„`BESCHRIFTUNG` und `PUNKT` vor dem Markierungstest abtragen" und „die
   Markierung wiederholt abtragen" sind ein und dieselbe Maßnahme, sobald man
   schleift.** Ich habe zuerst beides getrennt gebaut: einen Vorab-Abtrag vor der
   Schleife und die Schleife dahinter. Die Mutationsprobe „Vorab-Abtrag entfernt"
   blieb dabei **grün** — die Schleife trägt die Beschriftung in der nächsten
   Runde ohnehin ab. Der Vorab-Abtrag war also toter Code, den kein Test bindet,
   und solche Zeilen sind genau das, was ein Review zu Recht anstreicht.
   Umgesetzt ist deshalb eine Schleife, die **in jeder Runde** erst die
   Schreibweise abträgt und danach erst die Markierung prüft. Die Reihenfolge
   steht damit so da, wie Ruling 1 sie verlangt, ist aber nicht mehr tragend —
   tragend ist, dass jede Runde beides abträgt und die Schleife läuft, bis nichts
   mehr greift. Eine Mutation, die die Reihenfolge **innerhalb** der Schleife
   umdreht, wird folglich von keinem Test rot gemacht; das ist kein ungebundener
   Riegel, sondern eine stärkere Eigenschaft als die verlangte.

2. **Leere Kästen werden am Zeilenende abgetragen, obwohl sie nicht markieren.**
   Ruling 4 verlangt, dass `[ ]`, `☐`, `❌`, `✗` keine Markierung sind — auch
   nicht am Zeilenende. Das ist so umgesetzt. Zusätzlich trage ich `☐ ❌ ✗` am
   Zeilenende **ab**, ohne etwas zu markieren. Grund: ohne das stünde
   `Venus ❌` so auf der Kachel und verriete, welche Antwort falsch ist — derselbe
   Schaden wie B1, nur mit umgekehrtem Vorzeichen. Die Semantik („keine
   Markierung") bleibt dabei unangetastet und ist eigens gebunden
   (`ein leerer Kasten markiert auch am Zeilenende nicht` prüft, dass der Bericht
   „keine Antwort markiert" meldet). `[x]` und `[ ]` in Klammerform werden am
   Zeilenende **nicht** angefasst — dort nennt der Auftrag `[x]` ausdrücklich als
   Nicht-Markierung, und eine Sammlung mit `Merkur [x]` fällt ohnehin mit
   „keine Antwort markiert" auf.

3. **`abgelehnt()` setzt zusätzlich `wunsch = null`** (siehe B2). Ohne das
   schickte eine spätere Wiederverbindung die abgelehnte Sammlung von selbst noch
   einmal.

4. **Die Konstante für B3 steht in `validate.ts`, nicht in `main.ts`.** Der
   Auftrag sagt „gelöst wird das in `main.ts`" und „der Aufschlag gehört als
   benannte Konstante". Gesetzt wird `maxHttpBufferSize` in `main.ts`, wie
   verlangt. Die Konstante selbst steht in
   `transport/socketio/validate.ts` — dort, wo schon `MAX_FIELD_CHARS` die
   Eingangsgrenzen des Transportrands führt. Grund: `main.ts` ist von keinem Test
   erreichbar, ohne einen Server zu starten; eine Konstante dort wäre nicht
   messbar, und der Faktor ist genau das, was gemessen gehören muss.

5. **`test/server/harness.ts` bekommt dasselbe Maß.** Nicht verlangt, aber ein
   Harness, das größere oder kleinere Nachrichten annimmt als der echte Server,
   misst nicht den Betrieb. Eine Zeile, nur Testcode.

6. **`Upload.tsx` bekommt eine freiwillige Eigenschaft `anfangstext`** (siehe
   B10). Produktivcode für eine Naht — begründet dort.

7. **`jsonAntworten` benutzt jetzt denselben Abtrag wie das Zeilenformat.** Nicht
   ausdrücklich verlangt, aber die JSON-Form hatte eine zweite, einmalige
   Ersetzung und trug B1 damit unverändert weiter (`"* ✅ Merkur"` als
   JSON-Antwort). Das war dieselbe Wurzel; als Test gebunden („dieselbe Mischform
   im JSON, nicht eine zweite Fassung davon").

8. **Die Titelgrenze gilt auch im JSON-Pfad.** Der Auftrag nennt
   `parse.ts:440-444`, also das Zeilenformat. Ein Titel aus einem JSON-Feld lief
   sonst weiter grün durch und fiel am Transportrand stillschweigend durch — also
   genau der Befund, den B4 beschreibt, nur über die andere Tür.
