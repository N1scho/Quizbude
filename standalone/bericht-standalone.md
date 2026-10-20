# Quizbude — eigenständige Browser-Fassung

**Datei:** `C:\Users\nikol\quiz\standalone\quizbude.html` · 82,8 kB · eine Datei, keine Abhängigkeit außer Google Fonts
**Stand:** 2026-10-20 · **Nicht veröffentlicht** — das macht der Orchestrator.

---

## 1. Was der Orchestrator beim Veröffentlichen braucht

### Die Themen (topics)

| Thema | Richtung | Stufe | Inhalt |
|---|---|---|---|
| `state` | Bühne → alle | **Vorgabe lassen** (admin) | Vollständiger Spielzustand, jede Sekunde und sofort bei jeder Änderung |
| `join` | Spieler → Bühne | **`interact`** | `{ name: "Mira" }` |
| `answer` | Spieler → Bühne | **`interact`** | `{ seq: 0, i: 2 }` — Fragennummer und Kachelposition |

Deklaration:

```js
capabilities: { room: { topics: { join: "interact", answer: "interact" } } }
```

`state` steht bewusst **nicht** in der Liste und bleibt damit admin-only. Das ist die Sicherheitsnaht dieser Fassung: nur wer Editor-Rechte am Artifact hat, kann Spielzustand behaupten. **Folge, die du kennen musst: die Bühne muss von jemandem mit Editor-Rechten geführt werden.** Ein reiner Gast kann mitspielen, aber keine Runde eröffnen — sein `emit('state', …)` würde mit `not_permitted` abgelehnt. Die Seite zeigt das als klare Meldung, statt stumm hängenzubleiben.

Raumnamen: `q-` plus der kleingeschriebene Spielcode, also `q-abcd`. Das hält die Grammatik `^[a-z0-9][a-z0-9_.-]{0,47}$` ein. Topic-Namen sind doppelpunktfrei und passen auf `^[a-z][a-z0-9_.-]{0,47}$`.

### Was die Seite sonst noch braucht

Nichts. Keine weitere Fähigkeit. `db` ist, wie beauftragt, **nicht** benutzt — sie liefert abgemeldeten Besuchern `null`, und genau das sind die Gäste. `user` ist ebenfalls nicht deklariert; die Identität eines Spielers ist der vom Laufzeitsystem gestempelte `peer`, der pro offenem Dokument vergeben wird und von keiner Seite gefälscht werden kann.

---

## 2. Was aus `packages/core` übernommen ist

Alle Zahlen sind aus den Quelldateien gelesen und am Trockner nachgerechnet, nicht aus dem Gedächtnis.

### Zeiten (`engine/constants.ts`)

| Konstante | Wert | Wirkung in der Fassung |
|---|---|---|
| `ANNOUNCE_MS` | 3000 | Ankündigung „Frage 3 von 10" vor dem Lesefenster |
| `LATE_GRACE_MS` | 1500 | Nachzügler in REVEAL werden noch angenommen, mit 0 Punkten |
| `ALL_ANSWERED_SETTLE_MS` | 300 | Haben alle geantwortet, läuft die Frage 300 ms später aus |
| `PLAYER_SOFT_WARN` | 25 | Ab 25 Namen zeigt die Lobby „und N weitere" statt weiterer Kacheln |

### Lesefenster (`engine/reading.ts`)

```
Lesefenster = 1500 ms + 400 ms × Wörter(Frage) + 150 ms × Wörter(alle Antworten)
              Mindestdauer 10 000 ms, nach oben offen
```

Gerechnete Proben, alle grün gegen den Kern:

