# Quizbude — Stand

**Letzter Arbeitstag:** 2026-10-20 · **Branch:** `durchstich` (nicht nach `main` gemerged)

## Wo wir stehen

Konzeptphase abgeschlossen, Durchstich gebaut, unabhängig reviewt, Fix-Welle durchgelaufen, **Nachreview erledigt**, zweite Fix-Welle durchgelaufen.

**Selbst nachgemessen am Ende des Tages** (nicht aus Berichten übernommen):

```
npm test        105 Tests, 12 Dateien, grün, Exit 0
npx tsc         Exit 0  (strict: true aus tsconfig.base.json)
npm run build   Exit 0  (Spielergerät 193,59 kB │ gzip 61,82 kB)
Arbeitsbaum     sauber
```

## Was das Nachreview ergeben hat

Alle sechs Befunde der ersten Welle sind **bewiesen behoben**: zwölf Rücknahmeproben, zwölf davon rot, kein Falsch-Grün in den neuen Tests. Die Zahlen des Umsetzerberichts stimmen. Der Bericht liegt als `nachreview-fixwelle.md`.

Das Nachreview fand dabei drei neue Befunde — zwei davon waren durchlässige Wächter, einer eine ungeprüfte Stelle am zentralen Gesetz:

| | Befund | Stand |
|---|---|---|
| NR1 | Der E1-Wächter kannte nur einfache Anführungszeichen; ein Rückfall in doppelten lief durch | behoben, `85cfa50` |
| NR2 | Die Abbildung von `scope` auf die Socket.IO-Räume in `outbound.ts` war von keinem Tor gedeckt | gebunden, `209767e` |
| NR3 | Die Importprüfung arbeitete zeilenweise und verfehlte umbrochene Importe | behoben, `4960558` |

Die zweite Welle hat sie geschlossen, jede mit eigener Rücknahmeprobe. Einzelheiten in `bericht-fixwelle-2.md`.

## Entschieden: die beiden Nutzerentscheidungen sind gefallen

- **Lesefenster.** Die 10-Sekunden-Kappung **entfällt als Obergrenze**. Das Fenster wird dynamisch berechnet und hat eine **Mindestdauer von 10 s je Frage** (`READING_MIN_MS = 10000`, kein `READING_MAX_MS` mehr). Eine Frage an der 200-Zeichen-Grenze bekommt damit ihre 15,3 s statt gekappter 10 s; früher freigeben kann der Host jederzeit mit der Leertaste. Umgesetzt in `d0959a4`, nachgezogen in `konzept-ux.md` Abschnitt 3.
- **Ladebudget.** Das Budget der Beitrittsseite steht auf **65 kB gzip** (vorher 60 kB). Gemessen sind 61,82 kB mit React plus socket.io-client; die knapp zwei Kilobyte Abstand sind am Gerät nicht spürbar, und der Umbau, der sie einspart, kostet mehr, als er bringt. **React bleibt, kein Umbau.** Umgesetzt in `5c13d20`, nachgezogen in `konzept-ux.md` Abschnitt 6 und `konzept-architektur.md` 6.6.

Dazu unverändert: `PLAYER_HARD_CAP` steht auf 5000 — die hergeleitete Fairnessgrenze, kein Produktlimit.

## Offen — das Wichtigste zuerst

### 1. Zwei Restrisiken aus dem Nachreview, bewusst nicht behoben

Beide sind älter als die letzte Welle und stehen bewusst noch:

- **Timerpfad ohne örtliche Fehlerbehandlung.** `scheduler.ts:21-24` ruft `onFire` im `setTimeout`-Rückruf ohne `try/catch` auf; von dort geht es über `roomHandle.ts:42-57` direkt in `step`. Aufgefangen wird ein Wurf nur noch vom Prozessnetz in `main.ts`. Relevant wird das, sobald der Editor eigene Fragen zulässt und `parseSpec` wieder werfen kann.
- **Stream-Fehler hinter dem `.catch`.** `static.ts:80` gibt nach `createReadStream(file).pipe(res)` sofort `true` zurück; das `.catch` in `requestListener.ts:28` kann einen Stream-Fehler deshalb strukturell nicht erreichen. Ein `.on('error')` auf dem Lesestrom schließt das.

