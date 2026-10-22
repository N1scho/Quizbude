# Nachreview der siebten Fix-Welle

**Datum:** 2026-10-22 · **Branch:** `durchstich` · **Prüfstand:** `ef8f9d4` · **Scope:** ausschließlich `b4d0dbb..ef8f9d4`.

## Befunde und Gateurteil

**Keine neuen High-Confidence-Bugs oder blockierenden Befunde im geprüften Diff. GO für den technischen Abschluss der siebten Fix-Welle.** B-1 und B-2 sind für die beauftragten Eingaben behoben; B-3 bis B-5 sind gegen die benannten Rückfälle gebunden. Sieben eigene Mutationsproben wurden durch fachliche Assertions rot, sämtliche Mutationen anschließend bytegleich zurückgenommen. Die Aussage gilt für die unten beschriebenen Grenzen, nicht als Beweis beliebiger Vorworterkennung oder des vollständigen Browserbetriebs.

Das offene Produkturteil zu Vorwort ohne Satzzeichen bleibt offen. Keine Veröffentlichung, kein Merge, kein Push und keine zweite Featurewelle wurden durchgeführt. Das Nachreview gibt keinen externen Veröffentlichungsstand vor.

## Umfang und Ausgang

Der Umsetzerbericht `docs/bericht-welle7.md` wurde als Behauptung gelesen. Gemessen wurden Testlauf, Typprüfung, Build, Standalone-Riegel und alle fünf Befunde unabhängig. Der Diff enthält den Parser, den synchronisierten Standalone-Kern und die neuen/geänderten Tests. App.tsx, main.ts und die Serverfabrik sind im Diff unverändert; sie wurden ausschließlich für die beauftragten Rückfallproben vorübergehend mutiert.

Ausgangsstatus: sauber. Während des Reviews entstand parallel ausschließlich `docs/continuation-discovery-2026-10-22.md` als fremde, unversionierte Dokumentation. Sie wurde nicht verändert oder gestagt. Vor dem Dokumentationsabschluss war der gesamte versionierte Arbeitsbaum wieder sauber. Es gab keine dauerhaften Produktiv- oder Teständerungen.

`C:/Users/nikol/AGENTS.md` wurde gelesen. `C:/Users/nikol/.Codex/AGENTS.md` und eine Repo-AGENTS.md existierten an den angegebenen Pfaden nicht. Kein wörtlich belegbarer Konventionsverstoß im geprüften Diff. Die Änderung enthält keine Shell-/Python-Dateien und keine geänderten Secret-Dateien; daraus wird keine allgemeine Sicherheits- oder Dateirechteprüfung des Gesamtprojekts abgeleitet.

## Selbst gemessene Tore

| Tor | Eigenes Ergebnis |
|---|---|
| `npm.cmd test`, vor Mutation | 326/326 Tests, 28/28 Dateien, Exit 0 |
| `npm.cmd test`, nach vollständiger Rücknahme | 326/326 Tests, 28/28 Dateien, Exit 0 |
| `npx.cmd tsc --noEmit` | Exit 0, auch nach Rücknahme |
| `npm.cmd run build` | Exit 0 |
| `node tools/standalone-parser.mjs`, ohne `--schreiben` | aktuell, Exit 0, auch nach Rücknahme |
| Spielergerät, kritischer Pfad | HTML 0,31 + CSS 1,32 + JS 61,82 = **63,45 kB gzip**, Budget 65 kB |

Build-Dateien: Spieler-JS `index-VGdzwLjJ.js`, CSS `index-BEQfTrYX.css`; Bühne `index-MLP1Uj26.js`, CSS `index-BP45TIl4.css`. Kein gesondertes Lint-Skript im Projekt. Die erwarteten Fehlerausgaben der HTTP-/Gateway-Fehlerpfadtests liefen mit grünen Assertions durch.

Die Windows-Sandbox blockierte esbuild-Zugriffe und das Anlegen des Probeskripts. Tests, Build und Mutationsausführung wurden nach Freigabe außerhalb dieser Einschränkung ausgeführt; keine ExecutionPolicy oder globale Git-Konfiguration wurde geändert. Git-Aufrufe verwendeten `-c safe.directory=C:/Users/nikol/quiz`.

## Eigene Mutationsbeweise

Jede Mutation lief einzeln gegen die zugehörige Testsuite mittels `node node_modules/vitest/vitest.mjs run <Testdatei>`. Vorher wurden die Originalbytes gesichert; im `finally` wurden exakt diese Bytes zurückgeschrieben und mit `Buffer.equals` verglichen. Alle sieben Rücknahmen waren bytegleich. Das Rot kam jeweils aus der erwarteten Assertion, nicht aus Syntaxfehlern, fehlender Testentdeckung oder Startproblemen.

