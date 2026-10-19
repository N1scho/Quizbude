# Multiplayer-Quiz: Plattform- und Stack-Entscheidung

**Stand:** 2026-10-19 · **Entscheidungsvorlage, kein Code** · Quellenstand Discord-Doku: am 2026-10-19 live von `docs.discord.com` geprüft.

---

## Kurzfassung für die Entscheidung

Bauen Sie den MVP als **reine Web-App** — Host-Ansicht im Browser am Beamer, Spieler per Handy-Browser, Beitritt über einen sechsstelligen Code. Das ist der Weg, den Kahoot geht, und er ist aus drei Gründen der richtige Startpunkt: Er erreicht jeden Menschen mit einem Browser ohne Installation und ohne Konto, er gibt Ihnen die volle Kontrolle über Zeitmessung und Darstellung, und er hat keinen Plattformbetreiber zwischen Ihnen und Ihren Nutzern.

Discord Activity und Discord Bot sind **keine Alternativen zum MVP, sondern spätere Zusatz-Frontends**. Beide können auf denselben Spielserver aufsetzen — vorausgesetzt, Sie halten die Spiellogik von Anfang an transportunabhängig. Das kostet im MVP etwa einen halben Tag Mehraufwand und spart später Wochen.

Der Stack ist bewusst unaufregend: Node.js mit TypeScript, Socket.IO, React, Spielzustand im Arbeitsspeicher, PostgreSQL für Quizze und Auswertungen. Alles davon läuft im Start nahezu kostenlos.

---

## 1. Die drei Auslieferungswege im Vergleich

### 1a) Reine Web-App — der Kahoot-Weg

Der Host öffnet eine Seite am Beamer, die einen Raumcode anzeigt. Die Spieler öffnen eine zweite Seite am Handy, tippen den Code ein und wählen einen Namen. Danach erscheinen die Fragen am Beamer, die Antwortflächen am Handy.

| Kriterium | Bewertung |
|---|---|
| **Aufwand** | Am geringsten. Kein Plattform-SDK, keine Portal-Konfiguration, keine Freigabe. Sie bauen genau zwei Oberflächen und einen Server. |
| **Reichweite** | Jeder mit einem Browser. Keine Installation, kein Konto, kein Discord. Dafür kein eingebauter Verteilkanal — Reichweite müssen Sie selbst erzeugen. |
| **Einschränkungen** | Sie sind für Hosting, Verfügbarkeit und Missbrauchsabwehr selbst verantwortlich. Niemand entdeckt Sie zufällig. |
| **Timing/Latenz** | Bestmöglich. Direkte WebSocket-Verbindung vom Client zu Ihrem Server, kein Zwischen-Hop. Sie bestimmen, wann die Frage erscheint und wann die Uhr läuft. |
| **Betriebskosten** | Praktisch null im Start: statisches Frontend-Hosting kostenlos, ein kleiner Server ab etwa 4 EUR/Monat, Datenbank im kostenlosen Kontingent. |

### 1b) Discord Activity (Embedded App SDK)

