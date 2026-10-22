# Haltepunkt — 2026-10-22

Einstieg zum Fortsetzen. Die vollständige Historie und die offenen Folgeaufgaben stehen in `STAND.md`.

## Verifizierter Stand

- Branch `durchstich`, geprüfter Produktstand `ef8f9d4`; nicht nach `main` gemerged.
- Das frische Nachreview der siebten Fix-Welle (`b4d0dbb..ef8f9d4`) ist abgeschlossen: keine neuen High-Confidence-Befunde, technisches GO. Bericht: `docs/nachreview-welle7.md`.
- 326/326 Tests in 28 Dateien vor und nach sieben Gegenmutationen grün; alle sieben Mutationen rot und bytegleich zurückgenommen.
- Typecheck, Build und Standalone-Riegel ohne `--schreiben`: Exit 0. Spielergerät: 63,45 kB gzip gegen Budget 65 kB.
- Keine dauerhaften Code-/Teständerungen aus dem Review. Die parallele Datei `docs/continuation-discovery-2026-10-22.md` wurde nicht in den Review-Commit aufgenommen.

## Nächster Schritt

Das Upload-Review und die anschließenden Nachreviews sind erledigt; das alte abgebrochene Review nicht erneut starten. Vor jeder neuen Umsetzung den aktuellen Git-Status lesen und den eng begrenzten Auftrag festlegen.

Offene Produktentscheidung: Soll ein Vorwort ohne `:`/`!` weiterhin laut abgelehnt werden, oder soll die Erkennung/Fehlermeldung in einem eigenen Paket erweitert werden? Beide Parser-Türen lehnen es aktuell ab. Diese Entscheidung wurde nicht vorweggenommen.

Unverändert offen und außerhalb dieser Welle: `[x]` am Zeilenende, quadratische Bremse innerhalb einer Zeile, weitere im Stand dokumentierte Altlasten. Die zweite Featurewelle (SQLite, Reconnect, Auswertungsseite, QR-Code) wurde nicht begonnen.

## Veröffentlichung und Gerätetest

Es wurde nichts veröffentlicht, gemerged oder gepusht. Der tatsächliche externe Artifact-Stand wurde in diesem Review nicht geprüft; vor einer Veröffentlichung den Zielstand gesondert feststellen.

Weiterhin nur am Gerät prüfbar: Doppelklick aus dem Explorer, Firewall-Dialog, Gastgerät im WLAN, Browserdarstellung/Dateiablage sowie Timing und Lesefenster auf der Leinwand. Die Hook-Attrappe im Test ist kein Browser-E2E-Test.
