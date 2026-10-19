# Änderungsbericht 2026-10-19 — Teilnehmerzahl

**Anlass.** Präzisierung des Nutzers, wörtlich: „die app muss nicht wie kahoot identisch aussehen. ich will eine quizapp mit unbegrenzt vielen usern (wahrscheinlich max 20)".

**Ersetzte Annahme.** „Maximal ~50 gleichzeitige Spieler" und die daraus in `konzept-architektur.md` abgeleitete harte Obergrenze von 60 Spielern je Raum.

**Neue Lage.** Kein Produktlimit. Normalfall ~20 Spieler. Eine technische Grenze existiert und ist beziffert (Abschnitt 2 dieses Berichts, im Konzept als neuer Abschnitt 6.6).

**Geänderte Dateien:** `C:\Users\nikol\quiz\docs\konzept-architektur.md`, `C:\Users\nikol\quiz\docs\konzept-ux.md`.
**Unverändert, wie beauftragt:** `kahoot-feature-analyse.md`, `plattform-stack-entscheidung.md`.

---

## 1. Jede geänderte Stelle

### 1.1 `konzept-architektur.md`

| Abschnitt | Vorher | Nachher |
|---|---|---|
| Kopf (neu) | — | Abschnitt „Änderung 2026-10-19": Zitat, ersetzte Annahme, Liste der angefassten Abschnitte |
| 0, Zeile H | „Harte Obergrenze 60 Spieler je Raum"; Begründung „Ruling 1 nennt ~50. 60 gibt Luft, ohne Fan-out-Aggregation zwingend zu machen" | „Kein Produktlimit", optimiert auf ~20, nach oben nur eine Notbremse gegen Ressourcenerschöpfung; Verweis auf 6.6; ausdrücklich: Fan-out-Aggregation wird nicht gebraucht, weil die Nachricht an den einzelnen Spieler nach Entwurf O(1) ist |
| 2.2, Übergang 2 | Guard „< 60 Spieler" | Guard „Notbremse `PLAYER_HARD_CAP` nicht erreicht (2.3)" |
| 2.3 Konstanten | eine Zeile `MAX_PLAYERS` = 60, Begründung „siehe 0/H" | zwei Zeilen: `PLAYER_HARD_CAP` = 5 000 (Notbremse, konfigurierbar, Ablehnungsgrund `capacity`) und `PLAYER_SOFT_WARN` = 25 (reiner Hinweis an den Host, weist niemanden ab) |
| 3.1 Tabelle | „1 Frage × 60 Spieler = 60 Zeilen"; „20 Fragen × 60 = 1 200 Zeilen je Abend" | „1 Frage × 20 Spieler = 20 Zeilen", ~1 ms; „20 Fragen × 20 = 400 Zeilen je Abend, ~48 kB" |
| 3.1 Ergebnis-Absatz | „ein paar Megabyte nach zwanzig Abenden" | „unter einem Megabyte"; neu: die kleinere Zielgröße macht SQLite **deutlicher** richtig (60→20 Zeilen Spitze, 1 200→400 je Abend); Gegenprobe bei 2 000 Spielern mitgerechnet |
| 3.1 Schlussabsatz | „Transaktion über 60 Zeilen … einstellige Millisekunden" | „Transaktion über 20 Zeilen … rund eine Millisekunde", mit Verweis auf das lineare Wachstum in 6.6 |
| 3.2 Index-Begründung | „Bei 1 200 Zeilen je Spiel gewinnt der Tabellenscan" | „Bei 400 Zeilen … er gewönne ihn auch noch bei 10 000" |
| 3.4 `RoomConfig` | Feld `maxPlayers: number; // 60` | Feld `playerHardCap: number` mit Kommentar „Notbremse, KEIN Produktlimit"; `0` bedeutet „keine Notbremse" |
| **6.6 (neu)** | — | Vollständige Herleitung der technischen Grenze: Speicher je Spieler, Fan-out je Frage, Fairness-Grenze, SQLite-Schreiblast, Lobby-Darstellung, WLAN-Wand, gestufte Degradationstabelle |