| Probe | Mutation und verifizierte Stelle | Ergebnis |
|---|---|---|
| A / B-2 | `packages/core/src/questions/parse.ts:555`: nach dem `kannFrageSein`-Schutz sofort `true`, Satzzeichenprüfung umgangen | **4 rot, 62 grün / 66**. N2-Alttest, erste Frage mit einer Antwort, Zeilenmatrix und JSON-Matrix scheitern. Konkreter Fehler: `ok=true` statt `false`. |
| B / B-1 und B-2 | `packages/core/src/questions/parse.ts:690`: Abbruch wieder bei `kannFrageSein(erste) || erste.antworten.length > 1` | **4 rot, 62 grün / 66**. Wörtlicher Dreizeilenfall, Einantwortfall und beide Matrizen scheitern. |
| C / JSON-Fehlerpfad | `packages/core/src/questions/parse.ts:1083`: `if (b !== undefined) continue` statt `istVorwort` | **1 rot, 65 grün / 66**. JSON-Gleichheitsmatrix erkennt den erneut stillen Verlust. |
| D / B-3 | `apps/host-web/src/App.tsx:193`: `leitung.current = gelegt` entfernt, Verdrahtung selbst unverändert | **1 rot, 1 grün / 2**. Der Start-Rückruf erzeugt keinen erwarteten Raumbefehl mehr. |
| E / B-3 Aufräumen | `apps/host-web/src/App.tsx:196`: `leitung.current = null` entfernt | **1 rot, 1 grün / 2**. Nach dem Aufräumen geht wieder ein unerlaubter Raumbefehl hinaus. |
| F / B-4 | `packages/server/src/main.ts:37`: aktiver Zweig mit `new S(http, ...)` und zusätzlichem Aliasimport aus `socket.io`; ursprünglicher Fabrikaufruf bleibt im toten Zweig | **1 rot, 9 grün / 10**. `test/server/socketBuffer.test.ts:123` erkennt die tatsächliche Modulkante trotz erhaltenem Wächtertext. |
| G / B-5 | `packages/server/src/transport/socketio/server.ts:25`: `perMessageDeflate: false` auf `true` | **1 rot, 9 grün / 10**. `test/server/socketBuffer.test.ts:281` misst `permessage-deflate` statt leerem Header. |

SHA-256 der vor und nach den Mutationen identischen Dateien:

| Datei | SHA-256 |
|---|---|
| `packages/core/src/questions/parse.ts` | `3f66c8096edef8cc523677ed3c629b4339ea46ab5aaed503cdefa0f0fa94962e` |
| `apps/host-web/src/App.tsx` | `837068553dd24c3d3911a61c25b8357fc508bba0909ffe961049fa037260238e` |
| `packages/server/src/main.ts` | `cb844cff3e0f213bef6bc7b959f13f99439cc79be930c67096cb2253d56cb510` |
| `packages/server/src/transport/socketio/server.ts` | `cd3ff8db958f7b79a16016c320ee1faf5104a2c903baa4ca00aa2f0b53be6e69` |

Rohprotokolle und Originalbytes liegen lokal unter `C:/Users/nikol/welle7-review-evidence/`, das ausführbare Probeskript unter `C:/Users/nikol/welle7-review-probes.mjs`. Diese Dateien liegen außerhalb des Repositories. Der Bericht enthält die für die Übergabe wesentlichen Ergebnisse; die Proben sind keine neuen dauerhaften Projekttests.

## Aussagekraft und einzeln beurteilte Abweichungen

**B-1/B-2, `parse.ts:553` und `:690`:** Die beiden gegenläufigen Mutationen sind notwendig: Nur die großzügige Erkennung zu mutieren hätte den Dreizeilenregress nicht belegt, nur die Antwortzahlklausel zu mutieren hätte die neue Trennung nicht isoliert. Beide fallen. Die bestehenden Assertions prüfen neben `ok` den erhaltenen Fragenbestand, Hinweise und Fehlerzeile. Das beweist die benannten Fälle; Satzzeichen bleiben eine Heuristik und keine semantische Unterscheidung jedes denkbaren unmarkierten Fragetextes.

**Mehrere Vorwortblöcke:** Die Erweiterung ist sachlich begründet. Zwei durch Leerzeile getrennte Vorworte werden an beiden Türen akzeptiert; die Schleife entfernt pro Durchlauf einen Block und erhält den letzten. Die eigene zusätzliche Messung mit `Klar!\n\nHier sind deine Fragen:` bestätigt `ok=true` und genau eine Nutzfrage an beiden Türen. Der Zeilenweg gibt zwei Hinweise aus, der JSON-Weg einen zusammengefassten. Gleichheit bedeutet hier gleiche Zulassung, nicht identische Ergebnisobjekte.

