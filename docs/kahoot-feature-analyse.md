# Kahoot! — Vollständige Feature-Analyse als Clone-Grundlage

**Recherchestand:** 2026-10-19
**Zweck:** Rechercheberichte-Dokument. Keine Architektur, kein Code, keine Rechtsberatung.
**Quellenlage:** Ausschließlich öffentlich zugängliche Seiten (support.kahoot.com, kahoot.com, kahoot360.com, trust.kahoot.com, öffentliche Repos und Foren). Keine Login-Umgehung.

**Prioritäts-Legende (Sicht: MVP eines spielbaren Multiplayer-Quiz):**

| Marker | Bedeutung |
|---|---|
| **MUST** | Ohne das ist das Produkt nicht spielbar oder nicht wettbewerbsfähig im Kern |
| **SHOULD** | Deutlicher Mehrwert, aber MVP funktioniert ohne |
| **COULD** | Nice-to-have, Differenzierung, späte Ausbaustufe |

**Unsicherheits-Marker:** `[?]` = nicht abschließend belegt, als unsicher zu behandeln.

---

## 0. Kurzfassung für Eilige

Kahoot! ist längst kein reines Quiz mehr, sondern eine Plattform mit drei Achsen: **Fragetypen** (14+, überwiegend kostenpflichtig), **Experiences** (16+ Spielmodi vom nüchternen „Classic" bis zu Spielwelten wie „Robot Run"), und **Session-Typen** (Live, Assignment/self-paced, Study-Modi). Der spielbare Kern ist klein und präzise: PIN-Join ohne Account, 4 farbige Antwortkacheln, zeitabhängige Punkte nach einer öffentlich dokumentierten Formel, Zwischen-Leaderboard, Podium, Report.

Genau dieser Kern ist der MVP. Alles andere ist Ausbau.