**Aktueller Stand, belegt:** Das SDK heißt weiterhin **Embedded App SDK** (npm-Paket `@discord/embedded-app-sdk`); das Produkt heißt **Activities**. Eine Activity ist eine Web-App, die in einem iframe im Discord-Client läuft — auf Desktop, Mobil und Web. Die Kommunikation läuft über `postMessage`, das SDK kapselt das.
Quellen: [Activities Overview](https://docs.discord.com/developers/activities/overview) · [How Activities Work](https://docs.discord.com/developers/activities/how-activities-work)

**Voraussetzungen, belegt:**

| Thema | Stand laut Doku |
|---|---|
| **App im Developer Portal** | Ja. App anlegen, Installationskontexte (Server/User) wählen, Redirect-URI setzen, unter *Activities → Settings* die Checkbox **Enable Activities** aktivieren. ([Building an Activity](https://docs.discord.com/developers/activities/building-an-activity)) |
| **Offen für alle Entwickler?** | In der Doku ist **keine Freischaltung, kein Allowlist-Verfahren und keine Warteliste** beschrieben: Jeder kann eine App anlegen und Activities aktivieren. Eine **nicht verteilte** Activity können aber nur Sie und Ihr Developer-Team starten — für Dritte braucht es Verifizierung und Discovery (siehe unten). |
| **URL-Mapping** | Pflicht. Im Portal wird je Eintrag ein PREFIX (Pfad in Ihrer App) auf ein TARGET (externer Host, ohne Protokoll) gemappt. Das `/`-Mapping zeigt auf die HTML-Auslieferung. Überlappende Prefixe müssen von spezifisch nach allgemein sortiert sein; Targets müssen auf ein Verzeichnis zeigen. ([Local Development](https://docs.discord.com/developers/activities/development-guides/local-development)) |
| **Proxy** | Pflicht und nicht umgehbar. **Der gesamte Netzwerkverkehr läuft über den Discord-Proxy**, technisch Cloudflare Workers. Ihre App ist unter `{clientId}.discordsays.com` erreichbar. **WebSocket wird unterstützt. WebTransport nicht. WebRTC nicht.** Externe URLs, die nicht gemappt sind, scheitern mit `blocked:csp`; für Drittbibliotheken gibt es `patchUrlMappings`. ([Networking](https://docs.discord.com/developers/activities/development-guides/networking)) |
| **OAuth-Scopes** | Typisch `identify`, `guilds`, `applications.commands`. Der Code-Tausch gegen ein Access-Token muss **serverseitig** erfolgen (Client Secret). `rpc.activities.write` für Rich Presence. `dm_channels.read` **erfordert eine Freigabe durch Discord**. |
| **Activity Shelf** | **Unverifiziert.** Der Begriff kommt in der aktuellen Doku nicht mehr vor. Belegt sind heute zwei Einstiegspunkte: der **App Launcher** über einen *Entry Point Command* (beim Aktivieren wird automatisch ein Befehl „Launch" angelegt) und die Antwort auf eine Interaktion mit Callback-Typ `LAUNCH_ACTIVITY` (Typ 12). |
| **Review-Prozess** | Kein Store-Review im Sinne von Apple oder Google. Das Tor heißt **App Verification** (Identitäts- und App-Verifizierung des Team-Owners) und danach **Discovery-Opt-in**. Nach dem Einschalten dauert es **bis zu 24 Stunden**, bis die App im App Directory und App Launcher erscheint. Die konkreten Qualifikationskriterien stehen nur im Developer Portal und sind von außen **nicht verifizierbar** — ebenso wenig die Bearbeitungsdauer der Verifizierung. ([Enabling Discovery](https://docs.discord.com/developers/discovery/enabling-discovery)) |
| **Monetarisierung** | Möglich. „App Monetization applies to Bots and Activities." Voraussetzungen: verifizierte App, Besitz durch ein Developer-Team, Team-Owner mindestens 18 Jahre, 2FA und verifizierte E-Mails, Links auf Nutzungsbedingungen und Datenschutzerklärung, Slash-Commands (oder freigegebener Message-Content-Intent), Stripe-Auszahlung. **Auszahlungen nur für Teams in den USA, der EU oder dem UK.** Die erste Auszahlung ist erst ab 100 USD Umsatz möglich, davor steht eine Prüfung durch Discord. In der Activity selbst über SKUs, `startPurchase`, `getEntitlements` und das Event `ENTITLEMENT_CREATE`. **Der Umsatzanteil, den Discord einbehält, steht nicht in der Entwicklerdokumentation — unverifiziert**, er ist Teil der Monetization Terms. ([Enabling Monetization](https://docs.discord.com/developers/monetization/enabling-monetization) · [IAP für Activities](https://docs.discord.com/developers/monetization/implementing-iap-for-activities)) |
| **Betriebs-Limits** | Drei belegte Fallstricke: (1) Der Proxy entfernt Cache-Header bei `text/html` — Sie brauchen eine eigene Cache-Busting-Strategie. (2) Ratelimits der Discord-API müssen client- *und* serverseitig respektiert werden (`retry_after` bei 429). (3) **Dynamisch vergebene IP-Adressen, wie sie bei Cloud-Functions üblich sind, können einen vom Vorbesitzer geerbten Cloudflare-Bann mitbringen — ausgehender Verkehr zur Discord-API ist dann bis zu einer Stunde blockiert. Discord empfiehlt eine statische Egress-IP.** Das schließt ein rein serverloses Backend praktisch aus. ([Production Readiness](https://docs.discord.com/developers/activities/development-guides/production-readiness)) |
| **Teilnehmerzahl pro Instanz** | **Unverifiziert** — in der Doku nicht genannt. |

**Was Discord Ihnen *nicht* abnimmt:** Es gibt **keinen eingebauten Zustandsabgleich zwischen Spielern.** Die Doku liefert eine `instanceId`, die alle Teilnehmer derselben Sitzung teilen, sowie `getActivityInstanceConnectedParticipants()` und das Event `ACTIVITY_INSTANCE_PARTICIPANTS_UPDATE`. Den Echtzeit-Spielserver bauen Sie trotzdem selbst. ([Multiplayer Experience](https://docs.discord.com/developers/activities/development-guides/multiplayer-experience))

| Kriterium | Bewertung |
|---|---|
| **Aufwand** | Web-App plus Portal-Konfiguration, OAuth-Serverteil, Proxy-Eigenheiten, iframe-Layout für Mobil und Bild-in-Bild, Verifizierung. Faustregel: 40 bis 60 Prozent über dem Aufwand von 1a — und Sie brauchen 1a ohnehin fast vollständig. |
| **Reichweite** | Nur Discord-Nutzer, und nur die, die im selben Channel sind. Für den Beamer im Besprechungsraum oder im Klassenzimmer praktisch wertlos. Dafür null Beitrittshürde innerhalb von Discord und eine mögliche Entdeckung über das App Directory. |
| **Einschränkungen** | Kein WebRTC, kein WebTransport, CSP-Sandbox, Cookies nur mit `SameSite=None; Partitioned`, statische Egress-IP nötig, Daten aus dem Discord-Client sind grundsätzlich nicht vertrauenswürdig. |
| **Timing/Latenz** | Brauchbar, aber nicht optimal. WebSockets funktionieren, laufen jedoch über einen zusätzlichen Proxy-Hop mit zusätzlicher Streuung. Für ein Quiz mit Antwortfenstern von mehreren Sekunden unkritisch, solange die Zeitmessung serverautoritativ ist — und das muss sie ohnehin sein. Auf Mobilgeräten kommt Thermal-Throttling dazu; das SDK meldet das über `THERMAL_STATE_UPDATE`. |
| **Betriebskosten** | Wie 1a, plus die Pflicht zu fester Egress-IP — also eine kleine VM oder ein NAT-Gateway statt reinem Serverless. In der Praxis unter 10 EUR/Monat. |

### 1c) Discord Bot (Fragen als Nachrichten mit Buttons)

| Kriterium | Bewertung |
|---|---|
| **Aufwand** | Im Prototyp am geringsten von allen dreien — ein Prozess, keine Oberfläche. Der Aufwand verschiebt sich aber in das Umgehen der Plattformgrenzen. |
| **Reichweite** | Alle im Channel, ohne jede Hürde: kein Code, kein Namenseingeben. Erfordert eine Server-Installation durch jemanden mit Rechten. |
| **Einschränkungen** | Interaktionen müssen innerhalb von drei Sekunden bestätigt werden, der Interaktions-Token lebt 15 Minuten. Nachrichten-Edits unterliegen Ratelimits, ein flüssiger Countdown ist damit nicht darstellbar. Antworten sind öffentlich, sofern Sie nicht mit ephemeren Antworten arbeiten — und dann sieht der Raum nichts. Kein gemeinsamer, synchroner Startmoment. |
| **Timing/Latenz** | **Für ein Schnelligkeitsquiz die schlechteste Wahl.** Der Zeitstempel eines Button-Klicks ist der Moment, in dem Discords Infrastruktur die Interaktion an Sie weiterreicht — Sie messen Discords Zustellzeit mit, nicht die Reaktionszeit des Spielers. Für ein Quiz, bei dem Schnelligkeit Punkte bringt, ist das keine faire Grundlage. |
| **Betriebskosten** | Ein kleiner Prozess mit dauerhafter Gateway-Verbindung, unter 10 EUR/Monat. |

---

## 2. Empfehlung und Architektur-Konsequenz

**Für den MVP: 1a, die reine Web-App.** Sie ist die einzige Variante, die das Kernversprechen eines Kahoot-artigen Spiels erfüllt — jeder im Raum macht sofort mit, ohne irgendetwas zu installieren — und sie ist zugleich die, bei der die Zeitmessung sauber in Ihrer Hand liegt. Die beiden Discord-Wege bringen Reichweite in einer Nutzergruppe, die Sie heute nicht haben, und kosten Aufwand und Plattformabhängigkeit, bevor das Spiel selbst bewiesen hat, dass es trägt.

**Ja, b) und c) können später auf denselben Spielserver aufsetzen.** Eine Discord Activity *ist* eine Web-App; sie kann exakt dieselbe Spieleransicht laden und sich mit demselben WebSocket-Server verbinden. Der Bot ist ein weiterer Client, der dieselben Spielbefehle schickt — nur eben aus einem Discord-Prozess statt aus einem Browser.

**Die Architektur-Konsequenz, die Sie ab Tag eins einhalten müssen:**

Die Spiellogik lebt in einem eigenen Modul, das **nichts über Sockets, HTTP oder Discord weiß**. Es ist eine Zustandsmaschine: Sie nimmt einen Zustand und ein Ereignis entgegen und liefert einen neuen Zustand plus eine Liste von Nachrichten, die hinausgehen sollen. Die Zeit kommt als eingespeiste Abhängigkeit hinein, nicht aus einem `Date.now()` mitten im Code — sonst ist die Logik nicht testbar.

Darum herum liegen dünne **Transport-Adapter**: einer für Socket.IO, später einer für die Activity (der denselben Socket-Adapter mitbenutzt) und einer für den Bot, der Spielnachrichten in Discord-Nachrichten mit Buttons übersetzt. Die Spieleridentität ist abstrakt — eine `PlayerId` mit einem Herkunftsvermerk (`web`, `discord`) — und nicht an eine Discord-Nutzer-ID gebunden.

Wenn Sie diese Trennung einhalten, kostet das dritte Frontend Tage statt Wochen. Wenn Sie sie nicht einhalten, schreiben Sie das Spiel ein zweites Mal.

---

## 3. Stack-Vorschlag für den empfohlenen Weg

Jede Wahl mit einer Begründung. Alles bewusst langweilig und gut dokumentiert.

| Baustein | Wahl | Begründung in einem Satz |
|---|---|---|
| **Server-Runtime** | **Node.js 22 LTS mit TypeScript** | Eine Sprache für Server und Browser, das ausgereifteste Echtzeit-Ökosystem, und auf Ihrem Windows-10-Rechner ohne Umwege lauffähig. |
| **Realtime-Transport** | **Socket.IO** | Es liefert Wiederverbindung, Räume, bestätigte Nachrichten und Rundruf fertig mit — genau die Dinge, die Sie auf rohen WebSockets selbst und fehleranfällig nachbauen würden. |
| *Verworfen: rohe WebSockets (`ws`)* | — | Schlanker und schneller, aber Reconnect, Heartbeat und Raumverwaltung sind dann Ihre Baustelle; der Overhead von Socket.IO ist bei einem Quiz irrelevant. |
| *Verworfen: gehosteter Dienst (Ably, Pusher)* | — | Spart Betrieb, kostet ab der ersten echten Veranstaltung Geld und nimmt Ihnen die Kontrolle über genau den Moment, auf den es ankommt — wann die Frage erscheint. |
| **Frontend** | **React mit Vite**, zwei Oberflächen (Host, Spieler) in einem Repository | Größtes Ökosystem, einfachster Einstieg, und Vite startet schnell genug, dass Sie beim Entwickeln nicht warten. |
| *Verworfen: Next.js* | — | Serverseitiges Rendern bringt hinter einem Join-Code keinen Vorteil, erschwert aber das Modell mit dauerhafter Socket-Verbindung. |
| **Spielzustand zur Laufzeit** | **Im Arbeitsspeicher des Serverprozesses**, ein Objekt pro Raum | Ein Raum ist wenige Kilobyte groß, der Zugriff kostet null Latenz, und Redis löst ein Problem, das Sie bei einer Instanz noch nicht haben. |
| **Persistenz** | **PostgreSQL** (Quizze, Fragen, abgeschlossene Spiele, Auswertungen) | Relationale Daten mit klaren Beziehungen, überall betreibbar, kostenlose Einstiegskontingente — und Sie wachsen nicht heraus. |
| *Noch einfacherer Start* | SQLite im ersten Durchstich | Eine Datei, kein Server; der Umstieg auf PostgreSQL ist später ein überschaubarer Schritt, wenn Sie von Anfang an eine Abstraktionsschicht nutzen. |
| **Sitzungs-Token** | **Signiertes JWT im `sessionStorage`** | Es überlebt das Neuladen der Seite und erlaubt dem Server, einen zurückkehrenden Spieler eindeutig seinem Platz zuzuordnen. |
| **Skalierungsbaustein (später)** | **Redis bzw. Valkey** als Socket.IO-Adapter und Raumregister | Erst nötig, wenn mehr als ein Serverprozess läuft — dann aber der Standardweg, nicht eine Eigenkonstruktion. |

### Hosting: die nahezu kostenlose Variante

| Teil | Empfehlung | Kosten |
|---|---|---|
| Frontend (statisch) | Cloudflare Pages oder Netlify | 0 EUR |
| Spielserver | Eine kleine VM, z. B. Hetzner CX22 — oder Fly.io/Railway im Einstiegskontingent | 0 bis 5 EUR/Monat |
| Datenbank | Neon oder Supabase im kostenlosen Kontingent | 0 EUR |
| Domain | eigene Domain | ca. 10 EUR/Jahr |

**Zwei Warnungen zur Hosting-Wahl.** Erstens: **Serverlose Funktionsplattformen wie Vercel Functions sind für dauerhafte WebSocket-Verbindungen ungeeignet** — der Spielserver muss ein laufender Prozess sein. Zweitens: Achten Sie auf Leerlauf-Zeitüberschreitungen bei Proxys und Lastverteilern; ein Spiel, bei dem 20 Sekunden lang niemand etwas sendet, darf nicht die Verbindung verlieren. Ein Heartbeat alle 15 Sekunden löst das, Socket.IO bringt ihn mit.

Die eigene VM ist, obwohl sie etwas kostet, die ruhigere Wahl: feste IP (relevant, falls Sie später die Discord-Activity ergänzen), keine Überraschungen bei Verbindungsdauer, voller Zugriff auf Logs.

---

## 4. Die harten Echtzeit-Themen

### 4.1 Serverautoritative Zeitmessung und Punktevergabe

**Grundsatz: Eine vom Client gelieferte Zeit wird nie zur Punktberechnung verwendet.** Wer manipulieren will, braucht sonst nur die Entwicklerkonsole.

Der Server merkt sich beim Start einer Frage einen Zeitstempel aus einer **monotonen** Quelle (`process.hrtime.bigint()`), nicht aus der Wanduhr — die kann durch Zeitsynchronisation springen. Trifft eine Antwort ein, stempelt der Server den Empfangsmoment und rechnet die Differenz. Die Punkte ergeben sich aus Richtigkeit plus einem Schnelligkeitsanteil, der über das Antwortfenster abfällt.

Dazu gehören drei Regeln: Antworten, die nach Ablauf des Fensters eintreffen, zählen null Punkte und werden trotzdem bestätigt, damit der Spieler nicht im Ungewissen hängt. Pro Spieler und Frage zählt nur die **erste** Antwort; spätere werden verworfen, nicht überschrieben. Und: **Die richtige Antwort verlässt den Server erst, wenn das Fenster geschlossen ist** — vorher steckt sie nicht im Payload, auch nicht versteckt.

### 4.2 Clock-Sync und Latenzausgleich

Hier sind zwei Dinge sauber zu trennen, die oft vermischt werden.

**Für die Anzeige** braucht jeder Client eine gemeinsame Uhr, damit alle denselben Countdown sehen. Das löst ein kleiner Handshake über die bestehende Verbindung: Der Client sendet seinen Zeitstempel, der Server antwortet mit seinem, der Client misst die Rückkehr. Aus mehreren solchen Proben nimmt man den **Median** — nicht den Mittelwert, denn ein einzelner Ausreißer darf nicht durchschlagen — und kennt damit Versatz und halbe Umlaufzeit.

**Für die Wertung** gibt es zwei Ansätze, und ich empfehle den ersten:

*Ansatz A — synchronisierter Start.* Der Server liefert die Frage **vorab** an alle Clients aus, zusammen mit einem Anzeigezeitpunkt auf der gemeinsamen Uhr. Jeder Client blendet die Frage zu genau diesem Moment ein. Die Übertragungszeit der Frage fällt damit aus der Rechnung heraus; übrig bleibt nur die Rückrichtung.

*Ansatz B — Kompensation der Rückrichtung.* Der Server zieht vom gemessenen Antwortabstand die zuletzt gemessene halbe Umlaufzeit des jeweiligen Spielers ab — **gedeckelt**, etwa bei 400 Millisekunden. Ohne Deckel würde jemand, der seine Verbindung künstlich verschlechtert, dafür belohnt.

In Kombination bekommen Sie eine Wertung, die eine langsame Mobilfunkverbindung nicht bestraft und zugleich nicht manipulierbar ist.

### 4.3 Wiederverbindung mitten im Spiel

Ein Handy, das in den Ruhezustand geht, ein Tunnel, ein WLAN-Wechsel — das passiert in jeder zweiten Runde und darf das Spiel für niemanden beenden.

Beim Beitritt bekommt jeder Spieler ein **signiertes Sitzungstoken** (Spieler-ID und Raumcode, HMAC-signiert), das im `sessionStorage` liegt. Bei der Wiederverbindung schickt der Client dieses Token mit; der Server ordnet ihn seinem bestehenden Platz zu, statt einen zweiten Spieler mit demselben Namen anzulegen.

Danach schickt der Server einen **vollständigen Zustandsabzug**: aktuelle Phase, laufende Frage, verbleibende Zeit, eigener Punktestand, eigene bereits abgegebene Antwort. Der Client rendert daraus seinen Zustand neu — er versucht nicht, verpasste Ereignisse nachzuspielen.

Dazu eine **Karenzzeit** von etwa 60 Sekunden, bevor ein Spieler als ausgeschieden gilt; in der Lobby-Anzeige erscheint er währenddessen als „verbindet sich neu". Der Host bekommt dasselbe Verfahren mit höheren Rechten — und entscheidend: **Das Spiel läuft serverseitig weiter, auch wenn die Host-Ansicht kurz weg ist.** Der Spielzustand lebt im Server, nicht im Beamer-Browser.

### 4.4 Raumcodes: Kollisionen, Brute Force, Bot-Abwehr

**Format.** Sechs Zeichen aus einem reduzierten Alphabet ohne verwechselbare Zeichen (kein I, L, O, U, 0, 1) — Crockford-Base32 ist dafür der etablierte Zeichenvorrat. Das ergibt über eine Milliarde Kombinationen, und niemand vertippt sich bei der Null.

**Kollisionsfreiheit.** Code zufällig ziehen, gegen die Liste der aktiven Räume prüfen, bei Kollision neu ziehen. Bei realistischer Last bricht das nie um. Nach Spielende wird der Code nicht sofort wieder vergeben, sondern geht in eine Sperrzeit — sonst landet ein Nachzügler im falschen Spiel.

**Brute-Force-Schutz.** Drei Maßnahmen zusammen: Beitrittsversuche pro IP begrenzen (etwa zehn pro Minute, danach exponentiell wachsende Wartezeit); **falsche Codes und volle oder gesperrte Räume identisch beantworten**, damit niemand durch Ausprobieren herausfindet, welche Codes existieren; und ein Lobby-Schloss, mit dem der Host den Raum nach dem Start für neue Beitritte schließt.

**Flooder und Bots.** Eine Obergrenze für Spieler pro Raum. Genau eine Spielersitzung pro Verbindung. Spitznamen auf Länge und erlaubte Zeichen prüfen, Doppelnamen verhindern und einen Schimpfwortfilter vorschalten — das ist bei Publikumsveranstaltungen kein Luxus, sondern der Unterschied zwischen vorführbar und peinlich. Eine Kick-Funktion für den Host. Verbindungen pro IP begrenzen. Und falls das Spiel öffentlich beworben wird: eine leichte Captcha-Hürde (etwa Cloudflare Turnstile) vor dem Beitritt.

Alle genannten Maßnahmen sind rein defensiv — sie schützen Ihren eigenen Dienst, sie greifen niemanden an.

### 4.5 Horizontale Skalierung

**Zuerst die Entwarnung:** Ein Raum sprengt keinen Prozess. Selbst 1.000 Spieler in einem Raum erzeugen pro Frage 1.000 kleine Nachrichten hinein und einen Rundruf hinaus. Das trägt ein einzelner Node-Prozess.

Das Problem liegt woanders und heißt **Fan-out**: Wenn jede eingehende Antwort sofort an alle anderen verteilt wird, wächst der Aufwand quadratisch. Die Lösung ist, serverseitig zu **aggregieren**: Die Host-Ansicht bekommt einen Antwortzähler und am Ende die Verteilung, nicht jede Einzelantwort. Die Spieler bekommen ihren eigenen Rang und die obersten fünf, nicht die vollständige Rangliste.

**Wenn mehrere Instanzen laufen**, gilt ein Prinzip: **Ein Raum lebt immer vollständig in genau einem Prozess.** Nicht „klebrige Sitzung", sondern „klebriger Raum". Eine Zuordnung Raumcode → Instanz liegt in Redis; der Lastverteiler leitet anhand des Raumcodes. Der Redis-Adapter von Socket.IO dient dann nur noch dem Rundruf über Instanzgrenzen, nicht der Zustandshaltung.

**Gegen Prozessausfall** schreiben Sie den Raumzustand bei jedem Phasenwechsel als Abzug nach Redis. Fällt eine Instanz aus, übernimmt eine andere den Raum aus dem letzten Abzug. Das kostet im schlimmsten Fall eine Frage, nicht das ganze Spiel.

Ehrlich gesagt: Für die ersten Monate brauchen Sie nichts davon. Es gehört in die Vorlage, damit Sie es nicht durch eine frühe Entscheidung verbauen — nicht, damit Sie es jetzt bauen.

---

## 5. Schnittstellen-Skizze

Benennung als Vorschlag, nicht als Vorschrift. Der Zuschnitt ist entscheidender als die Namen.

### Host → Server

| Ereignis | Zweck |
|---|---|
| `host:create_game` | Erzeugt einen Raum aus einem gewählten Quiz und liefert den Raumcode. |
| `host:resume` | Stellt eine unterbrochene Host-Sitzung über das Sitzungstoken wieder her. |
| `host:lock_room` | Schließt den Raum für weitere Beitritte. |
| `host:start_game` | Startet das Spiel und damit die erste Frage. |
| `host:next_question` | Geht zur nächsten Frage über, nachdem die Ergebnisse gezeigt wurden. |
| `host:reveal_answers` | Beendet das laufende Antwortfenster vorzeitig und zeigt die Auflösung. |
| `host:skip_timer` | Verkürzt den laufenden Countdown, wenn erkennbar alle geantwortet haben. |
| `host:kick_player` | Entfernt einen Spieler aus dem Raum. |
| `host:end_game` | Beendet das Spiel vorzeitig und schreibt die Auswertung weg. |

### Server → Host

| Ereignis | Zweck |
|---|---|
| `host:room_created` | Liefert Raumcode und Beitritts-Link bzw. QR-Code. |
| `host:state_snapshot` | Vollständiger Raumzustand — bei Verbindungsaufbau und nach Wiederverbindung. |
| `host:player_joined` | Ein Spieler ist beigetreten, mit Name und aktueller Spielerzahl. |
| `host:player_left` | Ein Spieler hat verlassen oder ist in der Karenzzeit. |
| `host:question_started` | Frage, Antwortoptionen und Endzeitpunkt auf der gemeinsamen Uhr. |
| `host:answer_count` | Laufender Zähler der eingegangenen Antworten, ohne Inhalte. |
| `host:question_ended` | Auflösung plus Verteilung der Antworten über die Optionen. |
| `host:leaderboard` | Rangliste nach jeder Frage. |
| `host:game_ended` | Endstand und Verweis auf die gespeicherte Auswertung. |
| `host:error` | Fehler in einer Form, die am Beamer vorzeigbar ist. |

### Spieler → Server

| Ereignis | Zweck |
|---|---|
| `player:join` | Beitritt mit Raumcode und Spitzname. |
| `player:resume` | Wiederverbindung über das Sitzungstoken statt als neuer Spieler. |
| `player:submit_answer` | Gewählte Antwortoption zur aktuellen Frage, mit Fragenummer zur Absicherung. |
| `player:clock_ping` | Probe für den Uhrenabgleich; wird mehrfach erhoben. |
| `player:leave` | Verlässt den Raum bewusst. |

### Server → Spieler

| Ereignis | Zweck |
|---|---|
| `player:joined` | Beitritt bestätigt, mit Sitzungstoken und zugewiesener Spieler-ID. |
| `player:state_snapshot` | Vollständiger eigener Zustand — bei Verbindungsaufbau und nach Wiederverbindung. |
| `player:clock_sync` | Antwort auf die Probe, zur Berechnung von Versatz und Umlaufzeit. |
| `player:waiting` | Lobby-Zustand: Spiel hat noch nicht begonnen. |
| `player:question` | Antwortoptionen und Endzeitpunkt — **ohne die richtige Lösung**. |
| `player:answer_ack` | Antwort ist eingegangen und gezählt; sperrt die Eingabe. |
| `player:question_result` | Richtig oder falsch, erzielte Punkte, eigener Rang. |
| `player:rank_update` | Aktueller Rang und Abstand zum Vordermann. |
| `player:game_ended` | Endplatzierung und Gesamtpunktzahl. |
| `player:kicked` | Entfernt worden, mit Begründung. |
| `player:error` | Fehler in Klartext, etwa unbekannter Raumcode oder Raum geschlossen. |

---

## 6. Aufwandsschätzung für den MVP

Die Zahlen sind **Zielgrößen** für eine erfahrene Person in Vollzeit, keine Zusage. Wer nebenher arbeitet, rechnet in Kalenderwochen statt in Tagen.

| Stufe | Inhalt | Aufwand |
|---|---|---|
| **0 — Durchstich** | Raum anlegen, Beitritt per Code, eine fest verdrahtete Frage, serverautoritative Zeitmessung, Punkte, Rangliste. Keine Oberflächenpflege. Beweist, dass die Mechanik trägt. | **3 – 5 Tage** |
| **1 — Spielbarer MVP** | Vollständiger Spielablauf über mehrere Fragen, Quiz-Import aus einer Datei, Wiederverbindung, Uhrenabgleich, Host-Ansicht für den Beamer, Spieleransicht für das Handy, Lobby mit Spielerliste. | **+ 8 – 12 Tage** |
| **2 — Produktionsfähig** | PostgreSQL-Persistenz, Anmeldung für Quiz-Ersteller, einfacher Quiz-Editor, Auswertung mit Export, Ratelimits und Missbrauchsabwehr, strukturierte Logs, Deployment und Betriebsanleitung, Lasttest mit 200 Spielern. | **+ 6 – 9 Tage** |
| **Summe bis produktionsfähig** | | **17 – 26 Personentage** |
| **3a — Discord Activity als zweites Frontend** | Portal-Einrichtung, URL-Mappings, OAuth-Serverteil, Proxy-Anpassungen, iframe- und Mobil-Layout. Dazu Verifizierung — Wartezeit im Kalender, nicht Aufwand. | **+ 5 – 8 Tage** |
| **3b — Discord Bot als drittes Frontend** | Gateway-Anbindung, Übersetzung der Spielereignisse in Nachrichten mit Buttons, Umgang mit den Ratelimits. | **+ 3 – 5 Tage** |

**Der größte Hebel liegt in Stufe 0.** Wenn Zeitmessung, Wiederverbindung und Raumverwaltung dort sauber sitzen, ist der Rest Fleißarbeit. Wenn nicht, zahlen Sie es in jeder weiteren Stufe erneut.

---

## 7. Was in dieser Vorlage nicht verifiziert ist

Damit Sie wissen, worauf Sie sich stützen können und worauf nicht:

- **Umsatzbeteiligung von Discord bei Premium Apps** — in der Entwicklerdokumentation nicht genannt; steht in den Monetization Terms, die vor einer Monetarisierungsentscheidung gelesen werden müssen.
- **Konkrete Qualifikationskriterien für App Verification und Discovery**, einschließlich etwaiger Schwellenwerte bei Serverzahlen — laut Doku nur im Developer Portal einsehbar.
- **Bearbeitungsdauer der App-Verifizierung** — nicht dokumentiert. Belegt ist nur: nach dem Einschalten von Discovery bis zu 24 Stunden bis zur Sichtbarkeit.
- **Maximale Teilnehmerzahl je Activity-Instanz** — nicht dokumentiert.
- **„Activity Shelf"** — der Begriff kommt in der aktuellen Dokumentation nicht mehr vor. Belegt sind App Launcher, Entry Point Command und `LAUNCH_ACTIVITY` als Interaktionsantwort. Ob die Oberfläche intern noch so heißt, ist von außen nicht feststellbar.
- **Tatsächliche Latenz durch den Discord-Proxy** — nicht dokumentiert und nur am Gerät messbar. Vor einer Entscheidung für Variante 1b sollte ein Messdurchlauf mit echten Clients stattfinden.
- **Die Drei-Sekunden-Frist und die 15-Minuten-Lebensdauer des Interaktions-Tokens** in Abschnitt 1c stammen aus der allgemeinen Interactions-Dokumentation und wurden im Rahmen dieser Recherche nicht Zeile für Zeile neu nachgeschlagen — vor einer Entscheidung für Variante 1c sollte das gegen [Receiving and Responding to Interactions](https://docs.discord.com/developers/interactions/receiving-and-responding) geprüft werden.

---

### Quellen (alle am 2026-10-19 abgerufen)

- Activities Overview — https://docs.discord.com/developers/activities/overview
- How Activities Work — https://docs.discord.com/developers/activities/how-activities-work
- Building Your First Activity — https://docs.discord.com/developers/activities/building-an-activity
- Networking (Proxy, WebSocket/WebTransport/WebRTC, CSP, Cookies) — https://docs.discord.com/developers/activities/development-guides/networking
- Local Development (URL Mapping) — https://docs.discord.com/developers/activities/development-guides/local-development
- Multiplayer Experience (Instanzen, Teilnehmer) — https://docs.discord.com/developers/activities/development-guides/multiplayer-experience
- Production Readiness (Cache, Ratelimits, statische IP) — https://docs.discord.com/developers/activities/development-guides/production-readiness
- Embedded App SDK Reference (Befehle und Ereignisse) — https://docs.discord.com/developers/developer-tools/embedded-app-sdk
- Enabling Discovery — https://docs.discord.com/developers/discovery/enabling-discovery
- Enabling Monetization — https://docs.discord.com/developers/monetization/enabling-monetization
- In-App Purchases für Activities — https://docs.discord.com/developers/monetization/implementing-iap-for-activities
- Platform: Activities — https://docs.discord.com/developers/platform/activities
