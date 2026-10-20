# Multiplayer-Quiz — Architektur- und Datenmodell-Konzept

**Stand:** 2026-10-19 · **Konzeptdokument.** Code erscheint ausschließlich als Spezifikation (SQL-DDL, TypeScript-Typen, Formel-Pseudocode) — nicht als Implementierung.
**Arbeitstitel:** `quizrunde` (Platzhalter, siehe Offene Entscheidung 12). Kein SIMO-Produkt, keine SIMO-CI, keine Begriffe aus fremden Marken.
**Baut auf:** `plattform-stack-entscheidung.md` (Stack, Transport, 44-Event-Skizze) und `kahoot-feature-analyse.md` (MUST-Umfang, Abschnitt 10).

**Begriffsfestlegung (Ruling 6).** Der Code, mit dem ein Spieler beitritt, heißt durchgängig **Join-Code**; der Raum heißt **Room**, sein Bezeichner **Room-Code**. Die Begriffe des Vorbilds kommen in Datenmodell, Events, Dateinamen und Prosa nicht vor. Antwortkacheln tragen im Datenmodell keine Farb- oder Formzuordnung — sie werden über `optionIndex` identifiziert; die Darstellung ist Sache der Oberfläche und erhält vom zweiten Agenten eine eigenständige Form-/Farbwelt.

---

## Änderung 2026-10-19

Der Nutzer hat präzisiert: „die app muss nicht wie kahoot identisch aussehen. ich will eine quizapp mit unbegrenzt vielen usern (wahrscheinlich max 20)". Damit ist die bisherige Annahme „maximal ~50 gleichzeitige Spieler" ersetzt, und mit ihr die daraus abgeleitete harte Obergrenze von 60 Spielern je Raum. An ihre Stelle treten zwei Sätze: Es gibt **kein Produktlimit**, das Spieler aus Geschäftsgründen aussperrt, und der zu optimierende **Normalfall ist ~20 Spieler**. Eine technische Grenze existiert trotzdem — sie wird in **6.6** hergeleitet und beziffert, statt verschwiegen zu werden.

Angefasst wurden: Abweichung **0/H**, Übergang **2** der Übergangstabelle, die Konstantentabelle **2.3**, die Dimensionierung in **3.1**, die Indexbegründung in **3.2**, das Feld `maxPlayers` in **3.4** und der neue Abschnitt **6.6**. Punkteformel, Zustandsmaschine, Schichtenschnitt und Fragetyp-Abstraktion sind unberührt.

---

## 0. Was dieses Konzept gegenüber den Vorarbeiten ändert

Ausdrückliche Widersprüche zu `plattform-stack-entscheidung.md`, jeweils mit Grund. Alles andere aus dieser Vorlage gilt unverändert weiter.

| Nr. | Vorlage sagt | Dieses Konzept sagt | Grund |
|---|---|---|---|
| A | PostgreSQL für Persistenz, SQLite nur als „einfacherer Start" | **SQLite ist der Zielzustand**, nicht eine Vorstufe | Ruling 1. Ein Schreibvorgang je Frage, ein Prozess, ein Schreiber. Die Begründung steht in Abschnitt 3.1. Die Repository-Schicht bleibt trotzdem abstrakt. |
| B | Redis als Skalierungsbaustein, Raum-Snapshots nach Redis | **Entfällt vollständig**, auch als Vorbereitung | Ruling 1. Der Einhängepunkt bleibt trivial nachrüstbar (ein Repository-Interface mehr), kostet aber heute null Zeilen. |
| C | Signiertes JWT als Sitzungstoken | **Opakes Zufallstoken**, serverseitig im Raum gehalten | Signaturen existieren, um Serverzustand zu vermeiden. Wir *haben* den Serverzustand. Kein Schlüsselmaterial, keine Bibliothek, kein Ablaufdatum-Handling. |
| D | 60 s Karenzzeit, danach gilt der Spieler als ausgeschieden | **Keine Austragung wegen Verbindungsabbruch während eines laufenden Spiels** | Spieleabend. Wer in der Küche steht, soll seinen Punktestand behalten. Entfernt wird nur per Host-Kick oder Spielende. |
| E | Ein Event `question_started` mit Frage und Endzeitpunkt | **Zweistufig:** `room:question_prepared` (Vorschau, ohne Lösung) + serverseitiger Übergang bei `answersOpenAt` | Ansatz A der Vorlage (synchronisierter Start) *verlangt* Vorauslieferung. Ein einzelnes Event kann das nicht leisten. |
| F | Für die Wertung: Median der Umlaufzeit-Proben | **Median für den Anzeige-Offset, Minimum für die Wertungs-Kompensation** | Das Minimum der beobachteten Umlaufzeiten ist die beste Schätzung der echten Pfadlaufzeit und zugleich die am wenigsten manipulierbare Statistik. Für den Uhren-Offset bleibt der Median richtig. |
| G | Captcha (Turnstile), Schimpfwortfilter, IP-Ratelimits, 2-Schritt-Beitritt | **Nicht im MVP.** Es bleiben: Namenslänge/-zeichensatz serverseitig, Host-Kick, Raumsperre, ein In-Memory-Zähler gegen Code-Raten | Ruling 1: ein privater Raum, dessen Link unter Freunden geteilt wird. Die genannten Maßnahmen lösen ein Publikumsproblem, das hier nicht existiert. Sie sind in Abschnitt 6 als Nachrüstpunkt benannt. |
| H | Spielerlimit offen | **Kein Produktlimit.** Optimiert wird auf ~20 Spieler; nach oben gibt es nur eine Notbremse gegen Ressourcenerschöpfung, keine Tarifgrenze | Der Nutzer will ausdrücklich keine künstliche Deckelung der Teilnehmerzahl. Wo es wirklich klemmt, steht hergeleitet in 6.6. Eine Fan-out-Aggregation ist bei dieser Zielgröße nicht nötig — und auch bei großer Zahl nicht, weil die Nachricht an den einzelnen Spieler nach Entwurf O(1) ist (6.6). |

---

## 1. Komponentenschnitt

### 1.1 Die vier Schichten

| Paket | Inhalt | Darf kennen | Darf **nicht** kennen |
|---|---|---|---|
| **`protocol`** | Wire-Typen: `ClientMessage`, `ServerMessage`, öffentliche Sichten (`PublicQuestionView`, `RevealView`, `ScoreboardView`). Keine Logik, keine Laufzeitabhängigkeiten. | nichts | alles |
| **`core`** | Zustandsmaschine, Punkteformel, Fragetyp-Registry, Belohnungsschicht, Rangberechnung, Zufallsquelle. **Rein**: keine `import`e aus Node-Builtins, kein `Date.now()`, kein `Math.random()`, kein `setTimeout`, keine Socket-Referenz. | `protocol` | `server`, `apps`, Node, Netzwerk, Datenbank |
| **`server/runtime`** | Prozesszustand: Raumregister, Timer-Scheduler, monotone Uhr, Code-Generator, Token-Generator, Report-Writer. Übersetzt zwischen Effekt-Liste und echter Welt. | `core`, `protocol`, `persistence` | `transport` (nur über Callback-Interfaces) |
| **`server/transport/*`** | Socket.IO-Gateway: Nachricht rein → `GameEvent` + Zeitstempel; `Effect` raus → `emit`. Pro Transport ein Adapter. | `runtime`, `protocol` | `core` direkt (geht ausschließlich über `runtime`) |
| **`server/http`** | REST für Quiz-Verwaltung und Report-Abruf, Auslieferung der Oberflächen. Berührt keinen laufenden Raum. | `persistence`, `runtime` (nur Raum anlegen) | `core` |
| **`server/persistence`** | Repository-Interfaces + SQLite-Implementierung, Migrationen. | `protocol` (für Snapshot-Typen) | `core`, `transport` |
| **`apps/host-web`, `apps/player-web`** | Die beiden Oberflächen. **Nicht Gegenstand dieses Konzepts** — zweiter Agent. | `protocol` | alles andere |

### 1.2 Die eine Regel, die Ruling 2 trägt

```
core exportiert genau eine Funktion mit Wirkung:

  step(state: GameState, input: EngineInput, deps: EngineDeps): StepResult

  EngineInput  = { event: GameEvent; at: MonoMs }      ← die Uhr kommt als Wert herein
  StepResult   = { state: GameState; effects: Effect[] }
```

`step` ist **total und referenziell transparent**: gleiche Eingaben, gleiches Ergebnis. Die Uhr ist kein Interface, sondern ein Feld jeder Eingabe — das ist strenger als „injizierte Uhr" und macht jeden Testfall zu einer Tabelle aus `(Zustand, Ereignis, Zeitpunkt) → (Zustand, Effekte)`. Zufall kommt als gesäte `Rng` in `deps`, damit das Mischen der Antwortreihenfolge reproduzierbar ist.

Ein `Effect` beschreibt eine Absicht, nicht ihre Ausführung:

```ts
type Effect =
  | { kind: 'send';          to: Audience; message: ServerMessage }
  | { kind: 'scheduleTimer'; token: TimerToken; atMono: MonoMs }
  | { kind: 'cancelTimer';   token: TimerToken }
  | { kind: 'persistRound';  round: RoundRecord }
  | { kind: 'persistFinal';  summary: GameSummaryRecord }
  | { kind: 'closeRoom';     reason: EndReason };

type Audience =
  | { scope: 'host' }
  | { scope: 'players' }
  | { scope: 'all' }
  | { scope: 'player'; playerId: PlayerId };
```

Daraus folgt unmittelbar das, was Ruling 2 bezweckt: Ein zweites Frontend liefert einen zweiten Adapter, der `Audience` auf seine Zustellwege abbildet. `core` merkt davon nichts.

### 1.3 Diagramm

```
   Browser (Host)        Browser (Spieler)        [später: Discord Activity]
         │                       │                            │
         └───────── WebSocket ───┴────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────────┐
│ server/transport/socketio        Adapter: dünn, zustandslos         │
│   inbound:  ClientMessage ──► GameEvent + at = clock.nowMono()      │
│   outbound: Effect{send} ──► io.to(room).emit(...)                  │
│   clockSync: ping/pong, RTT-Statistik je Verbindung                 │
└────────────────────────────────┬────────────────────────────────────┘
                                 │  RoomHandle.dispatch(event)
┌────────────────────────────────▼────────────────────────────────────┐
│ server/runtime                                                      │
│   RoomRegistry   Map<RoomCode, RoomHandle>  (Prozessspeicher)       │
│   RoomHandle     hält GameState, serialisiert Eingaben, führt       │
│                  Effekte aus, re-armt Timer, kennt Tokens           │
│   Scheduler      setTimeout ⇄ TimerToken (Generationszähler)        │
│   MonoClock      process.hrtime.bigint() → MonoMs                   │
│   ReportWriter   persistRound/persistFinal ──► persistence          │
└───────┬─────────────────────────────────────────────┬───────────────┘
        │ step(state, {event, at}, deps)              │
        │           ◄── {state, effects}              │
┌───────▼─────────────────────────────────────┐  ┌────▼───────────────┐
│ core   (rein · transportfrei · I/O-frei)    │  │ server/persistence │
│  ┌────────────┐  ┌───────────────────────┐  │  │  QuizRepository    │
│  │ engine/    │  │ questions/            │  │  │  ReportRepository  │
│  │  step.ts   │──│  QuestionTypeRegistry │  │  │  SQLite (WAL)      │
│  │  phases/   │  │   singleChoice        │  │  └────────────────────┘
│  └─────┬──────┘  │   multiSelect         │  │           ▲
│        │         │   trueFalse           │  │           │
│  ┌─────▼──────┐  └───────────────────────┘  │  ┌────────┴───────────┐
│  │ scoring/   │  ┌───────────────────────┐  │  │ server/http        │
│  │  score.ts  │  │ reward/               │  │  │  Quiz-CRUD         │
│  └────────────┘  │  RewardLayer (Plugin) │  │  │  Report-Abruf      │
│  ┌────────────┐  │   classic = Identität │  │  └────────────────────┘
│  │ ranking.ts │  └───────────────────────┘  │
│  │ rng.ts     │                             │
│  └────────────┘                             │
└──────────────────┬──────────────────────────┘
                   │ nur Typen, keine Logik
          ┌────────▼─────────┐
          │ protocol         │  von Server und allen Clients geteilt
          └──────────────────┘
```

### 1.4 Wie die Regel durchgesetzt wird

Eine Architekturregel, die nur in einem Dokument steht, hält drei Wochen. Zwei Mechanismen machen sie prüfbar:

1. **`packages/core/package.json` deklariert keine `dependencies`** außer `protocol`. Ein versehentliches `import { Server } from 'socket.io'` scheitert beim Build, nicht erst im Review.
2. Ein Lint-Test in `test/core/purity.test.ts` liest alle Dateien unter `core/src` und schlägt fehl bei `Date.now`, `Math.random`, `setTimeout`, `setInterval`, `process.`, `require(`. Zehn Zeilen, und sie fangen genau den Rückfall, der sonst passiert.

---

## 2. Zustandsmaschine des Spiels

### 2.1 Zustände