### 1.2 `konzept-ux.md`

| Abschnitt | Vorher | Nachher |
|---|---|---|
| Kopf (neu) | — | Abschnitt „Änderung 2026-10-19": Zitat, ersetzte Annahme, ausdrücklicher Satz, dass die Gestaltung unverändert bleibt, Liste der angefassten Stellen und der beiden Entfälle |
| 0, Regel 2 | „Fünfzig Geräte mit Soundeffekten sind … Lärm" | „Schon zwanzig Geräte …" — das Argument trägt bei 20 unverändert |
| 1.1, B3 Lobby, Zustand „voll" | „**voll** (ab 50: Liste scrollt in zwei Spalten, dann Namen kleiner, nie Namen verstecken)" | „**Raster voll**" mit hergeleiteter Zahl ~25 Kacheln (Rechenweg inline), danach Zähler plus „und N weitere"; Namen werden weder verkleinert noch gescrollt, weil beides Regel 3 bräche. Zweispalten-Umbruch und Namensverkleinerung **entfallen ersatzlos** |
| 3, letzte Zeile | „+5 bis +7 s Zwischenstand … bei > 10 Spielern 7 s, sonst 5 s" | „+7 s Zwischenstand … ohne Fallunterscheidung", mit Begründung des Entfalls |
| 6, Ladebudget | „von bis zu 50 Geräten gleichzeitig" | „von allen Geräten gleichzeitig — im Normalfall rund 20"; **Budget bleibt ausdrücklich bei 60 kB**, weil nicht die Gerätezahl bindet, sondern das schlechte Mobilfunkgerät und der gemeinsame Access Point (1,2 MB bei 20, 30 MB bei 500) |
| 9, Begründung 4 | „bei 50 Geräten im selben Raum" | „schon bei zwanzig Geräten im selben Raum" |

---

## 2. Die technische Obergrenze — Rechenweg

Konservative Werte durchgehend; wo geschätzt wurde, zuungunsten der Obergrenze.

### 2.1 Speicher je Spieler im Raumzustand

`PlayerState` (Konzept 3.4): zwei kurze Zeichenketten `id` und `resumeToken` à ~22 Zeichen ≈ 40 B, Anzeigename ≤ 20 Zeichen ≈ 56 B, sechs Zahlen-/Bool-Felder in einer Objekthülle ≈ 120 B, `RttStats` mit acht Proben ≈ 130 B plus 48 B Hülle → **≈ 0,45 kB**.

Dazu je Spieler: Eintrag in `players` ≈ 48 B, Eintrag in `nameIndex` ≈ 90 B, im Antwortfenster ein `AnswerRecord` samt Map-Eintrag ≈ 176 B, in `SCOREBOARD`/`PODIUM` ein bis zwei `RankedPlayer` ≈ 160 B, Eintrag in `RoomHandle.sockets` ≈ 152 B.

→ **≈ 1 kB reiner Spielzustand je Spieler.** Bei 20 Spielern 20 kB, bei 1 000 Spielern 1 MB.

Der dominierende Posten ist nicht der Spielzustand, sondern die Verbindung: eine WebSocket-Verbindung unter `ws` samt Socket.IO-Buchhaltung ≈ **50 kB RSS**, **sofern `perMessageDeflate` ausgeschaltet bleibt** — eingeschaltet reserviert zlib je Verbindung sechsstellige Byte-Beträge und verzehnfacht die Zahl. Das ist eine harte Betriebsvorgabe, keine Optimierung.

| Spieler | Spielzustand | Verbindungen | Summe |
|---|---|---|---|
| 20 | 20 kB | ~1 MB | ~1 MB |
| 1 000 | 1 MB | ~50 MB | ~50 MB |
| 10 000 | 10 MB | ~500 MB | ~500 MB |

**Speicher klemmt nie zuerst.** Vorher greifen Dateideskriptor-Limits.

### 2.2 Nachrichten-Fan-out je Frage