**JSON-Fehlerpfad, `parse.ts:1081` und `:1139`:** Die Erweiterung ist gerechtfertigt, weil vorangestellter Nicht-Beiwerktext nicht mehr still verschwinden soll. Die eigene Messung `Nenne den kleinsten Planeten\nMerkur` ergibt an beiden Türen `ok=false` und Fehler auf Originalzeile 1. Im Zeilenweg bleiben zwei Fragen zur Diagnose sichtbar, im JSON-Weg nur die JSON-Frage; der Upload scheitert in beiden Fällen. Mutation C bindet diese Entscheidung. Eine alleinige Titelzeile `# Abendrunde` wurde zusätzlich an beiden Türen akzeptiert.

**B-3, `test/host/buehne.test.ts:172`:** Der Test ruft den tatsächlich von App gelieferten `onStart`-Rückruf und führt die gesammelten Effekte aus. Mutation D beweist die Bindung des Leitungsverweises, E dessen Freigabe. Das ist eine aussagekräftige Nahtprüfung. Die React-Hook-Attrappe rendert nicht neu und bildet weder DOM-Ereignisse noch den vollständigen React-Lebenszyklus ab; der Bericht darf daraus keinen Browser-E2E-Beweis ableiten.

**B-4, `test/server/socketBuffer.test.ts:97`:** Der Wechsel zum vorhandenen TypeScript-AST-Helfer entspricht dem bestehenden Projektmuster. Der neue Test blockiert die konkret benannte Aliasimport-/Totzweig-Umgehung; Mutation F belegt genau das. Die Abweichung vom Laufzeittest ist im engen Paket vertretbar, weil main.ts beim Import den Prozessstart verdrahtet und der Auftrag einen erneuten Umbau ausschließt. Die Importprüfung beweist weder den ausgeführten Fabrikaufruf noch beliebige indirekte Beschaffung über Reexports oder berechnete Imports. Diese Grenze bleibt ausdrücklich offen; die Aussage im Umsetzerbericht, nur ein Reexport könne noch umgehen, ist zu weit. Kein neuer Infrastrukturumbau aus diesem Nachreview.

**B-5, `test/server/socketBuffer.test.ts:279`:** Tatsächlich gemessen wird ein WebSocket-Upgrade am laufenden Server. Der positive Kontrollfall mit eingeschalteter Kompression zeigt, dass die Messung den Header überhaupt sehen kann. Mutation G kippt ausschließlich die erwartete Negativzusage. Damit ist die Aushandlung gebunden; Speicherverbrauch oder Netzwerklast wurden nicht vermessen.

## Offene Produktentscheidung und Testgrenzen

Das Vorwort `Klar\nHier sind deine Fragen\nViel Spass` wurde separat gemessen: beide Türen lehnen ab. Der Zeilenweg meldet auf Zeile 1 eine fehlende Markierung, der JSON-Weg nicht als Vorwort erkannten Text. Diese bereits dokumentierte Produktentscheidung wird durch das Review weder entschieden noch als neuer Blocker ausgegeben.

Browserdarstellung, Dateiablage, echte React-Interaktion, Doppelklick/Firewall und Gastgerät im WLAN wurden nicht geprüft. Die bereits dokumentierten Altlasten `[x]`, die quadratische Bremse innerhalb einer Zeile, Schlusswort und die zweite Featurewelle waren ausdrücklich außerhalb des Scopes und bleiben unverändert.

## Verdichtete Erkenntnisse für die Übergabe

- Gegenläufige Parserkorrekturen brauchen beide Rückfallrichtungen als Mutation; A und B belegen das am selben Prädikat.
- Ein AST-Importwächter ist belastbarer als ein Textschnipsel, bleibt aber eine begrenzte Strukturprüfung. Beleg: F und `test/quelltext.ts:34`.
- Ein positiver Kontrollfall macht eine negative Handshake-Zusage überprüfbar. Beleg: G und `socketBuffer.test.ts:284`.
- Bytegleiche Rücknahme plus vollständiger grüner Abschlusslauf sind der Nachweis, dass kein Mutationsrest ausgeliefert wird.

Diese Erkenntnisse sind im Bericht als Projektgedächtnis mit Belegstellen festgehalten. Ein neuer globaler Agent-Memory-Store wurde im eng begrenzten Dokumentationsauftrag nicht angelegt.