Sieben Zustände, wie beauftragt. Ein achter Zustand für „Fenster geschlossen, Nachzügler laufen noch ein" wurde **bewusst nicht** eingeführt: Verspätete Antworten werden innerhalb von `REVEAL` über ein Zeitfenster angenommen (Abschnitt 5.4). Ein eigener Zustand hätte dieselbe Regel nur an einer zweiten Stelle wiederholt.

| Zustand | Bedeutung | Was läuft | Was ist auf den Geräten sichtbar |
|---|---|---|---|
| `LOBBY` | Raum offen, Spiel nicht gestartet | Beitritte, Namensprüfung, Host-Kick, Raumsperre | Join-Code + Spielerliste (Host); Warteansicht (Spieler) |
| `PREVIEW` | Frage ist **ausgeliefert**, aber noch nicht freigegeben | Timer bis `answersOpenAt` | Fragetext; Antwortflächen gesperrt |
| `OPEN` | Antwortfenster offen | Timer bis `answersCloseAt`, Antwortannahme, Antwortzähler | Frage + Antwortflächen; Countdown |
| `REVEAL` | Fenster geschlossen, Lösung gezeigt | Nachzügler-Fenster (`LATE_GRACE_MS`) | Lösung + Verteilungsdiagramm (Host); richtig/falsch + Punkte + Rang (Spieler) |
| `SCOREBOARD` | Zwischenstand nach der Frage | — | Rangliste Top-N (Host); eigener Rang und Abstand (Spieler) |
| `PODIUM` | Endergebnis | — | Top 3 (Host); Endplatzierung (Spieler) |
| `FINISHED` | Terminal. Raum nimmt nichts mehr an. | — | „Spiel beendet" |

### 2.2 Übergangstabelle

`T` = Timeout-Übergang (Timer-Effekt + Uhrprüfung, siehe 5.6). Guards in Klammern.

| # | Von | Auslöser | Guard | Nach | Effekte (Auswahl) |
|---|---|---|---|---|---|
| 1 | — | `RoomCreated` | Quiz geladen, ≥1 Frage | `LOBBY` | `send(host, room:created)` |
| 2 | `LOBBY` | `PlayerJoinRequested` | nicht gesperrt, Notbremse `PLAYER_HARD_CAP` nicht erreicht (2.3), Name frei und gültig | `LOBBY` | `send(player, player:joined)`, `send(host, room:roster_changed)` |
| 3 | `LOBBY` | `PlayerRemoved` (Host) | Spieler existiert | `LOBBY` | `send(player, player:removed)`, `send(host, room:roster_changed)` |
| 4 | `LOBBY` | `RoomLockToggled` (Host) | — | `LOBBY` | `send(all, room:lock_changed)` |
| 5 | `LOBBY` | `HostStartedGame` | ≥1 Spieler | `PREVIEW` (Frage 0) | `send(all, room:question_prepared)`, `scheduleTimer(open)` |
| 6 | `PREVIEW` | `T: answersOpenAt` | — | `OPEN` | `send(all, room:answers_open)`, `scheduleTimer(close)` |
| 7 | `PREVIEW` | `HostSkippedPreview` | — | `OPEN` | wie 6, `answersOpenAt := at` |
| 8 | `PREVIEW` | `AnswerSubmitted` | — | `PREVIEW` | `send(player, player:answer_rejected{not_open})` — **kein** Zustandswechsel |
| 9 | `OPEN` | `AnswerSubmitted` | erste Antwort dieses Spielers, `questionSeq` passt | `OPEN` | Antwort buchen, `send(player, player:answer_ack)`, `send(host, room:answer_count)` |
| 10 | `OPEN` | `AnswerSubmitted` | Spieler hat bereits geantwortet | `OPEN` | `send(player, player:answer_ack)` mit der **ersten** Antwort (idempotent) |
| 11 | `OPEN` | `AllPlayersAnswered` (abgeleitet) | alle verbundenen Spieler haben geantwortet | `REVEAL` | `cancelTimer(close)`, Wertung, `send(all, room:reveal)` |
| 12 | `OPEN` | `HostForcedReveal` | — | `REVEAL` | wie 11 |
| 13 | `OPEN` | `T: answersCloseAt` | — | `REVEAL` | wie 11 |
| 14 | `REVEAL` | `AnswerSubmitted` | `at − answersCloseAt ≤ LATE_GRACE_MS`, erste Antwort | `REVEAL` | als **verspätet** mit 0 Punkten buchen, `send(player, player:answer_ack{late})` |
| 15 | `REVEAL` | `AnswerSubmitted` | sonst | `REVEAL` | `send(player, player:answer_rejected{closed})` |
| 16 | `REVEAL` | `HostAdvanced` | `expectedPhase == REVEAL` | `SCOREBOARD` | `persistRound`, `send(all, room:scoreboard)` |
| 17 | `SCOREBOARD` | `HostAdvanced` | weitere Frage vorhanden | `PREVIEW` (Frage n+1) | wie 5 |
| 18 | `SCOREBOARD` | `HostAdvanced` | letzte Frage | `PODIUM` | `send(all, room:podium)` |
| 19 | `PREVIEW`/`OPEN`/`REVEAL`/`SCOREBOARD` | `HostEndedGame` | — | `PODIUM` | laufende Frage verwerfen bzw. werten (siehe 2.4), `persistRound?`, `send(all, room:podium)` |
| 20 | `PODIUM` | `HostClosedRoom` | — | `FINISHED` | `persistFinal{completed\|host_ended}`, `closeRoom` |
| 21 | `PODIUM` | `T: PODIUM_TTL_MS` | — | `FINISHED` | wie 20 |
| 22 | jeder außer `FINISHED` | `T: ROOM_IDLE_TTL_MS` | keine Eingabe seit TTL | `FINISHED` | `persistFinal{timed_out}`, `closeRoom` |
| 23 | `LOBBY` | `PlayerLeft` / `PlayerDisconnected` | — | `LOBBY` | in `LOBBY` wird der Spieler **entfernt**; ab `PREVIEW` nur `connected := false` |
| 24 | `FINISHED` | alles | — | `FINISHED` | `send(..., room:closed)` |

### 2.3 Timeouts und Konstanten

| Konstante | Vorschlag | Begründung |
|---|---|---|
| `PREVIEW_MS` | 3 000 | Deckt Zustellung + Rendering + Vorlesezeit des Fragetexts. Untergrenze ist die größte erwartbare Einwegzeit (hier: zweistellige Millisekunden), der Rest ist Dramaturgie. |
| `LATE_GRACE_MS` | 1 500 | Eine Antwort, die 200 ms zu spät kommt, darf die Oberfläche des Spielers nicht hängen lassen. 1,5 s deckt jede realistische Mobilfunkspitze. |
| `ALL_ANSWERED_SETTLE_MS` | 300 | Nach der letzten erwarteten Antwort noch kurz warten, bevor vorzeitig aufgelöst wird — sonst schneidet ein Doppelklick das Fenster ab. |
| `PODIUM_TTL_MS` | 15 × 60 000 | Nach dem Podium darf der Raum liegen bleiben, bis jemand den Beamer ausschaltet. |
| `ROOM_IDLE_TTL_MS` | 60 × 60 000 | Vergessene Räume räumen sich selbst ab. |
| `HOST_RECONNECT_WAIT` | **unbegrenzt** | Ruling 1: ein Host, ein Raum. Ein automatisches Weiterschalten ohne Host würde die Runde überrollen. Siehe Offene Entscheidung 5. |
| `PLAYER_HARD_CAP` | 5 000 | **Kein Produktlimit, sondern eine Notbremse** (0/H). Der Wert ist die in 6.6 hergeleitete Stelle, ab der die Fairness-Zusage aus 5.4 zu erodieren beginnt — nicht die Stelle, ab der jemand zahlen soll. Konfigurierbar; Ablehnung mit ehrlichem Grund `capacity`. |
| `PLAYER_SOFT_WARN` | 25 | Keine Grenze, nur ein Hinweis an den Host: Ab hier kann die Bühne nicht mehr alle Namen in lesbarer Größe zeigen (Herleitung in 6.6, UX-Konzept Abschnitt 1.1/B3). Beitritte laufen unverändert weiter. |

### 2.4 Was bei `HostEndedGame` mit der laufenden Frage passiert

Definierte Regel, weil sie sonst im Review auffällt: Wird das Spiel in `PREVIEW` beendet, zählt die laufende Frage **nicht** (keine `persistRound`). Wird es in `OPEN` beendet, wird die Frage wie bei `HostForcedReveal` gewertet und gespeichert — es gibt bereits Antworten, und sie unter den Tisch fallen zu lassen wäre für die Betroffenen willkürlich. In `REVEAL` und `SCOREBOARD` ist die Frage ohnehin gewertet.

### 2.5 Diagramm

```
                    ┌──────────────┐
    RoomCreated ───►│    LOBBY     │
                    │              │◄── join · kick · lock  (Selbstübergänge)
                    └──────┬───────┘
                           │ HostStartedGame
                           ▼
                    ┌──────────────┐
         ┌─────────►│   PREVIEW    │  Frage ist ausgeliefert, Lösung nicht
         │          │              │  Antwort hier ⇒ abgelehnt (not_open)
         │          └──────┬───────┘
         │   T: answersOpenAt │ HostSkippedPreview
         │                  ▼
         │          ┌──────────────┐
         │          │     OPEN     │  Antwortannahme · Antwortzähler zum Host
         │          └──────┬───────┘
         │  T: answersCloseAt │ HostForcedReveal │ AllPlayersAnswered
         │                  ▼
         │          ┌──────────────┐
         │          │    REVEAL    │  Lösung + Verteilung
         │          │              │  Nachzügler ≤ LATE_GRACE_MS ⇒ 0 Punkte
         │          └──────┬───────┘
         │       HostAdvanced │ (persistRound)
         │                  ▼
         │          ┌──────────────┐
         └──────────┤  SCOREBOARD  │
          weitere   │              │
          Fragen    └──────┬───────┘
                           │ letzte Frage
                           ▼
                    ┌──────────────┐
   HostEndedGame ──►│    PODIUM    │◄── aus PREVIEW/OPEN/REVEAL/SCOREBOARD
   (aus jeder       │              │
    Spielphase)     └──────┬───────┘
                           │ HostClosedRoom · T: PODIUM_TTL
                           ▼
                    ┌──────────────┐
   T: ROOM_IDLE_TTL►│   FINISHED   │  terminal · persistFinal · closeRoom
   (aus jedem       └──────────────┘
    Zustand)
```

---

## 3. Datenmodell

### 3.0 Die Trennlinie

> **Persistent ist, was eine Partie überdauern muss: das Quiz und der abgeschlossene Spielbericht.
> Flüchtig ist alles, was eine *laufende* Partie beschreibt — ohne Ausnahme und ohne Spiegelung.**

Daraus folgen drei Regeln, die jeden Zweifelsfall entscheiden:

1. **Während `OPEN` wird nie geschrieben.** Die Datenbank darf im Antwortfenster nicht einmal berührt werden; `better-sqlite3` ist synchron, und ein Schreibvorgang mitten in der Zeitmessung wäre genau die Art Jitter, die man hinterher nicht mehr findet.
2. **Geschrieben wird an zwei Phasenwechseln:** `REVEAL → SCOREBOARD` (`persistRound`, eine Frage) und `* → FINISHED` (`persistFinal`, Kopfdaten und Endstand). Das ist ein bewusster Zusatz gegenüber „alles am Ende": Ein Absturz nach Frage 12 kostet dann Frage 13, nicht den ganzen Abend. Kosten: ~50 Zeilen in einer Transaktion, wenige Millisekunden, außerhalb jeder Zeitmessung.
3. **Der Bericht ist selbsttragend.** Fragetext, Spezifikation und Lösung werden als Snapshot kopiert, nicht per Fremdschlüssel referenziert. Wer am Folgetag das Quiz korrigiert, verfälscht sonst den Bericht von gestern. `question_id` wird mitgeführt, aber nur als Hinweis (`ON DELETE SET NULL`).

### 3.1 Datenbankwahl: SQLite reicht — ausdrücklich geprüft

Die Prüfung entlang der Last, die das Privat-Ruling erzeugt:

| Dimension | Anforderung | SQLite |
|---|---|---|
| Gleichzeitige Schreiber | **einer** (ein Prozess, Schreiben serialisiert über `RoomHandle`) | SQLite erlaubt genau einen Schreiber — hier keine Einschränkung, sondern Deckungsgleichheit |
| Schreibvolumen Spitze | 1 Frage × 20 Spieler = 20 Zeilen je `persistRound` | eine Transaktion, **~1 ms** (bei konservativ 50 µs je Zeile mit vorbereitetem Statement) |
| Schreibvolumen gesamt | 20 Fragen × 20 = 400 Zeilen je Abend, rund 48 kB Datei-Zuwachs | belanglos |
| Lesevolumen | Quizliste, ein Quiz, ein Bericht | belanglos |
| Gleichzeitige Leser | Quiz-Editor neben laufendem Spiel | WAL erlaubt Leser parallel zum Schreiber |
| Betrieb | kein Dienst, kein Benutzer, kein Netzwerk, eine Datei | genau das |
| Datensicherung | Datei kopieren (bzw. `VACUUM INTO`) | genau das |
| Wachstumsrisiko | mehrere Prozesse, Netzwerkzugriff, gleichzeitige Schreiber | **dann** PostgreSQL — der Wechsel berührt nur `persistence/` |

