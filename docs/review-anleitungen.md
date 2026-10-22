# Unabhängiges Review der Anleitungen

Stand: 22. Oktober 2026. Prüfumfang: ausschließlich `docs/BETRIEBSANLEITUNG.md` und `docs/KI-FORMATIERUNGSANLEITUNG.md`, abgeglichen mit dem aktuellen Produktstand. Keine Änderungen an Produktcode, Tests oder den geprüften Anleitungen.

## Ergebnis

**GO. Keine High-Confidence-Findings im geprüften Dokumentationspaket.** Es wurde kein sachlich falscher Bedienweg und kein ungültiges vollständiges Importbeispiel nachgewiesen. Keine Korrektur erforderlich.

## Selbst erhobene Belege

- Betriebsarten und Artifact-Grenze (`BETRIEBSANLEITUNG.md:7` und `:13`): Der Ein-Gerät-Modus erzeugt sein Spiel lokal (`standalone/quizbude.html:2078`); die Raumfunktion wird über `window.claude.use('room')` angefordert und bei fehlender Laufzeit ausdrücklich als nicht verfügbar gemeldet (`standalone/quizbude.html:2941`). Die Anleitung verspricht keinen durch die lokale Datei belegbaren Gastzugang.
- Windows-Start und Adressen (`BETRIEBSANLEITUNG.md:31`, `:45`, `:48`): Node-Mindestversion 22 wird in `quizbude-starten.cmd:28` geprüft, Installation/Bau/Start stehen in `:48`, `:61`, `:77`. Die tatsächlichen Bühnen- und Spieleradressen entstehen in `packages/server/src/runtime/banner.ts:25` und `:37`; Portbereich 3000–3010 und das Verhalten bei gesetztem PORT stehen in `packages/server/src/runtime/ports.ts:15` und `:52`.
- Lobby und Bedienung (`BETRIEBSANLEITUNG.md:54`, `:88`): Host beginnt im Upload und erzeugt erst auf expliziten Start einen Raum (`apps/host-web/src/App.tsx`, `verdrahte`/`starte`; `apps/host-web/src/Upload.tsx`, Startknopf). Die serverseitige UI lässt während der Frage kein Weiterschalten zu. Die HTML-Fassung stellt Freigeben, Schließen und Weiterreichen bereit (`standalone/quizbude.html:1837`, `:2340`, `:2896`). Namenprüfung und Groß-/Kleinschreibungsverhalten entsprechen `standalone/quizbude.html:1467`.
- Importgrenzen (`KI-FORMATIERUNGSANLEITUNG.md:9`, `:12`, `:17`): Titel 256 Zeichen, 1–200 Fragen, 5–300 Sekunden und 1.000.000 Bytes entsprechen `packages/core/src/questions/parse.ts:29`, `:30`, `:36`, `:48`, `:51`. Frage/Antwort 200/100 Zeichen entsprechen `packages/core/src/engine/constants.ts:39`. UTF-8 wird fatal dekodiert und Dateigröße geprüft; die Hinweise unterscheiden Dateieinlesen und spätere Übertragung der geprüften Sammlung korrekt.
- Beide vollständigen Beispiele direkt aus den Markdown-Codeblöcken extrahiert und unabhängig ausgeführt: jeweils `ok: true`, genau 3 Fragen, keine Fehler, keine Hinweise. Gegen frisch aus TypeScript erzeugten Core und den tatsächlich ausgelieferten HTML-Kern geprüft; Ergebnisse identisch. Zusätzlich geprüft: Typen `single_choice`, `true_false`, `true_false`; Zeiten 20, 15, 10 Sekunden; korrekte Lösungen Index 0, Wahr, Falsch. Beide dokumentierten Escape-Schreibweisen behalten den sichtbaren Stern und die richtige Markierung. Kein Scratch-Artefakt angelegt.
- Der eingebettete Parserblock entspricht dem frisch erzeugten Core-Block nach Normalisierung der Zeilenenden. Die Beispielprüfung stützt sich damit nicht auf möglicherweise veraltete Build-Ausgaben.

## Grenzen und Testlücken

Keine volle Produkttestsuite für diese reinen Dokumentationsdateien erneut ausgeführt; die Ausgangszahl 326 Tests in 28 Dateien wird hier nicht als selbst gemessen ausgegeben. Kein neuer Geräte-, Browser-, Explorer-Doppelklick-, Firewall- oder WLAN-Test. Die veröffentlichte Artifact-Fassung und tatsächliche Gastrechte wurden nicht extern geprüft. Diese Grenzen sind in `BETRIEBSANLEITUNG.md:124` ausdrücklich benannt.

Die angeforderten Dateien `C:/Users/nikol/.Codex/AGENTS.md` und `C:/Users/nikol/quiz/AGENTS.md` waren nicht vorhanden. Deshalb keine daraus abgeleiteten Konventionsbefunde; die bereitgestellten Auftragsregeln wurden berücksichtigt.

Der anschließend vorliegende `docs/bericht-anleitungen.md` wurde als Behauptungsquelle gelesen. Seine Beispieldaten stimmen mit der unabhängigen Prüfung überein; die dort genannten UTF-8-Größen von 317 und 944 Bytes wurden separat nachgemessen. Der Dokumentations-Commit `fe82670` enthält die geprüften Anleitungen. Das Urteil beruht auf den beiden Anleitungen, dem Quellcode und eigener Beispielvalidierung.

Arbeitsbaum vor dem eigenen Bericht: nur die beiden neuen Anleitungen und der fremde Discoverybericht untracked; kein verfolgter Diff. Eigene inhaltliche Schreiboperation ausschließlich dieser Bericht. Keine Mutationsproben. Nach ausdrücklichem Abschlussauftrag wird ausschließlich dieser Bericht namentlich gestagt und committed. Der Discoverybericht wurde gelesen, aber seine historischen Test- und Mutationsaussagen in diesem Dokuauftrag nicht unabhängig nachgeprüft; er bleibt untracked.
