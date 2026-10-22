# Bericht: Betriebs- und KI-Formatierungsanleitung

Stand: 22. Oktober 2026. Ausgangspunkt: HEAD `4ce1609`, Branch `durchstich`. Dieses Paket erstellt ausschließlich:

- `docs/BETRIEBSANLEITUNG.md`
- `docs/KI-FORMATIERUNGSANLEITUNG.md`
- diesen Bericht

Keine Produktivdatei, kein Test, keine Abhängigkeit geändert. Die vorhandene unversionierte Datei `docs/continuation-discovery-2026-10-22.md` blieb unberührt. Das unabhängige Review meldete keine Befunde und bestätigte beide vollständigen Beispiele im Kernparser und im ausgelieferten HTML-Parser. Der Dokumentations-Commit erfolgt nach diesem Review; Push, Merge und Veröffentlichung sind nicht Teil dieses Pakets.

## Inhalt und Rulings

Die Betriebsanleitung führt Laien getrennt durch den lokalen HTML-Ein-Gerät-Modus, den Windows-Serverstart und die nur mit passender Artifact-Laufzeit mögliche Mehrgeräte-HTML-Fassung. Sie beschreibt Import, Prüfung vor Lobby, Adressen, Firewall, Spielablauf, Unterschiede der Steuerung, Ende und Fehlersuche.

Die KI-Anleitung ist direkt als Anweisung verwendbar. Der primäre Ausgabeweg ist ein kanonisches Zeilenformat ohne Vorwort, Schlusswort oder Codezäune. JSON ist als ausdrückliche Alternative dokumentiert. Es werden nur tatsächlich gelesene Felder vorgeschlagen. Beide vollständigen Beispiele enthalten je eine Auswahlfrage sowie eine wahre und eine falsche Wahr/Falsch-Aussage.

**Ruling zu einer veralteten Zusage:** Die Kommentare in `packages/core/src/engine/constants.ts:31` und `packages/core/src/engine/reading.ts:22` sowie ältere Berichte sprechen pauschal vom frühen Freigeben mit der Leertaste. Die aktuelle Server-Oberfläche bietet das nicht: `apps/host-web/src/App.tsx:234` schaltet nur Lobby/Auflösung/Zwischenstand/Podium weiter, und `apps/host-web/src/App.tsx:298` deaktiviert den Knopf während einer Frage. Die HTML-Fassung ermöglicht dagegen vorzeitiges Freigeben und Schließen (`standalone/quizbude.html:1837`). Die Anleitung bildet den tatsächlichen Unterschied ab. Der Produktbefund wird in diesem Dokumentationspaket nicht behoben.

**Ruling zu Gültigkeitsgrenzen:** Der Parser begrenzt Titel, Fragenzahl, Fragetext, Antworttexte, Antwortzeit und Datei. Für die optionale Erklärung wird keine erfundene Zeichengrenze angegeben. „Kurze Erklärung“ ist eine Schreibempfehlung. Das JSON-Beispiel verwendet Antwortobjekte mit genau einem `correct: true` und kein konkurrierendes Lösungsfeld.

**Ruling zur Netzfassung:** Eine lokale HTML-Datei allein ermöglicht keine geräteübergreifende Raumfunktion. Die Anleitung verspricht weder anonymen Artifact-Beitritt noch einen geprüften Veröffentlichungsstand. Für Mehrgerätebetrieb im WLAN beschreibt sie den vorhandenen Serverweg.

## Frisch geprüfte Belegstellen

Alle Stellen wurden am aktuellen Arbeitsbaum gelesen, nicht nur aus älteren Berichten übernommen.