**Ergebnis: SQLite, `better-sqlite3`, WAL-Modus.** Gegen PostgreSQL spricht hier nichts Technisches, sondern der Betriebsaufwand: ein zweiter Dienst, ein Benutzer, eine Verbindungszeichenkette, eine Sicherungsstrategie — für eine Datei, die nach zwanzig Spieleabenden unter einem Megabyte liegt. Mit dem Normalfall ~20 statt ~50 Spielern trägt diese Entscheidung noch deutlicher: Das Spitzenvolumen je `persistRound` fällt von 60 auf 20 Zeilen, das Volumen je Abend von 1 200 auf 400. Selbst ein Raum mit 2 000 Spielern bliebe mit ~100 ms je `persistRound` handhabbar — und läge damit immer noch außerhalb jeder Zeitmessung (Regel 1 oben).

Zwei Dinge halten den Wechsel offen: Die Repositories sind Interfaces (`QuizRepository`, `ReportRepository`), und das Schema vermeidet SQLite-Spezialitäten bis auf `WITHOUT ROWID` und die `strftime`-Vorgabewerte — beides in zwei Zeilen übersetzbar. UUIDs liegen als `TEXT`, Zeitstempel als ISO-8601-UTC-`TEXT`; beides portiert ohne Umrechnung.

Eine Eigenheit, die man kennen muss: `better-sqlite3` ist **synchron** und blockiert damit die Ereignisschleife, die auch die WebSockets bedient. Genau deshalb steht Regel 1 oben. Eine Transaktion über 20 Zeilen liegt bei rund einer Millisekunde und fällt in einen Phasenwechsel, in dem ohnehin niemand auf eine Zeitmessung wartet. Die Blockade wächst linear mit der Spielerzahl; wann sie als Ruckler sichtbar wird, steht in 6.6.

### 3.2 Persistente Daten — SQL-DDL

```sql
-- ============================================================
-- quizrunde · Schema v1 · SQLite
-- ============================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous  = NORMAL;   -- WAL + NORMAL: fsync nur beim Checkpoint

-- ------------------------------------------------------------
-- Autorenseite: Quizze und Fragen
-- ------------------------------------------------------------
CREATE TABLE quiz (
  id                TEXT    PRIMARY KEY,                    -- UUIDv7 als Text
  title             TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description       TEXT,
  -- Globaler Schalter "Zeit zählt / zählt nicht" (MUST, Feature-Analyse 10/Engine 4).
  -- Bewusst auf Quiz-Ebene, nicht auf Raum-Ebene: er gehört zur Absicht des Quiz.
  -- Der Host darf ihn beim Anlegen des Raums überschreiben (RoomConfig).
  scoring_mode      TEXT    NOT NULL DEFAULT 'timed'
                            CHECK (scoring_mode IN ('timed','flat')),
  shuffle_options   INTEGER NOT NULL DEFAULT 1 CHECK (shuffle_options   IN (0,1)),
  shuffle_questions INTEGER NOT NULL DEFAULT 0 CHECK (shuffle_questions IN (0,1)),
  created_at_utc    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at_utc    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE question (
  id             TEXT    PRIMARY KEY,
  quiz_id        TEXT    NOT NULL REFERENCES quiz(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL CHECK (position >= 0),
  -- Fragetyp-Kennung; muss in der QuestionTypeRegistry registriert sein.
  -- MVP: 'single_choice' | 'multi_select' | 'true_false'
  type           TEXT    NOT NULL,
  prompt         TEXT    NOT NULL CHECK (length(prompt) BETWEEN 1 AND 200),
  media_url      TEXT,
  time_limit_ms  INTEGER NOT NULL CHECK (time_limit_ms BETWEEN 5000 AND 240000),
  -- 0 = Frage zählt nicht, 1 = einfach, 2 = doppelt
  points_factor  REAL    NOT NULL DEFAULT 1.0 CHECK (points_factor IN (0.0, 1.0, 2.0)),
  -- Die vollständige typspezifische Spezifikation inkl. Lösung, als JSON.
  -- Begründung siehe 3.3.
  spec_json      TEXT    NOT NULL CHECK (json_valid(spec_json)),
  spec_version   INTEGER NOT NULL DEFAULT 1,
  UNIQUE (quiz_id, position)
);
-- Der UNIQUE-Index deckt den Leseweg "alle Fragen eines Quiz in Reihenfolge"
-- vollständig ab; ein zusätzlicher Index auf (quiz_id, position) wäre redundant.
--
-- Umsortieren im Editor: Die UNIQUE-Bedingung wird je Statement geprüft.
-- Deshalb in EINER Transaktion zweistufig:
--   UPDATE question SET position = -1 - position WHERE quiz_id = ?;
--   dann die Zielpositionen setzen.

-- ------------------------------------------------------------
-- Berichtsseite: abgeschlossene Spiele (Snapshots, selbsttragend)
-- ------------------------------------------------------------
CREATE TABLE game_report (
  id              TEXT    PRIMARY KEY,
  -- Hinweis auf die Quelle, kein Datenweg: der Bericht bleibt gültig,
  -- wenn das Quiz gelöscht oder verändert wird.
  quiz_id         TEXT    REFERENCES quiz(id) ON DELETE SET NULL,
  quiz_title      TEXT    NOT NULL,                 -- Snapshot
  join_code       TEXT    NOT NULL,                 -- nur zur Wiedererkennung
  reward_layer    TEXT    NOT NULL DEFAULT 'classic',
  scoring_mode    TEXT    NOT NULL CHECK (scoring_mode IN ('timed','flat')),
  started_at_utc  TEXT    NOT NULL,
  -- NULL = Spiel lief, als der Prozess endete. Ein Sweeper beim Start setzt
  -- für solche Zeilen end_reason = 'server_lost' und ended_at_utc = NULL-Bleibt.
  ended_at_utc    TEXT,
  end_reason      TEXT    CHECK (end_reason IN
                          ('completed','host_ended','timed_out','server_lost')),
  player_count    INTEGER NOT NULL DEFAULT 0,
  question_count  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_game_report_started ON game_report(started_at_utc DESC);
CREATE INDEX idx_game_report_quiz    ON game_report(quiz_id, started_at_utc DESC);

CREATE TABLE report_player (
  id             TEXT    PRIMARY KEY,
  report_id      TEXT    NOT NULL REFERENCES game_report(id) ON DELETE CASCADE,
  display_name   TEXT    NOT NULL,
  final_score    INTEGER NOT NULL DEFAULT 0,
  -- Rang nach Punkten (kanonisch, immer gefüllt)
  final_rank     INTEGER,
  -- Rang, den die Belohnungsschicht angezeigt hat. Bei 'classic' identisch.
  -- Getrennt geführt, damit eine Spielwelt mit Zufallsfinale den Bericht
  -- nicht unbrauchbar macht. Siehe 4.4.
  display_rank   INTEGER,
  correct_count  INTEGER NOT NULL DEFAULT 0,
  answered_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (report_id, display_name)
);
CREATE INDEX idx_report_player_rank ON report_player(report_id, final_rank);

CREATE TABLE report_question (
  id                 TEXT    PRIMARY KEY,
  report_id          TEXT    NOT NULL REFERENCES game_report(id) ON DELETE CASCADE,
  position           INTEGER NOT NULL,
  source_question_id TEXT,                           -- Hinweis, kein FK
  type               TEXT    NOT NULL,
  prompt             TEXT    NOT NULL,               -- Snapshot
  spec_json          TEXT    NOT NULL CHECK (json_valid(spec_json)),  -- Snapshot inkl. Lösung
  time_limit_ms      INTEGER NOT NULL,
  max_points         INTEGER NOT NULL,               -- bereits mit points_factor verrechnet
  answer_count       INTEGER NOT NULL DEFAULT 0,
  correct_count      INTEGER NOT NULL DEFAULT 0,
  -- Vom Fragetyp-Handler erzeugte Aggregation (z. B. Trefferzahl je Option).
  -- Typspezifisch, deshalb JSON. Dient dem Balkendiagramm im Bericht.
  distribution_json  TEXT    CHECK (distribution_json IS NULL
                                    OR json_valid(distribution_json)),
  UNIQUE (report_id, position)
);

CREATE TABLE report_answer (
  report_question_id TEXT    NOT NULL REFERENCES report_question(id) ON DELETE CASCADE,
  report_player_id   TEXT    NOT NULL REFERENCES report_player(id)   ON DELETE CASCADE,
  response_json      TEXT    CHECK (response_json IS NULL OR json_valid(response_json)),
  is_correct         INTEGER NOT NULL CHECK (is_correct IN (0,1)),
  is_late            INTEGER NOT NULL DEFAULT 0 CHECK (is_late IN (0,1)),
  raw_elapsed_ms     INTEGER,    -- gemessen, vor Latenzkompensation
  scored_elapsed_ms  INTEGER,    -- nach Kompensation und Clamping, Basis der Formel
  points_awarded     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (report_question_id, report_player_id)
) WITHOUT ROWID;
-- Keine Zeile = nicht geantwortet. Das macht "unanswered" zur Abwesenheit
-- statt zu einem Sonderwert und hält die Auswertung einfach.
CREATE INDEX idx_report_answer_player ON report_answer(report_player_id);
```

**Wofür die Indizes da sind, einzeln:**

| Index | Abfrage, die ihn braucht |
|---|---|
| `question UNIQUE(quiz_id,position)` | „Alle Fragen dieses Quiz in Reihenfolge" — der einzige heiße Lesepfad beim Raumstart |
| `idx_game_report_started` | Berichtsliste, neueste zuerst |
| `idx_game_report_quiz` | „Alle Spiele zu diesem Quiz" |
| `idx_report_player_rank` | Teilnehmer-Rangliste eines Berichts |
| `report_answer PK(question,player)` | Frage-für-Frage-Ansicht; `WITHOUT ROWID` spart hier die zweite Indirektion |
| `idx_report_answer_player` | Drilldown „alle Antworten eines Teilnehmers" |

Bewusst **nicht** angelegt: ein Index auf `report_answer(is_correct)` oder `points_awarded`. Bei 400 Zeilen je Spiel gewinnt der Tabellenscan deutlich; er gewönne ihn auch noch bei 10 000.

### 3.3 Warum `spec_json` statt einer Optionstabelle

Die naheliegende Alternative wäre `question_option(question_id, position, label, is_correct)`. Dagegen sprechen drei Dinge:

1. **Die Spezifikation wird nur als Ganzes gelesen**, und immer von genau einem Handler. Es gibt keine Abfrage über Optionen hinweg, die der Anwendung nützt.
2. **Jeder neue Fragetyp bräuchte eine Migration.** Ein Schieberegler hat kein `label`, eine Sortierfrage hat keine `is_correct`-Spalte, eine Texteingabe hat eine Liste akzeptierter Schreibweisen. Ruling 5 verlangt, dass ein neuer Typ ohne Umbau andockt — eine relationale Optionstabelle bricht genau diese Zusage.
3. **Die Auswertung braucht sie nicht.** Die Antwortverteilung liegt aggregiert in `report_question.distribution_json`; der Bericht muss nie gegen Optionen joinen.

Der Preis ist ehrlich zu nennen: Man kann nicht in SQL fragen „welche Fragen haben mehr als vier Optionen". Dafür gibt es `json_each()`, und der Bedarf ist hypothetisch.

### 3.4 Flüchtiger Laufzeit-Zustand — TypeScript-Typen

Diese Typen leben ausschließlich im Prozessspeicher. Sie haben **keine** Entsprechung in der Datenbank und werden nirgends serialisiert außer in Snapshots an die Clients.