Je Spieler und Frage: `room:question_prepared` mit `PublicQuestionView` (200 Zeichen Fragetext + 4 × 100 Zeichen Optionen + Kopffelder ≈ 0,8 kB) + `room:answers_open` (~0,1 kB) + `room:reveal` (~0,4 kB) + `player:question_result` (~0,15 kB) ≈ **1,45 kB**.

Linear: 29 kB bei 20 Spielern, 290 kB bei 200, 1,45 MB bei 1 000. Über ein 20-Sekunden-Fenster selbst bei 1 000 Spielern unter 150 kB/s. **Nie bindend.**

**Der quadratische Term existiert nicht.** Er entstünde, wenn jeder Spieler die vollständige Rangliste bekäme: N × 60 B an N Spieler = N² × 60 B, also 24 kB bei 20, aber 15 MB bei 500 und 60 MB bei 1 000. Im Entwurf bekommt das Spielergerät ausschließlich eigenen Rang und Abstand (UX Z7), die Bühne eine Top-N-Liste plus Zähler — beides O(1) je Empfänger. Der Term fällt also durch die UX-Regel „Das Handy ist kein zweiter Bildschirm" weg, nicht durch eine Optimierung.

Einziger wirklich N-proportionaler Strom: `room:answer_count`, eine Nachricht an den Host je eingehender Antwort. Bei 20 Spielern 20 Nachrichten in 20 Sekunden. Zusammenfassung (höchstens ein Zähler je 100 ms) lohnt erst im vierstelligen Bereich.

### 2.3 Die Fairness-Grenze — der Wert, der tatsächlich bindet

Die Wertung hängt daran, dass der Zeitstempel als erste Anweisung im Transport-Adapter entsteht (Konzept 5.2). Eine blockierte Ereignisschleife geht unmittelbar in die Punkte. Bearbeitung einer Antwort (JSON-Parse ~80 B, `step()`, zwei kleine Emits): konservativ **50 µs**. Tippen alle Spieler im selben Moment, wird die letzte Antwort um `(N−1) × 50 µs` verzögert.

| Spieler | Worst-Case-Versatz | Anteil an 30-s-Fenster | Punkte von 1 000 |
|---|---|---|---|
| 20 | **1,0 ms** | 0,003 % | < 1 |
| 100 | 5 ms | 0,017 % | < 1 |
| 1 000 | 50 ms | 0,17 % | ~2 |
| 5 000 | **250 ms** | 0,83 % | ~8 |

Die Toleranzschwelle der Punkteformel liegt bei `FULL_POINTS_THRESHOLD_MS = 500` (Konzept 5.4). **Ab etwa 5 000 Spielern nähert sich der Worst-Case-Versatz dieser Schwelle — das ist der erste Punkt, an dem eine Zusage des Konzepts aufhört, wahr zu sein.** Deshalb steht dort die Notbremse, und nirgends darunter.

Zum Vergleich: die vom Konzept bereits akzeptierte Unstetigkeit bei 500 ms beträgt 8 Punkte. Der Versatz bei 1 000 Spielern (~2 Punkte) liegt darunter.

### 2.4 SQLite-Schreiblast je Spiel

`persistRound` schreibt N Zeilen in einer Transaktion, synchron (`better-sqlite3`), also mit blockierter Ereignisschleife. Konservativ 50 µs je Zeile (= 20 000 Zeilen/s; realistisch sind mit vorbereitetem Statement, WAL und `synchronous = NORMAL` eher 50 000–100 000/s):

| Spieler | je `persistRound` | Zeilen je Abend (20 Fragen) |
|---|---|---|
| 20 | **1 ms** | 400 (~48 kB) |
| 500 | 25 ms | 10 000 |
| 2 000 | 100 ms | 40 000 |
| 10 000 | 500 ms | 200 000 |

Der Ruckler fällt per Entwurf in den Phasenwechsel `REVEAL → SCOREBOARD`, in dem keine Zeit gemessen wird (Konzept 3.0, Regeln 1 und 2). **Er kostet Geschmeidigkeit, nicht Fairness**, und bleibt bis in den vierstelligen Bereich unsichtbar.

