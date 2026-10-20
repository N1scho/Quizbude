@echo off
setlocal
title Quizbude
cd /d "%~dp0"

echo.
echo   ==========================================================
echo      Quizbude
echo   ==========================================================
echo.

rem ------------------------------------------------------------------
rem  1. Ist Node da, und ist es neu genug?
rem     Ohne diese Pruefung bricht npm spaeter mit einer Meldung ab,
rem     die niemandem sagt, was zu tun ist.
rem ------------------------------------------------------------------
where node >nul 2>&1
if errorlevel 1 goto keinnode

set "NODEVER="
for /f "delims=" %%v in ('node --version 2^>nul') do set "NODEVER=%%v"
if not defined NODEVER goto keinnode

set "NODEVER=%NODEVER:v=%"
for /f "tokens=1 delims=." %%a in ("%NODEVER%") do set "NODEMAJOR=%%a"
echo %NODEMAJOR%| findstr /r /c:"^[0-9][0-9]*$" >nul
if errorlevel 1 goto nodeunklar
if %NODEMAJOR% LSS 22 goto nodezualt

echo   Node %NODEVER% ist da.

where npm >nul 2>&1
if errorlevel 1 goto keinnpm

rem ------------------------------------------------------------------
rem  2. Bausteine holen - nur, wenn sie fehlen.
rem ------------------------------------------------------------------
if exist "node_modules" goto bauen
echo.
echo   Einmalig: die Bausteine werden geholt. Das dauert ein paar Minuten.
echo.
call npm install
if errorlevel 1 goto installkaputt

:bauen
rem ------------------------------------------------------------------
rem  3. Nur bauen, wenn sich etwas geaendert hat.
rem     Exit 0 heisst aktuell, alles andere heisst bauen.
rem ------------------------------------------------------------------
echo.
node tools\build-needed.mjs
if not errorlevel 1 goto starten
echo.
call npm run build
if errorlevel 1 goto baukaputt

:starten
echo.
echo   ----------------------------------------------------------
echo    Wenn Windows gleich fragt, ob Node Verbindungen annehmen
echo    darf: erlauben - und den Haken bei "Privat" setzen. Ohne
echo    ihn kommt kein Handy herein, und es sieht aus wie ein
echo    Programmfehler.
echo   ----------------------------------------------------------
echo.

rem  Die Buehne oeffnet der Server selbst, sobald er lauscht - erst
rem  dann steht fest, welchen Port er bekommen hat.
set "QUIZBUDE_BUEHNE_OEFFNEN=1"
call npm start
set "ENDE=%errorlevel%"

echo.
if not "%ENDE%"=="0" goto serverkaputt
echo   Die Runde ist vorbei - der Server ist aus.
echo.
pause
exit /b 0

rem ------------------------------------------------------------------
rem  Ab hier nur noch Faelle, in denen etwas fehlt. Jeder endet mit
rem  pause: eine Meldung, die niemand liest, ist keine Meldung.
rem ------------------------------------------------------------------

:keinnode
echo.
echo   Node.js ist auf diesem Rechner nicht zu finden.
echo.
echo   Node ist der Motor, auf dem die Quizbude laeuft. Einmal
echo   installieren, danach genuegt der Doppelklick hier:
echo.
echo       https://nodejs.org  -  die Fassung "LTS" nehmen
echo.
echo   Danach dieses Fenster schliessen und neu doppelklicken.
goto ende

:nodezualt
echo.
echo   Node.js ist da, aber zu alt.
echo   Gefunden: %NODEVER%   Gebraucht: 22 oder neuer.
echo.
echo   Die aktuelle LTS-Fassung von https://nodejs.org holen und
echo   darueber installieren. Die alte muss nicht weg.
goto ende

:nodeunklar
echo.
echo   Node.js meldet eine Version, mit der ich nichts anfangen kann:
echo   %NODEVER%
echo.
echo   Sicherheitshalber die aktuelle LTS-Fassung von
echo   https://nodejs.org installieren.
goto ende

:keinnpm
echo.
echo   Node ist da, npm fehlt. Das ist ungewoehnlich - npm kommt
echo   sonst zusammen mit Node.
echo.
echo   Node von https://nodejs.org neu zu installieren loest das
echo   fast immer.
goto ende

:installkaputt
echo.
echo   Die Bausteine liessen sich nicht holen.
echo.
echo   Meistens fehlt gerade das Internet oder eine Firewall sitzt
echo   dazwischen. Weiter oben im Fenster steht, woran npm
echo   gescheitert ist.
goto ende

:baukaputt
echo.
echo   Das Bauen ist schiefgegangen.
echo.
echo   Weiter oben steht die erste Fehlermeldung - die zaehlt,
echo   nicht die letzte.
goto ende

:serverkaputt
echo.
echo   Der Server hat sich mit einem Fehler beendet.
echo.
echo   Haeufigster Grund: alle Ports von 3000 bis 3010 sind belegt,
echo   oder PORT wurde von Hand gesetzt und genau der ist besetzt.
echo   Weiter oben steht die genaue Meldung.
goto ende

:ende
echo.
pause
exit /b 1