| Aussage | Beleg |
|---|---|
| Ausgangslage, ausstehende Gerätetests und nicht extern geprüfter Artifact-Stand | `docs/STAND.md:7`, `docs/HALTEPUNKT.md:21`, `standalone/bericht-standalone.md:199` |
| Node ab 22, npm, Installation, Build, Serverstart | `quizbude-starten.cmd:17`, `quizbude-starten.cmd:28`, `quizbude-starten.cmd:32`, `quizbude-starten.cmd:43`, `quizbude-starten.cmd:58`, `quizbude-starten.cmd:77` |
| Private Firewall-Freigabe, Betriebsfenster und Ende | `quizbude-starten.cmd:68`, `packages/server/src/runtime/banner.ts:75`, `packages/server/src/runtime/banner.ts:81` |
| Tatsächliche Bühne und Spieleradressen, alternative Netzwerkkarten | `packages/server/src/runtime/startup.ts:40`, `packages/server/src/runtime/banner.ts:24`, `packages/server/src/runtime/banner.ts:37`, `packages/server/src/main.ts:29` |
| Port 3000 bis 3010, explizites PORT ohne Ausweichen | `packages/server/src/runtime/ports.ts:15`, `packages/server/src/runtime/ports.ts:53` |
| HTML-Startoptionen, Ein-Gerät-Modus und automatische erste Person | `standalone/quizbude.html:328`, `standalone/quizbude.html:2078`, `standalone/quizbude.html:2354` |
| HTML-Netzfunktion braucht Laufzeit; sichtbarer Rückfall | `standalone/quizbude.html:2026`, `standalone/quizbude.html:2940` |
| Import im Browser, Datei/Text/Ablegen und UTF-8 | `apps/host-web/src/Upload.tsx:110`, `apps/host-web/src/Upload.tsx:210`, `apps/host-web/src/Upload.tsx:236`, `packages/core/src/questions/parse.ts:253`, `standalone/quizbude.html:2762` |
| Prüfbericht mit Titel, Zahl, Dauer, Fehlern; expliziter Start | `apps/host-web/src/Upload.tsx:34`, `apps/host-web/src/Upload.tsx:262`, `standalone/quizbude.html:2739`, `standalone/quizbude.html:2819` |
| Eingebaute KI-Anweisung und Zwischenablagerückfall | `packages/core/src/questions/parse.ts:284`, `apps/host-web/src/Upload.tsx:146`, `standalone/quizbude.html:2786` |
| Titel 256, 200 Fragen, Antwortzeit 5–300 s und Standard 20 s, Dateideckel 1.000.000 Bytes | `packages/core/src/questions/parse.ts:30`, `packages/core/src/questions/parse.ts:37`, `packages/core/src/questions/parse.ts:49`, `packages/core/src/questions/parse.ts:52` |
| Fragetext 200, Antworttext 100 Zeichen | `packages/core/src/engine/constants.ts:40`, `packages/core/src/questions/parse.ts:724`, `packages/core/src/questions/parse.ts:760` |
| Blöcke, Titel, Erklärungen, Zeilenzeit und Fluchtweg | `packages/core/src/questions/parse.ts:390`, `packages/core/src/questions/parse.ts:473`, `packages/core/src/questions/parse.ts:559`, `packages/core/src/questions/parse.ts:636` |
| Zwei bis vier Antworten, genau eine richtige, Wahr/Falsch nur in Reihenfolge Wahr/Falsch | `packages/core/src/questions/parse.ts:709`, `packages/core/src/questions/parse.ts:746`, `packages/core/src/questions/parse.ts:773` |
| JSON mit titel/fragen/frage/antworten/sekunden/erklaerung; Antwortobjekte label/correct | `packages/core/src/questions/parse.ts:835`, `packages/core/src/questions/parse.ts:885`, `packages/core/src/questions/parse.ts:910`, `packages/core/src/questions/parse.ts:927`, `packages/core/src/questions/parse.ts:956`, `packages/core/src/questions/parse.ts:965` |
| Lesezeit mindestens 10 s zusätzlich zur Antwortzeit | `packages/core/src/engine/constants.ts:35`, `packages/core/src/engine/reading.ts:26`, `packages/core/src/questions/parse.ts:214` |
| Server-Code sechsstellig; Namen und Buzzer ohne Fragetext | `apps/player-web/src/App.tsx:291`, `apps/player-web/src/App.tsx:4`, `apps/player-web/src/App.tsx:354`, `packages/core/src/engine/step.ts:83` |
| Server-Bedienelemente, Endstand, beendetes Spiel | `apps/host-web/src/App.tsx:234`, `apps/host-web/src/App.tsx:310`, `apps/host-web/src/App.tsx:359` |
| HTML-Bedienelemente, Weiterreichen, Ton, Sperre, Ende | `standalone/quizbude.html:453`, `standalone/quizbude.html:473`, `standalone/quizbude.html:1837`, `standalone/quizbude.html:2336`, `standalone/quizbude.html:2890` |
| Erste Antwort gilt, automatische Schließung nach allen Antworten | `standalone/quizbude.html:1727`, `packages/core/src/engine/constants.ts:12`, `apps/player-web/src/App.tsx:176` |
| Punkte bis 1000, falsche oder verspätete Antworten ohne Punkte | `packages/core/src/scoring/constants.ts:8`, `packages/core/src/scoring/score.ts:43` |
| Browserspeicher für HTML-Fragen, keine Zusicherung der Wiederaufnahme | `standalone/quizbude.html:1602`, `standalone/quizbude.html:2822`, `docs/HALTEPUNKT.md:19` |