| Fall | Formel | Ergebnis |
|---|---|---|
| 8 Wörter, vier Ein-Wort-Antworten | 1500 + 3200 + 600 = 5300 | → **10 000** (Mindestdauer greift) |
| 20 Wörter, vier dreiwortige Antworten | 1500 + 8000 + 1800 | **11 300** |
| 30 Wörter (200-Zeichen-Grenze), dieselben Antworten | 1500 + 12 000 + 1800 | **15 300** |
| Wahr/Falsch, 6 Wörter | 1500 + 2400 + 300 = 4200 | → **10 000** |
| Demofrage 1 („Welcher Planet …", 7 Wörter, Merkur/Venus/Mars/Jupiter) | 1500 + 2800 + 600 = 4900 | → **10 000** |

`READING_MAX_MS` gibt es nicht und ist nicht eingebaut. Der Host gibt mit der **Leertaste** jederzeit früher frei — das ist der Rhythmusschutz an Stelle der früheren Kappung.

### Punkte (`scoring/score.ts`, `scoring/constants.ts`)

`POINT_UNIT_VALUE = 1000`, `FULL_POINTS_THRESHOLD_MS = 500`, `COMPENSATION_CAP_MS = 400`, `MIN_TIME_FACTOR = 0.5`. Die Formel Zweig für Zweig übernommen:

```
falsch → 0 · verspätet → 0 · pointsFactor 0 → 0 · flat → voll
elapsed < 500 ms → voll · sonst  round((1 − t/timeLimit/2) × max),  t geclampt auf [0, timeLimit]
```

Gerechnete Proben bei 20 s Fenster und 1000 Höchstpunkten:

| Zeit | Faktor | Punkte |
|---|---|---|
| 499 ms | — (Toleranzschwelle) | **1000** |
| 500 ms | 0,9875 | **988** |
| 2 s | 0,95 | **950** |
| 5 s | 0,875 | **875** |
| 10 s | 0,75 | **750** |
| 20 s und darüber | 0,5 | **500** |

`MIN_TIME_FACTOR` ist wie im Kern eine dokumentierte Zusage, die die Formel konstruktiv einhält, kein eigener Zweig.

### Rangliste (`ranking.ts`)

Gleiche Punkte ergeben gleichen Rang, bei Gleichstand alphabetisch nach `localeCompare(…, 'de')`, `deltaToAhead` ist der Abstand zum nächsthöheren Punktestand und 0 auf Rang 1. Probe: Zoe 100, Anna 100, Bo 50 → Anna 1, Zoe 1, Bo 3 (Delta 50).

### Zustandsmaschine (`engine/step.ts`)

Phasen `LOBBY → PREVIEW → OPEN → REVEAL → SCOREBOARD → (PREVIEW … | PODIUM) → FINISHED`, dazu `PASS` (siehe Abweichungen). Übernommen:

- **Fristen werden aus absoluten Zeitstempeln gerechnet**, nie aus aufsummierten Intervallen. `settleDeadlines(now)` prüft bei jedem Takt, ob die Phase nach der Uhr schon hätte enden müssen — derselbe Schleifenbau mit `guard < 4` wie im Kern.
- **Der Nullpunkt der Zeitmessung ist `answersOpenAt`**, nicht der Moment, in dem ein Timer feuert. Ein gedrosselter Hintergrund-Tab verschiebt damit keine Punkte.
- Antwort in PREVIEW → `not_open` (eine Wertung mit elapsed 0 wäre ein Freifahrtschein).
- Zweite Antwort desselben Spielers → **verworfen**, die erste gilt und wird nur noch einmal quittiert.
- Punkte werden erst beim Schließen der Frage gebucht, nicht beim Eingang der Antwort.
- Namensprüfung wörtlich aus `normalizeName`: NFKC, Mehrfach-Leerzeichen zusammen, Trim, 1..16 Zeichen, `^[\p{L}\p{N} _.-]+$`, Vergleich über `toLocaleLowerCase('de')`.
- Mischen über denselben gesäten Zufall (`createRng`/`shuffledIndices`, Fisher-Yates); Wahr/Falsch wird nie gemischt und steht fest auf Anzeigeposition 0 = Wahr, 1 = Falsch.
- Die Trennung der Empfängerkreise aus `engine/effects.ts` ist erhalten: **Fragetext, Antworttexte und Lösung verlassen die Bühne nie vor REVEAL.** Der Funkspruch trägt in PREVIEW und OPEN nur Kachelzahl, Anordnung und Zeitstempel. Das ist am Trockner geprüft (Suche nach „Merkur" im Funkspruch: nicht gefunden).

### Textgrenzen (`engine/constants.ts`, `questions/load.ts`)

`MAX_PROMPT_CHARS = 200`, `MAX_OPTION_CHARS = 100`, `MAX_NAME_CHARS = 16` — im Editor **durchgesetzt**, mit lauter, nicht stiller Meldung („Frage 1 (Zeile 1): 201 Zeichen. 200 sind das Maximum — kürz sie um 1."). Damit entspricht die Fassung dem `parsePrompt` aus `questions/load.ts`, das der parallel laufende Agent heute eingezogen hat.

### Demo-Quiz (`packages/server/src/demoQuiz.ts`)

Wörtlich übernommen als Startinhalt und zugleich als vorbelegter Editortext: Titel „Quizbude — Demorunde", Frage 1 Single-Choice 20 s (Merkur/Venus/Mars/Jupiter, richtig Merkur, mit Erklärung), Frage 2 Wahr/Falsch 15 s (Oktopus, richtig Wahr, mit Erklärung). Der Parser erzeugt daraus exakt dieselbe Struktur — am Trockner Feld für Feld verglichen.

---

## 3. Bewusste Abweichungen, jede einzeln begründet

1. **Keine Laufzeitkompensation (`compensate` bleibt wirkungslos).** Der Kern zieht die halbe gemessene Umlaufzeit ab. Über den Raumkanal gibt es keine serverseitig gemessene Umlaufzeit. Eine vom Gerät gemeldete Zeit wäre der eine Wert, mit dem man sich bis zu 400 ms Vorsprung erschwindeln könnte — teurer als der Fehler, den sie heilt. Die Funktion ist portiert, getestet und wird mit `rttMinMs = null` aufgerufen; eine spätere Messung dockt an einer Stelle an.

2. **Spielergrenze 40 statt `PLAYER_HARD_CAP = 5000`.** Ein Funkspruch darf 4 KiB tragen. Bei 40 Spielern misst der vollständige Zustand gemessene 3453 Zeichen; darüber greift eine Kürzung (Namen auf 8 Zeichen, dann Liste auf 30 Einträge). Die 5000 waren eine Notbremse gegen Ressourcenerschöpfung auf einem Server — hier ist die bindende Größe der Funkspruch. Der Normalfall sind ~20 Spieler.

3. **Phase `PASS`.** Neu, und nur für „allein am Bildschirm" mit mehr als einem Spieler: zwischen zwei Antwortfenstern wartet die Seite auf „Bin bereit", damit das Gerät weitergereicht werden kann, ohne dass der Nächste die Antwort des Vorigen sieht. In der Netzrunde wird diese Phase nie betreten.

4. **Antwortfenster je Spieler am einen Gerät.** Reihum heißt: die Frage wird einmal gemeinsam gelesen, danach bekommt jeder Spieler sein eigenes, volles Zeitfenster mit eigenem Nullpunkt. Anders ginge „blind mit dem Daumen entscheiden" am selben Gerät nicht. Bei einem einzigen Spieler ist der Ablauf identisch mit der Netzrunde.

5. **Wiederkehr nach dem Neuladen.** Der `peer` ist nach einem Reload neu. Meldet sich jemand mit dem Namen eines Spielers an, der gerade **nicht** im Raum ist, wandert dessen Platz samt Punkten auf das neue Gerät, statt „Name vergeben" zu sagen. Der Kern bindet an ein Sitzungstoken; das gibt es hier nicht. Der Preis: wer den Namen eines Abwesenden kennt, kann dessen Platz übernehmen. Für einen Spieleabend unter Freunden ist das der richtige Tausch, als Produktverhalten wäre es keiner.

6. **Kein Endspurt, kein QR-Code, keine Spielerentfernung, keine Auswertungsseite.** Alles im UX-Konzept beschrieben, im Kern nicht gebaut. Die Fassung baut nichts, was der Kern nicht hat. Beitritt sperren ist drin, weil `locked` im Kern existiert.

7. **Vier Fragetypen-Details vereinfacht:** `pointsFactor` ist im Editorformat nicht einstellbar und steht auf 1 (im Kern vorhanden, im Zeilenformat wäre es ein fünfter Sonderzeichen-Dialekt). Antwortzeit ist einstellbar (`| 20`), zugelassen 5–300 s.

8. **`hot`-Rettung nur für Fragen und Namen, nicht für den laufenden Spielstand.** Eine Neuveröffentlichung lädt jede Ansicht neu und leert den Raum — die Spieler wären ohnehin weg. Den Fragentext und den eigenen Namen zu retten, ist das, was dabei wirklich hilft; den Punktestand einer Runde zu retten, deren Spieler nicht mehr da sind, wäre Kulisse. Der Aufruf hängt an `?.` und einem `try`, fehlt `hot`, passiert nichts.

9. **Ton nur auf der Bühne, selbst erzeugt.** Vier kurze WebAudio-Figuren (Countdown-Tick, Freigabe, Schluss, Auflösung), erst nach dem ersten Klick, abschaltbar. Keine fremde Datei, keine fremde Musik. Das Handy bleibt stumm — Regel 2 aus Abschnitt 0 des UX-Konzepts.

---

## 4. Gestaltung

Dunkler Grund `#121126`, Antwortfarben **Sonne** `#FFC94D` (Blitz), **Welle** `#36BFE0` (Tropfen), **Glut** `#B3350C` (Herz), **Nacht** `#2B2A8C` (Mond). Feste Paarung Farbe–Form–Position; bei Wahr/Falsch oben Sonne/Blitz = Wahr, unten Nacht/Mond = Falsch. Jede Kachel trägt den 3-px-Umriss in Papier `#F7F6FB` (2 px auf dem Handy), weil Nacht gegen die Bühne nur 1,60 : 1 steht — der Umriss ist die Kachelgrenze, kein Zierrat.

Keine der vier Formen ist Dreieck, Raute, Kreis oder Quadrat; kein Kahoot-Name, -Logo, -Maskottchen, -Ton. Kein SIMO-Element: kein Bronze, kein Gold, kein Claim, keine Geschäftsführer-Tonalität.

Schrift: **Fredoka** von Google Fonts für alles aus drei Metern Lesbare, mit echtem Fallback-Stack (`'Trebuchet MS', 'Segoe UI', system-ui, sans-serif`); Systemschrift mit Tabellenziffern für alles Funktionale. Google Fonts ist die einzige externe Quelle der Datei.

### Gerechnete Kontraste (WCAG 2.1, Relativluminanz nach 1.4.3)

| Paarung | Verhältnis | Anforderung | Status |
|---|---|---|---|
| Tinte `#121126` auf Sonne | **12,09 : 1** | 4,5 : 1 | erfüllt |
| Tinte `#121126` auf Welle | **8,54 : 1** | 4,5 : 1 | erfüllt |
| Papier `#F7F6FB` auf Glut | **5,69 : 1** | 4,5 : 1 | erfüllt |
| Papier `#F7F6FB` auf Nacht | **10,77 : 1** | 4,5 : 1 | erfüllt |
| Papier auf Bühne (Fließtext) | 17,22 : 1 | 4,5 : 1 | erfüllt |
| Gedämpft `#A9A6C9` auf Bühne | 7,92 : 1 | 4,5 : 1 | erfüllt |
| Papier auf Fläche `#2B2752` (Karten, Knöpfe) | 12,89 : 1 | 4,5 : 1 | erfüllt |
| Gedämpft auf Fläche | 5,93 : 1 | 4,5 : 1 | erfüllt |
| Sonne auf Bühne (Code, Akzent) | 12,09 : 1 | 3 : 1 | erfüllt |
| Tinte auf Mint `#3DDC97` („Richtig") | 10,48 : 1 | 4,5 : 1 | erfüllt |
| Papier auf Plum `#3B1033` („Daneben") | 14,93 : 1 | 4,5 : 1 | erfüllt |
| Papier auf Schiefer `#3A3A4A` („Zu spät") | 10,37 : 1 | 4,5 : 1 | erfüllt |
| Kachelumriss Papier auf Bühne | 17,22 : 1 | 3 : 1 | erfüllt |
| *Kachelfläche Nacht auf Bühne* | *1,60 : 1* | *3 : 1* | *verfehlt → deshalb der Umriss* |
| Kachelfläche Glut auf Bühne | 3,03 : 1 | 3 : 1 | knapp erfüllt |

Die Werte stimmen auf zwei Nachkommastellen mit `docs/konzept-ux.md` Abschnitt 4 überein; sie sind hier selbst nachgerechnet, nicht übernommen.

---

## 5. Seitenvertrag — geprüft

- Datei beginnt mit `<title>Quizbude</title>`, direkt danach `<meta name="claude:viewport-fit-sides" content="cover">`. **Kein** `<!doctype>`, `<html>`, `<head>`, `<body>` (maschinell geprüft).
- `body` trägt `padding-left/right: max(16px, env(safe-area-inset-*, 0px))` und `padding-block: 14px` — nie die `padding`-Kurzform.
- Externe Quellen: ausschließlich `https://fonts.googleapis.com`. Keine Bibliothek, kein Skript von außen.
- `color-scheme: dark` auf `:root`, alle Farben als Tokens im blanken `:root`, `body` setzt einen Token-Hintergrund explizit.
- `height: 100%` auf `html`/`body`, **kein** `100vh`.
- Sichtbarkeit ausschließlich über `el.hidden` (`[hidden]{display:none !important}`), **kein** `style.display`.
- Kein `alert`/`confirm`/`prompt`, kein `window.print`, kein `<a download>`, kein eingebettetes Fremdfenster.
- `localStorage` nur für gemerkten Namen, letzten Code und Fragentext — jeder Zugriff in `try/catch`, die Seite rendert ohne ihn vollständig.
- `prefers-reduced-motion` abgeräumt, Tastaturfokus sichtbar (3 px Sonne), jedes Formularelement hat eine feste `id`.
- Phonebreite: ab 700 px fällt das Bühnenraster auf eine Spalte, Kacheln brechen mit `overflow-wrap: anywhere`. Kein waagerechtes Scrollen (`overflow-x: hidden` auf `body`).
- Größe 82,8 kB — weit unter 16 MB.

---

## 6. Was geprüft ist

**Syntax.** `node --check` auf den extrahierten Skriptteil: grün.

**Reine Funktionen am Trockner** (`t1.js`, 46 Proben, alle grün): Lesefenster gegen fünf Beispiele aus dem UX-Konzept, Punkteformel in allen neun Zweigen, Rangliste mit Gleichstand, Codeerzeugung (4000 Ziehungen, Alphabet ohne 0/O/1/I/L, 26 Zeichen), Namensprüfung an allen Grenzen, Editor-Parser gegen das Demo-Quiz Feld für Feld und gegen zehn Fehlerfälle an den Grenzen 200/100/2 Antworten/genau eine Markierung.

**Zustandsmaschine am Trockner** (`t2.js`, 47 Proben, alle grün): vollständige Netzrunde über zwei Fragen bis FINISHED, vollständige Reihum-Runde mit zwei Spielern an einem Gerät, dazu einzeln geprüft — Freigabe bei T0+13 s, Nullpunkt `answersOpenAt`, Antwort im Lesefenster abgelehnt, Bereichsprüfung, unbekannter Spieler, doppelte Antwort verworfen, Settle erst wenn alle geantwortet haben, Punkte erst beim Schließen gebucht, Gnadenfrist 1,5 s, Nachzügler mit 0 Punkten, Rangwechsel, Wahr/Falsch ungemischt. Zusätzlich die Dichtheitsprobe: **in PREVIEW und OPEN enthält der Funkspruch weder Fragetext noch Antworttexte noch Lösung.**

**Funkspruchgröße.** 40 Spieler in REVEAL: 3453 Zeichen gegen ein Budget von 3600 und die harte Grenze von 4096 Byte. Gemessen wird vor dem Senden in UTF-8-Bytes, mit zweistufiger Kürzung darüber.

**Kontraste.** Selbst gerechnet, Tabelle oben.

## 7. Was ich **nicht** prüfen konnte

Alles, was die Laufzeitfähigkeit braucht — sie antwortet nur in der veröffentlichten Seite. Offen bleibt am echten Gerät:

1. **Ob ein Gast ohne claude.ai-Konto überhaupt funken darf.** Der Fähigkeitsvertrag sagt: in den Raum kommen angemeldete Personen, die das System zulässt — Mitglieder der Organisation und von außen eingeladene Gäste; **wer abgemeldet oder nur über einen öffentlichen Link da ist, kann sich nicht verbinden** und bekommt `claude.use("room")` als `null`. Das ist die wahrscheinliche Lage für „jemand öffnet nur den Link". Die Seite hängt dann nicht: sie sagt es in eigenen Worten („Dieses Gerät bekommt keine Verbindung zur Runde…") und nennt die zwei Auswege. Was wirklich passiert, zeigt erst der erste fremde Link-Öffner. **Das ist die eine Frage, die über die Brauchbarkeit der Mehrgeräte-Fassung entscheidet.**
2. **Ob `emit` auf `join`/`answer` für Contributor durchgeht**, sobald die Themen auf `interact` stehen. Bei `not_permitted` zeigt die Seite sofort eine benannte Meldung statt eines Ladebalkens.
3. **Ob die Bühne Editor-Rechte hat.** Siehe Abschnitt 1.
4. **Ob `window.claude.hot.snapshot(obj)` genau dieses Argument erwartet.** Die Signatur ist nicht dokumentiert; der Aufruf steht in `try/catch` hinter `?.` und kann nur nichts bewirken, nie schaden.
5. **Timing und Rhythmus am Gerät** — zehn Sekunden stehende Lesezeit auf der Leinwand, ob die Auflösung gehetzt wirkt, ob der Countdown-Ton nervt. Dieselbe offene Frage wie im Hauptprojekt, und keine Probe beantwortet sie.
6. **Darstellung auf echtem Beamer/TV und auf echten Telefonen** (Safari-Eigenheiten, `navigator.vibrate` fehlt auf iOS — eingeplant: jedes haptische Signal hat ein sichtbares Gegenstück).
7. **Uhrensynchronisierung.** Das Spielergerät rechnet den Versatz aus dem Zeitstempel jedes Funkspruchs. Sichtbar wird ein Fehler nur am Fortschrittsbalken, nie an den Punkten — die misst allein die Bühne. Bei groteskem Uhrversatz (Gerät mehrere Minuten falsch) bliebe das trotzdem zu beobachten.