### 2. Kleinere Folgeaufgaben

Aus `bericht-fixwelle-2.md` Abschnitt „Folgeaufgaben", unverändert offen aus dem Durchstich-Review: Raum-TTL und Drosselung, die Token als Kulisse, `MAX_PROMPT_CHARS` ohne Durchsetzung, `MIN_TIME_FACTOR` ohne Wirkung. Dazu: die Zeitleiste in `konzept-ux.md` Abschnitt 3 nennt jetzt T−13,0 bis T0 — das ist die Mindestdauer; eine lange Frage schiebt den Anfang weiter nach vorn.

### 3. Zweite Welle, noch nicht begonnen

Nicht im Durchstich und bewusst weggelassen: Quiz-Editor · SQLite-Persistenz · Reconnect mit Sitzungstoken · Podium · Auswertungsseite · QR-Code · Spieler entfernen · Lobby sperren · Namensfilter · Audio · weitere Fragetypen.

Folgeaufgaben aus Review und Fix-Wellen stehen in `review-durchstich.md`, `bericht-fixwelle.md`, `nachreview-fixwelle.md` und `bericht-fixwelle-2.md`.

## Starten

```
cd C:\Users\nikol\quiz
npm install
npm run build
npm start
```

Bühne: `http://localhost:3000/host/` · Spielergerät: `http://localhost:3000/play/`
Anderer Port in PowerShell: `$env:PORT=3100; npm start`

Zum echten Testen drei Fenster: eins als Bühne, zwei als Spieler — eins davon im Privatmodus, sonst teilen sie sich den Browserspeicher.

**Noch nicht am Gerät erlebt:** ob sich Timing, Lesefenster und Rhythmus gut anfühlen. Mit der Mindestdauer von 10 s ist das jetzt die dringendste offene Frage, denn zehn Sekunden stehende Zeit fühlen sich auf der Leinwand anders an, als sie sich rechnen. Das ist die eine Frage, die kein Test beantwortet.

## Entscheidungen, die schon gefallen sind

| Thema | Entscheidung |
|---|---|
| Name | Quizbude |
| Einsatz | Privat, Spieleabende, ~20 Spieler, kein Produktlimit |
| Plattform | Reine Web-App; Discord Activity später möglich, Spiellogik ist transportfrei |
| Optik | Eigene Gestaltung, **kein SIMO-Branding**, keine Kahoot-Kopie |
| Zeichengrenzen | 200 Zeichen Frage, 100 je Antwort (nicht 120/75 wie beim Vorbild) |
| Lesefenster | Dynamisch, Mindestdauer 10 s je Frage, keine Obergrenze |
| Ladebudget | 65 kB gzip für die Beitrittsseite, React bleibt |
| Ergebnistyp | Richtig/Falsch, Präzisionstyp später andockbar |
| Datenbank | SQLite als Zielzustand, im Durchstich noch gar keine |
| Streak-Bonus | Nicht bauen — das Vorbild hat ihn abgeschafft |

## Dokumente

| Datei | Inhalt |
|---|---|
| `kahoot-feature-analyse.md` | Feature-Analyse des Vorbilds, ~36 Quellen, MUST/SHOULD/COULD |
| `plattform-stack-entscheidung.md` | Web vs. Discord Activity vs. Bot, Stack, 44 Events |
| `konzept-architektur.md` | Schichtenschnitt, Zustandsmaschine, Timing, Datenmodell |
| `konzept-ux.md` | Screens, Wireframes, Palette mit gerechneten Kontrasten |
| `aenderung-2026-10-19-teilnehmerzahl.md` | Nachzug auf „kein Produktlimit, Normalfall 20" |
| `bericht-durchstich.md` | Was der Umsetzer gebaut hat |
| `review-durchstich.md` | Unabhängiges Review, zwei blockierende Befunde |
| `bericht-fixwelle.md` | Die sechs Fixes der ersten Welle |
| `nachreview-fixwelle.md` | Nachreview: alle sechs bewiesen behoben, drei neue Befunde |
| `bericht-fixwelle-2.md` | Zweite Welle: NR1–NR3 und die beiden Nutzerentscheidungen |
