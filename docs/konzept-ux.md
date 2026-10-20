# UX-Konzept — Multiplayer-Quiz für Spieleabende

**Stand:** 2026-10-19 · **Scope:** MUST-Liste aus `kahoot-feature-analyse.md`, Abschnitt 10 · **Kein SIMO-Produkt, keine SIMO-CI.**

## Änderung 2026-10-19

Der Nutzer hat präzisiert: „die app muss nicht wie kahoot identisch aussehen. ich will eine quizapp mit unbegrenzt vielen usern (wahrscheinlich max 20)". Die bisherige Annahme „maximal ~50 gleichzeitige Spieler" ist damit ersetzt: Es gibt **kein Produktlimit**, das Spieler aussperrt, und der zu optimierende **Normalfall ist ~20 Spieler**. Wo es technisch klemmt, ist in `konzept-architektur.md`, Abschnitt 6.6 hergeleitet; für die Oberfläche ist die bindende Zahl eine andere und steht unten bei B3: Bei 36 px Mindestschriftgröße fasst die Bühne rund **25 Namen** in lesbarer Größe.

Die Lockerung bei der Optik ändert an der Gestaltung nichts. Dunkler Grund `#121126`, die Paarung Sonne/Welle/Glut/Nacht mit Blitz/Tropfen/Herz/Mond, alle gerechneten Kontraste und die Bewegungssprache bleiben unverändert.

Angefasst wurden: Regel 2 in **Abschnitt 0** (Gerätezahl im Ton-Argument), der Zustand „voll" bei **B3 Lobby** (1.1), die Standzeit des Zwischenstands in **Abschnitt 3**, das Ladebudget der Beitrittsseite in **Abschnitt 6** und die Begründung 4 in **Abschnitt 9**. Zwei Vereinfachungen sind dabei Gewinn, nicht Verlust: Der Zweispalten-Umbruch mit Namensverkleinerung ab 50 Spielern **entfällt ersatzlos**, und die Fallunterscheidung „bei > 10 Spielern 7 s, sonst 5 s" **entfällt**, weil bei ~20 Spielern nur noch ein Zweig erreichbar war.

---

## 0. Das eine Gesetz

Der große Bildschirm ist die Bühne. Das Handy ist der Buzzer. Die Frage steht nie auf dem Handy. Alles unten Folgende ist Ableitung aus diesem Satz.

Daraus folgen drei harte Regeln:

1. **Das Handy trägt keinen Text, der zum Mitlesen verleitet.** Keine Frage, keine Antworttexte. Vier Formen, ein Zustand, eine Zahl. Wer runterschaut, verpasst nichts — und genau deshalb schaut er hoch.
2. **Das Handy ist stumm.** Schon zwanzig Geräte mit Soundeffekten sind kein Spielgefühl, sondern Lärm. Ton gehört zur Bühne. (Die Feature-Analyse führt Soundeffekte als SHOULD; die Beschränkung auf die Bühne ist eine Scoping-Entscheidung.)
3. **Die Bühne zeigt nie etwas, was man aus 3 Metern nicht lesen kann.** Rechnerische Untergrenze: 55-Zoll-TV, 1210 mm Bildbreite, 1920 px → 1 px ≈ 0,63 mm. Lesbare Versalhöhe auf 3 m ≈ Distanz/200 = 15 mm → **24 px Versalhöhe ≈ 36 px Schriftgröße als absolutes Minimum**. Fragentext 56–72 px, Zahlen größer. Der TV ist der bindende Fall, nicht der Beamer (2,5 m Bildbreite: 1 px ≈ 1,3 mm, Minimum läge bei ~18 px).

Zwei getrennte Apps, zwei getrennte Layoutsysteme: **Bühne** (Querformat, 16:9, Layoutfloor 1024×768 laut Analyse) und **Buzzer** (Hochformat, Daumenzone, einhändig).

---

## 1. Screen-Inventar

Benennung: `B` = Bühne (Host), `Z` = Buzzer (Spieler).

### 1.1 Bühne