Ein Befund, der Architektur und Produktentscheidung vorwegnimmt: **Der Streak-Bonus existiert heute nicht mehr als Punktemechanik.** Kahoot bestätigt das ausdrücklich („No, having a streak of correct answers does not provide extra points"). Wer Kahoot nachbaut und dabei die 2016er-Streak-Formel aus alten Blogposts übernimmt, baut eine Version nach, die es seit Jahren nicht mehr gibt. Details in Abschnitt 5.

---

## 1. Host-Flow

### 1.1 Quiz erstellen (Creator)

| Feature | Beschreibung | Priorität |
|---|---|---|
| Kahoot-Creator mit Fragenliste links, Editor rechts | `Create` → `Add question` öffnet die Fragetyp-Auswahl | **MUST** |
| Fragetext | max. 120 Zeichen (hartkodiertes Limit, laut Support nicht durch Upgrade erweiterbar) | **MUST** |
| Antworttexte | max. 75 Zeichen (Quiz/Poll/Puzzle), 20 Zeichen (Type Answer, Word Cloud), 250 Zeichen (Open-ended), 10 Zeichen (Slider) | **MUST** |
| Zeitlimit pro Frage | 5 s – 4 min, je nach Fragetyp andere Untergrenze (Quiz/True-False/Poll ab 5 s, Slider ab 10 s, Type Answer/Puzzle/Word Cloud/Open-ended/Pin ab 20 s, Brainstorm ab 30 s, Default 120 s) | **MUST** |
| Zeitlimit global setzen | „Can be applied to each question individually or set for all questions at once" | **SHOULD** |
| Punkte-Toggle pro Frage | 0 / Standard (1000) / Double (2000) | **MUST** |
| Bild-Upload je Frage | eigenes Bild oder Bild-Bibliothek | **MUST** |
| Bilder als Antwortoptionen | kostenpflichtig | **COULD** |
| Video-Einbettung | YouTube oder Vimeo. **Achtung:** YouTube für Business- und Social-User nicht mehr unterstützt | **COULD** |
| Mehr als 4 Antwortoptionen (bis 6) | kostenpflichtig | **COULD** |
| Multi-Select-Toggle | „one or more than one answer" pro Frage | **SHOULD** |
| Import aus Spreadsheet | offizielles .xlsx-Template; **nur Standard-Quiz-Fragen**, keine anderen Typen, keine Bilder, keine Sonderzeichen; Zeitwerte beschränkt auf 5/10/20/30/60/120 s; korrekte Antworten als kommaseparierte Nummern („1" oder „2,3"); Fehlerprüfung beim Upload mit Option, fehlerhafte Fragen zu verwerfen | **SHOULD** |
| Import aus Slides | eigener Import-Pfad | **COULD** |
| KI-Fragengenerator | mehrere Formate (Quiz, Presentation, True-or-false, Brainstorm, Workshop, Pitch) | **COULD** |
| Kahoots kombinieren | zwei bestehende Kahoots zusammenführen statt Export/Import | **COULD** |
| LaTeX / mathematische Symbole | per Copy-Paste in den Creator, auch als LaTeX-Code | **COULD** |
| Fragenanzahl-Limit | laut Nutzerkommentar 100 Fragen `[?]` — nicht offiziell bestätigt | — |

Quellen: https://support.kahoot.com/hc/en-us/articles/115002308428-Kahoot-question-types · https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot · https://support.kahoot.com/hc/en-us/articles/34251401475101-How-to-choose-the-right-format-when-generating-a-kahoot-with-AI

### 1.2 Themes und Branding

Drei Stufen, Verfügbarkeit nach Tarif:

| Stufe | Umfang | Priorität |
|---|---|---|
| **Standard Theming** | Firmenlogo (JPG/PNG, max. 2 MB) + 4 Standard-Hintergründe | **COULD** |
| **Custom Theming** | Logo, eigenes Hintergrundbild (JPG, max. 2 MB, empfohlen 3840×2560), Hintergrund-Farbwähler, Kontrastfarben | **COULD** |
| **Immersive Branding** | 112 Custom-Fonts, kuratierte Farbpaletten, markeneigener Lobby-Track | **COULD** |

Organisatorisch relevant: Owner/Admins können Themes organisationsweit sichtbar machen und ein Default-Theme setzen; Member sehen ihre eigenen Themes nur selbst; Limited Members nur im privaten Workspace. Themes mit hochgeladenem Logo sind **nicht für öffentliche Spiele verfügbar** — das Kahoot muss privat oder unlisted sein.

Quelle: https://support.kahoot.com/hc/en-us/articles/4433531677715-How-to-use-themes

### 1.3 Spiel starten

Der Host hat drei Einstiege nebeneinander: **Host live**, **Lecture**, **Assign**.

1. Login, Kahoot aus **Library** oder **Discover** öffnen
2. `Host live` → Lobby
3. Experience/Spielmodus aus einem Karussell am unteren Bildschirmrand wählen
4. Optional: Playlist mehrerer Spiele aufbauen
5. PIN und QR-Code erscheinen auf dem Host-Screen
6. `Start`

Technische Mindestanforderung laut Kahoot: Projektor/Großbildschirm oder Screensharing mit **min. 1024×768**.

Ein Vorschau-/Preview-Modus existiert zum Durchspielen ohne echte Session.

Quelle: https://support.kahoot.com/hc/en-us/articles/360039422694-How-to-host-a-live-kahoot

### 1.4 Lobby

| Feature | Beschreibung | Priorität |
|---|---|---|
| Game-PIN groß auf Host-Screen | bleibt während des Spiels sichtbar, damit Nachzügler und Reconnects beitreten können | **MUST** |
| QR-Code | vergrößerbar | **SHOULD** |
| Direkter Join-Link | umgeht manuelle PIN-Eingabe | **SHOULD** |
| Spielerliste mit Nicknames | wächst live | **MUST** |
| Spieler entfernen | Klick auf den Nickname kickt den Spieler — **nur vor Spielstart** | **MUST** |
| Lock game joining | Schloss-Button neben `Start`, sperrt weitere Beitritte | **SHOULD** |
| Lobby-Musik mit Track-Auswahl und Preview | saisonale Tracks (Halloween, Christmas), „Original" jederzeit wählbar | **COULD** |
| Volume-Regler / Mute | nur wenn kein Lobby-Video läuft | **COULD** |
| Vollbild-Button | versteckt das Browser-UI | **SHOULD** |
| Teilnehmerzähler gegen Tarif-Limit | | **SHOULD** |

### 1.5 Live-Game-Settings (Zahnrad unten rechts)

Dies ist die vollständige öffentlich dokumentierte Liste. Einstellungen werden **für die nächste Session gespeichert**, einige sind zwischen Fragen änderbar.

**Game options / Recommended**

| Setting | Wirkung | Priorität |
|---|---|---|
| Show questions & answers | Fragen und Antworten auch auf dem Spielergerät anzeigen — kostenlos für alle | **MUST** |
| Player identifier | Spieler über mehrere Spiele hinweg verfolgbar machen, Reports kombinierbar | **SHOULD** |
| Themes | Theme-Wahl auch zur Spielzeit | **COULD** |
| Game characters | Spieler wählen und individualisieren einen Avatar | **COULD** |

**General**

| Setting | Wirkung | Priorität |
|---|---|---|
| Lobby music | Track-Auswahl | **COULD** |
| Sound effects | In-Game-Sounds an/aus | **SHOULD** |
| Language | UI-Sprache für Host und Spieler. **Übersetzt den Quiz-Inhalt ausdrücklich nicht** | **SHOULD** |

**Accessibility**

| Setting | Wirkung | Priorität |
|---|---|---|
| Increase contrast | Antwortkachel-Farben für bessere Lesbarkeit, „recommended when using a projector" | **SHOULD** |
| Unlimited time | unbegrenzte Antwortzeit — nur in der Accuracy Experience | **SHOULD** |

**Hosting**

| Setting | Wirkung | Priorität |
|---|---|---|
| Reactions | Spieler können während des Spiels reagieren | **COULD** |
| Randomize order of questions | geht nicht, wenn Slides enthalten sind | **SHOULD** |
| Randomize order of answers | Antwortpositionen mischen (auch Anti-Abschreiben) | **MUST** |
| Autoplay | Auto-Start nach 15 s ohne neuen Beitritt bei min. 1 Spieler; Ergebnis- und Leaderboard-Screens je 5 s; Neustart oder nächstes Spiel der Playlist am Ende. Für Kiosk-/Autopilot-Betrieb | **COULD** |
| Q&A | Publikum kann während der Präsentation Fragen stellen | **COULD** |
| Allow team selection | Spieler wählen Team und Teamnamen selbst | **COULD** |

**Learning**

| Setting | Wirkung | Priorität |
|---|---|---|
| Team Talk | Diskussionsfenster vor der Antwortabgabe, 5–20 s abhängig vom Fragentimer, default an | **COULD** |

**Security & privacy**

| Setting | Wirkung | Priorität |
|---|---|---|
| Nickname generator | Spieler drehen ein Rad statt zu tippen, max. 3 Spins, 2-Wort-Namen wie „kind tiger". Auch während des Spiels umschaltbar | **SHOULD** |
| 2-Step Join | nach der PIN muss ein 4-Kachel-Muster vom Host-Screen nachgetippt werden | **SHOULD** |
| Remove players | nur vor Spielstart | **MUST** |
| Lock game joining | | **SHOULD** |
| End kahoot | springt direkt zum Podium | **MUST** |

Quelle: https://support.kahoot.com/hc/en-us/articles/115016055107-Live-game-settings

> **Widerspruch in den Quellen:** Die Live-Game-Settings-Seite sagt, das 2-Step-Join-Muster wechsle **alle sieben Sekunden**; der dedizierte 2-Step-Join-Artikel sagt **„refreshes every ~10 seconds"** bzw. „roughly every 10 seconds". Ein Drittanbieter-Blog nennt sieben Sekunden. Für einen Clone ist die exakte Zahl ohnehin eine eigene Designentscheidung — festzuhalten ist nur die Größenordnung „einstellige bis knapp zweistellige Sekundenzahl".
> Quellen: https://support.kahoot.com/hc/en-us/articles/115016055107-Live-game-settings · https://support.kahoot.com/hc/en-us/articles/35342050693789-How-to-use-the-2-step-Join-option-to-secure-your-game

### 1.6 Spielablauf (Host-Sicht)

1. Frage wird auf dem Host-Screen angezeigt, Timer läuft
2. Antwortzähler („x Antworten") statt Live-Ergebnissen
3. Nach Ablauf oder wenn alle geantwortet haben: Antwort-Reveal mit Balkendiagramm der Antwortverteilung
4. Zwischen-Leaderboard (Top-Spieler)
5. Nächste Frage, Host steuert per Klick oder Leertaste
6. Podium

Nicht möglich laut Support: Leaderboard nach jeder Frage ausblenden oder die korrekte Antwort unterdrücken. Workaround laut Kahoot: Nickname-Generator für Anonymität, oder per Leertaste schnell weiterschalten, bevor das Podium vollständig aufgedeckt ist.

Ebenfalls nicht möglich: Punkte pro Frage und Spieler live sehen. „Access to per-question, per-player points is only available in the game's reports after the session is completed."

Quelle: https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work

**Clone-Bewertung:** Antwortzähler statt Live-Verteilung ist **MUST** (sonst schreiben alle voneinander ab). Balkendiagramm beim Reveal **MUST**. Zwischen-Leaderboard **MUST**. Die Option, das Leaderboard abzuschalten, ist eine echte Differenzierungschance — Kahoot-Nutzer fordern sie seit Jahren vergeblich.

### 1.7 Podium

- Top 3 mit Podest-Darstellung, Game Characters werden hier mit angezeigt
- „Game Over"-Screen mit `Find a new kahoot` und `Play Again` (Rematch/Ghosts)
- Podium ist später aus dem Report heraus erneut aufrufbar und teilbar

**Priorität: MUST.** Das Podium ist emotional der Produktkern.

### 1.8 Feedback-Umfrage

Am Ende eines Live-Spiels kann der Host `Get feedback` klicken und eine Standard-Feedback-Umfrage an die Teilnehmer senden. Die Antworten werden im Report aggregiert. **Nicht verfügbar beim Hosten über die Mobile-App.**

**Priorität: COULD.**

### 1.9 Reports

| Bereich | Inhalt | Priorität |
|---|---|---|
| Auffinden | `Reports` im linken Menü, getrennt nach Kahoots / Courses / Stories / Combined reports; Filter nach Live games, Assigned kahoots, Courses, Kahoots mit Player identifier; Sortierung nach Name, Datum, Game mode, Created by, Teilnehmerzahl | **SHOULD** |
| Workspace-Bindung | Reports hängen am aktiven Workspace — ein häufiger Supportfall | — |
| **Summary** | Durchschnittsscore, Teilnehmerzahl, Fragenzahl, Dauer (nur Live), Game mode, Datum, Host-Username, Podium teilen | **MUST** |
| **Difficult questions** | welche Fragen am schwersten fielen | **SHOULD** |
| **Create** | Folge-Kahoot aus problematischen Fragen generieren — erscheint ab >3 Fragen, die <35 % richtig beantwortet haben | **COULD** |
| **Need help** | Teilnehmer mit Follow-up-Bedarf | **SHOULD** |
| **Didn't finish** / **Didn't start** | unvollständige Teilnehmer; bei Assignments mit `Remind`-Button für E-Mail-Erinnerung (Nachricht bis 250 Zeichen) | **COULD** |
| **Participants** | Leaderboard mit % richtig, unbeantwortete Fragen, Endscore; Drilldown je Teilnehmer | **MUST** |
| **Questions** | Ergebnisse Frage für Frage mit Detailanalyse | **SHOULD** |
| **Feedback** | aggregierte Umfrageantworten | **COULD** |
| Report-Aktionen | Umbenennen, Download (.xlsx), Drucken, Löschen (Trash mit Wiederherstellung), Play again, Podium ansehen/teilen | **SHOULD** |
| Combined reports | mehrere Sessions zusammenführen — setzt Player identifier voraus | **COULD** |
| Reports-API | offiziell dokumentiert | **COULD** |

Wichtig für die Datenmodellierung: **Ein Teilnehmer kann nicht mit demselben Nickname erneut beitreten, selbst wenn er aus dem Report entfernt wurde.** Der Nickname ist also innerhalb einer Session dauerhaft belegt, nicht nur solange der Spieler verbunden ist.

Quelle: https://support.kahoot.com/hc/en-us/articles/360035063054-Kahoot-quiz-reports

---

## 2. Player-Flow

### 2.1 Beitreten

Drei Wege, alle ohne Account:

| Weg | Ablauf | Priorität |
|---|---|---|
| **Game-PIN** | kahoot.it oder App → `Join` → PIN → `Enter` | **MUST** |
| **Direkter Link** | öffnet die Session ohne PIN-Eingabe | **SHOULD** |
| **QR-Code** | Kamera oder In-App-Scanner | **SHOULD** |

Kritisch: **Weder Link noch QR umgehen 2-Step Join.** Wenn der Host es aktiviert hat, gilt der Muster-Schritt auch für Quick-Join-Wege. Das ist eine Designentscheidung, die man beim Nachbau bewusst treffen muss — sonst ist die Schutzmaßnahme wertlos.

Nach dem Beitritt, abhängig von den Host-Einstellungen:
1. ggf. **Player identifier** eingeben (z. B. E-Mail)
2. **Nickname** tippen oder generieren lassen
3. ggf. **2-Step-Join-Muster** nachtippen

Quelle: https://support.kahoot.com/hc/en-us/articles/360039890713-Kahoot-join-How-to-join-a-Kahoot-game

### 2.2 Nicknames

| Mechanismus | Verhalten | Priorität |
|---|---|---|
| Freie Eingabe | Standard | **MUST** |
| **Automatischer Nickname-Filter** | serverseitige Deny-List „universally inappropriate" Wörter; verletzende Namen werden **automatisch in etwas Neutrales umbenannt**, nicht abgelehnt. Kahoot bestätigt False Positives (Beispiel: „router") und bietet manuelle Allow-/Deny-List-Pflege per Support-Ticket | **MUST** |
| **Nickname-Generator** | Rad drehen, max. 3 Spins, 2-Wort-Namen („kind tiger"), auch während des Spiels umschaltbar; erklärter Zweck: DSGVO/COPPA-Konformität und Anonymität | **SHOULD** |
| Entfernen aus der Lobby | Klick auf den Namen | **MUST** |

Der stille Rename statt der Ablehnung ist ein kluges Detail: Der Trollende merkt nicht sofort, dass er gefiltert wurde, und probiert nicht sofort die nächste Umgehung.

Quelle: https://support.kahoot.com/hc/en-us/articles/115002201267-How-to-handle-inappropriate-nicknames

### 2.3 Antwort-Screen

| Element | Beschreibung | Priorität |
|---|---|---|
| 4 (bis 6) farbige Antwortkacheln mit Symbolen | Kahoot nutzt Farbe **und** Form — wichtig für Farbfehlsichtigkeit | **MUST** |
| Fragen und Antworten auf dem Spielergerät | optional per `Show questions & answers`, kostenlos | **MUST** |
| Typ-spezifische Eingaben | Texteingabe (Type Answer), Drag-Sortierung (Puzzle), Slider (auch Pfeiltasten/PageUp/Down), Bild-Pin-Platzierung per Drag, Freitext | **SHOULD** |
| Screenreader-Unterstützung | Host und Lernende; „Read Aloud" in den Mobile-Apps | **SHOULD** |

### 2.4 Feedback nach der Antwort

- Richtig/Falsch-Screen mit Punkten für diese Frage
- Aktueller Rang und Abstand zum Vordermann
- **Streak-Zähler** als visuelles Feedback — siehe Abschnitt 5 zur Punktewirkung

**Priorität: MUST** (Richtig/Falsch + Punkte + Rang). Streak-Anzeige **SHOULD**.

### 2.5 Reconnect

Ein Detail mit echtem Architektur-Gewicht, und die Quellen widersprechen sich je nach Modus:

- **Classic/Live:** „Tap to rejoin game" → `Resume as [nickname]` behält den Score. Wer stattdessen einen neuen Nickname wählt, startet bei null.
- **Team experience:** „It's not possible to rejoin with the same nickname and accumulated points after leaving the game (e.g. closing the app or the tab; losing connectivity). Participants who rejoin the game need to provide a new nickname and collect points from the beginning."
- **Assignments:** Resume über denselben Browser und dasselbe Gerät, solange der Cache nicht geleert wurde; in der Mobile-App automatisch gespeichert.

Für einen Clone heißt das: Session-Resume ist **MUST**, und die Bindung sollte nicht allein am Nickname hängen, sondern an einem Client-Token. Kahoots Inkonsistenz zwischen den Modi ist eher ein historischer Unfall als ein Vorbild.

Quellen: https://support.kahoot.com/hc/en-us/articles/360039422694-How-to-host-a-live-kahoot · https://support.kahoot.com/hc/en-us/articles/4408679135891-Team-experience-How-to-play-kahoot-in-groups

### 2.6 Scoreboard

Zwischenstand nach jeder Frage mit Top-Platzierungen; bei Team-Spielen Teamscores statt Einzelscores (Einzelscores erst im Report). Game Characters erscheinen auf Scoreboard und Podium.

**Priorität: MUST.**

---

## 3. Spielmodi („Kahoot! experiences")

Kahoot nennt Spielmodi heute **Experiences**. Die Verfügbarkeit hängt am Tarif. Auswahl erfolgt nach `Host live` in einem Karussell.

### 3.1 Kern-Experiences

| Experience | Mechanik | Priorität |
|---|---|---|
| **Classic** | Einzelspieler gegen alle, Punkte nach Geschwindigkeit + Korrektheit | **MUST** |
| **Accuracy** | Nur Korrektheit zählt, Geschwindigkeit nicht. **Jede richtige Antwort = 1 Punkt.** Teilrichtige (Multi-Select) und fast richtige (Slider) Antworten gelten als richtig. Kein Double Points. Erlaubt `Unlimited time` | **SHOULD** |
| **Confidence** | Classic plus Konfidenz-Angabe nach der Antwort; richtig + hohe Konfidenz gibt extra, Fehler kosten. Wer richtig antwortet, aber keine Konfidenz wählt, wird schrittweise auf das Minimum (500 Punkte) heruntergestuft | **COULD** |
| **Team — Shared devices** | Ein Gerät pro Team, Teamleiter gibt ein, kann Namen der Mitspieler hinterlegen, Team Talk 5 s. **Für Business-Accounts nicht verfügbar** | **SHOULD** |
| **Team — Personal devices** | Eigenes Gerät pro Spieler, Teams automatisch zugeteilt und bei Dropouts **automatisch rebalanciert**; mit höheren Tarifen eigene Teamnamen und Line-ups, Host kann Spieler per Drag zwischen Teams verschieben | **SHOULD** |
| **Professional (Presentation mode)** | Content-Präsentation mit eingestreuten Fragen, für Meetings/Trainings | **COULD** |
| **Lecture** | Vorlesungsformat, eigener Einstiegsbutton neben `Host live` | **COULD** |
| **Unplugged** | Teilnahme **ohne eigene Geräte**, nur über den geteilten Screen; betont Review und Gruppendiskussion statt Tempo | **COULD** |

### 3.2 Spielwelt-Experiences (gamifizierte Overlays auf denselben Fragen)

Alle bauen auf demselben Frage-/Antwort-Kern auf und ersetzen nur die Belohnungsdarstellung:

| Experience | Mechanik |
|---|---|
| **Color Kingdoms** | Zwei Teams erobern Kartenfelder; meiste Kacheln gewinnt |
| **Chill Art** | Kollaborativ Pinsel sammeln und ein Bild aufdecken |
| **Submarine Squad** | Kollaborativ ein U-Boot vor Fischen schützen |
| **Tallest Tower** | Teams bauen den höchsten Turm |
| **Treasure Trove** | Schätze sammeln mit „brain breaks" zwischen Fragen; Schätze müssen im Vorbeifliegen angetippt werden |
| **The Lost Pyramid** | Teams stimmen über die Antwort ab **und geben eine Konfidenz an** — höhere Konfidenz bewegt weiter nach oben |
| **Robot Run** | Flucht vor einem Roboter, mit Minispielen und Kollaborationsaufgaben |
| **Cosmic Conquest** | Weltraum-Variante, Ablauf ähnlich Tallest Tower |
| **Marble Race** | Richtige Antworten geben Murmeln; am Ende ein glücksbasiertes Murmelrennen. Bewusst **Zufallselement**, damit nicht immer der Schnellste gewinnt |

**Priorität insgesamt: COULD.** Aber architektonisch die wichtigste Beobachtung des Berichts: Kahoot hat die Spiel-Engine strikt von der Darstellungs-/Belohnungsschicht getrennt. Ein Clone, der das von Anfang an als Plugin-Punkt vorsieht, bekommt später neun Spielmodi fast geschenkt. Ein Clone, der die Classic-Darstellung fest verdrahtet, bekommt keinen.

Marble Race verdient eine eigene Notiz: Es ist Kahoots Antwort auf ein echtes Problem — in jeder Klasse gewinnt sonst immer dasselbe Kind. Ein Zufallsfinale ist billig zu bauen und hat hohen wahrgenommenen Wert.

Quelle: https://support.kahoot.com/hc/en-us/articles/35636870654867-Kahoot-experiences

### 3.3 Live vs. Self-Paced

| Dimension | **Live game** | **Assignment (self-paced)** |
|---|---|---|
| Takt | Host schaltet weiter | Teilnehmer in eigenem Tempo |
| Anzeige | Host-Screen + Spielergerät | alles auf dem Spielergerät |
| Zugang | PIN / Link / QR | PIN / Link / QR |
| PIN-Gültigkeit | an die Session gebunden | **bis zur Deadline** |
| Deadline | — | bis zu **28 Tage** in der Zukunft, stundengenau; manche Tarife erlauben „No deadline" |
| Timer | nicht abschaltbar | **vollständig abschaltbar** → keine Zeitabzüge |
| 2-Step Join | ja | **nein** — „not part of the assignment flow" |
| Leaderboard ausblenden | nein | nein |
| Mehrfach-Teilnahme | — | ein Durchlauf pro Nickname; danach nur „practice the questions they got wrong" |
| Nach Abschluss editierbar | — | **Nein.** Änderungen am Kahoot schlagen nicht auf laufende Assignments durch; neue Assignment nötig |
| Reminder | — | `Remind`-Button mit E-Mail an Nicht-Starter |
| Brainstorm | voll (sammeln, gruppieren, abstimmen) | **nur Ideen einreichen**, kein Gruppieren/Abstimmen |
| Game Characters | ja | nein (nur Live + Solo in der App) |
| Einbettung | — | Assignment auf einer Webseite einbettbar |
| Teilen | — | Google Classroom, MS Teams, Remind |

**Priorität:** Live **MUST**, Assignment **SHOULD**. Assignment ist der günstigste Weg zu Retention nach dem ersten Spiel.

Begriffsklärung: Was früher „Challenge" hieß, läuft heute unter **Assignment** bzw. „learner-paced". „Challenge" findet sich nur noch in Altbeständen und Nutzerkommentaren.

Quelle: https://support.kahoot.com/hc/en-us/articles/360039411334-How-to-assign-a-kahoot-in-web-platform

### 3.4 Ghost Mode — heute „Rematch experience"

Ghost Mode existiert weiter, heißt aber jetzt **Rematch experience (Play again with ghosts)**:

- Am Ende eines Live-Spiels: `Play Again` auf dem Game-Over-Screen
- Aus den Spielerdaten eines vergangenen Spiels werden „Ghosts" generiert, gegen die das Publikum antritt
- Eine Klasse kann gegen ihre eigenen Vorscores antreten oder gegen die einer früheren Klasse
- Auch nachträglich aus der Reports-Seite über das Drei-Punkte-Menü aufrufbar
- Laut Nutzerbericht **nicht abschaltbar** `[?]` — Lehrkräfte beklagen, dass Ghosts die Sicht auf echte Antworten stören

**Priorität: COULD.** Sehr günstig zu bauen (die Daten liegen im Report ohnehin vor) und didaktisch wertvoll, weil Wiederholung messbar wird.

Quellen: https://support.kahoot.com/hc/en-us/articles/115000510968-Rematch-experience-Play-again-with-ghosts · https://kahoot.com/blog/2015/03/20/introducing-ghost-mode-repetition-self-motivation/

### 3.5 Study-Modi (Solo, asynchron)

Wird ein Kahoot nur **geteilt** statt zugewiesen, stehen Selbstlern-Modi offen: **Learn**, **Flashcards**, **Play Solo** — beliebig oft wiederholbar. Game Characters funktionieren im Solo-Modus nur in der Mobile-App.

**Priorität: COULD.**

Quelle: https://support.kahoot.com/hc/en-us/articles/360021489353-How-to-use-Kahoot-study-modes

---

## 4. Fragetypen im Detail

Kahoot gliedert in **Test knowledge**, **Collect opinions** und **Slides**. Mit Stern markierte Typen erfordern einen höheren Tarif. Entscheidend: **Ohne passenden Tarif lässt sich ein Spiel mit diesen Typen nicht einmal speichern** — „You cannot create, edit and save games with this question type if you are not subscribed to a plan that includes this feature."

### 4.1 Test knowledge

| Typ | Free? | Zeitlimit | Punkte | Spezifika | Priorität |
|---|---|---|---|---|---|
| **Quiz** (Multiple Choice) | **Free** | 5 s – 4 min | 0/1000/2000 | 2–6 Antworten, min. 1 richtig; leere Antworten erscheinen nicht; Single- oder Multi-Select; Antworten als Text (75 Z.) oder Bild; >4 Antworten kostenpflichtig | **MUST** |
| **True or False** | **Free** | 5 s – 4 min | 0/1000/2000 | Antworten fix und nicht editierbar, genau eine richtig | **MUST** |
| **Type Answer** | Paid | **20 s** – 4 min | 0/1000/2000 | 1–4 akzeptierte Antworten à 20 Z.; **nicht case-sensitive**; Mehrfach-Leerzeichen = ein Leerzeichen; Emojis zählen nur ohne weiteren Text; umfangreiche Interpunktion wird ignoriert (``~ ` ! @ # $ % ^ & * ( ) { } [ ] ; : " ' < , . > ? / \ \| - _ + =``); Host kann im Live-Spiel **nachträglich weitere eingereichte Antworten als richtig anerkennen** (Lehrkräfte brauchen dafür EDU); Work/Home-Accounts sehen alle eingereichten Antworten, School/Higher-Ed nur die richtigen | **SHOULD** |
| **Puzzle** (Ordering) | Paid | 20 s – 4 min | 0/1000/2000 | 3–4 Antworten à 75 Z. in korrekte Reihenfolge; separater „Text to be read aloud" (120 Z.); bei gleichen Werten in mehreren Antworten sind mehrere Reihenfolgen gültig | **SHOULD** |
| **Slider** | Paid | **10 s** – 4 min | 0/1000/2000 | Antwort max. 10 Z.; **20 % Geschwindigkeit / 80 % Präzision**; Antwort-Margin none/low/medium/high/maximum; Schrittzahl und Schrittwert automatisch aus Min/Max; optionale Einheit (20 Z.); Tastatursteuerung | **COULD** |
| **Pin answer** | Paid | 20 s – 4 min | 0/1000/2000 | Bild **zwingend**; korrekte Zone beliebiger Größe und Form definierbar; keine GIFs/Videos | **COULD** |

### 4.2 Collect opinions (keine Punkte, kein Leaderboard danach)

| Typ | Free? | Zeitlimit | Spezifika | Priorität |
|---|---|---|---|---|
| **Poll** | Paid | 5 s – 4 min | kein Richtig/Falsch, keine Punkte, kein Leaderboard; Text (75 Z.) oder Bild; Single/Multi-Select | **SHOULD** |
| **Word cloud** | Paid | 20 s – 4 min | 20 Z. pro Antwort; häufige Antworten größer; Report zeigt Top-10, volle Cloud nur per PDF-Download | **COULD** |
| **Open-ended** | Paid | 20 s – 4 min | 250 Z.; Teilnehmer wählt ein Wort zum Hervorheben; Antworten auf scrollbarer Wand | **COULD** |
| **Brainstorm** | Paid | **30 s** – 4 min (default 120 s) | bis 5 Ideen à 75 Z. pro Teilnehmer (Anzahl im Creator einstellbar); **KI-Gruppierung** der Ideen, vom Host per Ungroup korrigierbar und per Drag regruppierbar; danach bis 180 s Voting (abhängig von der Ideenzahl), unbegrenzt viele Stimmen; **Top-3-Ideen: 1000 Punkte pro Stimme**; Stimme für die eigene Idee zählt nicht; max. 3000 Punkte pro Teilnehmer; in Assignments nur Einreichung | **COULD** |
| **Drop pin** | Paid | 20 s – 4 min | **keine Punkte möglich**; Bild Pflicht, keine Videos; alle Pins erscheinen gemeinsam auf dem Host-Screen, ausblendbar; Drag auf dem Gerät; Tastatur-Navigation über Tab + Pfeiltasten | **COULD** |
| **Scale** | Paid | — | Likert (1–5) oder Custom (Endpunkte frei zwischen 0 und 10); Labels für die Extrempunkte, auch custom | **COULD** |
| **NPS Scale** | Paid | — | Net Promoter Score; Gruppierung in Detractors / Passives / Promoters; Ampeldarstellung rot/gelb/grün | **COULD** |

### 4.3 Slides

| Typ | Free? | Spezifika | Priorität |
|---|---|---|---|
| **Slide** | Paid | Content-Slides zwischen Fragen; **blockiert `Randomize order of questions`**; laut Nutzerkommentaren waren lange keine zwei Slides hintereinander möglich `[?]` | **COULD** |

### 4.4 Entscheidungshilfe für den MVP

Der spielbare Kern besteht aus **Quiz (Single-Select, 2–4 Antworten) und True/False**. Das deckt Kahoots kostenlosen Umfang vollständig ab. Alle übrigen Typen sind bei Kahoot kostenpflichtig — und genau hier liegt die klarste Wettbewerbslücke: Mehrere Marktbegleiter positionieren sich ausdrücklich damit, dass „diverse question types are limited to higher plans" bei Kahoot gilt, bei ihnen aber nicht.

Reihenfolge nach Aufwand-zu-Wirkung für einen Clone:
1. Quiz + True/False (**MUST**)
2. Type Answer — hoher didaktischer Wert, moderater Aufwand (Normalisierung!) (**SHOULD**)
3. Poll — technisch fast identisch zu Quiz, nur ohne Scoring (**SHOULD**)
4. Puzzle und Word Cloud — eigene UI, aber überschaubare Logik (**COULD**)
5. Slider, Pin answer, Drop pin, Open-ended, Brainstorm, Scale, NPS (**COULD**)

Quelle für alle Angaben in Abschnitt 4: https://support.kahoot.com/hc/en-us/articles/115002308428-Kahoot-question-types

---

## 5. Scoring-Mechanik

### 5.1 Punktwerte

| Fall | Maximalpunkte |
|---|---|
| Single-Select, Standard | **1000** |
| Single-Select, Double Points | **2000** |
| Punkte aus | **0** |
| Multi-Select, Standard | **500 pro richtiger Antwort** → 2000 bei 4 richtigen, 3000 bei 6 richtigen |
| Multi-Select, Double Points | **1000 pro richtiger Antwort** → 4000 bei 4 richtigen, 6000 bei 6 richtigen |

**Kein Teilpunktesystem bei Multi-Select:** „If a player chooses even one incorrect option alongside correct ones, they receive 0 points for the entire question."

### 5.2 Die Zeitformel (offiziell dokumentiert)

```
Punkte = round( (1 - ((Antwortzeit / Fragentimer) / 2)) × Maximalpunkte )
```

In Kahoots eigener Notation: `⌊ ( 1 - (( {response time} / {question timer} ) / 2 )) {points possible} ⌉`

Schrittweise am offiziellen Beispiel (2 s Antwortzeit, 30 s Timer, 1000 Punkte):
1. 2 / 30 = 0,0667
2. 0,0667 / 2 = 0,0333
3. 1 − 0,0333 = 0,9667
4. 1000 × 0,9667 = 966,7
5. gerundet: **967 Punkte**

**Zwei Konsequenzen, die man beim Nachbau leicht übersieht:**

- **Der Punkteverlust ist gedeckelt bei 50 %.** Wer die volle Zeit ausschöpft, bekommt immer noch die Hälfte. Der Faktor liegt in `[0.5, 1.0]`. Das ist das Gegenteil dessen, was viele Spieler annehmen — und erklärt, warum Nachdenken sich lohnt.
- **Unter 0,5 Sekunden greift die Formel nicht.** „If a player responds correctly in less than 0.5 seconds, the speed reduction formula is bypassed, and they automatically receive the maximum number of points." Eine Toleranzschwelle gegen Netzwerk-Jitter — und gleichzeitig eine Stelle, die ein Clone ohne serverseitige Zeitmessung angreifbar macht.

### 5.3 Streak-Bonus

**Heute: keiner.** Kahoots eigene FAQ, Stand Oktober 2026:

> „Do answer streaks give extra points in kahoot? **No**, having a streak of correct answers does not provide extra points."

Historisch gab es ab ca. 2016/2017 einen echten Streak-Bonus. Kahoots eigener Produktmanager beschrieb damals im Engineering-Blog: Bonus steigt mit der Streak-Länge, **ab Answer Streak 5 bei 500 Punkten gedeckelt**, während der Streak-Level unbegrenzt weiterzählt. Die Mechanik war in der Community stark umstritten — ein Support-Forum-Thread mit dem Titel „Disable Answer Streak Bonus" (Status: Completed) dokumentiert die Kritik: Wer die ersten fünf Fragen richtig und die letzten fünf falsch hat, schlägt jemanden mit neun von zehn richtigen.

**Für den Clone:** Der Streak-**Zähler** als visuelles Feedback ist wertvoll und billig (**SHOULD**). Ein Streak-**Bonus** auf die Punkte ist eine bewusste Designentscheidung mit bekannten Fairness-Problemen — Kahoot hat ihn abgeschafft. Wenn überhaupt, dann von Anfang an abschaltbar.

Quellen: https://support.kahoot.com/hc/en-us/articles/115002303908-How-points-work · https://medium.com/inside-kahoot/experimenting-with-answer-streaks-to-help-make-learning-awesome-3b3357e42595 · https://support.kahoot.com/hc/en-us/community/posts/360033686653-Disable-Answer-Streak-Bonus

### 5.4 Abweichende Scoring-Regeln

| Fall | Regel |
|---|---|
| **Slider** | 20 % Geschwindigkeit, 80 % Präzision. Margin none/low/medium/high/maximum; bei „maximum" bekommen alle Antworten Punkte, je näher desto mehr |
| **Brainstorm** | **Zeit spielt keine Rolle.** Punkte nach Stimmenzahl; die meistgewählte Idee ist das Maximum (default 1000) wert, jede Stimme anteilig; max. 3000 Punkte pro Teilnehmer |
| **Accuracy experience** | **1 Punkt pro richtiger Antwort**, keine Geschwindigkeit, kein Double Points; teilrichtige (Multi-Select) und fast richtige (Slider) Antworten zählen als richtig |
| **Confidence experience** | Konfidenz-Angabe nach der Antwort; wer richtig antwortet, aber keine Konfidenz wählt, wird schrittweise auf 500 Punkte heruntergestuft |
| **Team experience** | Teamscore = **Durchschnitt** der Einzelscores der Teammitglieder nach Standardformel. Teams können unterschiedlich groß sein — der Durchschnitt gleicht das aus |
| **Poll / Word cloud / Open-ended / Drop pin** | keine Punkte, kein Leaderboard danach |

### 5.5 Zeitdruck abschalten

- **Live:** nicht vollständig möglich. Entweder Accuracy experience (nur Korrektheit) oder den Timer verlängern. In Accuracy zusätzlich `Unlimited time`.
- **Assignment:** Timer komplett abschaltbar → keine Geschwindigkeitsabzüge.

**Clone-Empfehlung:** Ein globaler Schalter „Zeit zählt / Zeit zählt nicht" gehört von Anfang an ins Datenmodell, nicht nachträglich. Kahoot musste dafür zwei getrennte Experiences bauen.

---

## 6. Nebenfeatures

### 6.1 Avatare / Game Characters

| Aspekt | Detail | Priorität |
|---|---|---|
| Verfügbarkeit | Nur **Live experience** (Web + App) und **Solo-Modus** (nur App) | **COULD** |
| Default | School-Lehrkräfte, Social-User und Studenten: **an**. Business und Higher Ed: **aus** | — |
| Ablauf | Zufälliger Character bei Beitritt, per Stift-Icon anpassbar; Characters und Accessoires in Tabs; `Done` bestätigt | — |
| Darstellung | Neben dem Nickname in der Lobby, auf Scoreboard und Podium | — |
| Einschränkung | **Nicht im Report enthalten** | — |

Quelle: https://support.kahoot.com/hc/en-us/articles/10712953904147-How-to-use-game-characters

### 6.2 Musik und Sound

| Feature | Detail | Priorität |
|---|---|---|
| Lobby-Musik mit Track-Auswahl | saisonale Tracks, „Original" jederzeit wählbar, Preview-Button | **SHOULD** |
| Sound effects | In-Game-Sounds bei Fragen und Antwort-Reveal, abschaltbar | **SHOULD** |
| Volume / Mute | nur wenn kein Lobby-Video läuft | **SHOULD** |
| Lobby-Track als Branding-Element | Teil von Immersive Branding | **COULD** |

Musik ist für die wahrgenommene Produktqualität überproportional wichtig — und gleichzeitig der wichtigste Lizenz-Stolperstein, siehe Abschnitt 7.

### 6.3 Branding

Siehe 1.2. Drei Stufen, Logo max. 2 MB, Hintergrund max. 2 MB / 3840×2560, 112 Custom-Fonts in der höchsten Stufe, markeneigener Lobby-Track. **COULD**, aber der wichtigste Monetarisierungshebel im B2B.

### 6.4 Player identifier

Erlaubt, Teilnehmer über mehrere Sessions hinweg zu verfolgen (z. B. E-Mail-Abfrage beim Beitritt), ermöglicht **Combined reports** und Langzeit-Performance-Tracking. Verfügbarkeit tarifabhängig. In Assignments Voraussetzung für Resume über „Your learning" und für E-Mail-Reminder.

**Priorität: SHOULD** — ohne das ist jedes Spiel eine anonyme Insel und Lernfortschritt nicht messbar.

Quelle: https://support.kahoot.com/hc/en-us/articles/360036178314-Player-identifier

### 6.5 Bibliothek, Discover, Teilen, Kollaboration

| Feature | Detail | Priorität |
|---|---|---|
| **Library** | eigene und gespeicherte Kahoots | **MUST** |
| **Discover** | öffentlicher Katalog fertiger Kahoots, auch von Partnern | **COULD** |
| Sichtbarkeit | öffentlich / privat / unlisted. Für Prüfungen empfiehlt Kahoot ausdrücklich **privat**, „so it's not discoverable by services that scan public games for answers" | **SHOULD** |
| **Shared workspaces** | Rollen Owner / Admin / Member / **Limited member**; Limited Members haben keinen Report-Zugriff im Shared Workspace und können Themes nur privat anlegen | **COULD** |
| Reports pro Workspace | jeder Workspace hat eine eigene Reports-Ansicht | — |
| Kahoot teilen | an einzelne Nutzer oder Gruppen | **SHOULD** |
| Teilen in Drittsysteme | Google Classroom, MS Teams, Remind | **COULD** |
| Integrationen | Zoom, MS Teams, Google Classroom Add-on | **COULD** |
| Embedding | Assignment auf eigener Webseite einbetten | **COULD** |
| Playlists | mehrere Spiele nacheinander, relevant für Autoplay/Kiosk | **COULD** |
| Courses / Stories / Kahootopia | eigene Container-Formate mit eigenen Reports | **COULD** |

### 6.6 Spielerlimits pro Tarif

Die vollständige öffentliche Matrix (Stand 2026-10-19). Zahlen = gleichzeitige Teilnehmer, getrennt für Live/Present und Assign.

**Home / Study / Higher Education (aktuelle Tarife):**

| Tarif | Live | Assign |
|---|---|---|
| Kahoot! Go | 10 | 10 |
| Kahoot! Plus Bronze | 50 | 50 |
| Kahoot! Plus Silver | 100 | 100 |
| Kahoot! Plus Gold | 200 | 200 |
| Kahoot! One | 800 | 800 |
| Kahoot! One Max | 2000 | 2000 |
| Kahoot! One Ultra | 4000 | 4000 |

**School (K-12) — abweichend:**

| Tarif | Live | Assign |
|---|---|---|
| Kahoot! Go | **40** | **40** |
| Plus Bronze / Silver / Gold | 50 / 100 / 200 | 50 / 100 / 200 |
| One / One Max / One Ultra | 800 / 2000 / 4000 | 800 / 2000 / 4000 |
| EDU Standard School & District | 800 | 800 |
| EDU Pro School & District | 2000 | **10000** |

**Higher Education (zusätzlich):** EDU Standard Institution 800/800, EDU Pro Institution 2000/2000.

**Work / Business (Kahoot! 360):**

| Tarif | Present | Assign |
|---|---|---|
| 360 Express | **15** (und je Session max. **15 Minuten**) | — |
| 360 Pro Start | 50 | 50 |
| 360 Pro Standard | 200 | 200 |
| 360 Pro Plus | 1000 | 1000 |
| 360 Pro Max | 2000 | 2000 |
| 360 Pro Ultra | 5000 | 5000 |
| 360 Spirit | 400 | 400 |
| 360 Spirit Premium | 2000 | 2000 |

**Event-Tarife (einmalig):** 360 Event Standard 200, Event Plus 1000, Event Max 2000, Event Ultra 5000.

**Harte Einschränkungen im Free-Bereich:**
- Freie **Business**-User: Der Support-Artikel nennt **3 Teilnehmer** für selbst erstellte Spiele und ebenfalls 3 für Spiele aus Discover bzw. dem „Free Resources"-Channel; die FAQ derselben Seite nennt für den „Kahoot! at Work"-Channel **50**; die 360-Pricing-Seite nennt für Express **15** bei max. 15 Minuten Session-Dauer. **Drei widersprüchliche Zahlen in Kahoot-eigenen Quellen** — als unsicher zu behandeln `[?]`. Gemeinsamer Nenner: Der kostenlose Business-Einstieg ist faktisch nicht für echte Veranstaltungen nutzbar.
- **Junge Lernende** (unter 13 in den USA, unter 14 in Korea, unter 16 sonst) sind auf Kahoot! Go auf **exakt 10 Spieler im Classic-Modus** begrenzt — eine Datenschutz-, keine Monetarisierungsgrenze.
- **Team-Modus:** Die Summe aller Teammitglieder darf das Gesamtlimit nicht überschreiten, die Verteilung auf Teams ist frei (Beispiel aus der Doku: 200 + 1800 bei 2000 Limit). Laut Support-Kommentar ist ein freier Higher-Ed-Account auf **5 Teams** begrenzt `[?]`.
- Manche Tarife erlauben, die Team-Experience **genau einmal** zu testen, danach ist ein Upgrade nötig.

Quelle: https://support.kahoot.com/hc/en-us/articles/115003072287-How-many-participants-can-play-a-kahoot

### 6.7 Accessibility

| Feature | Priorität |
|---|---|
| Increase contrast für Antwortkacheln | **SHOULD** |
| Screenreader-Unterstützung für Host und Lernende | **SHOULD** |
| „Read Aloud" in den Mobile-Apps | **COULD** |
| Separates „Text to be read aloud"-Feld bei Puzzle und Slider | **COULD** |
| Tastaturbedienung: Slider per Pfeiltasten/PageUp-Down, Drop-Pin-Bild per Tab + Pfeiltasten | **SHOULD** |
| Unlimited time (Accuracy) | **SHOULD** |
| Self-paced als a11y-Pfad (alles auf dem eigenen Gerät, Screenreader-tauglich) | **SHOULD** |

Farbe **und** Form auf den Antwortkacheln ist der wichtigste a11y-Baustein und kostet nichts — bei Kahoot von Anfang an so gelöst.

---

## 7. Rechtlich/markenrechtlich: was nicht übernommen werden darf

*Kurzer Hinweis, keine Rechtsberatung. Vor Launch ist anwaltliche Prüfung angezeigt.*

Die Trennlinie verläuft zwischen **Funktionsprinzip** und **Ausdrucksform**. Spielmechaniken und Abläufe — PIN-Join, zeitabhängige Punkte, Zwischen-Leaderboard, Podium — sind als solche nicht monopolisierbar. Konkrete Ausdrucksformen sind es sehr wohl.

**Nicht übernehmen:**

- **Name und Wortmarke „Kahoot!"** — inklusive der Schreibweise mit Ausrufezeichen. Kahoots eigene Markenrichtlinie verlangt ausdrücklich die Verwendung mit „!". Auch Ableitungen und klangähnliche Namen sind riskant.
- **Produktspezifische Begriffe** wie „Kahoot PIN", „a kahoot", „kahooting", „Kahoot! experiences", „Kahootopia". Neutrale Alternativen: Spiel-PIN, Quiz, Spielmodus.
- **Logo und Logo-Varianten** — die Assets stehen zwar als ZIP zum Download, aber für die Berichterstattung über Kahoot, nicht zur Verwendung in Konkurrenzprodukten.
- **Die exakte Farbwelt** — insbesondere die vier Antwortfarben in genau dieser Kombination und Zuordnung zu genau diesen vier Symbolen (Dreieck, Raute, Kreis, Quadrat). Vier farbige Kacheln mit unterscheidbaren Formen sind eine Funktionslösung; genau Kahoots Palette plus genau Kahoots Formen in genau dieser Paarung ist eine Nachahmung.
- **Die Typografie** der Marke (Montserrat in Kahoots Markenanwendung) im Zusammenspiel mit dem restlichen Erscheinungsbild.
- **Musik und Sound-Effekte** — der Lobby-Track und die Countdown-Musik sind urheberrechtlich geschützte Kompositionen und zugleich hoher Wiedererkennungswert. Hier liegt das praktisch größte Risiko, weil Entwickler die Sounds gern „zum Testen" übernehmen und sie dann im Release bleiben. Eigene Komposition oder lizenzierte Library-Musik.
- **Maskottchen, Game Characters und Illustrationen** — die Charaktere, ihre Accessoires und die Illustrationen der Spielwelten.
- **Wortlaut der Oberflächentexte** — Formulierungen wie „Let's go!", „Nice!", „Make learning awesome!", „Game PIN", Podium-Texte. Eigene Tonalität entwickeln.
- **Screenshots und Marketingbilder.**
- **Abgegriffene Inhalte** — öffentliche Kahoots sind User Content. Die Nutzungsbedingungen weisen das Urheberrecht am User Content dem erstellenden Nutzer zu. Fremde Quiz-Inhalte nicht in die eigene Bibliothek übernehmen.

**Aus den Nutzungsbedingungen und der Acceptable Use Policy relevant** (betrifft auch die eigene Recherche, nicht nur das Produkt):

- Terms §3: „All trademarks displayed on the Kahoot! Platform are the sole property of Kahoot! or its licensors" und „does not grant you any rights to use any mark for any purpose".
- Terms §19 definiert „Kahoot! Brands" als „all Kahoot! trademarks, service marks, trade names, logos, domain names".
- AUP: kein Zugriff „through any automated, unethical or unconventional means" und „by any means other than through the means we provide"; keine Aktivität, „that disrupts or interferes with our Services and Resources"; kein Versuch, „to copy, duplicate, reproduce, sell, trade, or resell our Resources".

Praktische Folge für die Recherchephase: **Nicht gegen die laufende Plattform testen, nicht scrapen, keine Bots gegen echte Sessions.** Die Analyse in diesem Bericht stützt sich ausschließlich auf publizierte Dokumentation.

**Was unbedenklich ist:** Das Spielprinzip, die Abläufe, die dokumentierte Punkteformel als mathematisches Verfahren, die Fragetyp-Konzepte, eigene Farben und Formen, eigene Musik, eigener Name. Ein Clone, der eine eigene Marke aufbaut statt Kahoots zu spiegeln, hat die beste Position — rechtlich wie geschäftlich.

Quellen: https://trust.kahoot.com/terms-and-conditions/ · https://trust.kahoot.com/acceptable-use-policy/ · https://kahoot.com/library/kahoot-logo/ · https://kahoot.com/files/2017/08/Kahoot-BrandGuide-July2019.pdf

---

## 8. Technische Beobachtungen

*Alles aus öffentlicher Dokumentation und öffentlichen Repos. Keine Tests gegen die laufende Plattform, keine Bots, kein Login.*

### 8.1 Realtime-Transport

**Offiziell belegt** (Kahoots eigener Netzwerk-Artikel): Live-Spiele laufen über WebSocket.

| Rolle | Endpunkt |
|---|---|
| Spieler | `wss://kahoot.it/cometd` |
| Host | `wss://play.kahoot.it/cometd` |
| Migration/zusätzlich | `wss://game.kahoot.it`, `wss://new-game.kahoot.it/` — laut Kahoot „while we perform migrations" |
| Anti-Bot | `https://captcha.kahoot.it/` — ausdrücklich „to prevent bots from joining games and to keep sessions safe" |

Kahoots eigene Begründung für WebSockets: Verbindung bleibt bis Spielende offen, niedrige Latenz bei geringer Bandbreite.

Quelle: https://support.kahoot.com/hc/en-us/articles/115003198708

Der Pfadbestandteil `/cometd` verrät die Protokollfamilie: **CometD / Bayeux**. Die Community-Dokumentation (`kahoot.js`, theusaf) beschreibt den Ablauf konzeptionell so:

1. `GET https://kahoot.it/reserve/session/{gameid}` — liefert JSON mit `challenge`, `namerator`, `twoFactorAuth`, `participantId`, `smartPractice`, `gameMode`, dazu den HTTP-Header `x-kahoot-session-token`. Bei unbekannter PIN: „Not found".
2. Die `challenge` ist ein **JavaScript-Funktions-String**, den der Client auswerten muss.
3. Header-Token wird base64-dekodiert und mit dem Challenge-Ergebnis zu einem Verbindungstoken kombiniert.
4. WebSocket zu `wss://kahoot.it/cometd/{gameid}/{token}`.
5. `/meta/handshake`, dann `/meta/connect`.

**Kanalstruktur:** `/meta/handshake`, `/meta/connect`, `/meta/disconnect`, `/service/controller`, `/service/status`, `/service/player`. Als veraltet markiert: `/meta/subscribe`, `/meta/unsubscribe`, `/controller/{pin}`.

**Handshake-Parameter:** `advice` mit Interval und Timeout 60000 ms, `version`/`minimumVersion` 1.0, `supportedConnectionTypes` `websocket` und `long-polling`, fortlaufender Nachrichtenzähler `id`.

**Heartbeat:** Server sendet Ping, Client antwortet auf `/meta/connect` mit Pong. Dessen `ext` trägt `ack` und `timesync`.

**Reconnect:** Handshake wiederholen, dann ein Relogin-Paket.

Quellen: https://kahoot.js.org/class/client · https://kahoot.js.org/enum/LiveMessageChannel · https://kahoot.js.org/enum/LiveClientHandshake · https://kahoot.js.org/enum/LiveSessionClientToken

> **Aktualitätsvorbehalt — wichtig:** `kahoot.js-updated` ist seit **19.02.2021 archiviert**, `kahoot-api-docs` seit **15.05.2021**. Die offizielle Endpunktliste nennt inzwischen `game.kahoot.it`-Endpunkte, die in der Community-Doku nicht vorkommen. **Die Handshake- und Challenge-Details sind daher als historisch, nicht als aktuell zu behandeln.** `[?]`

**Einordnung für einen Clone:** Die Challenge-Funktion wird vom Server geliefert und vom Client ausgewertet — sie ist eine Hürde, kein Sicherheitsanker. Wer sie als Schutz nachbaut, baut Sicherheitstheater. Der Schutz muss aus Rate-Limiting, Session-Bindung und serverseitiger Validierung kommen.

### 8.2 Game-PIN

Die offizielle Dokumentation nennt **keine Stellenzahl**. Belegt ist nur:

| Befund | Beleg |
|---|---|
| PIN ist temporär, vom Host erzeugt, nach Spielende ungültig | https://support.kahoot.com/hc/en-us/articles/360000109048 |
| Live-PIN laut Kahoot **bis zu 8 Stunden** gültig | ebd. |
| Assignment-PIN gültig **bis zur Deadline** | ebd. |
| Keine öffentliche Liste aktiver PINs | ebd. |
| **8-stelliges Beispiel** („Or join with PIN: 03518037") im Assignment-Screenshot | https://support.kahoot.com/hc/en-us/articles/360039411334-How-to-assign-a-kahoot-in-web-platform |
| 6- und 7-stellige PINs existierten 2017 | GitHub-Issue https://github.com/unixpickle/kahoot-hack/issues/86 |
| „6 bis 10 Ziffern" | **nur Drittquellen**, z. B. techprevue.com — `[?]` nicht offiziell belegt |

**Fazit:** Die Länge ist offenbar variabel, mindestens 6 bis mindestens 8 Stellen. Eine feste Zahl lässt sich öffentlich nicht belegen.

**Für den Clone — und das ist kein Detail:** Ein 6-stelliger numerischer Raum hat 10⁶ Kombinationen. Bei 1000 parallelen Sessions ist jede tausendste Zufallseingabe ein Treffer. Das ist ohne Rate-Limit in Minuten durchsuchbar — und genau das tun existierende Tools. Empfehlung: längerer oder alphanumerischer Raum, strikte Drosselung von Fehlversuchen pro Herkunft, kurzes Join-Fenster plus Lock-Funktion.

### 8.3 Timing und Latenz

**Wo die Antwortzeit gemessen wird, ist öffentlich nicht dokumentiert.** Es gibt zwei Indizien:

1. **Clock-Sync existiert im Protokoll.** Die Community-Doku zeigt `timesync`-Felder in Handshake und Pong: `l` (Latenz), `o` (Offset), `tc` (Client-Zeitstempel in ms). Beim ersten Handshake sind `l` und `o` null, später sendet der Client berechnete Werte. Das ist CometD-Timesync-Standard. **Ob Kahoot diese Werte bei der Punktewertung verrechnet, ist nicht belegt.** `[?]`
   Quelle: https://kahoot.js.org/enum/LiveTimesyncData
2. **Host-seitige Auswertung angedeutet.** Ein Kahoot-Mitarbeiter schreibt im Community-Forum, das Host-Gerät sei „critical in calculating several data points for participants, such as if the submitted response is correct and how many points to award".
   Quelle: https://support.kahoot.com/hc/en-us/community/posts/27352194885651-Timer-not-synced-on-student-devices

**Belegte Timer-Drift:** Im selben Thread berichtet eine Lehrkraft von bis zu **15 Sekunden Abweichung** zwischen Spieler- und Host-Timer bei einer 60-Sekunden-Frage. Kahoots Antwort ordnet das als Latenz-, Netzwerk- und Geräteproblem ein — nicht als Sync-Fehler. Das ist der ehrlichste verfügbare Hinweis darauf, dass Kahoot Latenz **nicht** systematisch kompensiert.

Dazu passt die 0,5-Sekunden-Schwelle in der Punkteformel: Sie ist genau die Art Toleranz, die man einbaut, wenn man weiß, dass die gemessene Zeit Jitter enthält.

**Empfehlung für den Clone** (eigene Ableitung, kein Kahoot-Beleg): Antwortzeit **serverseitig** messen — Server-Zeitstempel des Frage-Starts bis Antworteingang, optional abzüglich gemessener RTT/2 pro Client. Client-Zeitstempel niemals vertrauen, aber als Plausibilitätsprüfung mit hartem Maximal-Offset verwenden. Die Kompensation offenlegen, damit sie nicht als Willkür wahrgenommen wird.

### 8.4 Anti-Cheat und das Flooder-Problem

**Das Problem, sachlich.** Öffentliche Reverse-Engineering-Projekte zeigen drei Muster — hier nur zur Verteidigungsplanung beschrieben, ohne Umsetzungsdetails:

| Muster | Beschreibung | Beleg |
|---|---|---|
| **PIN-Flooding** | Massenhaft Fake-Spieler per PIN, Spam-Namen, Zufallsantworten. Die Lobby wird unbenutzbar, echte Teilnehmer gehen unter | https://github.com/michaelshumshum/kahoot-annoyer |
| **PIN-Raum-Scanning** | Automatisches Abtasten aktiver Spielcodes — der Angreifer braucht die PIN gar nicht zu kennen | ebd. |
| **Antwort-Bots** | Lesen Quiz-Daten öffentlicher Kahoots samt Lösungen und antworten mit künstlicher Verzögerung. Der Autor nennt es ausdrücklich „Proof of Concept, to show how easy it is to cheat" | https://github.com/yuvix25/kahoot-answer-bot |
| **Antwort-Scraper** | Apps und Dienste, die zu öffentlichen Quizzen die Lösungen anzeigen | Play-Store-Eintrag „Kahoot Answers" |

Kahoot selbst nennt Bot-Floods als mögliche Ursache für scheinbaren Verbindungslag.

**Kahoots dokumentierte Gegenmaßnahmen:**

| Maßnahme | Wirkung | Grenze |
|---|---|---|
| **2-Step Join** | 4-Kachel-Muster vom Host-Screen; wechselt alle 7–10 s; QR und Direktlink umgehen es **nicht** | Nur Live-Lobby, **nicht** für Assignments. Kahoot sagt selbst: blockiert „most known bot services", garantiert aber keine Bot-Freiheit |
| **Nickname-Generator** | Zufallsnamen statt Freitext; Auffälligkeiten fallen schneller auf | — |
| **Automatischer Nickname-Filter** | Serverseitige Deny-List, stiller Rename | False Positives, pflegebedürftig |
| **Spieler entfernen** | Klick auf den Nickname in der Lobby | **Nur vor Spielstart** |
| **Lock game joining** | Keine Beitritte mehr, auch mit korrekter PIN und Muster | Muss manuell ausgelöst werden |
| **Quiz privat stellen** | Nicht auffindbar für Dienste, die öffentliche Spiele nach Antworten absuchen | Kahoots eigene Empfehlung für Prüfungssituationen |
| **CAPTCHA-Dienst** | `captcha.kahoot.it`, explizit gegen Bots | — |
| **PIN-Weitergabe-Aufklärung** | „Do not share your game PIN publicly on social media" | organisatorisch, nicht technisch |

Quellen: https://support.kahoot.com/hc/en-us/articles/35342050693789-How-to-use-the-2-step-Join-option-to-secure-your-game · https://support.kahoot.com/hc/en-us/articles/360000109048 · https://support.kahoot.com/hc/en-us/articles/115003198708

**Verteidigungs-Baseline für einen Clone** (Standardpraxis, teils belegt):

1. **Transport:** nur `wss://`, `Origin`-Allowlist beim Handshake, Authentifizierung beim oder direkt nach dem Handshake. (OWASP WebSocket Security Cheat Sheet)
2. **Rate-Limiting** auf drei Ebenen: pro Verbindung, pro Herkunft, global. Dazu Nachrichtengrößen- und Idle-Limits.
3. **Join-Gate:** CAPTCHA oder Proof-of-Work vor dem Beitritt, serverseitig geprüft, Token **einmalig** und kurzlebig (Cloudflare Turnstile: 300 s, Replay wird mit `timeout-or-duplicate` abgelehnt).
4. **Session-Bindung:** Join-Token an Spiel-ID **und** Client gebunden, einmalig einlösbar.
5. **Serverseitige Validierung, ausnahmslos:** Punkte nur serverseitig berechnen; Antworten nur innerhalb des offenen Fragefensters annehmen; genau eine Antwort pro Spieler und Frage; Namensfilter und Längenlimit serverseitig.
6. **Lösungen niemals vor Fragenende an Clients senden.** Das ist der eine Punkt, an dem Kahoot strukturell angreifbar ist, sobald ein Quiz öffentlich ist — und der einzige, den ein Clone von Anfang an besser machen kann, ohne Mehraufwand.
7. **Quiz-Inhalte standardmäßig privat.** Öffentlich nur auf ausdrückliche Entscheidung.
8. **Host-Kontrollen:** Spieler auch **während** des Spiels entfernen können (Kahoot kann das nicht — eine konkrete Lücke), Lobby sperren, Massen-Kick bei erkanntem Flood.

### 8.5 Offizielle API

Es gibt eine offizielle **Reports-/Data-API**, aber keine öffentliche API für die Live-Teilnahme:

- REST nach OpenAPI, Swagger unter `https://results.kahoot.com/swagger/`
- Endpunkte u. a. `/v1/organisations/{id}/games`, `.../participants`, `.../blocks/{n}/answers`
- OAuth2 Client Credentials über `https://access-2.kahoot.com/auth/realms/kahoot-api/protocol/openid-connect/token`, JWT-Bearer mit 1 Stunde Gültigkeit
- Daten **90 Tage** nach Spielende abrufbar
- Zugang nur für bestimmte Top-Tier-Pläne über den Customer Success Manager

Quelle: https://support.kahoot.com/hc/en-us/articles/11735948502931

Das Live-WebSocket-Protokoll ist **nicht** als öffentliche API dokumentiert, und Kahoot bekämpft dessen Nutzung erkennbar (2-Step Join, CAPTCHA-Dienst).

---

## 9. Pricing-Tiers (Stand 2026-10)

*Nur zur Orientierung. Alle Preise **USD, exkl. Steuern**, abgerufen am 2026-10-19 im en_US-Default. Ein Währungsumschalter existiert; EUR-Preise wurden nicht erhoben. **Alle Preise sind Aktionspreise mit durchgestrichenem Listenpreis und ohne sichtbares Enddatum** — die regulären Listenpreise nach Aktionsende sind öffentlich nicht verifizierbar.*

### 9.1 Personal / Study / Higher Ed

Identische Preisleiste auf allen drei Seiten.

| Tarif | Jährlich (Monatsäquivalent) | Monatlich | Teilnehmer | Was neu dazukommt |
|---|---|---|---|---|
| **Kahoot! Go** | Free | — | 10 | Quiz, True/False, bis 4 Antworten, Bilder als Antworten, Flashcards, Free Themes, Classic live, Solo, Assign |
| **Kahoot!+ Bronze** | $3/Mo ($36/Jahr) | $9/Mo | 50 | **bis 6 Antworten**, Multi-Select, **Poll**, **Puzzle**, Image Reveal, Custom Background + Logo, Premium Themes, **Standard- und Download-Reports**, private Kahoots, Working Groups, AI aus Topic/URL/Wikipedia (PDF bis 3 Seiten) |
| **Kahoot!+ Silver** | $7/Mo ($84/Jahr) | $15/Mo | 100 | **Word Cloud**, **Drop Pin**, **Scale**, Slide-Import/-Sync, Lecture-Experience, Live-Q&A, Custom Team-Namen, PDF bis 150 Seiten |
| **Kahoot!+ Gold** | $12/Mo ($144/Jahr) | $25/Mo | 200 | **Type Answer**, **Pin Answer**, **Slider**, **Brainstorm**, **Open-ended**, Combine Reports, **Player Identifier**, Course Reporting, Test-Experience |
| **Kahoot! One** | $19/Mo ($228/Jahr) | $35/Mo | 800 | **Shared space** (Kollaboration), Drops unbegrenzt, Full-size-Hintergrundbilder |
| **Kahoot! One Ultra** | $39/Mo | — | n/a | Große gebrandete Events, Kahoot! Assistant, Early Access |

### 9.2 Schools (K-12)

Gleiche Preisleiste wie Personal. Zusätzlich **Student Passes** nur ab One (50 Pässe, 3 Monate). **Freiform-Fragetypen (Word Cloud, Open-ended, Brainstorm) sind für unter 16-Jährige gesperrt** — dafür verweist Kahoot auf EDU.

**Kahoot! EDU School & District**, Preis pro Host und Monat, jährlich abgerechnet:

| Tarif | Preis | Teilnehmer live | Umfang |
|---|---|---|---|
| **EDU Standard** | $15/Host/Mo (5 Lizenzen = $900/Jahr), Mengenrabatt bis $12 | 800 | AI-Generator, Slide-Import/-Sync, Word Cloud, Brainstorm, Open-ended, Type Answer, Slider, Pin, Poll, 100 Student Passes, LMS |
| **EDU Pro** | $25/Host/Mo (5 Lizenzen = $1.495/Jahr), Mengenrabatt bis $20 | 2.000 | + 250 Student Passes, Branding mit Logo, LMS + SSO, Advanced Customization |
| **EDU Premium** | Custom („Book an intro") | 2.000, bis 5.000 mit Onboarding | + 400 Student Passes, Professional-Learning-Sessions, Employee-App |

### 9.3 Business (Kahoot! 360)

Nur Jahresverkauf, Lizenz pro Präsentator — Teilnehmer brauchen weder Konto noch Lizenz.

| Tarif | Preis | Teilnehmer | Umfang |
|---|---|---|---|
| **Express** | Free | **15**, Session max. **15 Min.** | Test der Pro-Features |
| **Pro Start** | $19/Mo ($228/Jahr) | 50 | Poll, Quiz, True/False, Multi-Select, Puzzle, AI aus Prompt, Logo + Farben, Slide-Import. **Keine Standard-Reports** |
| **Pro Standard** | $25/Mo ($300/Jahr) | 200 | + Type Answer, Slider, Pin, Word Cloud, Brainstorm, Drop Pin, Scale, Open-ended, Slide-Sync, Q&A, Reports, Player Identifier |
| **Pro Plus** | $39/Mo ($468/Jahr) | 1.000 | + NPS, Moderated Q&A, Courses, Zertifikate, Stories, Course Reporting, **Custom Theming**, Full AI Suite |
| **Pro Max** | $79/Mo ($948/Jahr) | 2.000 | + individuelle Lernpfade, **Immersive Branding**, Self-directed Learning |
| **Pro Ultra** | $79/Mo ($948/Jahr, „Introduction offer") | 5.000 (Onboarding nötig) | + **kommerzielle Rechte** (Marketing, Sales, externe Events), Pay by Invoice, Early Access |
| **Spirit** (Team, min. 25 Lizenzen) | $20/Mo/Lizenz ($240/Jahr; 25 = $6.000) | 400 | Team Workspaces, Full Speaker Toolkit, NPS |
| **Spirit Premium** | $25/Mo/Lizenz ($300/Jahr; 25 = $7.500) | 2.000 | + Moderated Q&A, Media Upload, Embed, Immersive Branding |
| **Enterprise** | Custom | 5.000 | SSO, SCIM, LMS-Integration, **Reporting API**, Customer Success Manager |

Weitere Business-Hinweise: Team Workspaces gibt es bei Pro Standard bis Max erst ab 2 Lizenzen, bei Start gar nicht. Nonprofits erhalten laut FAQ 50 % Rabatt. Als Zertifizierungen nennt die Seite ISO 27001, GDPR-Ausrichtung und SOC 2 Type 2 — **keine Aussage zu Hosting-Region, Auftragsverarbeitung oder CLOUD Act**.

### 9.4 Lesart für die Clone-Positionierung

Die Monetarisierungslogik ist eindeutig und über alle Segmente identisch: **Der kostenlose Tarif gibt Quiz und True/False bei 10 Teilnehmern. Jeder weitere Fragetyp und jede Form von Report ist kostenpflichtig.** Die erste Bezahlstufe ($3/Monat) öffnet nicht etwa mehr Teilnehmer als Hauptnutzen, sondern **Reports** — Kahoot verkauft die Auswertung, nicht die Spielgröße.

Zwei Lücken, die ein Clone adressieren kann:
- **Fragetypen hinter der Paywall.** Mehrere Marktbegleiter positionieren sich genau damit. Type Answer kostet bei Kahoot $12/Monat.
- **Reports ab der ersten Bezahlstufe.** Eine kostenlose Basisauswertung ist technisch billig und nimmt dem stärksten Verkaufsargument die Spitze.

Quellen: https://kahoot.com/register/pricing-personal/ · https://kahoot.com/schools/plans/ · https://kahoot.com/schools/edu-school-and-district/ · https://kahoot360.com/pricing/ · https://kahoot360.com/360-spirit-team-plans/ · https://kahoot.com/schools/higher-ed/plans/ · https://kahoot.com/register/kahoot-study-pricing/

---

## 10. Konsolidierte MUST-Liste für den MVP

Was ein spielbares Multiplayer-Quiz mindestens braucht:

**Host**
1. Quiz anlegen: Fragetext, 2–4 Antworten, korrekte Antwort(en) markieren, Zeitlimit, Punkte-Toggle (0/1x/2x), Bild pro Frage
2. Spiel starten, PIN generieren und groß anzeigen
3. Lobby mit Spielerliste, Spieler entfernen, Start-Button
4. Fragen weiterschalten; Antwortzähler statt Live-Verteilung
5. Antwort-Reveal mit Verteilungsdiagramm
6. Zwischen-Leaderboard
7. Podium
8. Report: Summary, Teilnehmer-Leaderboard, Frage-für-Frage

**Player**
1. Beitritt per PIN ohne Account
2. Nickname mit serverseitigem Filter
3. Antwortkacheln mit Farbe **und** Form
4. Fragen/Antworten optional auch auf dem Spielergerät
5. Richtig/Falsch-Feedback mit Punkten und Rang
6. Reconnect mit Score-Erhalt über Client-Token

**Engine**
1. Serverseitige Antwortzeitmessung und Punkteberechnung — nie Client-Werte vertrauen
2. Zeitformel mit 50-%-Deckel und Toleranzschwelle für sehr schnelle Antworten
3. Randomize answer order
4. Globaler Schalter „Zeit zählt / zählt nicht" im Datenmodell
5. Trennung Spiel-Engine ↔ Darstellungs-/Belohnungsschicht (ermöglicht später Spielmodi)
6. Join-Rate-Limiting pro PIN und Herkunft

---

## 11. Offene Punkte und Unsicherheiten

### Widersprüche innerhalb Kahoots eigener Quellen

| Punkt | Status |
|---|---|
| **2-Step-Join-Intervall: 7 s vs. ~10 s** | Live-Game-Settings-Seite sagt sieben Sekunden, der dedizierte 2-Step-Join-Artikel „roughly every 10 seconds". Beides Kahoot-eigene Seiten |
| **Kahoot! Go Teilnehmerlimit Schools: 10 vs. 40** | Die Tarifmatrix der Schools-Seite zeigt 40, die FAQ derselben Seite sagt „Go: Up to 10" und ordnet 40 einem „Teacher essentials" zu. Die Teilnehmer-Übersicht im Support nennt für School ebenfalls 40, für alle anderen Segmente 10. Vermutlich ein Tarif-Umbenennungs-Artefakt |
| **Free-Business-Limit: 3 vs. 15 vs. 50** | Der Teilnehmer-Artikel nennt 3 für selbst erstellte Spiele freier Business-User und 3 für Discover-/Free-Resources-Spiele; dieselbe Seite nennt in der FAQ 50 für den „Kahoot! at Work"-Channel; die 360-Pricing-Seite nennt 15 für Express-eigene Spiele. Nicht auflösbar |
| **Monatsabrechnung bei Bildungstarifen** | Die Tarifkarten zeigen „$9 billed monthly", die FAQ derselben Seite sagt, für Bildungstarife gebe es keine monatliche Abrechnung |
| **„Kahoot! One Max"** | Der Support-Artikel zu Teilnehmerlimits führt One Max (2000) zwischen One und One Ultra. Auf keiner der abgerufenen Pricing-Seiten taucht der Tarif auf. Entweder nicht mehr verkauft oder nur in bestimmten Regionen |

### Nicht offiziell belegt

| Punkt | Status |
|---|---|
| **PIN-Länge** | Offiziell wird keine Stellenzahl genannt. Belegt: 8-stelliges Beispiel in einem aktuellen Assignment-Screenshot, 6- und 7-stellig 2017. „6 bis 10" nur aus Drittquellen |
| **Wo die Antwortzeit gemessen wird** | Server, Host oder Client — öffentlich nicht dokumentiert. Ein Support-Mitarbeiterzitat deutet auf host-seitige Auswertung hin. Ob die `timesync`-Felder in die Wertung eingehen, ist unbekannt |
| **Latenz-Kompensation** | Kein Beleg, dass Kahoot sie durchführt. Belegt ist nur eine Timer-Drift von bis zu 15 s, die Kahoot als Netzwerkproblem einordnet |
| **Aktualität des Live-Protokolls** | Die Community-Doku ist seit 2021 archiviert; Kahoot nennt inzwischen zusätzliche `game.kahoot.it`-Endpunkte „while we perform migrations". Handshake- und Challenge-Details sind als historisch zu behandeln |
| Maximale Fragenanzahl pro Kahoot (100?) | nur Nutzerkommentar |
| Team-Limit „5 Teams" bei freiem Higher-Ed-Account | nur Support-Kommentar |
| Rematch/Ghosts abschaltbar? | nur Nutzerbericht, dass es nicht geht |
| Zwei Slides hintereinander | alte Nutzerkommentare, aktueller Stand unklar |
| EUR-Preise und reguläre Listenpreise nach Aktionsende | nicht erhoben bzw. nicht öffentlich |
| EDU-Mengenrabatt-Schwellen | Rabattstufen sichtbar, Mengenschwellen nicht |
| Import aus Spreadsheet in der Tarifmatrix | Auf keiner Pricing-Seite als Zeile geführt; der Support-Artikel beschreibt die Funktion ohne Tarifbindung. Vermutlich für alle verfügbar — nicht bestätigt |
