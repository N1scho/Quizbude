# Anweisung für KIs: Quizfragen für Quizbude

Erstelle eine importierbare Fragensammlung für Quizbude. Verwende das folgende Zeilenformat, sofern ausdrücklich kein JSON verlangt wird. Thema, Zielgruppe und gewünschte Fragenzahl kommen aus dem Benutzerauftrag. Fehlen diese Angaben, kläre sie vor dem Erzeugen der Sammlung.

Gib als endgültige Antwort ausschließlich die vollständige Fragensammlung aus: kein Vorwort, kein Schlusswort, keine Erläuterung des Formats, keine Codezäune und keine Backticks. Die Codezäune in den Beispielen dieses Dokuments dienen nur zum Anzeigen des Beispiels; sie gehören nicht in deine Ausgabe.

## Verbindliches Zeilenformat

1. Beginne mit genau einer Titelzeile: `# `, dann ein nicht leerer Titel mit höchstens 256 Zeichen. Die Zeichen `# ` zählen nicht zum Titel.
2. Nach dem Titel folgt eine Leerzeile. Trenne auch alle Fragenblöcke durch genau eine Leerzeile. Innerhalb eines Fragenblocks darf keine Leerzeile stehen.
3. Die erste Zeile jedes Blocks ist der nicht leere Fragetext, gefolgt von ` | ` und einer ganzen Zahl für die Antwortzeit in Sekunden. Der reine Fragetext darf höchstens 200 Zeichen haben; Zeitangabe und Trennzeichen zählen nicht dazu.
4. Die Antwortzeit muss zwischen 5 und 300 Sekunden einschließlich liegen. Schreibe sie immer ausdrücklich, beispielsweise ` | 20`. Der Import verwendet bei fehlender Zeitangabe 20 Sekunden. Die Antwortzeit beginnt erst nach Ankündigung und zusätzlicher Lesezeit.
5. Unter die Frage kommen zwei bis vier nicht leere Antworten, jede auf genau eine eigene Zeile. Jede Antwort darf höchstens 100 Zeichen haben; die Richtigmarkierung zählt nicht zum Antworttext.
6. Genau eine Antwortzeile beginnt mit `* `: Stern und Leerzeichen. Das ist die einzige richtige Antwort. Die übrigen Antworten beginnen unmittelbar mit ihrem Text. Keine Nummerierung, Buchstabenbeschriftung, Aufzählungsstriche, Häkchen, Kästchen oder weiteren Markierungen verwenden.
7. Optional folgt direkt unter den Antworten genau eine kurze Erklärungszeile mit `> ` am Anfang. Keine Leerzeile davor. Die Erklärung gehört nur zu dieser Frage. Schreibe keine separate Lösungsliste.
8. Für eine Wahr/Falsch-Frage müssen die Antworten genau `Wahr` und danach `Falsch` lauten, in dieser Reihenfolge. Markiere genau eine davon mit `* `. Dann erkennt Quizbude den Fragetyp automatisch.
9. Erzeuge mindestens eine und höchstens 200 Fragen. Verwende keine weiteren Überschriften, Kommentare oder Zusatzfelder.
10. Verwende normalen Text mit korrekten Umlauten. Speichere eine gelieferte Datei als UTF-8, vorzugsweise mit Endung `.txt`. Die gesamte Datei darf höchstens 1.000.000 Bytes haben.

Verwende eindeutige Fragen, sachlich geprüfte Lösungen und plausible falsche Antworten. Vermeide mehrdeutige Antwortpaare, doppelte Antworten und Antworten wie „alle genannten“, deren Bedeutung durch eine andere Anordnung der Kacheln unklar würde. Die Position der richtigen Antwort kann sich bei der Anzeige ändern.

Beginnt ein Antworttext selbst mit einem Zeichen, das als Formatierung gelesen werden könnte, setze einen umgekehrten Schrägstrich davor. Beispiel: `\* Stern` ist ein unmarkierter Antworttext mit sichtbarem Stern am Anfang; `* \* Stern` markiert denselben Text als richtig. Vermeide solche Sonderfälle, wenn sie für die Frage nicht erforderlich sind.