### 2.5 Lobby-Rendering — die niedrigste Zahl, und sie kommt nicht vom Server

Bindend ist die Lesbarkeitsregel des UX-Konzepts: mindestens 36 px für alles Spielrelevante.

```
1 920 px Bühne − 2 × 48 px Rand            = 1 824 px nutzbar
16-Zeichen-Name bei 36 px:
  16 × 0,55 × 36 px ≈ 317 px + Innenabstand ≈ 340 px je Kachel
1 824 / 340                                 ≈ 5 Kacheln je Zeile
Namensfläche ~400 px bei 80 px Zeilenhöhe   ≈ 5 Zeilen
                                            → ~25 Namen
```

**Rund 25 Namen passen in lesbarer Größe auf die Bühne.** Darüber bleibt: verkleinern (verletzt Regel 3), scrollen (aus 3 m unlesbar) oder ehrlich zählen. Gewählt ist das Zählen. Das ist kein Limit — Beitritte laufen weiter, nur die Kachel fehlt.

### 2.6 Die Wand, die in einem echten Raum zuerst kommt

Ein Consumer-Access-Point verwaltet typischerweise **32–64 assoziierte Geräte**. Die Beitrittsseite wird von allen gleichzeitig geladen: 20 Geräte × 60 kB = 1,2 MB (unkritisch), 500 Geräte = 30 MB (sprengt das 1,5-s-Budget lange vor dem Server). Umgebung, nicht Anwendung — gehört aber genannt, weil der Nutzer sie als Erstes trifft.

### 2.7 Zusammenfassung: Verhalten beim Überschreiten

| Ab etwa | Was passiert | Wer merkt es |
|---|---|---|
| 25 | Bühne zeigt Namen plus „und N weitere". Beitritt offen. | Host, kosmetisch |
| 64 | WLAN-Access-Point wird zur Bremse, nicht der Server | Spieler beim Beitritt |
| 500 | `persistRound` ruckelt ~25 ms am Phasenwechsel | niemand während der Wertung |
| 1 000 | ~1,5 MB Fan-out je Frage, ~50 MB Verbindungsspeicher, ~2 Punkte Versatz. Korrekt, nur kein Wohnzimmerspiel mehr | niemand |
| **5 000** | **`PLAYER_HARD_CAP`.** Versatz nähert sich der 500-ms-Schwelle, Fairness-Zusage aus 5.4 erodiert. Ablehnung mit Grund `capacity` — Kapazitätsaussage, keine Tarifgrenze | Nachzügler, mit ehrlichem Grund |
| darüber | Ein Prozess trägt es nicht: Dateideskriptoren, 500 ms `persistRound`, Host-Antwortzähler. Dann mehrere Prozesse plus gemeinsamer Raumzustand — der Einhängepunkt, den Abweichung 0/B offenhält | alle |

---

## 3. Was durch die kleinere Zielgröße entfallen konnte

1. **Zweispalten-Umbruch der Lobby ab 50 Spielern — ersatzlos entfallen.** Er wurde nie gebraucht und war außerdem mit der eigenen Lesbarkeitsregel unvereinbar: Die zweite Spalte halbiert die Kachelbreite und zwingt unter 36 px.
2. **Progressive Namensverkleinerung in der Lobby — ersatzlos entfallen.** Gleiche Begründung. An ihre Stelle tritt eine einzige Zahl (~25) und eine Zeile „und N weitere".
3. **Fallunterscheidung „bei > 10 Spielern 7 s, sonst 5 s" beim Zwischenstand — entfallen.** Bei ~20 Spielern war nur ein Zweig erreichbar. Feste 7 s.
4. **Serverseitige Aggregation gegen Fan-out — nie nötig, jetzt ausdrücklich ausgeschlossen.** Abweichung 0/H führte 60 als Wert an, der sie „nicht zwingend macht". Die Rechnung in 2.2 zeigt: Sie wird auch bei 1 000 Spielern nicht gebraucht, weil die Nachricht an den einzelnen Spieler durch den UX-Entwurf O(1) ist. Entfällt damit als Thema, nicht nur als Aufwand.
5. **Die harte Zahl `MAX_PLAYERS` als Guard im heißen Beitrittspfad — entfällt als Produktbegriff.** Was bleibt, ist eine Notbremse weit jenseits jeder gewollten Nutzung.
6. **Index-Diskussion auf `report_answer` — bleibt entfallen, jetzt mit größerem Abstand.** 400 statt 1 200 Zeilen je Spiel.