```ts
// ===========================================================
// packages/core/src/engine/state.ts   — rein, transportfrei
// ===========================================================

/** Millisekunden aus einer MONOTONEN Quelle. Niemals Wanduhr. */
export type MonoMs = number & { readonly __brand: 'MonoMs' };

export type RoomCode  = string & { readonly __brand: 'RoomCode' };
export type PlayerId  = string & { readonly __brand: 'PlayerId' };

/** Herkunft ab Tag eins im Modell — damit das zweite Frontend
 *  keinen Eingriff in core braucht (Ruling 2). */
export type PlayerOrigin = 'web' | 'discord';

// -----------------------------------------------------------
// Raumkonfiguration: beim Anlegen fixiert, danach unveränderlich
// -----------------------------------------------------------
export interface RoomConfig {
  readonly roomCode: RoomCode;
  readonly quizTitle: string;
  readonly sourceQuizId: string | null;
  readonly scoringMode: 'timed' | 'flat';
  readonly shuffleOptions: boolean;
  readonly rewardLayerId: string;          // 'classic' im MVP
  /** Notbremse gegen Ressourcenerschöpfung, KEIN Produktlimit (0/H, 6.6).
   *  Default PLAYER_HARD_CAP; 0 bedeutet "keine Notbremse". */
  readonly playerHardCap: number;
  readonly previewMs: number;
  readonly lateGraceMs: number;
  readonly podiumTtlMs: number;
  readonly roomIdleTtlMs: number;
}

// -----------------------------------------------------------
// Spieler
// -----------------------------------------------------------
export interface PlayerState {
  readonly id: PlayerId;
  readonly displayName: string;            // innerhalb des Raums dauerhaft belegt
  readonly origin: PlayerOrigin;
  /** Opakes Zufallstoken. Nicht signiert — der Raum hält den Zustand selbst. */
  readonly resumeToken: string;
  connected: boolean;
  joinedAt: MonoMs;
  lastSeenAt: MonoMs;
  score: number;                           // kanonisch, nur aus scoring/
  correctCount: number;
  answeredCount: number;
  /** Statistik für die Latenzkompensation. Vom Transport gepflegt,
   *  von core nur gelesen. */
  rtt: RttStats;
}

export interface RttStats {
  /** Letzte N serverseitig gemessenen Umlaufzeiten in ms. */
  readonly samples: readonly number[];
  /** Minimum der Proben — Basis der Wertungskompensation (siehe 5.3). */
  readonly minMs: number | null;
  /** Median — nur für den Anzeige-Offset der gemeinsamen Uhr. */
  readonly medianMs: number | null;
}

// -----------------------------------------------------------
// Laufende Frage
// -----------------------------------------------------------
export interface LiveQuestion {
  readonly seq: number;                    // 0-basiert, Index im Spiel
  readonly questionId: string;
  readonly type: string;
  readonly prompt: string;
  readonly mediaUrl: string | null;
  readonly timeLimitMs: number;
  readonly pointsFactor: number;
  /** Vollständige Spezifikation inkl. Lösung. Verlässt core NIE
   *  vor dem Übergang nach REVEAL. */
  readonly spec: unknown;
  /** Öffentliche Sicht — enthält strukturell keine Lösung (siehe 4.2). */
  readonly publicView: PublicQuestionView;
  /** Abbildung angezeigter Index → kanonischer Index, Ergebnis des
   *  Mischens. Bleibt serverseitig. */
  readonly optionMapping: readonly number[];
  readonly maxPoints: number;              // unitValue × units × pointsFactor
}

export interface AnswerRecord {
  readonly playerId: PlayerId;
  readonly response: unknown;              // kanonisiert, typspezifisch
  readonly receivedAt: MonoMs;
  readonly rawElapsedMs: number;
  readonly scoredElapsedMs: number;
  readonly correct: boolean;
  readonly late: boolean;
  readonly points: number;
}

// -----------------------------------------------------------
// Zustand: diskriminierte Union über die sieben Phasen
// -----------------------------------------------------------
export type Phase =
  | 'LOBBY' | 'PREVIEW' | 'OPEN' | 'REVEAL'
  | 'SCOREBOARD' | 'PODIUM' | 'FINISHED';

interface BaseState {
  readonly config: RoomConfig;
  readonly hostToken: string;              // opak, Zufallswert
  readonly players: ReadonlyMap<PlayerId, PlayerState>;
  readonly nameIndex: ReadonlyMap<string, PlayerId>;   // normalisierter Name → Spieler
  readonly questions: readonly LoadedQuestion[];       // Reihenfolge bereits fixiert
  readonly startedAt: MonoMs | null;
  readonly lastInputAt: MonoMs;
  /** Monoton steigender Generationszähler. Jeder Timer trägt ihn;
   *  ein Timer mit veralteter Generation wird verworfen (siehe 5.6). */
  readonly timerGen: number;
  /** Zustand der Belohnungsschicht. core kennt nur den Typ, nicht den Inhalt. */
  readonly reward: unknown;
}

export interface LobbyState extends BaseState {
  readonly phase: 'LOBBY';
  readonly locked: boolean;
}

export interface PreviewState extends BaseState {
  readonly phase: 'PREVIEW';
  readonly question: LiveQuestion;
  readonly preparedAt: MonoMs;
  readonly answersOpenAt: MonoMs;
}

export interface OpenState extends BaseState {
  readonly phase: 'OPEN';
  readonly question: LiveQuestion;
  readonly openedAt: MonoMs;               // der einzige Nullpunkt der Zeitmessung
  readonly answersCloseAt: MonoMs;
  readonly answers: ReadonlyMap<PlayerId, AnswerRecord>;
}

export interface RevealState extends BaseState {
  readonly phase: 'REVEAL';
  readonly question: LiveQuestion;
  readonly closedAt: MonoMs;
  readonly lateUntil: MonoMs;              // closedAt + lateGraceMs
  readonly answers: ReadonlyMap<PlayerId, AnswerRecord>;
  readonly distribution: unknown;          // vom Fragetyp-Handler aggregiert
  readonly persisted: boolean;
}

export interface ScoreboardState extends BaseState {
  readonly phase: 'SCOREBOARD';
  readonly afterSeq: number;
  readonly ranking: readonly RankedPlayer[];
}

export interface PodiumState extends BaseState {
  readonly phase: 'PODIUM';
  readonly ranking: readonly RankedPlayer[];
  readonly displayRanking: readonly RankedPlayer[];   // ggf. von reward/ überschrieben
  readonly endReason: EndReason;
  readonly expiresAt: MonoMs;
}

export interface FinishedState extends BaseState {
  readonly phase: 'FINISHED';
  readonly endReason: EndReason;
}

export type GameState =
  | LobbyState | PreviewState | OpenState | RevealState
  | ScoreboardState | PodiumState | FinishedState;

export interface RankedPlayer {
  readonly playerId: PlayerId;
  readonly displayName: string;
  readonly score: number;
  readonly rank: number;                   // 1-basiert, gleiche Punkte ⇒ gleicher Rang
  readonly deltaToAhead: number;           // 0 für Rang 1
}

export type EndReason = 'completed' | 'host_ended' | 'timed_out';
```

```ts
// ===========================================================
// packages/server/src/runtime/roomHandle.ts
// Prozesszustand AUSSERHALB von core — hier leben die Sockets.
// ===========================================================
export interface RoomHandle {
  readonly code: RoomCode;
  state: GameState;                                  // der einzige veränderliche Halter
  readonly sockets: Map<PlayerId, Set<SocketId>>;    // ein Spieler darf mehrere Tabs haben
  readonly hostSockets: Set<SocketId>;
  readonly timers: Map<TimerToken, NodeJS.Timeout>;
  /** Serialisiert Eingaben: step() darf nie reentrant laufen. */
  dispatch(event: GameEvent): void;
}

export interface RoomRegistry {
  create(config: RoomConfig, questions: LoadedQuestion[]): RoomHandle;
  byCode(code: RoomCode): RoomHandle | undefined;
  /** Nach Spielende gesperrt, damit ein Nachzügler nicht im Folgespiel landet. */
  retire(code: RoomCode, cooldownMs: number): void;
  readonly size: number;
}
```

---

## 4. Fragetyp-Abstraktion

### 4.1 Das Interface

Ein Fragetyp ist ein **Handler**, kein Datensatz. Er kapselt alles, was typabhängig ist, und nichts, was es nicht ist.

```ts
// packages/core/src/questions/handler.ts

export interface QuestionTypeHandler<TSpec, TResponse, TAgg> {
  readonly type: string;

  /** Autorenzeit: rohes spec_json validieren und normalisieren.
   *  Wirft bei ungültiger Eingabe — der Editor speichert dann nicht. */
  parseSpec(raw: unknown): TSpec;

  /** Spielzeit, beim Übergang in PREVIEW.
   *  MUSS eine Sicht liefern, die strukturell keine Lösung tragen kann. */
  publicView(spec: TSpec, rng: Rng, shuffle: boolean): {
    view: PublicQuestionView;
    /** angezeigter Index → kanonischer Index. Bleibt serverseitig. */
    mapping: readonly number[];
  };

  /** Spielzeit, bei Antworteingang. Rückkanonisierung über mapping.
   *  Darf NICHT werfen — ungültige Eingaben ergeben einen ParseError. */
  parseResponse(
    raw: unknown, spec: TSpec, mapping: readonly number[],
  ): { ok: true; value: TResponse } | { ok: false; reason: ResponseError };

  /** Die einzige Stelle, an der "richtig" definiert wird.
   *  Kennt KEINE Zeit und KEINE Punkte. */
  grade(response: TResponse, spec: TSpec): Verdict;

  /** Wie viele Punkteinheiten diese Frage maximal wert ist.
   *  1 für Single-Choice und True/False. Hebel für "500 je richtiger
   *  Option" bei Multi-Select, ohne die Formel anzufassen (Offene Entscheidung 1). */
  maxPointUnits(spec: TSpec): number;

  /** Aggregation für Auflösungsdiagramm und Bericht. */
  emptyAggregate(spec: TSpec): TAgg;
  accumulate(agg: TAgg, response: TResponse, verdict: Verdict): TAgg;

  /** Spielzeit, beim Übergang nach REVEAL. Hier — und nur hier —
   *  darf die Lösung den Server verlassen. */
  revealView(spec: TSpec, agg: TAgg, mapping: readonly number[]): RevealView;
}

export interface Verdict { readonly correct: boolean }

export type ResponseError =
  | 'malformed' | 'out_of_range' | 'empty' | 'too_many_selections';

export interface QuestionTypeRegistry {
  get(type: string): QuestionTypeHandler<unknown, unknown, unknown>;
  has(type: string): boolean;
  register(h: QuestionTypeHandler<any, any, any>): void;
}
```

### 4.2 Warum die Lösung strukturell nicht entweichen kann

`PublicQuestionView` und `RevealView` sind **zwei getrennte Typen** in `protocol`, nicht derselbe Typ mit optionalen Feldern:

```ts
// packages/protocol/src/views.ts
export interface PublicQuestionView {
  readonly seq: number;
  readonly type: string;
  readonly prompt: string;
  readonly mediaUrl: string | null;
  readonly timeLimitMs: number;
  readonly maxPoints: number;
  /** Nur Beschriftungen in Anzeigereihenfolge. Es gibt kein Feld,
   *  in dem Korrektheit stehen könnte. */
  readonly options: readonly { readonly index: number; readonly label: string }[];
  readonly selectionMode: 'single' | 'multiple';
  readonly maxSelections: number | null;
}

export interface RevealView {
  readonly seq: number;
  readonly correctIndices: readonly number[];   // in Anzeigereihenfolge
  readonly distribution: readonly { readonly index: number; readonly count: number }[];
  readonly explanation: string | null;
}
```

Der Server sendet in `PREVIEW` und `OPEN` ausschließlich `PublicQuestionView`. Dass die Lösung nicht mitgeht, ist dadurch keine Disziplinfrage mehr, sondern ein Typfehler. Das ist die eine Stelle, an der ein Nachbau dem Vorbild strukturell überlegen sein kann (Feature-Analyse 8.4, Punkt 6) — und sie kostet nichts.

### 4.3 Die drei MVP-Typen

| Typ | `TSpec` | `TResponse` | `grade` | `maxPointUnits` |
|---|---|---|---|---|
| `single_choice` | `{ options: {label}[]; correctIndex: number; explanation?: string }` | `{ index: number }` | `index === correctIndex` | `1` |
| `true_false` | `{ correct: boolean; explanation?: string }` | `{ value: boolean }` | `value === correct` | `1` |
| `multi_select` | `{ options: {label}[]; correctIndices: number[]; explanation?: string }` | `{ indices: number[] }` | **Mengengleichheit.** Eine falsche Auswahl neben richtigen ⇒ `false`. **Keine Teilpunkte** (Ruling 4). | `correctIndices.length` (Standardnutzung: siehe Offene Entscheidung 1) |

`true_false` ist bewusst ein **eigener Handler** und kein `single_choice` mit zwei festen Optionen: Die Beschriftungen sind nicht editierbar, das Mischen ist sinnlos, und die Oberfläche stellt ihn anders dar. Ein Handler mit zwölf Zeilen ist billiger als drei Sonderfälle im Choice-Handler.

### 4.4 Belohnungsschicht — der Einhängepunkt nach Ruling 5

Die Feature-Analyse (Abschnitt 3.2) ist hier eindeutig: Alle Spielwelten des Vorbilds laufen auf **identischer Fragenlogik** und tauschen nur die Belohnungsdarstellung. Der Einhängepunkt muss deshalb *nach* der Wertung und *vor* der Darstellung liegen — und er darf die Punkte nicht anfassen.

```ts
// packages/core/src/reward/layer.ts

export interface RoundOutcome {
  readonly seq: number;
  readonly perPlayer: readonly {
    readonly playerId: PlayerId;
    readonly correct: boolean;
    readonly late: boolean;
    readonly points: number;        // kanonisch, bereits vergeben
    readonly totalScore: number;
    readonly rank: number;
  }[];
}

export interface RewardLayer<TState = unknown> {
  readonly id: string;

  init(players: readonly PlayerState[], rng: Rng): TState;

  /** Nach jeder Wertung. Liefert neuen Schichtzustand und eine
   *  Darstellungs-Nutzlast, die als zusätzliches Feld in
   *  room:scoreboard mitgeht. */
  onRound(state: TState, outcome: RoundOutcome, rng: Rng):
    { state: TState; view: RewardView };

  /** Darf die ANGEZEIGTE Endreihenfolge überschreiben — z. B. ein
   *  Zufallsfinale. Gibt null zurück, wenn die Punktereihenfolge gilt. */
  finalRanking(state: TState, ranking: readonly RankedPlayer[], rng: Rng):
    readonly RankedPlayer[] | null;
}
```