**B1 — Start**
*Zweck:* In zwei Klicks ins Spiel. *Inhalt:* Liste der eigenen Quizze (Titel, Fragenzahl, zuletzt gespielt), ein großer Button „Quiz starten", ein kleiner „Neues Quiz". *Aktionen:* Quiz wählen → Starten; Quiz anlegen/bearbeiten; löschen. *Einstieg:* App öffnen. *Weiter:* → B2 (Editor) oder → B3 (Lobby).
*Zustände:* leer (noch kein Quiz: ein einziger Call-to-Action plus Hinweis auf Beispielquiz) · gefüllt · Ladefehler (Liste aus lokalem Cache, Banner „Keine Verbindung — Starten nicht möglich").

**B2 — Quiz-Editor**
*Zweck:* Fragen anlegen. MVP-Tiefe, kein Autorensystem. *Inhalt:* links Fragenliste mit Drag-Reihenfolge, rechts die Frage: Fragetext (120 Zeichen, Zähler ab 100), 2–4 Antwortfelder (75 Zeichen) mit fest zugeordneter Farb-Form-Kachel, Richtig-Markierung (Häkchen pro Antwort, mindestens eine), Fragetyp (Quiz / Wahr-Falsch), Zeitlimit (10/20/30/60 s, Default 20 s), Punkte (0 / 1× / 2×), Bild optional.
*Aktionen:* Frage hinzufügen/duplizieren/löschen, Reihenfolge ändern, Vorschau, Speichern. *Einstieg:* B1. *Weiter:* Speichern → B1.
*Zustände:* neu (eine leere Frage vorbelegt) · gültig · **ungültig** (keine richtige Antwort markiert, leerer Fragetext, nur eine Antwort — Fehler inline an der Frage und als Zähler über dem Starten-Button, nie als Modal) · speichert · Speichern fehlgeschlagen (Inhalt bleibt im Formular, Retry-Button).

**B3 — Lobby** *(Wireframe 1)*
*Zweck:* Leute reinholen, Spannung aufbauen. *Inhalt:* Spielcode riesig (die größte Zahl, die die App je zeigt), QR-Code daneben, Join-Adresse klein darunter, Spielerliste als wachsendes Kachelfeld, Zähler „12 dabei", Start-Button, Schloss-Button (Beitritt sperren), Lautstärke, Vollbild.
*Aktionen:* Starten (ab 1 Spieler aktiv), Spieler entfernen (Klick auf den Namen → kurze Bestätigung, MUST, nur hier möglich), Beitritt sperren/entsperren, QR vergrößern (Vollbild-QR für den Raum), Abbrechen.
*Einstieg:* B1. *Weiter:* Start → B4.
*Zustände:* **leer** (0 Spieler: QR und Code nehmen den ganzen Schirm ein, Start-Button inaktiv, Hinweiszeile „Scannen oder Code eintippen") · füllt sich (jeder neue Name schiebt sich mit 240 ms ein, Zähler tickt) · **Raster voll** (das Namensraster fasst rund 25 Kacheln: 1 920 px minus 2 × 48 px Rand ergeben bei 36 px Mindestschrift und 16 Zeichen Name ~340 px je Kachel, also fünf je Zeile bei fünf Zeilen Namensfläche. Ab dort kommen keine Kacheln mehr hinzu — der Zähler läuft weiter und eine Zeile nennt „und 7 weitere". Namen werden **nicht** verkleinert und **nicht** gescrollt; beides bräche Regel 3 aus Abschnitt 0. Der frühere Zweispalten-Umbruch mit Namensverkleinerung ab 50 Spielern entfällt damit ersatzlos) · gesperrt (Schloss aktiv, Code durchgestrichen dargestellt, Zeile „Beitritt gesperrt") · Spieler verlässt (Kachel bleibt 3 s als Umriss stehen, dann weg) · Verbindung zum Server weg (roter Balken oben: „Keine Verbindung — Spiel pausiert", Code bleibt stehen).

**B4 — Frage** *(Wireframe 2)*
*Zweck:* Die Bühne. Hat drei Phasen im selben Layout, kein Screenwechsel: **Ankündigung → Lesefenster → Antwortzeit**. *Inhalt:* oben Zähler „Frage 3 / 10" und Punktewert („2×" nur wenn abweichend), Mitte Fragentext (und Bild, wenn vorhanden), unten vier Antwortkacheln, links der Timer als Ring mit Restsekunden, rechts der Antwortzähler als Zahl („14").
*Aktionen (Host):* Antworten freigeben (überspringt das restliche Lesefenster), Frage vorzeitig schließen, Spiel beenden. Tastatur: Leertaste = weiter, Esc = Menü.
*Einstieg:* Start aus B3 oder „Weiter" aus B6. *Weiter:* Zeit um oder alle geantwortet → B5.
*Zustände:* Ankündigung (3 s) · Lesefenster (Timer steht sichtbar still, Kacheln sichtbar) · Antwortzeit · **Endspurt** (siehe Abschnitt 3) · Zeit abgelaufen · vorzeitig geschlossen · keine einzige Antwort eingegangen (Reveal zeigt leeres Balkenfeld und die Zeile „Niemand hat geantwortet" — nicht verschweigen, das ist lustig) · Verbindungsverlust des Hosts (Spiel friert ein, Overlay „Verbindung weg — es geht automatisch weiter"; Timer wird serverseitig angehalten).

**B5 — Auflösung** *(Wireframe 3)*
*Zweck:* Die Entlastung. *Inhalt:* Fragentext bleibt oben klein stehen, die vier Kacheln bleiben an ihrem Platz, die richtige wächst und bekommt ein Häkchen, die falschen sinken auf 45 % Deckkraft und bekommen ein kleines Kreuz. Über jeder Kachel ein Balken mit absoluter Antwortzahl. *Aktionen:* Weiter. *Einstieg:* B4. *Weiter:* → B6.
*Zustände:* Normalfall · Mehrfachrichtig (mehrere Kacheln wachsen) · niemand richtig (Zeile „Keiner. Respekt an die Frage.") · alle richtig (Zeile „Alle. Zu einfach.").

**B6 — Zwischenstand** *(Wireframe 4)*
*Zweck:* Die Drehung der Erzählung. *Inhalt:* Top 5 als Zeilen mit Platz, Name, Punkten; Veränderungspfeil mit Platzdifferenz; darunter eine Zeile „und 23 weitere". Punkte zählen von altem auf neuen Wert hoch (900 ms), Zeilen tauschen die Plätze animiert.
*Aktionen:* Weiter (→ B4), Spiel beenden (→ B7). *Zustände:* normal · Gleichstand (gleiche Platzzahl, alphabetisch sortiert) · < 5 Spieler (zeigt alle) · letzte Frage gespielt (Button heißt „Podium").

**B7 — Podium**
*Zweck:* Der emotionale Kern. *Inhalt:* Drei Podeste, Aufbau von Platz 3 nach Platz 1 mit je ~1,2 s Pause, Name und Punkte groß, Konfetti nur auf Platz 1. Darunter in klein die Plätze 4–8. *Aktionen:* Auswertung ansehen, Nochmal spielen (gleiches Quiz, neue Lobby), Beenden. *Zustände:* Aufbau · fertig · weniger als 3 Spieler (nur so viele Podeste wie Spieler).

**B8 — Auswertung**
*Zweck:* Nachbesprechung am Küchentisch, nicht Reporting. *Inhalt:* Summary (Teilnehmerzahl, Fragenzahl, Dauer, Durchschnitt richtig in %), Teilnehmerliste mit Punkten und Richtig-Quote, Frage-für-Frage mit Antwortverteilung und Richtig-Quote. *Aktionen:* Frage aufklappen, Nochmal spielen, Schließen. *Zustände:* vorhanden · leer (Spiel abgebrochen vor Frage 1) · wird geladen.

*Später, nur benannt:* B9 Quiz-Import (Tabelle), B10 Bibliothek mit Ordnern, B11 erweitertes Einstellungs-Panel (Musikwahl, Sprache), B12 Playlist mehrerer Quizze, B13 Rematch gegen frühere Ergebnisse, B14 Team-Modus-Aufstellung.

### 1.2 Buzzer

**Z1 — Beitritt: Code** *(Wireframe-Extra)*
*Zweck:* In unter 20 Sekunden drin. *Inhalt:* Produktname klein, ein einziges Feld für sechs Ziffern (großzügig, gruppiert 3+3), numerische Tastatur erzwungen, Button „Weiter". *Einstieg:* QR-Scan (Code vorbelegt, dieser Screen wird übersprungen) oder Adresse tippen. *Weiter:* → Z2.
*Zustände:* leer · tippt (Button wird aktiv ab 6 Ziffern) · prüft (Button zeigt Spinner, Feld gesperrt) · **Code unbekannt** (Feld wackelt 160 ms, Zeile darunter: „Diesen Code gibt es nicht. Nochmal prüfen.", Ziffern bleiben stehen) · **Spiel gesperrt** („Die Runde ist schon gesperrt. Der Host kann wieder öffnen.") · **Spiel läuft schon** (Beitritt bleibt erlaubt, Hinweis: „Läuft bereits — du steigst bei Frage 4 ein") · **zu viele Versuche** (Feld 30 s gesperrt, Countdown sichtbar) · offline.

**Z2 — Beitritt: Name**
*Inhalt:* „Wie heißt du heute Abend?", ein Textfeld (max. 16 Zeichen), Würfel-Button für einen Zufallsnamen, Button „Mitspielen". *Weiter:* → Z3.
*Zustände:* leer · tippt · **Name vergeben** („Den gibt's schon. Nimm einen anderen.") · **Name gefiltert** (serverseitiger Filter benennt still um, der Spieler sieht im Warteraum schlicht den neuen Namen — kein Hinweis, kein Streit) · prüft · abgelehnt, weil Lobby inzwischen gesperrt (zurück zu Z1 mit Erklärzeile).

**Z3 — Warteraum**
*Inhalt:* Der eigene Name groß, darunter „Du bist dabei.", darunter klein „Schau nach vorn." plus ein ruhiger Puls-Indikator, ganz unten der Spielerzähler. Kein Spielerlisten-Scroll — das Handy ist kein zweiter Bildschirm.
*Zustände:* wartend · **entfernt worden** (Vollbild: „Du wurdest aus der Runde genommen." plus Button „Neu beitreten") · Verbindung weg · Spiel startet (Übergang 400 ms in Z4).

**Z4 — Buzzer gesperrt (Lesefenster)**
*Zweck:* Den Blick oben halten. *Inhalt:* Vier Kacheln in gedämpfter Form — Formen als Umriss, Farben auf 35 % Deckkraft, kein Text —, darüber in Versalien „Lesen" und ein sich füllender dünner Balken. Tippen löst nichts aus (kein Fehlerton, nur ein kurzes Wackeln der Kachel, 120 ms).
*Zustände:* Ankündigung (nur Fragennummer, Kacheln noch nicht da) · Lesefenster · Übergang zur Freigabe (Kacheln „schnappen" in 180 ms auf volle Farbe, kurze Vibration).

**Z5 — Buzzer aktiv** *(Wireframe 5)*
*Zweck:* Eine Entscheidung, blind getroffen, mit dem Daumen. *Inhalt:* Vier Vollfarb-Kacheln 2×2, füllen ca. 78 % der Viewport-Höhe, Formen zentriert und groß; ganz oben eine dünne, ablaufende Zeitleiste; ganz unten in klein der eigene Name und Punktestand. **Kein Fragentext, keine Antworttexte.**
*Aktionen:* Eine Kachel antippen = endgültig. Kein Ändern, kein Bestätigen-Button (zwei Taps kosten Zeit und erzeugen Zweifel).
*Zustände:* aktiv · zwei Kacheln (Wahr/Falsch, gestapelt, volle Breite) · gesendet (→ Z6) · **Zeit abgelaufen ohne Antwort** (Kacheln fallen in Graustufen, Zeile „Zeit vorbei") · Verbindung weg während der Antwortzeit (siehe 8.2).

**Z6 — Abgegeben**
*Inhalt:* Die gewählte Form füllt bildschirmfüllend den Hintergrund in ihrer Farbe, darüber „Abgegeben" und darunter klein „17 von 18 sind fertig". Keine Aussage darüber, ob es richtig war. *Zustände:* wartend · andere noch offen (Zähler aktualisiert sich) · Antwort serverseitig abgelehnt, weil zu spät (→ Z7 im Zustand „zu spät").

**Z7 — Ergebnis** *(Wireframe 6)*
*Inhalt:* Vollflächig, Helligkeit ist das Hauptsignal: **richtig = heller Mint-Screen**, **falsch = dunkler Plum-Screen**. Dazu ein großes Glyph (Haken / Kreuz), das Wort („Richtig" / „Daneben"), die Punkte dieser Frage als Hochzähler, darunter Platz und Abstand („Platz 4 · 320 zurück").
*Zustände:* richtig · falsch · **zu spät** (neutraler Schiefergrund, „Zu spät", +0, keine Vibration — niemand wird für ein langsames Netz bestraft) · **nicht geantwortet** (gleicher neutraler Screen, Text „Keine Antwort") · Aufstieg (Platzzahl schiebt sich von unten herein, Pfeil in Sonne) · Abstieg (schiebt sich nach unten, gedämpft, kein Rot, keine Vibration).

**Z8 — Endstand**
*Inhalt:* Eigener Platz riesig, Punkte, eine Zeile Einordnung („Platz 4 von 18"), darunter „Danke fürs Mitspielen". Kein Teilen-Button, kein Konto-Angebot. *Zustände:* Platz 1–3 (Konfetti, Podestfarbe) · übrige · Spiel vom Host beendet (Zeile „Runde beendet").

**Z-Fehlerzustände, bildschirmübergreifend:** Verbindung weg (siehe 8.2) · Wiederverbunden · Spiel beendet · aus der Runde genommen · Browser-Tab war im Hintergrund (beim Zurückkommen Sofort-Resync ohne Zwischenscreen).

*Später, nur benannt:* Z9 Avatar wählen, Z10 Reaktionen senden, Z11 Fragentext auf dem Gerät (Barrierefreiheits-Option, siehe Abschnitt 10), Z12 Teamansicht.

---

## 2. ASCII-Wireframes

**1 — B3 Lobby** (Bühne, 16:9)

```
┌──────────────────────────────────────────────────────────────────────┐
│  quiz.example                                      [vol] [⤢] [lock]  │
│                                                                      │
│   ╔══════════════════════════╗     ┌──────────────┐                  │
│   ║                          ║     │              │                  │
│   ║      4 9 2   8 1 3       ║     │   ███ QR ███ │  Scannen oder    │
│   ║                          ║     │   ███████    │  Code eintippen  │
│   ╚══════════════════════════╝     └──────────────┘                  │
│            SPIELCODE                                                 │
│  ────────────────────────────────────────────────────────────────    │
│   12 DABEI                                                           │
│   [ Mira ] [ Jonas ] [ Pelle ] [ Ayse ] [ Tom ] [ Nik ] [ Luca ]     │
│   [ Bine ] [ Ole ] [ Zoe ] [ Hanna ] [ Rafa ]                        │
│                                                                      │
│                                        ┌───────────────────────┐     │
│                                        │      STARTEN          │     │
│                                        └───────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

**2 — B4 Frage, Antwortzeit** (Bühne)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRAGE 3 / 10                                            2× PUNKTE   │
│                                                                      │
│       Welcher Fluss fließt durch Aschaffenburg?                      │
│                                                                      │
│   ┌────────┐                                          ┌──────────┐   │
│   │  ( 12  │                                          │    14    │   │
│   │  SEK   │                                          │ ANTWORTEN│   │
│   └────────┘                                          └──────────┘   │
│  ┌───────────────────────────┐  ┌───────────────────────────┐        │
│  │ Blitz   Main              │  │ Tropfen  Lahn             │        │
│  └───────────────────────────┘  └───────────────────────────┘        │
│  ┌───────────────────────────┐  ┌───────────────────────────┐        │
│  │ Herz    Kinzig            │  │ Mond     Tauber           │        │
│  └───────────────────────────┘  └───────────────────────────┘        │
│                                               [Leertaste: schließen] │
└──────────────────────────────────────────────────────────────────────┘
```

**3 — B5 Auflösung** (Bühne)

```
┌──────────────────────────────────────────────────────────────────────┐
│  FRAGE 3 / 10   Welcher Fluss fließt durch Aschaffenburg?            │
│                                                                      │
│        ▇▇▇▇▇▇▇▇▇▇▇ 11        ▇▇ 2         ▇▇▇ 3        ▇ 1           │
│  ╔═══════════════════════════╗  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐         │
│  ║ Blitz   Main         [ok] ║  │ Tropfen  Lahn       [x]  │         │
│  ║  R I C H T I G            ║  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘         │
│  ╚═══════════════════════════╝  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐         │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐    │ Mond     Tauber     [x]  │         │
│  │ Herz    Kinzig      [x]  │    └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘         │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘                                        │
│                                        ┌───────────────────────┐     │
│  11 von 17 richtig                     │   ZWISCHENSTAND  >    │     │
└──────────────────────────────────────────────────────────────────────┘
```

**4 — B6 Zwischenstand** (Bühne)

```
┌──────────────────────────────────────────────────────────────────────┐
│  ZWISCHENSTAND                                        NACH FRAGE 3   │
│                                                                      │
│    1   Mira                                    4 820     ▲ 2         │
│    2   Jonas                                   4 410     ▼ 1         │
│    3   Ayse                                    3 995     ▲ 4         │
│    4   Pelle                                   3 675     –           │
│    5   Tom                                     3 120     ▼ 2         │
│                                                                      │
│    und 12 weitere                                                    │
│                                                                      │
│                                        ┌───────────────────────┐     │
│                                        │   NÄCHSTE FRAGE  >    │     │
└──────────────────────────────────────────────────────────────────────┘
```

**5 — Z5 Buzzer aktiv** (Handy, Hochformat)

```
┌─────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ │  <- Zeitleiste, 3 px
│                     │
│ ┌────────┬────────┐ │
│ │        │        │ │
│ │ Blitz  │Tropfen │ │   Sonne / Welle
│ │        │        │ │
│ ├────────┼────────┤ │
│ │        │        │ │
│ │ Herz   │ Mond   │ │   Glut / Nacht
│ │        │        │ │
│ └────────┴────────┘ │
│                     │
│  Mira      3 410    │  <- 14 px, gedämpft
└─────────────────────┘
```

**6 — Z7 Ergebnis, richtig** (Handy)

```
┌─────────────────────┐
│                     │
│                     │   Vollfläche Mint,
│        [ok]         │   Tinte dunkel
│                     │
│      RICHTIG        │
│                     │
│       + 1 740       │   zählt hoch, 900 ms
│                     │
│                     │
│   Platz 3   ▲ 4     │
│   320 zurück        │
└─────────────────────┘
```

*Extra — Z1 Beitritt* (Handy)

```
┌─────────────────────┐
│                     │
│   Spielcode         │
│  ┌───────────────┐  │
│  │  4 9 2  8 1 3 │  │  48 px, numerische Tastatur
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │    WEITER     │  │
│  └───────────────┘  │
└─────────────────────┘
```

*Extra — B7 Podium* (Bühne)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        *  M I R A  *                                 │
│                             4 820                                    │
│                  Jonas          ┌─────┐                              │
│                  4 410          │  1  │          Ayse                │
│                 ┌─────┐         │     │          3 995               │
│                 │  2  │         │     │         ┌─────┐              │
│                 │     │         │     │         │  3  │              │
│  [ AUSWERTUNG ]        [ NOCHMAL SPIELEN ]                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Der Spannungsbogen einer Frage

Default-Antwortzeit 20 s. T = 0 ist die Freigabe der Antworten. Die Zeiten vor T0 gelten für die **Mindestdauer** des Lesefensters von 10 s (Formel weiter unten); eine längere Frage schiebt den Anfang entsprechend nach vorn, der Ablauf bleibt derselbe.

| Zeit | Bühne | Buzzer | Begründung |
|---|---|---|---|
| **T−13,0 bis T−10,0** | Zwischenstand verblasst, Ankündigung: „Frage 3 / 10" groß, Punktewert, Hintergrund pulsiert einmal | Kacheln verschwinden, nur Fragennummer, ruhiger Puls | Reset der Aufmerksamkeit. Alle Köpfe gehen hoch, bevor Information kommt |
| **T−10,0** | Fragentext erscheint, Zeile für Zeile (je 120 ms), Bild blendet mit auf. Timer sichtbar, **steht still** | Kacheln erscheinen als Umriss, 35 % Deckkraft, Label „Lesen" | Lesefenster. Der Timer steht sichtbar still — das ist die Zusage, dass Lesen nicht bestraft wird |
| **T−10,0 bis T−0,6** | Antwortkacheln erscheinen nacheinander (je 90 ms versetzt), vollflächig farbig | unverändert gesperrt; Tippen quittiert nur mit 120-ms-Wackeln | Formen und Positionen werden vorab verankert, bevor der Druck beginnt |
| **T−0,6 bis T0** | Timerring färbt sich, ein kurzer Ton, Countdown „3·2·1" (das Lesefenster ist mit der Mindestdauer 10 s immer lang genug dafür) | Kacheln „schnappen" in 180 ms auf volle Farbe und Größe, **eine kurze Vibration (10 ms)** | Der physische Moment der Freigabe. Niemand muss hinschauen, um zu merken, dass es losgeht |
| **T0** | Timer läuft, Antwortzähler bei 0 | aktiv | |
| **T0 bis T+6** | Antwortzähler tickt hoch, sonst nichts. **Keine Verteilung, keine Namen** | Jeder Tap: Kachel 0,96 skaliert, Rahmen verdickt, Haptik, dann Vollbild-Form „Abgegeben" | Wer schnell antwortet, bekommt Ruhe — und schaut dadurch zu den anderen |
| **T+6 bis T+15** | Timerring wird ab 50 % kräftiger, ab 25 % pulsiert er im Sekundentakt | Wartende sehen „14 von 18 sind fertig" | Der Zähler ist die Dramaturgie. Er erzeugt Druck, ohne jemanden zu benennen |
| **Endspurt** (sobald nur noch ≤ 2 offen sind und > 5 s Restzeit) | Timer springt sichtbar auf 5 s, Zeile „Endspurt" | unverändert — der Nachzügler merkt nichts | Spart tote Zeit, ohne den Letzten vorzuführen. Die Zeile auf der Bühne verhindert, dass der Sprung als Willkür wirkt |
| **T+20 / alle fertig** | Timer auf 0, kurzer Schluss-Ton, Kacheln frieren 0,8 s ein | „Zeit vorbei" bzw. Wartescreen hält | Die Atempause vor der Auflösung. Ohne sie wirkt das Reveal gehetzt |
| **+0,8 bis +1,4** | Falsche Kacheln sinken auf 45 %, die richtige wächst um 6 %, Häkchen setzt auf | **gleichzeitig** Vollbild-Ergebnis: hell oder dunkel, Glyph, Wort | Die Gleichzeitigkeit ist der Lacher. Erst der Schrei im Raum, dann der Blick aufs Handy |
| **+1,4 bis +2,6** | Verteilungsbalken wachsen aus den Kacheln heraus (ease-out, 600 ms), Zahl zählt mit | Punkte zählen hoch (900 ms) | Zwei Zahlen, die gleichzeitig steigen — synchroner Rhythmus auf beiden Geräten |
| **+2,6 bis +4,5** | Zeile „11 von 17 richtig", Weiter-Button wird hell | Platz und Abstand schieben sich herein | Die Einordnung kommt erst, wenn der Punktestand steht |
| **Host drückt Weiter** | Zwischenstand, Zeilen tauschen Plätze (400 ms), Punkte zählen hoch | Handy wird dunkel und ruhig: nur Platz und Punkte, klein | Das Handy tritt bewusst zurück, damit alle zum Leaderboard schauen |
| **+7 s Zwischenstand** | stehen lassen, 7 s — ohne Fallunterscheidung | | Zeit zum Lästern. Das ist der soziale Kern des Abends. Die frühere Regel „bei > 10 Spielern 7 s, sonst 5 s" entfällt: Im Normalfall ~20 Spieler war nur noch ein Zweig erreichbar, und eine tote Verzweigung ist teurer als die feste Zahl |

**Wie lange muss die Frage lesbar sein, bevor die Antworten freigegeben werden?**

Rechnung: stilles Lesen liegt bei Erwachsenen bei 200–250 Wörtern/Minute; im Partykontext, aus 3 m, mit Nebengesprächen, konservativ gerechnet mit **160 Wörtern/Minute = 0,375 s pro Wort**. Antworten werden überflogen, nicht gelesen — dafür 40 % davon (0,15 s/Wort).

```
Lesefenster = 1,5 s  +  0,40 s × Wörter(Frage)  +  0,15 s × Wörter(alle Antworten)
              Mindestdauer 10,0 s, nach oben offen
```

Beispiele: kurze Frage (8 Wörter) mit vier Ein-Wort-Antworten → 1,5 + 3,2 + 0,6 = 5,3 s → **Mindestdauer 10 s**. Lange Frage (20 Wörter) mit vier dreiwortigen Antworten → 1,5 + 8,0 + 1,8 = **11,3 s**. Eine Frage an der 200-Zeichen-Grenze (rund 30 Wörter) mit denselben Antworten → 1,5 + 12,0 + 1,8 = **15,3 s**. Wahr/Falsch mit 6 Wörtern → 1,5 + 2,4 + 0,3 = 4,2 s → **Mindestdauer 10 s**.

Die Mindestdauer von 10 s je Frage ist gesetzt: jede Frage steht mindestens zehn Sekunden lesbar auf der Leinwand, auch die kürzeste. Eine Obergrenze gibt es nicht mehr. Die frühere Kappung bei 10 s war unter der Annahme 120 Zeichen Fragetext hergeleitet; mit den gesetzten 200 Zeichen hätte sie als Regel statt als Ausnahme gegriffen und ausgerechnet den langen Fragen die Lesezeit genommen, die sie brauchen. Den Rhythmus schützt stattdessen der Host: die Leertaste gibt jederzeit früher frei, und in der Praxis tut er das, sobald die Blicke oben sind. Das Lesefenster ist der Preis dafür, dass der Fragentext nicht auf dem Handy steht; ohne es wäre Regel 3 unfair statt elegant.

---

## 4. Antwort-Kodierung

Vier Farben, vier Formen, feste Paarung, feste Position. Die Position wechselt nie — „Randomize answer order" (MUST) mischt, welcher Antworttext auf welcher Kachel landet, nicht wo die Kacheln liegen.

| Position | Name | Form | Hex | Rel. Luminanz |
|---|---|---|---|---|
| oben links | **Sonne** | **Blitz** | `#FFC94D` | 0,636 |
| oben rechts | **Welle** | **Tropfen** | `#36BFE0` | 0,434 |
| unten links | **Glut** | **Herz** | `#B3350C` | 0,122 |
| unten rechts | **Nacht** | **Mond** (Sichel) | `#2B2A8C` | 0,041 |

Wahr/Falsch nutzt zwei volle Breitkacheln: oben **Sonne/Blitz = Wahr**, unten **Nacht/Mond = Falsch** — das Paar mit dem größten Helligkeits- und Farbabstand im ganzen Set.

**Warum diese Paarung.** Zwei Entwurfsregeln, beide prüfbar:

1. **Zwei Achsen statt einer.** Die Palette ist ein 2×2-Raster aus *warm/kühl* und *hell/dunkel*: Sonne (warm, hell), Welle (kühl, hell), Glut (warm, dunkel), Nacht (kühl, dunkel). Jedes Paar unterscheidet sich in mindestens einer Achse deutlich. Bei Rot-Grün-Schwäche kollabiert die Buntheit auf eine Blau-Gelb-Achse — genau die Achse, die hier erhalten bleibt, während das Paar auf derselben Achse über die Helligkeit auseinanderfällt.
2. **Mnemonik statt Konvention.** Blitz ist gelb, Tropfen ist blau, Herz ist rot, Mond ist dunkelblau — vier Zuordnungen, die niemand lernen muss. Keine der vier Formen ist Dreieck, Raute, Kreis oder Quadrat; die Silhouetten unterscheiden sich in Symmetrie (Blitz asymmetrisch-diagonal), Konkavität (Mond als einziger konkav), Seitenverhältnis (Herz breit, Tropfen schmal) und Oberkante (Tropfen spitz, Herz eingekerbt). Das bleibt auch bei 24 px und bei starker Unschärfe unterscheidbar.

**Kontraste, gerechnet (WCAG 2.1, Relativluminanz nach 1.4.3):**

| Paarung | Verhältnis | Anforderung | Status |
|---|---|---|---|
| Tinte `#121126` auf Sonne | **12,09 : 1** | 4,5 : 1 | erfüllt |
| Tinte `#121126` auf Welle | **8,54 : 1** | 4,5 : 1 | erfüllt |
| Papier `#F7F6FB` auf Glut | **5,69 : 1** | 4,5 : 1 | erfüllt |
| Papier `#F7F6FB` auf Nacht | **10,77 : 1** | 4,5 : 1 | erfüllt |
| Sonne auf Bühne `#121126` | 12,09 : 1 | 3 : 1 (1.4.11) | erfüllt |
| Welle auf Bühne | 8,54 : 1 | 3 : 1 | erfüllt |
| Glut auf Bühne | 3,03 : 1 | 3 : 1 | knapp erfüllt |
| **Nacht auf Bühne** | **1,60 : 1** | 3 : 1 | **verfehlt → Umriss nötig** |
| Sonne auf Weiß | 1,53 : 1 | — | heller Hintergrund nur mit Umriss |

Daraus eine harte Regel: **jede Antwortkachel bekommt einen 3-px-Umriss in Papier `#F7F6FB`** (Bühne; 2 px auf dem Handy). Der Umriss steht gegen die Bühne bei 17,22 : 1 und löst den Nacht-Fall. Er ist kein Zierrat, sondern die Kachelgrenze.

**Prüfung auf Farbfehlsichtigkeit** (Machado et al. 2009, Severity 1.0, Abstände als ΔE2000; ab ≈ 11 gilt ein Paar als klar unterscheidbar):

| Simulation | simulierte Hexwerte | schwächstes Paar | ΔE2000 |
|---|---|---|---|
| Normalsicht | — | Sonne / Glut | **45,6** |
| **Deuteranopie** | Sonne `#F2D44F`, Welle `#A9B4D9`, Glut `#8A7A12`, Nacht `#003C9B` | Sonne / Glut | **33,1** |
| **Protanopie** | Sonne `#D8C300`, Welle `#BCC0D4`, Glut `#605704`, Nacht `#0050B6` | Sonne / Glut | **43,6** |
| Tritanopie (zusätzlich geprüft) | — | Sonne / Glut | **36,8** |

Der kritische Fall ist erwartungsgemäß Sonne gegen Glut — beide warm, bei Rot-Grün-Schwäche beide gelblich. Er wird über die Helligkeit getragen: **Kontrastverhältnis Sonne zu Glut 3,64 : 1 unter Deuteranopie, 4,87 : 1 unter Protanopie**. Selbst in reiner Graustufe bleiben alle vier Kacheln unterscheidbar (Luminanzverhältnisse Sonne→Welle 1,42, Welle→Glut 2,82, Glut→Nacht 1,89) — damit trägt die Kodierung auch bei Achromatopsie und bei schlecht kalibrierten Beamern, die Farbe wegwaschen.

**Drittes, unabhängiges Merkmal:** die Position. Farbe, Form und Platz sagen dasselbe. Ein Spieler kann jede einzelne Information verlieren und trotzdem antworten — und auf dem Handy, wo kein Text steht, ist genau das die Lebensversicherung.

**Nebenfarben** (nie als Antwortfarbe verwenden): Bühne `#121126` · Fläche `#2B2752` · Linie `#413B73` · Papier `#F7F6FB` (17,22 : 1 auf Bühne) · Gedämpft `#A9A6C9` (7,92 : 1 auf Bühne) · Richtig-Mint `#3DDC97` (Tinte darauf 10,48 : 1) · Falsch-Plum `#3B1033` (Papier darauf 14,93 : 1) · Zu-spät-Schiefer `#3A3A4A`.

Richtig und Falsch werden **nicht über Rot/Grün** entschieden, sondern über drei Signale zugleich: Flächenhelligkeit (hell vs. dunkel), Glyph (Haken vs. Kreuz) und Wort.

---

## 5. Mikro-Feedback

**Beim Tippen (Z5).** Kachel skaliert in 80 ms auf 0,96 und federt in 120 ms zurück; Umriss verdickt von 2 auf 4 px; Haptik: ein kurzer Impuls von 10 ms. Direkt danach füllt die gewählte Form als Silhouette den Bildschirm (260 ms, ease-out) — das ist die Quittung, die man aus dem Augenwinkel sieht, ohne hinzusehen.
*Realitätsvorbehalt:* `navigator.vibrate` gibt es auf iOS/Safari nicht. Die Haptik ist deshalb Zugabe, nie Träger: jedes haptische Signal hat ein visuelles Gegenstück, das allein ausreicht.

**Richtig.** Fläche wird in 180 ms hell (Mint), Haken skaliert mit leichtem Überschwingen (220 ms, Overshoot 8 %), Punkte zählen in 900 ms hoch, Ziffern nicht springend, sondern rollend. Haptik: zwei kurze Impulse (20 ms – 40 ms Pause – 20 ms). Ton: nur auf der Bühne.

**Falsch.** Fläche wird in 180 ms dunkel (Plum), Kreuz blendet ohne Überschwingen ein, „+0" steht still, kein Hochzählen. Haptik: ein längerer Impuls (120 ms). Kein Rütteln, kein Rot, keine Verneinungsgeste — das Spiel geht zehnmal weiter, und wer neunmal bestraft wird, legt das Handy weg.

**Zu spät / nicht geantwortet.** Neutraler Schiefergrund, kein Glyph, kein Impuls. Der Unterschied zum Falsch-Screen ist absichtlich: Falsch ist eine Entscheidung, Zu-spät ist keine.

**Rang.** Aufstieg: die Platzzahl tauscht sich mit 220-ms-Schub von unten aus, dazu „▲ 4" in Sonne, einmal aufblitzend (300 ms). Abstieg: Schub nach unten, Pfeil in Gedämpft, keine Haptik, keine Farbe. Gleichbleibend: ein Strich, keine Bewegung. Auf der Bühne tauschen die Leaderboard-Zeilen physisch die Plätze (FLIP-Prinzip, 400 ms) — das Überholen muss man sehen, nicht lesen.

**Bühnen-Atmosphäre.** Lobby: langsamer Puls auf dem Spielerzähler, neue Namen schieben sich ein. Letzte 5 Sekunden: Timerring pulsiert im Sekundentakt, Hintergrund wird um 4 % dunkler. Podium: Konfetti nur auf Platz 1, 3 s, dann aus.

**Was an Audio gebraucht wird** (Eigenproduktion oder Lizenz, ausschließlich Bühne, jederzeit stummschaltbar): ein ruhiger, loopbarer Lobby-Track von 30–60 s ohne auffällige Melodie; ein Frage-Bett, das unter dem Timer liegt und in den letzten 5 Sekunden in der Tonhöhe steigt; ein Schluss-Signal von ~0,4 s beim Schließen der Frage; ein Reveal-Stinger von ~0,6 s; eine Erfolgsfigur (zwei Töne aufwärts, ≤ 0,4 s) und eine Misserfolgsfigur (ein Ton abwärts, ≤ 0,4 s, weich, nicht grell); eine Podium-Fanfare von 3–4 s. Alles muss auch über TV-Lautsprecher bei halber Lautstärke tragen, also mittenbetont, kein Bassfundament.

**Reduzierte Bewegung.** Bei `prefers-reduced-motion`: alle Positionswechsel werden zu Überblendungen, das Timer-Pulsieren entfällt (Restzeit bleibt als Zahl), Balken erscheinen in Endlänge, Konfetti entfällt. Der Informationsgehalt bleibt vollständig erhalten — das ist die Prüfbedingung.

---

## 6. Join-Flow

**Zielbild:** Jemand steht mit dem Handy im Raum, hat keine App, kein Konto, und spielt nach spätestens 20 Sekunden mit.

**Weg A — QR (der Normalfall):**

| Schritt | Budget |
|---|---|
| Kamera öffnen und auf die Leinwand richten | 4 s |
| QR erkannt, Banner antippen | 2 s |
| Seite lädt (Code aus der URL vorbelegt, Z1 wird übersprungen) | 1,5 s |
| Namensfeld ist bereits fokussiert, Tastatur offen, Name tippen | 7 s |
| „Mitspielen" | 1 s |
| **Summe** | **15,5 s** |

**Weg B — Code tippen** (wer die Kamera nicht findet oder keinen QR-Scanner hat):

| Schritt | Budget |
|---|---|
| Adresse eintippen oder aus dem Verlauf wählen | 6 s |
| Seite lädt | 1,5 s |
| 6 Ziffern auf dem Ziffernblock | 5 s |
| Name tippen und bestätigen | 7 s |
| **Summe** | **19,5 s** |

Damit das Budget hält, sind folgende Punkte keine Optimierung, sondern Voraussetzung:

- **Kurze Domain, kurzer Pfad.** Schema `domain.tld/j/492813`. Der QR enthält genau diese URL — kein Redirect, keine Query-Parameter, keine Tracking-Kette.
- **Kritischer Pfad unter 60 kB.** Die Beitrittsseite ist die einzige Seite, die über ein überlastetes WLAN oder schlechtes Mobilnetz geladen wird, und zwar von allen Geräten gleichzeitig — im Normalfall rund 20. **Das Budget bleibt trotzdem bei 60 kB**, denn bindend ist nicht die Gerätezahl, sondern das eine schlechte Mobilfunkgerät und der gemeinsame Access Point: 20 Geräte × 60 kB sind 1,2 MB, die ein Haushalts-WLAN in Bruchteilen einer Sekunde liefert, 500 Geräte wären 30 MB und sprengten das 1,5-Sekunden-Budget lange vor dem Server. Keine Webfonts im kritischen Pfad (Systemschrift bis zum Laden), kein Framework-Bootstrap vor dem ersten sichtbaren Feld.
- **Sechs Ziffern, numerisch.** `inputmode="numeric"` erzwingt den großen Ziffernblock; Darstellung gruppiert 3+3; Einfügen aus der Zwischenablage erlaubt; nach der sechsten Ziffer wird automatisch geprüft, ohne dass man „Weiter" drücken muss.
- **QR groß genug.** Auf der Leinwand mindestens 1/5 der Bildhöhe; ein Vollbild-QR ist einen Klick entfernt, damit auch die hintere Reihe scannen kann. Fehlerkorrekturstufe hoch (Q), weil Beamerbilder flau und Kamerawinkel schräg sind.
- **Der Code bleibt sichtbar.** Während des gesamten Spiels steht er klein in der Ecke der Bühne — für Nachzügler und für Wiederverbindungen (MUST aus der Analyse).
- **Kein Konto, keine E-Mail, kein Cookie-Banner.** Gespeichert wird ein Client-Token in `localStorage`, ausschließlich für die Wiederverbindung.
- **Name als letzter Schritt, nicht als erster.** Wer scannt, ist schon im Spiel; der Name ist die einzige verbleibende Hürde. Der Würfel-Button daneben ist der Ausweg für alle, die sich nicht entscheiden können — ein Tap statt sieben Sekunden Tippen, das ist der kürzeste mögliche Beitritt (**~9 s über QR**).
- **Der Namensfilter lehnt nicht ab, er benennt still um** (MUST aus der Analyse). Ein abgelehnter Name kostet einen zweiten Anlauf und erzeugt Trotz; ein stiller Rename kostet nichts.
- **Nachzügler dürfen rein, solange der Host nicht sperrt.** Einstieg bei laufender Runde mit 0 Punkten und der ehrlichen Zeile „Du steigst bei Frage 4 ein".

---

## 7. Design-Richtung

**Typografie — zwei Rollen, keine dritte.**
*Display* trägt alles, was aus 3 Metern gelesen wird: Fragentext, Zahlen, Plätze, Spielcode. Gerundete, kräftige Grotesk (Empfehlung: Fredoka SemiBold oder Baloo 2 — frei lizenziert, rund genug fürs Partygefühl, und markenrechtlich unauffällig). *Text* trägt alles Funktionale: Buttons, Hinweise, Editor, Auswertung. Neutrale Grotesk mit echten Tabellenziffern (Inter oder vergleichbar); Tabellenziffern sind Pflicht, weil Punktestände hochzählen und nicht springen dürfen.
Größen Bühne: Spielcode 180 px, Fragentext 56–72 px (bei 120 Zeichen auf drei Zeilen, nie unter 40 px), Antworttexte 32–40 px, Hilfstexte nie unter 24 px, absolutes Minimum 36 px für alles Spielrelevante. Größen Handy: Punktzahl 64 px, Wort-Feedback 40 px, Hilfstexte 16 px, nichts unter 14 px.

**Farbsystem.** Ein dunkler Grund auf beiden Geräten (`#121126`): auf der Leinwand, weil helle Vollflächen im abgedunkelten Raum blenden; auf dem Handy, weil die Helligkeitsumkehr beim Richtig-Screen dann als körperliches Ereignis wirkt. Die vier Antwortfarben sind **reserviert** — sie erscheinen nie an Buttons, Rahmen oder Dekor, sondern ausschließlich an Antwortkacheln und ihren Ableitungen (Balken, abgegebene Form). Sonne ist zusätzlich die einzige Akzentfarbe für positive Hervorhebungen (Platzgewinn, aktiver Button). Alles andere ist Papier, Gedämpft, Fläche, Linie.

**Dichte.** Bühne: höchstens fünf Informationsblöcke gleichzeitig, großzügige Ränder (mindestens 48 px, weil TV-Overscan und Beamer-Keystone die Ränder fressen), 8-px-Raster. Handy: höchstens drei Blöcke, Antwortkacheln füllen ~78 % der Viewporthöhe, Mindest-Tapfläche 72 × 72 CSS-px (WCAG 2.5.5 verlangt 44 — bei Einhandbedienung im Halbdunkel ist das zu wenig), 12 px Abstand zwischen den Kacheln, damit der Daumen nicht danebengreift. Die unteren zwei Drittel des Bildschirms gehören dem Daumen; oberhalb steht nur Nicht-Interaktives.

**Bewegungssprache.** Schnell und körperlich, nie dekorativ. Drei Dauern: 120 ms für Quittungen (Tap, Fokus), 240 ms für Zustandswechsel (Kachel schnappt auf, Rang schiebt), 400–900 ms für Dramatik (Balkenwachstum, Punkte-Hochzählen, Leaderboard-Tausch). Easing: `cubic-bezier(0.2, 0, 0, 1)` für alles Eintretende, `cubic-bezier(0.4, 0, 1, 1)` für alles Verschwindende. Verboten: Parallax, Weichzeichner, Leuchteffekte, Glas-Optik — auf Beamern sind sie unsichtbar und auf schwachen Handys ruckeln sie. Bewegung darf nie Information ersetzen; jede Animation hat einen Endzustand, der allein verständlich ist.

---

## 8. Die drei harten Randfälle

**8.1 Der Spieler, der zu spät antwortet.** Der Server nimmt Antworten nur im offenen Fragefenster an. Kommt eine Antwort danach an, sieht der Spieler den neutralen Schiefer-Screen „Zu spät · +0", ohne Glyph, ohne Vibration, ohne Rot. In der Auswertung zählt die Frage als unbeantwortet. Auf der Bühne erscheint er nie namentlich. Wichtig: Die Kachel zeigt vorher trotzdem die normale Tap-Quittung — der Spieler erfährt die Ablehnung erst im Ergebnis-Screen, weil ein sofortiges Zurückspringen wie ein Bug wirkt.

**8.2 Der Spieler, der die Verbindung verliert.** Erkennung clientseitig nach 2 s ohne Heartbeat. Der Buzzer legt ein Band über den oberen Rand: „Verbindung weg — ich versuch's weiter" in Gedämpft, die Kacheln bleiben sichtbar und bedienbar (die Antwort wird gepuffert und beim ersten erfolgreichen Reconnect gesendet; kommt sie zu spät an, gilt 8.1). Nach 10 s wird das Band zum Vollbild-Hinweis mit Button „Neu verbinden".
Beim Wiederverbinden: kein Wiedereinstiegsformular, kein Namensdialog. Der Client-Token aus `localStorage` stellt Identität und Punktestand her (MUST aus der Analyse: Bindung an Token, nicht an den Namen). Der Spieler sieht 1,5 s „Willkommen zurück, Mira · 3 410 Punkte" und landet dann exakt im aktuellen Zustand der Runde. Lief die Frage noch und hatte er nicht geantwortet, sind die Kacheln sofort aktiv — mit der Restzeit, die tatsächlich übrig ist, nicht mit einer frischen. Die verlorene Zeit kostet Punkte; das wird mit der Zeile „Die Verbindung war weg" benannt statt kaschiert.
Auf der Bühne: der Name bekommt einen kleinen Umriss-Zustand in der Lobby; während des Spiels wird **nichts** angezeigt — der Antwortzähler zählt ihn weiterhin als offen, mehr braucht der Raum nicht zu wissen.

**8.3 Der Einzige, der noch nicht geantwortet hat.** Entwurfsregel: **niemand wird vorgeführt.** Die Bühne zeigt immer nur die Zahl („17 von 18"), nie Namen, nie eine Liste der Ausstehenden, auch nicht bei einem einzigen Verbleibenden. Stattdessen greift der Endspurt: Sobald höchstens zwei Antworten offen sind und mehr als 5 s Restzeit bleiben, springt der Timer auf 5 s und die Bühne zeigt „Endspurt". Auf dem Gerät des Nachzüglers ändert sich nichts — kein „Alle warten auf dich", keine zusätzliche Vibration, kein schnellerer Puls. Wer ohnehin schon unter Druck steht, braucht keinen zweiten.
Die Gegenprobe gehört in die offenen Entscheidungen: Manche Gruppen wollen genau diese Häme. Der Endspurt ist deshalb als Schalter zu bauen, und die namentliche Anzeige ausdrücklich nicht.

---

## 9. Begründete Abweichungen vom Auftrag

1. **Kein Dateioutput durch den Agenten.** Der Lauf war auf lesende Werkzeuge beschränkt; diese Datei wurde nachträglich aus dem Agentenbericht abgelegt. Inhalt unverändert bis auf die Ersetzung einiger Emoji-Glyphen in den Wireframes durch Textplatzhalter.
2. **Der Quiz-Editor (B2) ist bewusst flach beschrieben.** Er steht als MUST in der Analyse, trägt aber nichts zum Spielgefühl bei; Tiefe wäre hier Platzverschwendung gegenüber Bühne und Buzzer.
3. **Das Lesefenster ist kein MUST aus der Feature-Analyse**, sondern die direkte Folge der Vorgabe, dass die Frage nicht auf dem Handy steht. Ohne es wäre die Regel unfair gegenüber langsameren Lesern.
4. **Stummes Handy.** Die Analyse führt Soundeffekte als SHOULD. Eingeschränkt auf die Bühne — schon bei zwanzig Geräten im selben Raum ist Ton auf dem Handy destruktiv.
5. **Endspurt und Namens-Tabu bei Nachzüglern** sind eigene Dramaturgie-Entscheidungen ohne Vorbild in der Analyse, mit Begründung in 8.3.
6. **Sechsstelliger numerischer Code trotz des Brute-Force-Hinweises** in der Analyse (Abschnitt 8.2). Die 20-Sekunden-Vorgabe ist ohne kurze Codes nicht haltbar; die Gegenmaßnahmen (Sperren der Lobby, Drosselung) sind Serverthema und gehören in `konzept-architektur.md`. Als offene Entscheidung aufgeführt.
7. **Keine Markenelemente und kein Produktname.** Weder „PIN" noch Kahoot-nahe Begriffe verwendet (durchgehend „Spielcode"); die Oberflächentexte sind eigene Formulierungen.

---

## 10. Offene Entscheidungen

1. **Produktname und Wortmarke.** Das Konzept arbeitet durchgehend mit „Spielcode", „Bühne", „Buzzer" als Arbeitsbegriffen. Der Name fehlt — und er bestimmt rückwirkend Typografie und Tonalität.
2. **Herz oder Stern für Glut?** Das Herz hat die stärkere Farb-Mnemonik und die klarste Silhouette, trägt aber eine Zuneigungs-Konnotation. Der Stern ist neutraler und schwächer gemerkt. Empfehlung: Herz.
3. **Endspurt an oder aus?** Spart pro Frage bis zu 15 Sekunden tote Zeit, nimmt aber Nachzüglern die volle Bedenkzeit. Als Host-Schalter bauen, Default: an.
4. **Darf der Fragentext als Barrierefreiheits-Option doch aufs Handy?** Für Sehbehinderte, die 3 Meter nicht überbrücken, und für Screenreader-Nutzer wäre das der einzige Zugang. Es durchbricht Regel 3 — deshalb Vorschlag: als individuelle Option pro Spieler, nicht als Host-Einstellung, und mit sichtbarer Kennzeichnung beim Host.
5. **Codelänge und Zeichenvorrat.** Sechs Ziffern halten das 20-Sekunden-Budget, machen den Codeeraum aber klein. Alternative: acht Ziffern (+2–3 s) oder sechs alphanumerische Zeichen (fehleranfälliger beim Vorlesen). Entscheidung hängt an der erwarteten Zahl paralleler Runden.
6. **Antwortzeit-Default.** Gesetzt: 20 s. Für Spieleabende mit Alkohol eher 25–30 s, für schnelle Runden 15 s. Einmal am echten Fernseher gegentesten.
7. **Heller Modus für die Bühne?** Alle Kontraste sind für den dunklen Grund gerechnet. Ein heller Modus (Tageslicht, Beamer mit schwachem Kontrast) braucht eine zweite Kontrastrechnung und dunkle Kacheloutlines — Aufwand etwa ein halber Tag, Nutzen nur bei hellen Räumen.
8. **Zwischenstand abschaltbar?** Die Analyse nennt das als echte Lücke beim Vorbild. Für Spieleabende mit stark unterschiedlichen Spielstärken kann „Leaderboard erst am Ende" die Stimmung retten. Reine Host-Einstellung, kleiner Aufwand.
9. **Streak-Zähler als reine Anzeige?** Das Vorbild hat den Punktebonus abgeschafft, zeigt die Serie aber weiter. Als Anzeige billig und motivierend; als Bonus unfair. Empfehlung: Anzeige ja, Bonus nein.
10. **Was passiert nach dem Podium?** „Nochmal spielen" mit derselben Lobby ist billig zu bauen und verlängert den Abend. Soll die Spielerliste dabei erhalten bleiben (schnell, aber Nachzügler brauchen den Code erneut) oder eine frische Lobby entstehen?
