# Quizbude — Handover

Stand: **2026-10-22**. Haltepunkt: Der technisch geprüfte Durchstich ist als Alpha getaggt; das GitHub-Release mit Downloads steht noch aus. Die nächste Sitzung kann bei der Veröffentlichung fortsetzen, ohne eine neue Entwicklungswelle zu beginnen.

## Gesicherter Stand

- Repository: `N1scho/Quizbude`, Branch `durchstich`; nicht nach `main` gemerged.
- Beim Erstellen dieses Handovers: HEAD `0307f3279bb4fd0bac67ae6b42d037fdfa677570`.
- Der annotierte Tag **`v0.1.0-alpha.1` ist zu GitHub gepusht**. Tag-Objekt: `fcdabfcc2266ad1396c88d30917c349ad4f7fa53`; aufgelöster Zielcommit: `0307f3279bb4fd0bac67ae6b42d037fdfa677570`.
- **Ein GitHub-Release-Objekt wurde noch nicht angelegt.** Notes und Anhänge liegen lokal bereit. Der Aufruf der Release-Oberfläche führte zur GitHub-Anmeldung; im verfügbaren Connector fehlt ein Release-Endpunkt und ein angemeldeter Browser war nicht verfügbar. Die Bereitstellung eines angemeldeten Browsers ist noch ausstehend.
- Die bestehenden lokalen Dateien `docs/release-preparation.md` und `docs/release-notes-v0.1.0-alpha.1.md` sind beim Erstellen dieses Handovers noch ungetrackt. Der fremde ungetrackte Bericht `docs/continuation-discovery-2026-10-22.md` bleibt unberührt und wird nicht beiläufig aufgenommen.

Der Veröffentlichungsstand im älteren [HALTEPUNKT.md](HALTEPUNKT.md) und historische Aussagen in [STAND.md](STAND.md) beziehen sich auf frühere Prüfpakete. Für den inzwischen gepushten Tag und das weiterhin fehlende Release gelten dieses Handover und der Nachtrag in [release-preparation.md](release-preparation.md).

## Genau hier fortsetzen

Sobald eine angemeldete GitHub-Oberfläche verfügbar ist:

1. Aktuellen Git-Status lesen und den vorhandenen Tag sowie seinen oben genannten Zielcommit kontrollieren. **Keinen neuen Tag erzeugen und den bestehenden Tag nicht verschieben.** Spätere Dokumentationscommits ändern den Release-Kandidaten nicht.
2. Unter `N1scho/Quizbude` ein GitHub-Release am **bereits vorhandenen** Tag `v0.1.0-alpha.1` anlegen, Titel **`Quizbude v0.1.0-alpha.1`**. Den vollständigen Text aus [release-notes-v0.1.0-alpha.1.md](release-notes-v0.1.0-alpha.1.md) übernehmen und als **Prerelease** markieren.
3. Die beiden unten genannten lokalen Dateien unverändert als Anhänge hochladen. Vorher ihre SHA-256-Werte abgleichen.
4. Nach dem Veröffentlichen Tag-Ziel, Vorabstatus, vollständige Notes und beide Downloadlinks prüfen. Die heruntergeladenen Dateien gegen die unten genannten Hashes prüfen und den tatsächlichen Release-Link im Übergabestand festhalten.

Ein Merge nach `main`, Versionswechsel, neuer Build oder neuer Tag ist für diesen Schritt nicht erforderlich. Die bestehende Release-Absicht umfasst diesen vorbereiteten Alpha-Stand; neue Produkt- oder Infrastrukturentscheidungen gehören in einen eigenen Auftrag.

## Vorbereitete Anhänge

Ordner: `C:\Users\nikol\quiz-release\v0.1.0-alpha.1\`

| Datei | Inhalt |
|---|---|
| `quizbude.html` | Bytegleiche Kopie von `standalone/quizbude.html`; Ein-Gerät-Modus im Browser |
| `quizbude-0.1.0-alpha.1-source.zip` | `git archive` des oben genannten Release-Commits, 175 Einträge, ohne ungetrackte Dateien und lokale Abhängigkeiten |

```text
02C58093588F5482B97ED9F4FCFAFE425F5D1F94404E322D70554FEC969DEDD3  quizbude.html
92440534A471E1714E694123C7341889884D298A6D8E028A95129AE6E4799D04  quizbude-0.1.0-alpha.1-source.zip
```

Das Quellarchiv ist kein vorkompiliertes Serverpaket. Der Windows-Starter benötigt Node.js ab Version 22 samt npm und lädt beim ersten Start Abhängigkeiten. Download oder statisches Hosting der HTML-Datei stellt keine Mehrgeräte-Raumfunktion bereit; diese benötigt eine passende Claude-Artifact-Laufzeit mit den erforderlichen Rechten.

## Was bereits geprüft ist

Das unabhängige [Nachreview der siebten Welle](nachreview-welle7.md) dokumentiert technisches GO: **326/326 Tests in 28 Dateien**, Typprüfung, Build und Standalone-Parserprüfung grün; sieben Rücknahmeproben wurden rot und anschließend bytegleich zurückgenommen. Dies sind die dort erhobenen Ergebnisse, keine erneute Messung für dieses Handover. Die lokale Release-Vorbereitung hat die Aktualität des Standalone-Parsers nochmals geprüft, ohne Tests, Typprüfung und Build zu wiederholen.

[Betriebsanleitung](BETRIEBSANLEITUNG.md) und [KI-Formatierungsanleitung](KI-FORMATIERUNGSANLEITUNG.md) sind unabhängig geprüft. Ihre vollständigen Importbeispiele wurden gegen Core und ausgelieferten Standalone-Parser akzeptiert; Belege und Grenzen stehen in [review-anleitungen.md](review-anleitungen.md).

## Offen nach der Veröffentlichung

- **Am Gerät abnehmen:** Windows-Doppelklick aus dem Explorer, Firewall-Dialog, Gastgerät im WLAN, reale Browserdarstellung und Dateiablage sowie eine vollständige Runde auf Telefonen und Beamer/TV. Timing, Lesefenster und Rhythmus sind noch nicht praktisch abgenommen.
- **Produktentscheidung des Nutzers:** Vorworte ohne `:` oder `!` werden derzeit von beiden Parser-Zugängen abgelehnt. Ob die Erkennung oder Fehlermeldung erweitert werden soll, ist offen; diese Entscheidung wurde nicht vorweggenommen.
- **Gesonderte Folgepakete:** `[x]` am Antwortende, sehr lange Markierungsfolgen, weitere dokumentierte Parser-/Transportgrenzen sowie SQLite, Reconnect, Auswertungsseite und QR-Code. Keine dieser Erweiterungen wurde für das Release begonnen. Einzelheiten und Prioritäten: [STAND.md](STAND.md).
- **Artifact-Veröffentlichung:** Der externe Artifact-Stand wurde nicht verifiziert; eine Aktualisierung ist ein eigener Veröffentlichungsschritt. Das GitHub-Release aktualisiert kein Artifact und betreibt keinen Server.

Vor neuer Umsetzung den aktuellen Zustand feststellen und ein eng begrenztes Paket mit getrenntem Review beauftragen. Das abgeschlossene Upload-Review und die abgeschlossenen Nachreviews müssen nicht neu gestartet werden.