**Drei Grenzen, die das Interface erzwingt:**

1. `onRound` bekommt `points` als Eingabe, nicht als Rückgabewert. **Eine Schicht kann Punkte nicht verändern.** Punkte sind kanonisch und gehen unverändert in den Bericht.
2. `finalRanking` wirkt ausschließlich auf die Anzeige. `report_player.final_rank` hält immer den Punkterang, `display_rank` das Ergebnis der Schicht. Ein Zufallsfinale macht den Bericht damit nicht unbrauchbar.
3. Die Schicht ist **rein** und liegt in `core`. Sie bekommt die gesäte `Rng` und niemals eine Uhr oder einen Socket.

Im MVP existiert `classic`: `init` gibt `null`, `onRound` gibt `{ state: null, view: { kind: 'classic' } }`, `finalRanking` gibt `null`. Acht Zeilen. Der Punkt ist nicht die Schicht, sondern dass die Naht ab Tag eins existiert und von einem Test abgedeckt ist.

### 4.5 Beispiel: ein neuer Fragetyp dockt an — Schieberegler

Gezeigt am aufwendigsten der später vorgesehenen Typen (Ruling: Type-Answer, Slider, Ordering sollen ohne Umbau aufnehmbar sein).

**Schritt 1 — Spezifikation festlegen.** Nur ein neuer JSON-Inhalt in `spec_json`, **keine Migration**:

```jsonc
{ "min": 0, "max": 1000, "step": 10, "correct": 450,
  "marginMode": "medium", "unit": "km" }
```

**Schritt 2 — Handler schreiben.** Eine neue Datei `core/src/questions/slider.ts`:

```ts
export const sliderHandler: QuestionTypeHandler<SliderSpec, SliderResponse, SliderAgg> = {
  type: 'slider',

  parseSpec(raw) { /* min < max, step > 0, correct in [min,max] */ },

  publicView(spec) {
    return {
      view: { seq: 0, type: 'slider', prompt: '', mediaUrl: null,
              timeLimitMs: 0, maxPoints: 0,
              options: [],                       // keine Kacheln
              selectionMode: 'single', maxSelections: 1,
              // typspezifische Zusatzfelder über ein offenes Feld der Sicht
              extra: { min: spec.min, max: spec.max, step: spec.step, unit: spec.unit } },
      mapping: [],                               // nichts zu mischen
    };
  },

  parseResponse(raw, spec) {
    const v = Number((raw as any)?.value);
    if (!Number.isFinite(v))              return { ok: false, reason: 'malformed' };
    if (v < spec.min || v > spec.max)     return { ok: false, reason: 'out_of_range' };
    return { ok: true, value: { value: v } };
  },

  grade(res, spec) {
    return { correct: Math.abs(res.value - spec.correct) <= marginOf(spec) };
  },

  maxPointUnits() { return 1; },

  emptyAggregate()            { return { buckets: new Map<number, number>() }; },
  accumulate(agg, res)        { /* Werte in Histogramm-Eimer zählen */ },
  revealView(spec, agg)       { /* correct-Wert + Histogramm */ },
};
```

**Schritt 3 — registrieren.** Eine Zeile in `core/src/questions/registry.ts`:

```ts
registry.register(sliderHandler);
```

**Was dafür nicht angefasst wird** — das ist die eigentliche Aussage dieses Abschnitts:

| Bereich | Änderung |
|---|---|
| `core/engine` (Zustandsmaschine) | **keine** |
| `core/scoring` (Punkteformel) | **keine** |
| `core/reward` | **keine** |
| `server/runtime`, `server/transport` | **keine** |
| SQL-Schema, Migrationen | **keine** |
| `protocol` | eine Variante mehr in der `ClientMessage`-Union für die Antwortnutzlast |
| Oberfläche | eine Antwortkomponente, eine Reveal-Komponente |

Einzige Einschränkung, die ehrlich zu nennen ist: Die Punkteformel aus Ruling 4 ist rein zeitbasiert. Ein Typ, der Punkte nach **Präzision** statt nach Richtig/Falsch vergeben soll (das Vorbild gewichtet beim Schieberegler 20 % Zeit / 80 % Präzision), passt nicht in `Verdict{correct:boolean}`. Dafür wäre `Verdict` um ein optionales `accuracy: number ∈ [0,1]` zu erweitern und `scoring/` um einen zweiten, benannten Modus. Das ist eine Erweiterung des Interfaces um ein Feld, kein Umbau — aber es ist nicht gratis, und es gehört vor die Entscheidung, nicht dahinter (Offene Entscheidung 8).

---

## 5. Timing-Spezifikation

Der Abschnitt, an dem sich entscheidet, ob das Spiel fair wirkt. Jede Regel ist als Prüfpunkt formuliert.

### 5.1 Zwei Uhren, strikt getrennt

| Uhr | Quelle | Wofür | Wofür **nicht** |
|---|---|---|---|
| **Monotone Uhr** (`MonoMs`) | `process.hrtime.bigint() / 1e6`, Nullpunkt bei Prozessstart | **Jede** Wertung, jeder Timer, jeder Phasenübergang | Anzeige, Persistenz |
| **Wanduhr** (ISO-8601 UTC) | `Date.now()` | `created_at`, `started_at`, `ended_at` | Wertung, Timer |

Die monotone Uhr springt nicht bei Zeitsynchronisation, Sommerzeit oder manueller Korrektur. Das ist kein akademischer Punkt: Ein NTP-Sprung mitten in einem 30-Sekunden-Fenster würde sonst eine ganze Frage verfälschen.

Für die Clients wird die monotone Uhr als `serverTimeMs = monoNow + SERVER_EPOCH_OFFSET` veröffentlicht, wobei `SERVER_EPOCH_OFFSET` beim Prozessstart einmal fixiert wird. Clients rechnen immer gegen `serverTimeMs`, nie gegen ihre eigene Wanduhr.

### 5.2 Wann der Timer startet und wo gemessen wird

```
Host klickt "Weiter"
   │
   ├─ t₀  core: step(SCOREBOARD, HostAdvanced, at=t₀)
   │       → PREVIEW; answersOpenAt := t₀ + PREVIEW_MS
   │       → effect send(all, room:question_prepared {
   │              publicView,                 ← OHNE Lösung
   │              answersOpenAt:  shared(t₀ + PREVIEW_MS),
   │              answersCloseAt: shared(t₀ + PREVIEW_MS + timeLimitMs) })
   │
   ├─ Zustellung (Einwegzeit, je Client unterschiedlich) ───────────┐
   │                                                                 │
   ├─ t₀+PREVIEW_MS  Timer feuert → core: step(PREVIEW, TimerFired)  │
   │                 → OPEN; openedAt := answersOpenAt (NICHT 'at')  │
   │                 → send(all, room:answers_open)                  │
   │                                                                 ▼
   │                 Clients blenden die Antwortflächen bei
   │                 answersOpenAt auf der gemeinsamen Uhr ein —
   │                 unabhängig vom Eintreffen von room:answers_open
   │
   ├─ Spieler tippt → ClientMessage über WebSocket
   │
   ├─ tₐ  TRANSPORT-ADAPTER stempelt receivedAt := clock.nowMono()
   │       als ERSTE Anweisung im Handler, vor jeder Validierung,
   │       jedem await, jeder Protokollierung.
   │
   └─ core: step(OPEN, AnswerSubmitted{...}, at=tₐ)
            rawElapsed := tₐ − openedAt
```

**Drei Festlegungen daraus:**

1. **Der Nullpunkt ist `answersOpenAt`, nicht der Moment, in dem der Timer tatsächlich feuert.** `setTimeout` kann unter Last 10–50 ms zu spät kommen; würde man `at` nehmen, bekämen alle Spieler diese Verspätung geschenkt und das Fenster würde länger als angegeben. Deshalb: `openedAt := answersOpenAt`.
2. **Die Vorauslieferung ist der Ausgleich der Hinrichtung** (Ansatz A der Stack-Vorlage). Die Zustellzeit der Frage fällt aus der Rechnung heraus, weil alle Clients auf denselben Zeitpunkt der gemeinsamen Uhr einblenden. Was bleibt, ist nur die Rückrichtung.
3. **Der Zeitstempel entsteht im Adapter, nicht in `core` und nicht im Client.** Ein vom Client gelieferter Zeitstempel wird angenommen, protokolliert und **niemals** für Punkte verwendet.

### 5.3 Ausgleich der Rückrichtung

```ts
const COMPENSATION_CAP_MS = 400;

function compensate(rawElapsedMs: number, rtt: RttStats): number {
  const halfRtt = rtt.minMs !== null ? rtt.minMs / 2 : 0;
  return Math.max(0, rawElapsedMs - Math.min(halfRtt, COMPENSATION_CAP_MS));
}
```

**Warum das Minimum und nicht der Median** (Abweichung 0/F): Die Umlaufzeit-Proben enthalten echte Pfadlaufzeit plus Warteschlangen-Jitter. Das Minimum ist die beste verfügbare Schätzung der echten Pfadlaufzeit und zugleich die Statistik, die ein Manipulationsversuch am schlechtesten beeinflussen kann — wer seine Antworten verzögert, hebt den Median, nicht das Minimum. Für den **Anzeige-Offset** der gemeinsamen Uhr bleibt der Median richtig, weil dort ein Ausreißer in beide Richtungen stört.

**Warum der Deckel bei 400 ms:** Ohne Deckel würde eine künstlich verschlechterte Verbindung belohnt. Mit Deckel ist der maximale Vorteil bei 30 s Fenster `400/30000/2 = 0,67 %` des Maximums — bei 1000 Punkten also sieben Punkte. Das ist kleiner als der Rundungsfehler, über den sich am Spieleabend jemand beschweren würde.

**Erhebung der Proben:** Der Server sendet alle 5 s `room:clock_ping{seq, serverTimeMs}`; der Client antwortet unmittelbar mit `player:clock_pong{seq}`. Der Server misst die Umlaufzeit selbst — eine vom Client gelieferte Zahl geht nicht ein. Gehalten werden die letzten acht Proben. Vor der ersten Probe ist `minMs = null` und die Kompensation ist 0; das bevorteilt niemanden, weil die erste Probe beim Verbindungsaufbau erhoben wird, lange vor der ersten Frage.

### 5.4 Die Punkteformel, exakt

```ts
// packages/core/src/scoring/score.ts

export const FULL_POINTS_THRESHOLD_MS = 500;   // Ruling 4
export const MIN_TIME_FACTOR          = 0.5;   // Ruling 4: Deckel bei 50 %
export const POINT_UNIT_VALUE         = 1000;

export interface ScoringInput {
  readonly correct: boolean;
  readonly late: boolean;
  readonly scoringMode: 'timed' | 'flat';
  readonly elapsedMs: number;      // nach compensate(), vor Clamping
  readonly timeLimitMs: number;
  readonly units: number;          // handler.maxPointUnits(spec)
  readonly unitValue: number;      // POINT_UNIT_VALUE, je Typ überschreibbar
  readonly pointsFactor: number;   // 0 | 1 | 2
}

export function maxPointsOf(i: ScoringInput): number {
  return Math.round(i.unitValue * i.units * i.pointsFactor);
}

export function scoreAnswer(i: ScoringInput): number {
  // (1) Falsch ⇒ null. Kein Trostpunkt, keine Teilpunkte.
  if (!i.correct) return 0;

  // (2) Verspätet ⇒ null, obwohl richtig. Die Antwort wird gezählt,
  //     aber sie war außerhalb des Fensters.
  if (i.late) return 0;

  const max = maxPointsOf(i);

  // (3) "Punkte aus" (pointsFactor = 0).
  if (max === 0) return 0;

  // (4) Zeit zählt nicht ⇒ voller Wert.
  if (i.scoringMode === 'flat') return max;

  // (5) Degenerierter Timer ⇒ voller Wert statt Division durch null.
  if (i.timeLimitMs <= 0) return max;

  // (6) Toleranzschwelle gegen Jitter (Ruling 4).
  if (i.elapsedMs < FULL_POINTS_THRESHOLD_MS) return max;

  // (7) Clamping: negative Werte (Überkompensation) und Werte jenseits
  //     des Fensters (Nachzügler innerhalb der Gnadenfrist, die nicht
  //     als 'late' markiert sind) fallen auf die Fensterränder.
  const t = Math.min(Math.max(i.elapsedMs, 0), i.timeLimitMs);

  // (8) Die Formel. factor ∈ [0.5, 1.0] per Konstruktion.
  const factor = 1 - (t / i.timeLimitMs) / 2;

  // (9) Kaufmännische Rundung. Math.round rundet .5 nach oben;
  //     factor * max ist stets positiv, also ist das eindeutig.
  return Math.round(factor * max);
}
```

**Nachgerechnete Randfälle** (Fenster 30 000 ms, `units = 1`, `unitValue = 1000`, `pointsFactor = 1`, also `max = 1000`):

