# Quizbude — Stand

**Letzter Arbeitstag:** 2026-10-19 · **Branch:** `durchstich` (nicht nach `main` gemerged)

## Wo wir stehen

Konzeptphase abgeschlossen, Durchstich gebaut, unabhängig reviewt, Fix-Welle durchgelaufen.

**Selbst nachgemessen am Ende des Tages** (nicht aus Berichten übernommen):

```
npm test        94 Tests, 10 Dateien, grün, Exit 0
npx tsc         Exit 0  (strict: true aus tsconfig.base.json)
npm run build   Exit 0
Arbeitsbaum     sauber
```

## Offen — das Wichtigste zuerst

### 1. Das Nachreview der Fix-Welle fehlt

Die Fix-Welle hat sechs Befunde behoben (`f24f977` bis `2e006c6`). Ihre Zahlen stimmen — ich habe Tests, Typprüfung und Build selbst gemessen. **Nicht geprüft ist, ob die neuen Tests tatsächlich binden.** Genau dort lag beim ersten Review das Problem: sechs Mutationsproben blieben grün, obwohl sie etwas kaputt gemacht hatten.

Der Umsetzer behauptet, für jeden Fix eine Rücknahmeprobe gefahren zu haben (siehe `bericht-fixwelle.md`). Das ist eine Behauptung, kein Befund.

**Morgen als Erstes:** eng begrenztes Nachreview, nur über den Diff `2d14013..HEAD`, durch einen frischen Agenten. Keine neuen Themen.

### 2. Zwei Entscheidungen gehören dem Nutzer

Beide entstanden aus Widersprüchen in der eigenen Spezifikation, keine Fehler:

- **Lesefenster-Kappung.** Die 10-Sekunden-Obergrenze wurde unter der Annahme 120 Zeichen Fragetext hergeleitet. Gesetzt sind jetzt 200 Zeichen — damit greift die Kappung als Regel statt als Ausnahme (gemessen: 200 Zeichen ergeben 15 300 ms Lesebedarf). Entweder Kappung anheben oder Fragetext wieder kürzen.
- **Ladebudget.** Konzept fordert unter 60 kB gzip für die Beitrittsseite. Gemessen: **61,82 kB** mit React plus socket.io-client. Knapp drüber. Entweder Budget anheben oder die Beitrittsseite ohne React bauen.

Dazu: `PLAYER_HARD_CAP` steht auf 5000 — die hergeleitete Fairnessgrenze, kein Produktlimit.

### 3. Zweite Welle, noch nicht begonnen

Nicht im Durchstich und bewusst weggelassen: Quiz-Editor · SQLite-Persistenz · Reconnect mit Sitzungstoken · Podium · Auswertungsseite · QR-Code · Spieler entfernen · Lobby sperren · Namensfilter · Audio · weitere Fragetypen.

Folgeaufgaben aus Review und Fix-Welle stehen in `review-durchstich.md` und `bericht-fixwelle.md`.

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

**Noch nicht am Gerät erlebt:** ob sich Timing, Lesefenster und Rhythmus gut anfühlen. Das ist die eine Frage, die kein Test beantwortet.

## Entscheidungen, die schon gefallen sind

| Thema | Entscheidung |
|---|---|
| Name | Quizbude |
| Einsatz | Privat, Spieleabende, ~20 Spieler, kein Produktlimit |
| Plattform | Reine Web-App; Discord Activity später möglich, Spiellogik ist transportfrei |
| Optik | Eigene Gestaltung, **kein SIMO-Branding**, keine Kahoot-Kopie |
| Zeichengrenzen | 200 Zeichen Frage, 100 je Antwort (nicht 120/75 wie beim Vorbild) |
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
| `bericht-fixwelle.md` | Die sechs Fixes — **noch nicht nachgeprüft** |
