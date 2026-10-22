# Quizbude: Betriebsanleitung

Stand: 22. Oktober 2026. Diese Anleitung beschreibt die Dateien in diesem Projekt. Eine früher veröffentlichte Artifact-Fassung kann einen anderen Stand haben.

## Welche Fassung brauchst du?

| Vorhaben | Fassung | Was du brauchst |
|---|---|---|
| Allein spielen oder ein Gerät am Tisch weiterreichen | `standalone/quizbude.html`, „Allein am Bildschirm“ | Einen Browser; keinen laufenden Quizbude-Server |
| Großer Bildschirm und eigene Telefone im WLAN | `quizbude-starten.cmd` | Windows-Rechner mit Node.js ab Version 22, Browser, gemeinsames lokales Netz |
| Mehrere Geräte über ein veröffentlichtes Claude-Artifact | Veröffentlichte HTML-Fassung mit verfügbarer Raumfunktion | Passende Laufzeit und Zugriffsrechte auf jedem Gerät; vorab mit einem Gastgerät ausprobieren |

Die lokale HTML-Datei verbindet mehrere Geräte nicht allein dadurch, dass alle dieselbe Datei öffnen. Die Schaltflächen „Bühne eröffnen“ und „Mitspielen“ benötigen in dieser Fassung die Raumfunktion der Artifact-Laufzeit. Fehlt sie, erscheint „Kein Funk — allein am Bildschirm“. Verwende dann den Ein-Gerät-Modus oder den lokalen Server.

## Schnellstart: ein Gerät am Tisch

1. Öffne `standalone/quizbude.html` im Browser.
2. Für einen ersten Versuch kannst du die geladene Demorunde verwenden. Eigene Fragen lädst du vorher über „Eigene Fragen schreiben“; siehe den Abschnitt zum Import.
3. Wähle „Allein am Bildschirm“. Ein erster Spieler ist bereits eingetragen, normalerweise „Ich“ oder ein gemerkter Name.
4. Trage für eine Runde am Tisch weitere Namen im Namensfeld ein und füge sie hinzu. Ein Name darf 1 bis 16 Zeichen haben. Verwende Buchstaben, Ziffern, Leerzeichen, Punkt, Unterstrich oder Bindestrich. Namen müssen sich unterscheiden.
5. Klicke „Los geht’s“ oder drücke außerhalb eines Eingabefelds die Leertaste.
6. Lest die Frage gemeinsam. Sobald Antworten freigegeben sind, tippt der angezeigte Spieler auf die passende Antwortkachel. Bei mehreren Spielern zeigt die Seite anschließend, an wen das Gerät geht. Der Nächste klickt „Bin bereit“ und erhält sein eigenes volles Antwortfenster.
7. Gehe nach der Auflösung mit „Zwischenstand“ weiter, danach mit „Nächste Frage“ beziehungsweise „Podium“.

Dieser Modus benötigt keine Netzverbindung für den Spielablauf. Die externe Schrift kann bei fehlendem Internet durch eine vorhandene Schrift ersetzt werden.

## Schnellstart: Bildschirm und Telefone im WLAN

### Vorbereiten und starten

1. Lass den vollständigen Projektordner zusammen. Die Startdatei allein reicht nicht.
2. Auf dem Windows-Rechner müssen Node.js ab Version 22 und npm installiert sein. Meldet die Startdatei eine fehlende oder zu alte Installation, folge der angezeigten Anleitung.
3. Verbinde Rechner und Telefone mit demselben lokalen Netz. Der Rechner darf auch per Kabel am selben Router hängen. Ein Gast-WLAN kann Verbindungen zwischen Geräten sperren.
4. Doppelklicke im Projektordner auf `quizbude-starten.cmd`.
5. Beim ersten Start lädt das Programm seine Bausteine. Dafür ist Internet nötig. Anschließend baut es die Oberfläche, falls erforderlich, und startet den Server. Das kann beim ersten Mal einige Minuten dauern.
6. Fragt Windows nach Netzwerkzugriff für Node.js, erlaube ihn für das private Netz. Verwende diese Einstellung in deinem vertrauenswürdigen Heim- oder Veranstaltungsnetz.
7. Lass das Konsolenfenster während des Spiels offen. Die Bühne sollte sich im Browser öffnen. Falls das nicht passiert, kopiere die im Fenster genannte Bühnenadresse in den Browser.

### Die richtigen Adressen verwenden

Im Konsolenfenster stehen zwei Arten von Adressen:

| Adresse | Für wen? |
|---|---|
| `http://127.0.0.1:3000/host/` | Bühne auf dem Rechner, auf dem der Server läuft |
| Beispielsweise `http://192.168.178.20:3000/play/` | Telefone und andere Spielergeräte im lokalen Netz |

Diese Werte sind Beispiele. Übernimm die tatsächlich angezeigte Adresse einschließlich Port und `/host/` oder `/play/`. Ist Port 3000 belegt, sucht der Server normalerweise einen freien Port bis 3010. Eine ausdrücklich gesetzte Umgebungsvariable `PORT` verhindert dieses Ausweichen.