| `elapsedMs` | Zweig | `factor` | Punkte | Anmerkung |
|---|---|---|---|---|
| 0 | (6) | — | **1000** | |
| 499 | (6) | — | **1000** | letzter Wert der Toleranzschwelle |
| 500 | (8) | 0,991667 | **992** | Sprung um 8 Punkte, siehe unten |
| 2 000 | (8) | 0,966667 | **967** | entspricht dem dokumentierten Referenzbeispiel |
| 15 000 | (8) | 0,75 | **750** | halbes Fenster |
| 29 999 | (8) | 0,500017 | **500** | |
| 30 000 | (8) | 0,5 | **500** | Deckel erreicht |
| 31 200 (Gnadenfrist, `late=true`) | (2) | — | **0** | |
| −120 (Überkompensation) | (6) | — | **1000** | `elapsedMs < 500` greift vor dem Clamping |
| beliebig, `correct=false` | (1) | — | **0** | |
| beliebig, `pointsFactor=0` | (3) | — | **0** | Frage erscheint trotzdem im Bericht |
| beliebig, `scoringMode='flat'` | (4) | — | **1000** | |

**Die Unstetigkeit bei 500 ms ist gewollt und wird akzeptiert.** Bei einem 30-s-Fenster beträgt sie 8 Punkte (0,8 %), bei einem 5-s-Fenster 50 Punkte (5 %). Sie ist der Preis der Toleranzschwelle aus Ruling 4. Eine stetige Alternative (Formel ab `t − 500` rechnen) wäre mathematisch schöner, würde aber von der vorgegebenen Formel abweichen — die Formel steht, die Unstetigkeit bleibt dokumentiert.

**Kein Streak-Bonus** (Ruling 3). Es gibt in `ScoringInput` kein Feld dafür, und es gibt keinen Zähler im Zustand, der ihn speisen könnte. Ein reiner **Anzeige**-Zähler für Serien richtiger Antworten wäre später in der Belohnungsschicht unterzubringen, ohne die Punkte zu berühren — er ist im MVP nicht vorgesehen.

### 5.5 Randfälle am Antwortfenster — vollständige Tabelle

| # | Fall | Zustand | Verhalten | Punkte | Bericht | Rückmeldung an den Spieler |
|---|---|---|---|---|---|---|
| 1 | Antwort **vor** `answersOpenAt` | `PREVIEW` | **Abgelehnt**, nicht gebucht. Der Spieler darf erneut antworten. | — | keine Zeile | `player:answer_rejected{not_open}`, Eingabe bleibt offen |
| 2 | Antwort in `LOBBY` oder `SCOREBOARD` | — | Abgelehnt | — | keine Zeile | `player:answer_rejected{wrong_phase}` |
| 3 | Erste Antwort im Fenster | `OPEN` | Gebucht, gewertet | nach Formel | Zeile | `player:answer_ack{accepted, elapsedMs}` — **ohne** Richtig/Falsch |
| 4 | **Zweite** Antwort desselben Spielers | `OPEN` | Verworfen. Die **erste zählt**, immer. | unverändert | unverändert | `player:answer_ack` mit der **ersten** Antwort (idempotent) |
| 5 | Antwort mit falscher `questionSeq` | beliebig | Still verworfen (Nachzügler der Vorfrage) | — | — | `player:answer_ack{stale}` |
| 6 | Antwort nach `answersCloseAt`, innerhalb `LATE_GRACE_MS` | `REVEAL` | Gebucht, **markiert `late`** | **0** | Zeile mit `is_late=1` | `player:answer_ack{late}` — Eingabe wird gesperrt |
| 7 | Antwort nach der Gnadenfrist | `REVEAL`/später | Abgelehnt | — | keine Zeile | `player:answer_rejected{closed}` — Eingabe wird gesperrt |
| 8 | Keine Antwort | — | — | 0 | **keine Zeile** (= nicht geantwortet) | `player:question_result{answered:false}` |
| 9 | Antwort unparsbar / außerhalb des Bereichs | `OPEN` | Abgelehnt, Spieler darf erneut antworten | — | keine Zeile | `player:answer_rejected{malformed\|out_of_range}` |
| 10 | Antwort von einem Spieler, der gerade gekickt wurde | beliebig | Abgelehnt | — | — | `player:removed` |
| 11 | Alle verbundenen Spieler haben geantwortet | `OPEN` | Nach `ALL_ANSWERED_SETTLE_MS` vorzeitige Auflösung | regulär | regulär | regulär |
| 12 | Host löst vorzeitig auf | `OPEN` | Fenster schließt bei `at`; `answersCloseAt := at` | regulär bis `at` | regulär | regulär |

**Zu Fall 1 — warum Ablehnung und nicht Wertung mit `elapsed = 0`:** Eine Wertung mit 0 ms wäre die volle Punktzahl und damit ein Freifahrtschein für jeden, der die Antwort errät oder die Nachricht vorzeitig absetzt. Ablehnung mit offener Eingabe ist zugleich die freundlichste Variante: Ein legitimer Client kann diesen Fall gar nicht erzeugen, weil er seine Flächen erst bei `answersOpenAt` aufblendet.

**Zu Fall 6 — warum die verspätete Antwort überhaupt gebucht wird:** Damit die Oberfläche des Spielers nicht hängen bleibt und damit im Bericht steht, dass die Person geantwortet hat. Die Unterscheidung „zu spät" versus „gar nicht" ist für den Abend wertlos, für den Bericht aber richtig. Sie geht **nicht** in das Verteilungsdiagramm der Auflösung ein — das wird beim Schließen des Fensters berechnet und danach nicht mehr verändert.

**Zu Fall 4 — Idempotenz statt Fehler:** Ein doppelter Tipp, ein Wiederverbindungs-Retry oder ein zweiter Tab erzeugen alle dieselbe Nachricht. Mit der ersten Antwort zu antworten statt mit einem Fehler bringt jeden dieser Clients ohne Sonderbehandlung in denselben Zustand.

### 5.6 Timer sind Hinweise, die Uhr ist die Wahrheit

`setTimeout` ist nicht verlässlich: Ein schlafender Rechner, eine blockierte Ereignisschleife oder ein Lastspitze verschieben es. Deshalb gilt in `core`:

> **Jede Eingabe prüft als Erstes, ob die aktuelle Phase nach `at` bereits hätte enden müssen, und führt den Ablauf-Übergang vor der eigentlichen Verarbeitung aus.**

```ts
function step(state, input, deps) {
  const settled = settleDeadlines(state, input.at, deps);   // lazy close
  return applyEvent(settled.state, input, deps, settled.effects);
}
```

Fällt der Timer zehn Sekunden zu spät, ist die Frage trotzdem exakt bei `answersCloseAt` geschlossen — die erste danach eintreffende Nachricht löst den Übergang aus, und ihre eigene Behandlung sieht bereits den Zustand `REVEAL`.

**Veraltete Timer** werden über `timerGen` erkannt: Jeder Zustandswechsel erhöht den Generationszähler; ein `TimerFired` mit niedrigerer Generation wird verworfen. Damit kann ein Timer, der kurz nach einem vorzeitigen Auflösen noch feuert, die Folgephase nicht abschneiden.

### 5.7 Doppelte Host-Befehle

Jeder Host-Befehl trägt `expectedPhase` und, wo sinnvoll, `questionSeq`. Passt beides nicht zum aktuellen Zustand, wird der Befehl verworfen. Das löst drei Fälle mit einer Regel: den Doppelklick, den zweiten Host-Tab am Laptop und den Wiederholungsversuch nach einer Wiederverbindung.

---

## 6. Reconnect- und Ausfallverhalten

### 6.1 Identität ohne Konten

| Rolle | Token | Ablage | Lebensdauer |
|---|---|---|---|
| Spieler | `resumeToken`, 16 Zufallsbytes base64url | `sessionStorage` des Browsers | Lebensdauer des Raums |
| Host | `hostToken`, 16 Zufallsbytes base64url | **im Beitrittslink**: `/host/<roomCode>#<hostToken>` | Lebensdauer des Raums |

Beide Token sind **opak und serverseitig gehalten** (Abweichung 0/C). Der Vergleich erfolgt in konstanter Zeit. Der Host-Token steht im Fragment-Teil der URL und geht damit nicht als Referrer an Dritte und nicht in Server-Protokolle — das ist die einzige Härtung, die hier Sinn ergibt.

Ruling 1 erlaubt ausdrücklich „simples Host-Token im Link". Mehr ist nicht vorgesehen: kein Konto, kein Passwort, kein OAuth. Wer den Link hat, ist der Host.

### 6.2 Spieler trennt die Verbindung

| Zeitpunkt | Verhalten |
|---|---|
| in `LOBBY` | Spieler wird **entfernt**, Name wird wieder frei. Vor dem Start gibt es nichts zu bewahren. |
| ab `PREVIEW` | `connected := false`, sonst **nichts**. Punktestand, Platz und Name bleiben erhalten. **Keine Austragung** (Abweichung 0/D). |
| während `OPEN` | Die Frage läuft weiter. Keine Antwort ⇒ Fall 8 aus Tabelle 5.5. Die Bedingung „alle haben geantwortet" zählt nur **verbundene** Spieler — sonst würde ein Spieler in der Küche jedes Fenster bis zum Ende aufhalten. |

**Wiederverbindung:** Der Client sendet `player:resume{roomCode, resumeToken}`. Der Server setzt `connected := true` und sendet einen **vollständigen Zustandsabzug** — nicht die verpassten Ereignisse:

```ts
interface PlayerSnapshot {
  phase: Phase;
  you: { playerId; displayName; score; rank; answeredThisQuestion: boolean };
  serverTimeMs: number;                  // für den Uhrenabgleich
  question?: PublicQuestionView;         // nur in PREVIEW und OPEN
  answersOpenAt?: number;
  answersCloseAt?: number;
  yourAnswer?: { response: unknown; accepted: boolean; late: boolean };
  reveal?: RevealView;                   // nur in REVEAL
  scoreboard?: ScoreboardView;           // nur in SCOREBOARD/PODIUM
}
```

Kein Nachspielen von Ereignissen. Der Client verwirft seinen lokalen Zustand und rendert den Abzug. Das ist der einzige Weg, der ohne Ereignis-Nummerierung, Puffer und Lückenerkennung auskommt — und er kostet bei einem Quiz nichts.

**Was nicht überlebt:** Ein Spieler, der `sessionStorage` leert, das Gerät wechselt oder den privaten Modus verlässt, hat kein Token mehr. Er kann seinen alten Namen nicht wiederverwenden (dieser bleibt im Raum belegt) und tritt als neuer Teilnehmer mit null Punkten bei. **Akzeptiert** unter Ruling 1. Der Ausweg, falls es im Betrieb stört, ist eine Host-Aktion „Namen neu zuordnen" — siehe Offene Entscheidung 4.

### 6.3 Host trennt die Verbindung

| Aspekt | Verhalten |
|---|---|
| Spielzustand | lebt im Serverprozess, **nicht** im Beamer-Browser. Das Spiel läuft weiter. |
| Laufende Timer | laufen weiter. Ein offenes Antwortfenster schließt pünktlich, die Auflösung wird berechnet. |
| Host-gesteuerte Übergänge (16, 17, 18) | **warten.** Ohne Host bleibt das Spiel in `REVEAL` oder `SCOREBOARD` stehen. |
| Wiederverbindung | derselbe Link, derselbe `hostToken`, voller Zustandsabzug. Der Host landet exakt dort, wo das Spiel steht. |
| Mehrere Host-Verbindungen | erlaubt. Alle erhalten Rundrufe, alle dürfen Befehle senden; `expectedPhase` verhindert Doppelschaltungen (5.7). |
| Host kommt nie zurück | `ROOM_IDLE_TTL_MS` greift, Übergang 22, Bericht mit `end_reason='timed_out'`. |

Ein automatisches Weiterschalten ohne Host ist **nicht** vorgesehen. Am Spieleabend ist „das Spiel wartet" das richtige Verhalten — der Host holt sich etwas zu trinken, und niemand verliert eine Frage. Siehe Offene Entscheidung 5.

### 6.4 Server startet neu

| Was | Schicksal |
|---|---|
| Quizze und Fragen | **überleben** (SQLite-Datei) |
| Bereits abgeschlossene Fragen des laufenden Spiels | **überleben** — `persistRound` lief bei jedem `REVEAL → SCOREBOARD` |
| Kopfdaten des laufenden Spiels | überleben mit `ended_at_utc = NULL`; ein Sweeper beim Start setzt `end_reason = 'server_lost'` |
| Laufender Raum, Join-Code, Spielerliste, laufende Frage | **verloren** |
| Verbindungen | brechen ab; Clients erhalten beim Wiederverbinden `room:not_found` und eine klare Meldung |

**Akzeptiert unter Ruling 1.** Die realistische Ursache ist ein Deployment oder ein Absturz; beides passiert an einem Spieleabend praktisch nicht, und wenn, ist die Runde ohnehin unterbrochen. Der Nutzen eines Wiederanlaufs — ein halb fertiges Spiel fortsetzen — steht in keinem Verhältnis zu seinem Preis.