**Gegenprobe — was ausdrücklich NICHT entfallen ist:** Das 60-kB-Budget der Beitrittsseite bleibt. Es ist nicht von der Gerätezahl abgeleitet, sondern vom einzelnen schlechten Mobilfunkgerät. Eine Lockerung hier wäre eine Verschlechterung ohne Gegenwert.

---

## 4. Die beiden geprüften Zusatzfragen

**4.1 Trägt „SQLite statt PostgreSQL" durch die kleinere Zielgröße deutlicher?** **Ja, deutlich.** Das Spitzenschreibvolumen je `persistRound` fällt von 60 auf 20 Zeilen (~1 ms statt ~3 ms), das Gesamtvolumen je Abend von 1 200 auf 400 Zeilen (~48 kB). Die einzige echte Eigenheit — `better-sqlite3` ist synchron und blockiert die Ereignisschleife — wird damit um den Faktor drei unkritischer, und sie lag ohnehin außerhalb jeder Zeitmessung. Die Rechnung in 2.4 zeigt zusätzlich, dass die Entscheidung bis in den vierstelligen Spielerbereich trägt: Selbst 2 000 Spieler ergeben ~100 ms an einem Phasenwechsel, an dem niemand auf eine Zeitmessung wartet. PostgreSQL bliebe Aufwand ohne Gegenwert. Der Wechselpunkt verschiebt sich nicht — er lag und liegt bei „mehrere Prozesse, Netzwerkzugriff, gleichzeitige Schreiber", und das ist dieselbe Schwelle, an der auch Redis zurückkäme.

**4.2 Werden die Lösungsansätze gegen Fan-out bei 20 Spielern noch gebraucht?** **Nein — und zwar bei keiner realistischen Zahl.** Der lineare Anteil (1,45 kB je Spieler und Frage) ist bei 20 Spielern 29 kB und bei 1 000 Spielern 1,45 MB, verteilt über zwanzig Sekunden. Der quadratische Anteil, gegen den eine Aggregation überhaupt helfen würde, entsteht nur bei Voll-Rangliste an jeden Spieler — und die gibt es im Entwurf nicht, weil das Handy per UX-Gesetz nur den eigenen Rang zeigt. Übrig bleibt ein einziger N-proportionaler Strom: `room:answer_count` an den Host. Dessen Zusammenfassung (ein Zähler je 100 ms) sind drei Zeilen im Adapter und lohnt erst vierstellig. **Empfehlung: nicht bauen, Stelle in 6.6 benannt lassen.**

---

## 5. Befunde ohne Änderung (Vorschläge, nicht umgesetzt)

Die folgenden Punkte wurden gefunden, liegen aber außerhalb des Pakets oder gehören dem Nutzer. Sie wurden ausdrücklich **nicht** geändert.