Die Zeichenbegrenzungen werden technisch über JavaScript-Stringlängen geprüft. Normale deutsche Buchstaben zählen jeweils einmal; manche Sonderzeichen und Emojis brauchen mehr als eine Einheit. Bleibe mit Texten deutlich unter der Grenze.

## Vollständiges Beispiel im Zeilenformat

```text
# Wissen am Tisch

Welcher Planet ist der Sonne am nächsten? | 20
* Merkur
Venus
Mars
Jupiter
> Merkur ist der innerste Planet unseres Sonnensystems.

Ein Oktopus hat drei Herzen. | 15
* Wahr
Falsch
> Zwei Kiemenherzen und ein Körperherz übernehmen den Bluttransport.

Eine Woche hat acht Tage. | 10
Wahr
* Falsch
```

## JSON nur auf ausdrücklichen Wunsch

Quizbude unterstützt auch JSON. Gib in diesem Fall ausschließlich ein gültiges JSON-Objekt aus, ohne Markdown und ohne Text davor oder danach. Verwende gerade doppelte Anführungszeichen, keine Kommentare und keine nachgestellten Kommas. Die Grenzen für Fragenzahl, Titel, Frage, Antworten, Antwortzeit, Dateigröße und UTF-8 gelten wie oben.

Verwende genau diesen Aufbau:

- `titel`: nicht leerer Titel als Zeichenkette.
- `fragen`: Liste der Fragenobjekte.
- Pro Frage: `frage` als Zeichenkette, `sekunden` als ganze Zahl von 5 bis 300 und `antworten` als Liste mit zwei bis vier Antwortobjekten.
- Pro Antwort: `label` als nicht leere Zeichenkette und `correct` als JSON-Wahrheitswert. Genau ein Antwortobjekt pro Frage enthält `true`, alle anderen enthalten `false`.
- Optional pro Frage: `erklaerung` als kurze Zeichenkette. Wenn keine Erklärung gewünscht ist, lasse dieses Feld weg.

Verwende in JSON keine Sternmarkierungen in den Antworttexten und kein zusätzliches Lösungsfeld. Wahr/Falsch wird auch hier durch die Antworttexte `Wahr`, dann `Falsch` erkannt. Die importierte Sammlung erhält ihre internen IDs und Fragetypen automatisch; erfinde dafür keine Felder.

## Vollständiges JSON-Beispiel

```json
{
  "titel": "Wissen am Tisch",
  "fragen": [
    {
      "frage": "Welcher Planet ist der Sonne am nächsten?",
      "sekunden": 20,
      "antworten": [
        { "label": "Merkur", "correct": true },
        { "label": "Venus", "correct": false },
        { "label": "Mars", "correct": false },
        { "label": "Jupiter", "correct": false }
      ],
      "erklaerung": "Merkur ist der innerste Planet unseres Sonnensystems."
    },
    {
      "frage": "Ein Oktopus hat drei Herzen.",
      "sekunden": 15,
      "antworten": [
        { "label": "Wahr", "correct": true },
        { "label": "Falsch", "correct": false }
      ],
      "erklaerung": "Zwei Kiemenherzen und ein Körperherz übernehmen den Bluttransport."
    },
    {
      "frage": "Eine Woche hat acht Tage.",
      "sekunden": 10,
      "antworten": [
        { "label": "Wahr", "correct": false },
        { "label": "Falsch", "correct": true }
      ]
    }
  ]
}
```

## Prüfung vor deiner Ausgabe

Prüfe die gesamte Sammlung: richtige Fragenzahl, Titel vorhanden, alle Längen eingehalten, zwei bis vier Antworten je Frage, genau eine richtige Antwort, erlaubte Zeitangaben und vollständige Blöcke beziehungsweise gültiges JSON. Wird dir ein Quizbude-Prüfbericht mit Fehlern gegeben, korrigiere die vollständige Sammlung und gib sie erneut im gewählten Format aus, ohne Begleittext.

Ein grüner Prüfbericht bestätigt die Importierbarkeit, nicht die sachliche Richtigkeit der Lösungen.