**Der Preis, falls es doch gewünscht wird**, ehrlich beziffert (Offene Entscheidung 6): Der Zustand selbst ist billig — eine JSON-Datei je Raum, bei jedem Phasenwechsel geschrieben, wenige Kilobyte. Teuer ist das Wiederanlaufen: Alle Timer müssen aus `MonoMs`-Werten neu berechnet werden, die nach einem Neustart keinen Bezugspunkt mehr haben (also müssten Fristen zusätzlich als Wanduhrzeit abgelegt werden); alle Sockets müssen sich neu authentifizieren; eine Frage, die beim Absturz offen war, lässt sich nicht fair fortsetzen und müsste wiederholt oder verworfen werden. Das sind drei neue Fehlerpfade für einen Fall, der unter Ruling 1 selten ist.

### 6.5 Was an Missbrauchsabwehr bleibt

Unter Ruling 1 entfallen Captcha, Schimpfwortfilter, 2-Schritt-Beitritt und IP-Drosselung (Abweichung 0/G). Es bleibt, was ohnehin Teil der Korrektheit ist:

1. **Join-Code**: sechs Zeichen aus Crockford-Base32 ohne `I L O U 0 1`. Nicht als Schutz, sondern damit sich niemand vertippt.
2. **Ein In-Memory-Zähler** verwirft nach 30 Fehlversuchen je Verbindung weitere Beitrittsversuche. Zehn Zeilen, kein Redis, kein Zustand über Prozessgrenzen.
3. **Namensprüfung serverseitig**: 1–20 Zeichen, Unicode-Buchstaben/Ziffern/Leerzeichen/`-_.`, Normalisierung (NFKC, Mehrfach-Leerzeichen zusammen, Trim), Eindeutigkeit über den normalisierten Namen.
4. **Alle Punkte entstehen im Server.** Vom Client kommt nur „welche Fläche", nie „wie schnell" und nie „wie viele Punkte".
5. **Die Lösung verlässt den Server erst mit `RevealView`** — typerzwungen, siehe 4.2.
6. **Host-Kick auch während des Spiels** (das Vorbild kann das nicht). Übergang 3 ist in jeder Phase erlaubt.
7. **Raumsperre** nach dem Start.

### 6.6 Teilnehmerzahl: kein Produktlimit, eine technische Grenze

Das Vorbild deckelt die Teilnehmerzahl nach Tarif. Das soll es hier nicht geben: **Es gibt keine konfigurierte Zahl, die Spieler aus Geschäftsgründen aussperrt.** Eine technische Grenze gibt es trotzdem, und sie gehört benannt statt verschwiegen. Dieser Abschnitt rechnet sie her. Optimiert wird auf den Normalfall **~20 Spieler**.

**Speicher je Spieler im Raumzustand.** `PlayerState` (3.4) hält zwei kurze Zeichenketten (`id`, `resumeToken`, je ~22 Zeichen ≈ 40 B), den Anzeigenamen (≤ 20 Zeichen ≈ 56 B), sechs Zahlen-/Bool-Felder in einer Objekthülle (~120 B) und `RttStats` mit acht Proben (~130 B plus 48 B Hülle) — zusammen **≈ 0,45 kB**. Dazu je Spieler ein Eintrag in `players` (~48 B), einer in `nameIndex` (~90 B), im Antwortfenster ein `AnswerRecord` samt Map-Eintrag (~176 B), in `SCOREBOARD`/`PODIUM` ein bis zwei `RankedPlayer` (~160 B) und ein Eintrag in `RoomHandle.sockets` (~152 B). Macht **≈ 1 kB reinen Spielzustand je Spieler**.

Der Spielzustand ist damit irrelevant. Was tatsächlich Speicher kostet, ist die Verbindung: Eine WebSocket-Verbindung unter `ws` samt Socket.IO-Buchhaltung liegt bei **~50 kB RSS**, sofern `perMessageDeflate` **ausgeschaltet** bleibt — eingeschaltet reserviert zlib je Verbindung sechsstellige Byte-Beträge und verzehnfacht die Zahl. Das ergibt:

| Spieler | Spielzustand | Verbindungen | Summe |
|---|---|---|---|
| 20 | 20 kB | ~1 MB | **~1 MB** |
| 100 | 100 kB | ~5 MB | ~5 MB |
| 1 000 | 1 MB | ~50 MB | ~50 MB |
| 10 000 | 10 MB | ~500 MB | ~500 MB |

Speicher klemmt also nie zuerst. Vorher greifen Dateideskriptor-Limits des Betriebssystems.

**Nachrichten-Fan-out je Frage.** Je Spieler und Frage gehen heraus: `room:question_prepared` mit `PublicQuestionView` (200 Zeichen Fragetext + 4 × 100 Zeichen Optionen + Kopffelder ≈ **0,8 kB**), `room:answers_open` (~0,1 kB), `room:reveal` (~0,4 kB) und `player:question_result` (~0,15 kB) — zusammen **≈ 1,45 kB je Spieler und Frage**. Das ist linear: 29 kB bei 20 Spielern, 1,45 MB bei 1 000. Über ein 20-Sekunden-Fenster verteilt sind das selbst bei 1 000 Spielern unter 150 kB/s.

Ein quadratischer Term entstünde nur, wenn jeder Spieler die vollständige Rangliste bekäme (N Einträge × ~60 B an N Spieler = N² × 60 B; bei 500 Spielern 15 MB je Zwischenstand). **Dieser Term existiert hier nicht**, und zwar nicht durch eine Optimierung, sondern durch den Entwurf: Das Spielergerät bekommt ausschließlich den eigenen Rang und den Abstand, die Bühne eine Top-N-Liste plus Zähler. Beides ist O(1) je Empfänger. Die in der Vorarbeit erwogene serverseitige Aggregation gegen Fan-out **wird dadurch nicht gebraucht** — weder bei 20 noch bei 1 000 Spielern.

Der einzige wirklich N-proportionale Strom ist `room:answer_count`: eine Nachricht an den Host je eingehender Antwort. Bei 20 Spielern sind das 20 Nachrichten in 20 Sekunden. Erst im vierstelligen Bereich lohnt eine Zusammenfassung — höchstens ein Zähler je 100 ms, drei Zeilen im Adapter, heute nicht nötig.

**Die Fairness-Grenze — der Wert, der tatsächlich bindet.** Die gesamte Wertung hängt daran, dass der Zeitstempel als erste Anweisung im Adapter entsteht (5.2). Blockiert die Ereignisschleife, wenn eine Antwort eintrifft, geht diese Blockade unmittelbar in die Punkte. Die Bearbeitung einer Antwort (JSON-Parse, `step()`, zwei kleine Emits) liegt konservativ bei **50 µs**. Tippen alle Spieler im selben Moment, wird die letzte Antwort um `(N−1) × 50 µs` verzögert:

| Spieler | Worst-Case-Versatz | Anteil an 30-s-Fenster | Punkte von 1 000 |
|---|---|---|---|
| 20 | **1,0 ms** | 0,003 % | < 1 |
| 100 | 5 ms | 0,017 % | < 1 |
| 1 000 | 50 ms | 0,17 % | ~2 |
| 5 000 | **250 ms** | 0,83 % | ~8 |

Die Toleranzschwelle der Formel liegt bei `FULL_POINTS_THRESHOLD_MS = 500` (5.4). **Ab etwa 5 000 Spielern nähert sich der Worst-Case-Versatz dieser Schwelle, und damit hört eine Zusage dieses Konzepts auf, wahr zu sein.** Das ist die Zahl, ab der es wirklich klemmt — nicht 50, nicht 60.

**SQLite-Schreiblast je Spiel.** `persistRound` schreibt N Zeilen in einer Transaktion, synchron, also mit blockierter Ereignisschleife. Bei konservativ 50 µs je Zeile: 20 Spieler = **1 ms**, 500 = 25 ms, 2 000 = 100 ms, 10 000 = 500 ms. Der Ruckler fällt per Entwurf in den Phasenwechsel `REVEAL → SCOREBOARD`, in dem keine Zeit gemessen wird (3.0, Regel 1 und 2). Er kostet also Geschmeidigkeit, nicht Fairness — und bleibt bis in den vierstelligen Bereich unsichtbar.

**Lobby-Darstellung.** Hier liegt die niedrigste Zahl, und sie kommt nicht aus dem Server. Die Lesbarkeitsregel des UX-Konzepts verlangt mindestens 36 px für alles Spielrelevante. Auf 1 920 px abzüglich 2 × 48 px Rand bleiben 1 824 px; ein 16-Zeichen-Name braucht bei 36 px rund 317 px plus Innenabstand, also ~340 px je Kachel — **fünf Kacheln je Zeile**. Der Namensbereich der Lobby trägt bei 80 px Zeilenhöhe etwa fünf Zeilen. **Rund 25 Namen passen in lesbarer Größe auf die Bühne.** Darüber hinaus bleibt nur: verkleinern (verletzt die Regel), scrollen (aus 3 m unlesbar) oder ehrlich zählen. Gewählt ist das Zählen; `PLAYER_SOFT_WARN = 25` macht es dem Host sichtbar, ohne irgendwen abzuweisen.

**Und die Wand, die in einem echten Raum zuerst kommt**, ist keine der obigen: Ein Consumer-Access-Point verwaltet typischerweise 32–64 assoziierte Geräte, und die Beitrittsseite wird von allen gleichzeitig geladen (bei 65 kB und 20 Geräten rund 1,3 MB, bei 500 Geräten 32,5 MB). Das ist Umgebung, nicht Anwendung — gehört aber genannt, weil der Nutzer sie als Erstes trifft.

**Verhalten beim Überschreiten — gestuft, nie abweisend:**

| Ab etwa | Was passiert | Wer merkt es |
|---|---|---|
| 25 | Die Bühne zeigt nicht mehr alle Namen, sondern Namen plus „und N weitere". Beitritt unverändert offen. | Host, kosmetisch |
| 64 | Der WLAN-Access-Point des Raums wird zur Bremse, nicht der Server. | Spieler beim Beitritt |
| 500 | `persistRound` ruckelt um ~25 ms am Phasenwechsel; der Beitritts-Ansturm belastet das gemeinsame Netz spürbar. | niemand während der Wertung |
| 1 000 | ~1,5 MB Fan-out je Frage, ~50 MB Verbindungsspeicher, ~2 Punkte Worst-Case-Versatz. Alles korrekt, nur kein Wohnzimmerspiel mehr. | niemand |
| 5 000 | **`PLAYER_HARD_CAP`.** Der Worst-Case-Versatz nähert sich der 500-ms-Toleranzschwelle; die Fairness-Zusage aus 5.4 erodiert. Weitere Beitritte werden mit `capacity` abgelehnt — als Kapazitätsaussage, nicht als Tarifgrenze. | Nachzügler, mit ehrlichem Grund |
| darüber | Ein Prozess trägt es nicht mehr: Dateideskriptoren, 500 ms `persistRound`-Blockade, der Host-Antwortzähler. Dann greifen mehrere Prozesse plus ein gemeinsamer Raumzustand — der Einhängepunkt, den 0/B ausdrücklich offenhält. | alle |

Der Wert von `PLAYER_HARD_CAP` ist eine Entscheidung des Nutzers, keine technische Notwendigkeit; 5 000 ist die hergeleitete Stelle des ersten gebrochenen Versprechens. *Bestätigung erbeten.*

---

## 7. Projektstruktur