1. **Widerspruch bei den Textlängen zwischen den beiden Dokumenten.** `konzept-ux.md` Abschnitt 1.1/B2 nennt 120 Zeichen Fragetext und 75 Zeichen je Antwort — exakt die Grenzen des Vorbilds. `konzept-architektur.md`, Offene Entscheidung 9 und das SQL-Schema nennen 200 bzw. 100 Zeichen und begründen das damit, dass „kein Grund besteht, dessen Enge zu übernehmen". Das ist die einzige im UX-Dokument gefundene Stelle, deren Zahl sich allein aus dem Vorbild erklärt. **Nicht geändert**, weil Offene Entscheidung 9 ausdrücklich eine Bestätigung des Nutzers erbittet; die Lockerung bei der Optik stützt die 200/100-Variante. *Entscheidung erbeten.* Die Fan-out-Rechnung in 2.2 ist bereits mit 200/100 gerechnet, trägt also beide Varianten.
2. **Keine Stelle gefunden, die ausschließlich mit „weil Kahoot das so macht" begründet ist.** Die Treffer auf „Vorbild" sind durchgängig Abgrenzungen (Architektur 4.2 „strukturell überlegen", 6.5 Punkt 6 „das Vorbild kann das nicht", Offene Entscheidung 9 „kein Grund, dessen Enge zu übernehmen") oder Sachaussagen aus der Feature-Analyse (4.4 Belohnungsschicht, 4.5 Präzisionswertung). Einzig UX-Offene-Entscheidung 9 (Streak-Zähler) referenziert das Vorbild als Beleg, trägt aber eine eigene Begründung („als Anzeige billig und motivierend; als Bonus unfair") und bleibt deshalb stehen.
3. **Die aktive Abgrenzung der Formen** (UX Abschnitt 4: „Keine der vier Formen ist Dreieck, Raute, Kreis oder Quadrat") wäre durch die Optik-Lockerung formal verzichtbar. **Nicht angefasst**, weil Ruling 6 die Farbpalette und damit die gewachsene Form-/Farbwelt ausdrücklich schützt und die Begründung daneben („Silhouetten unterscheiden sich in Symmetrie, Konkavität, Seitenverhältnis, Oberkante") eigenständig trägt.
4. **Beispielzahlen in den Wireframes** (17–18 Spieler, „und 12 weitere", „14 von 18 sind fertig") liegen bereits beim neuen Normalfall und wurden nicht angefasst. Eine Ausnahme bleibt stehen: B6 im Fließtext nennt „und 23 weitere" (≈ 28 Spieler). Kosmetisch, kein Widerspruch zu einer Regel — bewusst nicht geändert, um die Eingriffstiefe zu halten.

---

## 6. Begründete Abweichung vom Auftrag

**Eine Umbenennung, obwohl der Auftrag Umbenennungen untersagt.** `MAX_PLAYERS` heißt jetzt `PLAYER_HARD_CAP`, und `RoomConfig.maxPlayers` heißt `playerHardCap`.

Begründung: Die Semantik der Konstante kehrt sich um. „Maximale Spielerzahl" ist genau die Aussage, die laut Ruling 1 nicht mehr gelten soll; den Namen zu behalten, während die Bedeutung zu „Notbremse gegen Ressourcenerschöpfung" wechselt, würde jeden späteren Leser in die Irre führen — und wäre genau der Drift, den das Ledger verhindern soll. Das Verbot der Umbenennung zielt erkennbar auf die Begriffswelt (Join-Code, Room, Bühne, Buzzer) und auf Datei- und Verzeichnisnamen; dort wurde nichts angefasst.

**Rückbau, falls nicht gewollt:** drei Stellen in `konzept-architektur.md` — Konstantentabelle 2.3, Guard in Übergang 2, Feld in `RoomConfig` (3.4) — plus die Erwähnungen in 6.6.

Zwei weitere Punkte sind Zusätze, keine Abweichungen, aber sie sollen benannt sein:

- **`PLAYER_SOFT_WARN` = 25 ist neu** und stand so nicht im Auftrag. Er ist kein Limit und weist niemanden ab; er macht nur die in 2.5 hergeleitete Darstellungsgrenze für den Host sichtbar. Ohne ihn wäre die Zahl 25 hergeleitet, aber nirgends wirksam.
- **Der Wert 5 000 für `PLAYER_HARD_CAP` ist eine Herleitung, keine Produktentscheidung.** Er markiert das erste gebrochene Versprechen (2.3). Ob überhaupt eine Notbremse gewollt ist — `0` schaltet sie ab — gehört dem Nutzer und ist im Konzept mit „Bestätigung erbeten" markiert.