## Beispielvalidierung und Kontrollen

Die zwei vollständigen Codeblöcke wurden direkt aus `docs/KI-FORMATIERUNGSANLEITUNG.md` extrahiert. `erzeugeBlock()` aus `tools/standalone-parser.mjs` übersetzte dabei den aktuellen Parserquelltext samt seinen Konstanten und der Lesefensterfunktion. Der erzeugte Block wurde in einer Node-VM ausgeführt; kein bestehender Build und kein nachgebauter Parser wurde verwendet. Die Prüfung lief im Speicher über Node-Standardeingabe und hinterließ keine Scratch- oder Testdateien.

| Beispiel | UTF-8-Bytes | Parser | Fragen | Typen | Antwortzeiten | Fehler/Hinweise |
|---|---:|---|---:|---|---|---|
| Zeilenformat | 317 | `ok: true` | 3 | Auswahl, Wahr/Falsch, Wahr/Falsch | 20, 15, 10 s | 0 / 0 |
| JSON | 944 | `ok: true` | 3 | Auswahl, Wahr/Falsch, Wahr/Falsch | 20, 15, 10 s | 0 / 0 |

Zusätzlich wurden Titel, die richtige Auswahlposition 0 und die Wahrheitswerte `true`/`false` beider Wahr/Falsch-Fragen ausdrücklich geprüft. Das Stern-Fluchtwegbeispiel wurde separat als vollständige Frage geparst: markierter Text `* Stern`, unmarkierter Text `* Anderer Stern`, `ok: true`. `dekodiereUtf8()` wurde für beide vollständigen Beispiele ebenfalls ausgeführt. Gesamter Prüflauf: Exit 0.

`node tools/standalone-parser.mjs` ohne Schreiboption: Exit 0, ausgelieferte HTML-Fassung aktuell. `git diff --check`: Exit 0. Da die neuen Dateien noch unversioniert sind, ist dessen Aussage auf bestehende Diffs begrenzt; die neuen Dateien wurden zusätzlich als UTF-8 gelesen und die Beispiele wie oben geprüft.

Die volle Testsuite wurde für dieses reine Dokumentationspaket nicht wiederholt. Die Ausgangszahl 326 Tests in 28 Dateien stammt aus dem beauftragten Ausgangsstand, nicht aus einer eigenen Messung dieses Pakets. Doppelklick, Firewall-Dialog, Gastgerät, Browser-Dateiablage, TV/Beamer und Artifact-Zugriffsrechte wurden hier nicht praktisch geprüft und werden in der Anleitung entsprechend benannt.

Angewandter Sprachskill: `C:/Users/nikol/.agents/skills/simo-deutsche-sprache/SKILL.md`. Der allgemeine docs-Skill wurde gelesen; er verweist auf einen Dokument-Connector. Der explizite Auftrag verlangt lokale Markdown-Dateien im Repo, deshalb erfolgte die Erstellung direkt dort.