```
quizrunde/
├─ package.json                 Workspaces-Wurzel; nur Skripte und Dev-Werkzeuge.
├─ tsconfig.base.json           Gemeinsame strenge Compiler-Optionen, Pfad-Aliase.
├─ packages/
│  ├─ protocol/
│  │  └─ src/
│  │     ├─ messages.ts         ClientMessage- und ServerMessage-Unions; der Vertrag
│  │     │                      zwischen Server und jedem Frontend.
│  │     ├─ views.ts            PublicQuestionView, RevealView, ScoreboardView,
│  │     │                      Snapshots — getrennte Typen, damit die Lösung
│  │     │                      nicht versehentlich mitreisen kann.
│  │     └─ ids.ts              Gebrandete Primitivtypen (RoomCode, PlayerId, MonoMs).
│  ├─ core/                     Keine Laufzeit-Abhängigkeit außer protocol.
│  │  └─ src/
│  │     ├─ engine/
│  │     │  ├─ state.ts         Die sieben Zustände als diskriminierte Union.
│  │     │  ├─ events.ts        GameEvent-Union: alles, was dem Spiel zustoßen kann.
│  │     │  ├─ effects.ts       Effect-Union: alles, was das Spiel bewirken will.
│  │     │  ├─ step.ts          Die eine Funktion. Deadline-Abgleich plus Dispatch.
│  │     │  └─ phases/          Je Phase eine Datei mit ihren Übergängen.
│  │     ├─ scoring/
│  │     │  ├─ score.ts         Die Formel aus Abschnitt 5.4, sonst nichts.
│  │     │  └─ constants.ts     Schwellen und Deckel als benannte Konstanten.
│  │     ├─ questions/
│  │     │  ├─ handler.ts       Das Interface aus 4.1.
│  │     │  ├─ registry.ts      Typ-Kennung → Handler; der einzige Ort, an dem
│  │     │  │                   ein neuer Fragetyp eingetragen wird.
│  │     │  ├─ singleChoice.ts  MVP.
│  │     │  ├─ multiSelect.ts   MVP, ohne Teilpunkte.
│  │     │  └─ trueFalse.ts     MVP, eigener Handler statt Sonderfall.
│  │     ├─ reward/
│  │     │  ├─ layer.ts         Das Interface aus 4.4.
│  │     │  ├─ classic.ts       Identitätsschicht; hält die Naht offen.
│  │     │  └─ registry.ts      Kennung → Schicht.
│  │     ├─ ranking.ts          Punkte → Rangliste, gleiche Punkte ⇒ gleicher Rang.
│  │     └─ rng.ts              Gesäter Zufall; macht Mischen reproduzierbar.
│  └─ server/
│     └─ src/
│        ├─ main.ts             Zusammenbau: DB öffnen, Registry füllen, HTTP und
│        │                      Socket starten, Sweeper für verwaiste Berichte.
│        ├─ runtime/
│        │  ├─ roomRegistry.ts  Räume im Prozessspeicher, Sperrzeit nach Spielende.
│        │  ├─ roomHandle.ts    Hält GameState, serialisiert Eingaben, führt Effekte aus.
│        │  ├─ scheduler.ts     TimerToken ⇄ setTimeout, Generationszähler.
│        │  ├─ clock.ts         Monotone Uhr und der fixierte Epochen-Offset.
│        │  ├─ codes.ts         Join-Code-Alphabet, Ziehen, Kollisionsprüfung.
│        │  └─ tokens.ts        Opake Zufallstoken, Vergleich in konstanter Zeit.
│        ├─ transport/
│        │  └─ socketio/
│        │     ├─ gateway.ts    Verbindungsaufbau, Raumbeitritt, Abbau.
│        │     ├─ inbound.ts    ClientMessage → GameEvent; stempelt receivedAt zuerst.
│        │     ├─ outbound.ts   Effect{send} → emit; bildet Audience auf Räume ab.
│        │     └─ clockSync.ts  Ping/Pong, RTT-Statistik je Verbindung.
│        ├─ http/
│        │  ├─ app.ts           Express/Fastify-Zusammenbau, Auslieferung der Apps.
│        │  ├─ quizRoutes.ts    Quiz-CRUD; validiert spec_json über die Registry.
│        │  ├─ roomRoutes.ts    Raum anlegen aus einem Quiz; gibt Host-Link zurück.
│        │  └─ reportRoutes.ts  Berichtsliste, ein Bericht, Export.
│        └─ persistence/
│           ├─ db.ts            SQLite öffnen, PRAGMAs, Migrationen anwenden.
│           ├─ migrations/      Nummerierte .sql-Dateien, nur vorwärts.
│           ├─ schema.sql       Das DDL aus Abschnitt 3.2 als Ausgangszustand.
│           ├─ quizRepo.ts      QuizRepository-Implementierung.
│           └─ reportRepo.ts    ReportRepository; persistRound und persistFinal.
├─ apps/
│  ├─ host-web/                 Beameransicht. NICHT Gegenstand dieses Konzepts.
│  └─ player-web/               Handyansicht. NICHT Gegenstand dieses Konzepts.
└─ test/
   ├─ core/
   │  ├─ purity.test.ts         Verbietet Uhr, Zufall und I/O in core (1.4).
   │  ├─ scoring.test.ts        Die Tabelle aus 5.4, Zeile für Zeile.
   │  ├─ transitions.test.ts    Die Übergangstabelle aus 2.2, Zeile für Zeile.
   │  └─ timing.test.ts         Die Randfalltabelle aus 5.5, Zeile für Zeile.
   └─ server/
      ├─ reconnect.test.ts      Abzüge nach Trennung in jeder Phase.
      └─ persistence.test.ts    persistRound/persistFinal gegen eine Datei im Speicher.
```

Drei der vier `core`-Testdateien sind direkte Übersetzungen von Tabellen aus diesem Dokument. Das ist Absicht: Eine Spezifikation, die sich nicht in eine Testtabelle übersetzen lässt, ist noch nicht präzise genug.

---

## 8. Ausbaupfad Discord Activity

Nur als Abriss, wie beauftragt. Die belegten Rahmenbedingungen stehen in `plattform-stack-entscheidung.md`, Abschnitt 1b — insbesondere: WebSocket wird unterstützt, der gesamte Verkehr läuft über den Discord-Proxy, und der OAuth-Code-Tausch muss serverseitig erfolgen.

**Was hinzukommt:**

| Pfad | Inhalt |
|---|---|
| `apps/activity-web/` | Dritte Oberfläche. Lädt das Embedded App SDK, ruft `ready()` und den Autorisierungsfluss auf, rendert danach dieselben Komponenten wie `player-web`. |
| `packages/server/src/http/discordOAuth.ts` | Code-gegen-Token-Tausch mit dem Client Secret. Serverseitig, weil es nicht anders geht. |
| `packages/server/src/transport/socketio/discordAuth.ts` | Prüft das Discord-Zugriffstoken beim Verbindungsaufbau und erzeugt daraus eine `PlayerIdentity` mit `origin: 'discord'`. |
| `packages/server/src/runtime/instanceBinding.ts` | Bildet Discords `instanceId` auf einen `RoomCode` ab, damit innerhalb eines Channels kein Code eingetippt werden muss. |
| Betrieb | URL-Mappings im Developer Portal, feste Ausgangs-IP, eigene Cache-Busting-Strategie. Keine Codeänderung, aber Kalenderzeit. |

**Was unberührt bleibt** — und das ist der ganze Zweck von Ruling 2:

`packages/core/` vollständig. `packages/protocol/` vollständig (`PlayerOrigin` ist ab Tag eins im Modell). `packages/server/src/runtime/` bis auf die eine neue Datei. `packages/server/src/persistence/` und das gesamte SQL-Schema. `apps/host-web/` — die Beameransicht bleibt eine normale Webseite.

Der Discord-Bot aus Variante 1c wäre ein weiterer Adapter unter `transport/discord-bot/`. Die Vorarbeit rät von ihm ab, weil der Zeitstempel eines Button-Klicks Discords Zustellzeit mitmisst und damit für ein Schnelligkeitsspiel keine faire Grundlage ist. Diese Bewertung bleibt unverändert gültig.

---

## 9. Offene Entscheidungen

Entscheidungen, die dem Nutzer gehören. Jede mit Empfehlung, damit sie beantwortbar ist statt nur gestellt.

1. **Maximalpunkte bei Multi-Select.** Flach 1 000 wie bei Single-Choice, oder 500 je richtiger Option (bei vier richtigen also 2 000)? Das Interface trägt beides über `maxPointUnits`. *Empfehlung: flach 1 000.* Eine Frage mit vier richtigen Optionen ist nicht doppelt so viel wert wie eine mit zwei — und eine einheitliche Obergrenze macht den Zwischenstand lesbar.

2. **Dauer und Inhalt der Vorschau.** `PREVIEW_MS = 3 000` ist gesetzt; offen ist, ob während der Vorschau nur der Fragetext oder bereits die Antwortflächen (gesperrt) sichtbar sind. *Empfehlung: Fragetext allein.* Wer die Flächen vorher sieht, liest statt zuzuhören.

3. **Automatisches Weiterschalten.** Auflösung und Zwischenstand jeweils nach N Sekunden automatisch weiter, oder ausschließlich auf Host-Klick? *Empfehlung: Host-Klick im MVP*, mit einem Schalter im `RoomConfig`, der später einen Timer-Effekt freischaltet. Übergänge 16–18 sind dafür vorbereitet.

4. **Spieler ohne Token.** Was passiert, wenn jemand den Browser-Speicher leert oder das Gerät wechselt? Heute: neuer Teilnehmer bei null, alter Name bleibt belegt. Alternative: eine Host-Aktion „Namen neu zuordnen", die einen verwaisten Platz an eine neue Verbindung bindet. *Empfehlung: im MVP so lassen*, nachrüsten, wenn es tatsächlich stört — der Aufwand sind etwa zwanzig Zeilen plus eine Oberflächenaktion.

5. **Host dauerhaft weg.** Heute wartet das Spiel unbegrenzt, bis `ROOM_IDLE_TTL_MS` greift. Alternative: nach N Minuten ohne Host automatisch weiterschalten oder zum Podium springen. *Empfehlung: warten.*

6. **Raum-Abzug auf Platte für Absturzsicherheit.** Heute bewusst nicht. Der Preis ist in 6.4 beziffert: drei neue Fehlerpfade. *Empfehlung: nicht bauen.*

7. **Bilder in Fragen.** `media_url` steht im Schema, aber Upload, Ablage, Größenbegrenzung und Auslieferung sind nicht spezifiziert. Die Feature-Analyse führt „Bild je Frage" als MUST. *Empfehlung: im MVP nur externe URLs*, Upload als erste Erweiterung — das vermeidet Dateiablage, Aufräumen und Größenprüfung im ersten Durchstich.

8. **Fragetypen mit Präzisionswertung.** Sollen Schieberegler und Ähnliches später Punkte nach Genauigkeit statt nach Richtig/Falsch vergeben? Dann ist `Verdict` um `accuracy: number` und `scoring/` um einen zweiten Modus zu erweitern (4.5). *Empfehlung: jetzt entscheiden, später bauen* — die Entscheidung kostet nichts, die nachträgliche Interface-Änderung schon.

9. **Textlängen.** Vorgeschlagen sind 200 Zeichen Fragetext und 100 Zeichen je Antwort — großzügiger als beim Vorbild (120 / 75), weil kein Grund besteht, dessen Enge zu übernehmen. Die Oberfläche muss damit umgehen können; das betrifft den zweiten Agenten. *Bestätigung erbeten.*

10. **Zwischenstand abschaltbar.** Die Feature-Analyse nennt das als echte Differenzierungschance gegenüber dem Vorbild (Abschnitt 1.6). Ein Schalter in `RoomConfig`, der Übergang 16 direkt nach `PREVIEW` führt. Billig, aber eine Produktentscheidung. *Empfehlung: Schalter vorsehen, Standard „an".*

11. **Fragen mischen.** `quiz.shuffle_questions` steht im Schema, Standard ist aus. Antworten mischen (`shuffle_options`) ist an, weil es Abschreiben erschwert. *Bestätigung erbeten.*

12. **Arbeitstitel und Paketname.** `quizrunde` ist ein Platzhalter. Der Name wandert in Paketnamen, Verzeichnis, Domain und Oberflächentexte; ein später Wechsel ist lästig. *Entscheidung erbeten, bevor der erste Commit liegt.*

---

## 10. Abweichungen vom Auftrag

Vollständig, wie verlangt.

1. **Ein achter Zustand wurde geprüft und verworfen.** Der Auftrag nennt sieben Zustände. Für Nachzügler-Antworten wäre ein `CLOSING` zwischen `OPEN` und `REVEAL` denkbar gewesen; er hätte dieselbe Regel nur an zweiter Stelle wiederholt. Die Gnadenfrist liegt deshalb in `REVEAL` (Übergänge 14/15).

2. **Die Persistenz schreibt je Frage, nicht nur am Spielende.** Der Auftrag nennt als persistente Daten „abgeschlossene Spielberichte". Das Konzept schreibt bereits bei jedem `REVEAL → SCOREBOARD` und markiert unvollständige Berichte über `ended_at_utc IS NULL`. Grund: wenige Millisekunden außerhalb jeder Zeitmessung gegen den Verlust eines ganzen Abends. Die Trennlinie bleibt dadurch unberührt — geschrieben wird, was abgeschlossen ist.

3. **Die Uhr wird nicht als Interface injiziert, sondern als Feldwert jeder Eingabe.** Ruling 2 verlangt eine injizierte Uhr. `at: MonoMs` an jeder Eingabe erfüllt das strenger: `step` wird dadurch eine reine Funktion, und jeder Testfall ist eine Tabellenzeile statt eines konfigurierten Doubles.

4. **`PublicQuestionView` und `RevealView` sind zwei Typen, nicht einer.** Nicht ausdrücklich beauftragt, aber die einzige Möglichkeit, Ruling-konform zu garantieren, dass die Lösung den Server nicht zu früh verlässt — ohne sich auf Disziplin zu verlassen.

5. **Abweichung von der Stack-Vorlage bei der Latenzstatistik** (Minimum statt Median für die Wertung, 0/F). Die Vorlage nennt den Median; für die Wertungs-Kompensation ist er die falsche Statistik.

6. **Vier Eigenschaften, die die Feature-Analyse als MUST führt, sind hier nicht ausgearbeitet:** Lobby-Musik und Klangeffekte (keine Datenmodell- oder Engine-Wirkung), Vollbild (Oberfläche), Farbe-**und**-Form auf den Antwortflächen (Oberfläche, und ohnehin Ruling 6) sowie der Quiz-Editor als Bedienoberfläche. Alle vier liegen beim zweiten Agenten; dieses Konzept liefert ihnen mit `protocol` und dem SQL-Schema die Grundlage.