`127.0.0.1` bezeichnet immer das gerade benutzte Gerät. Auf dem Telefon führt diese Adresse daher nicht zum Quiz-Rechner. Der Spielcode ersetzt ebenfalls keine Internetadresse: Erst die Spieleradresse öffnen, dann den Code eingeben.

### Lobby eröffnen und beitreten

1. Auf der Bühne erscheint zuerst „Eigene Fragen“. Lade deine Sammlung oder verwende die Demorunde.
2. Prüfe den Bericht und klicke bei gültigen Fragen auf „Runde eröffnen“. Erst jetzt entsteht die Lobby mit Spielcode.
3. Die Gäste öffnen die im Konsolenfenster genannte Spieleradresse auf ihren Telefonen.
4. Sie geben den sechsstelligen Code der Server-Bühne ein, klicken „Weiter“, tragen ihren Namen ein und wählen „Mitspielen“.
5. Kontrolliere auf der Bühne die eingetroffenen Namen. Sobald mindestens ein Spieler dabei ist, startet „Runde starten“ oder die Leertaste die erste Frage.

Stelle den Bühnenbrowser auf den großen Bildschirm, damit alle Fragetext und Antworten lesen können. Auf den Telefonen erscheinen die passenden Farben und Formen als Antworttasten. Die Frage wird dort nicht angezeigt.

## Eigene Fragen importieren

Die [KI-Formatierungsanleitung](KI-FORMATIERUNGSANLEITUNG.md) kannst du einer KI zusammen mit Thema, Zielgruppe und gewünschter Fragenzahl geben. In beiden Oberflächen gibt es außerdem „Anweisung kopieren“. Falls der Browser das automatische Kopieren ablehnt, markiert die Seite den Text oder fordert dich zum manuellen Markieren auf; kopiere dann mit Strg+C.

Du kannst eine `.txt`-, `.md`- oder `.json`-Datei auswählen, die Datei auf „Datei hierher ziehen“ ablegen oder ihren vollständigen Inhalt in das Textfeld einfügen. Bei mehreren abgelegten Dateien wird nur die erste gelesen. Speichere Dateien als UTF-8. Pro Datei sind höchstens 1.000.000 Bytes erlaubt, pro Sammlung höchstens 200 Fragen.

Die Datei wird zunächst im Browser gelesen und geprüft. In der Server-Fassung werden die geprüften Fragen beim Eröffnen der Runde an den Quiz-Server übergeben.

### Prüfbericht lesen

Der Bericht zeigt Titel, Fragenzahl, eine geschätzte Dauer und gegebenenfalls Hinweise oder Fehler mit Zeilennummern. Die Dauer ist eine Orientierung: Wie lange du Auflösung und Zwischenstand stehen lässt, entscheidest du selbst.

„Alles in Ordnung“ bestätigt das Format. Prüfe auch, ob die angezeigte Fragenzahl deiner erwarteten Zahl entspricht und ob Fragen und Lösungen sachlich stimmen. Bei Fehlern kannst du den Text ändern oder die Meldungen an die KI zurückgeben. „Demorunde zurückholen“ ersetzt den Text im Feld durch die Beispielfragen.

In der Server-Fassung wird beim Ändern sofort neu geprüft. „Runde eröffnen“ ist erst bei gültiger Sammlung und stehender Verbindung verfügbar.

In der HTML-Fassung findest du den Import unter „Eigene Fragen schreiben“. Nach einer Textänderung klickst du „Fragen prüfen“; beim Dateiimport erscheint der Bericht automatisch. Klicke nach erfolgreicher Prüfung auf „Übernehmen“, kehre zum Start zurück und wähle „Allein am Bildschirm“. „Bühne eröffnen“ im Editor ist für die Artifact-Netzrunde vorgesehen.

## Spielablauf und Steuerung

Eine Frage beginnt mit einer kurzen Ankündigung. Danach folgt eine berechnete Lesezeit von mindestens zehn Sekunden; lange Texte erhalten mehr Zeit. Erst danach läuft die eingestellte Antwortzeit. Jede Person wählt eine Antwort. Die erste angenommene Antwort gilt und lässt sich nicht austauschen. Haben alle geantwortet, kann die Frage vor Ablauf der vollen Zeit schließen.

Die Auflösung zeigt die richtige Antwort und das Ergebnis. Richtige Antworten bringen bei der üblichen Zeitwertung bis zu 1000 Punkte; schnellere Antworten erhalten mehr Punkte. Falsche, fehlende oder verspätete Antworten bringen keine Punkte. Danach schaltest du zum Zwischenstand und zur nächsten Frage weiter. Am Ende folgt der Endstand.

Die beiden Fassungen haben unterschiedliche Bedienelemente:

| Aktion | Lokaler Server | HTML-Fassung |
|---|---|---|
| Starten und nach Auflösung/Stand weiterschalten | Angezeigter Knopf oder Leertaste | Angezeigter Knopf oder Leertaste |
| Lesezeit vorzeitig beenden | In der aktuellen Oberfläche nicht verfügbar | „Antworten freigeben“ oder Leertaste |
| Laufendes Antwortfenster vorzeitig schließen | In der aktuellen Oberfläche nicht verfügbar | „Frage schließen“ oder Leertaste |
| Gerät weiterreichen | Eigene Telefone verwenden | Im Ein-Gerät-Modus auf „Bin bereit“ warten |
| Ton umschalten | Kein entsprechender Knopf | „Ton an“/„Ton aus“ |
| Beitritt sperren | Kein entsprechender Knopf | In der Netzlobby „Beitritt sperren“/„Beitritt öffnen“ |

Tippe die Leertaste nicht im Namens- oder Fragenfeld als Steuerbefehl: Dort ist sie ein normales Leerzeichen. Halte die Bühnenansicht während des Spiels sichtbar.

## Runde und Programm beenden

In der Server-Fassung führt „Runde beenden“ nach dem Endstand zum beendeten Spiel. Für eine neue Runde öffnest du die Bühnenadresse erneut und eröffnest mit deinen Fragen eine neue Lobby. Zum vollständigen Ausschalten schließt du das Konsolenfenster oder drückst darin Strg+C. Danach sind die Spieleradressen nicht mehr erreichbar. Das Schließen eines Browser-Tabs allein beendet den Server nicht.

In der HTML-Fassung kannst du „Runde beenden“ verwenden. Während einer laufenden Runde erscheint zunächst das Podium; aus Lobby oder Endansicht geht es zurück zum Anfang. Schließen oder Neuladen der HTML-Seite beendet den dortigen Spielstand.

Es gibt derzeit keine verlässliche Wiederaufnahme einer unterbrochenen Runde und keine dauerhafte Ergebnisablage. Bewahre deine Fragendatei separat auf. Die HTML-Fassung versucht, Fragentext und einige Eingaben im Browserspeicher zu merken; das ist kein Ersatz für eine gespeicherte Datei.

## Wenn etwas nicht funktioniert

| Problem | Nächster Schritt |
|---|---|
| Der Doppelklick meldet fehlendes oder zu altes Node.js | Node.js ab Version 22 samt npm installieren; danach das Fenster schließen und die Startdatei erneut öffnen |
| Das Laden der Bausteine scheitert | Internetverbindung prüfen und die erste konkrete Fehlermeldung im Konsolenfenster lesen; Start erneut versuchen |
| Die Oberfläche öffnet sich nicht automatisch | Die tatsächliche `/host/`-Adresse aus dem Konsolenfenster manuell öffnen |
| Der Rechner erreicht die Bühne, das Telefon aber nicht | Die LAN-Adresse mit `/play/` verwenden; gemeinsames Netz, private Firewall-Freigabe für Node.js und mögliche Gastnetz-Sperre prüfen |
| Die zuerst genannte LAN-Adresse geht nicht | Die anderen im Konsolenfenster genannten Adressen versuchen; bei VPN oder virtuellen Netzwerkkarten kann die erste Auswahl falsch sein |
| Es wird keine LAN-Adresse gefunden | WLAN-/Kabelverbindung des Rechners prüfen. Die angezeigte `127.0.0.1`-Adresse funktioniert nur auf diesem Rechner |
| Die Seite öffnet sich, aber der Code wird abgelehnt | Den Code der gerade offenen Lobby verwenden; Server- und Artifact-Code gehören zu verschiedenen Fassungen |
| „Name vergeben“ oder ungültiger Name | Einen anderen Namen mit 1 bis 16 zulässigen Zeichen wählen; Groß-/Kleinschreibung unterscheidet Namen nicht |
| Die Datei wird abgelehnt | Prüfbericht lesen; UTF-8, Dateigröße, Leerzeilen, Textlängen und genau eine Sternmarkierung pro Frage kontrollieren |
| „Runde eröffnen“ bleibt auf „Verbinde …“ | Prüfen, ob der Server noch läuft und die Bühne über seine angezeigte Adresse geöffnet ist |
| Die lokale HTML-Datei meldet „Kein Funk“ | „Allein am Bildschirm“ wählen; für mehrere Geräte den lokalen Server verwenden |
| Nach Neuladen oder Verbindungsabbruch fehlt der Spielstand | Eine neue Runde vorbereiten; eine automatische Wiederaufnahme ist derzeit nicht zugesichert |

## Vor dem ersten Spieleabend testen

Parser und Spielregeln sind im Projekt automatisiert geprüft. Der Doppelklick aus dem Explorer, der Windows-Firewall-Dialog, ein echtes Telefon im verwendeten WLAN, Dateiablage im Browser, Darstellung auf TV/Beamer und der Leserhythmus müssen noch an deinen Geräten erprobt werden. Spiele deshalb vorab die Demorunde mit einem Telefon vollständig durch.

Bei einer veröffentlichten Artifact-Fassung muss zusätzlich ein tatsächlicher Gast die Seite öffnen und beitreten können. Ob die Raumfunktion dort verfügbar ist und welche Anmeldung beziehungsweise Freigabe nötig ist, lässt sich aus der lokalen HTML-Datei nicht garantieren. Der veröffentlichte Stand wurde für diese Anleitung nicht extern geprüft.
