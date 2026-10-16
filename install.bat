@echo off
rem ==========================================================
rem  gestione-sprint - installazione sicura per Claude Code
rem  Contiene anche il modulo contesto (ex controllo-contesto):
rem  se il vecchio mod controllo-contesto e installato, viene tolto
rem  per evitare doppioni.
rem  uso: install.bat        (chiede conferma)
rem       install.bat /y     (si a tutto)
rem ==========================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "RADICE=%~dp0"
if "%RADICE:~-1%"=="\" set "RADICE=%RADICE:~0,-1%"
set "PLUGIN=%RADICE%\gestione-sprint"
set "MARKET=mod-progetti"
set "NOME=gestione-sprint"
rem mod che questo sostituisce: vanno tolti
set "SOSTITUITI=controllo-contesto"
set "LOG=%RADICE%\install.log"
set "SI=0"
if /i "%~1"=="/y" set "SI=1"

echo.
echo   gestione-sprint - installazione
echo   cartella: %RADICE%
echo.
echo [%date% %time%] installazione da %RADICE% > "%LOG%"

rem ---- 1. controlli -----------------------------------------
where claude >nul 2>&1
if errorlevel 1 (
  echo   [errore] comando "claude" non trovato nel PATH.
  echo            installa Claude Code e riapri il terminale.
  goto :fine_errore
)
if not exist "%PLUGIN%\.claude-plugin\plugin.json" (
  echo   [errore] manca %PLUGIN%\.claude-plugin\plugin.json
  goto :fine_errore
)
if not exist "%RADICE%\.claude-plugin\marketplace.json" (
  echo   [errore] manca %RADICE%\.claude-plugin\marketplace.json
  goto :fine_errore
)

echo   1/6 verifico il mod...
call claude --version >> "%LOG%" 2>&1
call claude plugin validate "%PLUGIN%" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   [errore] il mod non supera la validazione di questa versione di Claude Code:
  for /f "delims=" %%v in ('claude --version 2^>nul') do echo            versione: %%v
  findstr /c:"> modules" /c:"> plugin" /c:"> types" /c:"error" "%LOG%"
  echo            il dettaglio completo e in install.log
  goto :fine_errore
)
echo       ok

rem ---- 2. cosa c'e gia ---------------------------------------
echo   2/6 cerco versioni precedenti e mod da sostituire...
call claude plugin list > "%TEMP%\gs_plugin_list.txt" 2>nul
call claude plugin marketplace list > "%TEMP%\gs_market_list.txt" 2>nul

set "VECCHIE="
for %%n in (%NOME% %SOSTITUITI%) do (
  for /f "tokens=2" %%a in ('findstr /r /c:"> %%n@" "%TEMP%\gs_plugin_list.txt"') do set "VECCHIE=!VECCHIE! %%a"
)
set "MERCATI="
for %%m in (%MARKET% %SOSTITUITI%) do (
  findstr /c:"> %%m" "%TEMP%\gs_market_list.txt" >nul && set "MERCATI=!MERCATI! %%m"
)
set "COPIE="
for %%n in (%NOME% %SOSTITUITI%) do (
  for %%d in ("%USERPROFILE%\.claude\mods\%%n" "%USERPROFILE%\.claude\skills\%%n") do (
    if exist "%%~d\.claude-plugin\plugin.json" set "COPIE=!COPIE! "%%~d""
  )
)

if defined VECCHIE (echo       plugin da togliere:!VECCHIE!) else (echo       nessun plugin da togliere)
if defined MERCATI (echo       marketplace da registrare di nuovo o togliere:!MERCATI!)
if defined COPIE (echo       copie manuali da spostare in backup:!COPIE!)

rem caricamenti da cartella che il mod non puo togliere da solo
set "AVVISO_DIRS=0"
if defined CLAUDE_CODE_PLUGIN_DIRS set "AVVISO_DIRS=1"
if exist "%USERPROFILE%\.claude\settings.json" (
  findstr /i /c:"CLAUDE_CODE_PLUGIN_DIRS" "%USERPROFILE%\.claude\settings.json" >nul && set "AVVISO_DIRS=1"
)
if "%AVVISO_DIRS%"=="1" (
  echo       [attenzione] CLAUDE_CODE_PLUGIN_DIRS e impostata: se punta a C:\Progetti\Mod o a controllo-contesto
  echo                    toglila da %USERPROFILE%\.claude\settings.json, altrimenti il vecchio mod si carica ancora.
)

echo.
echo   Verra fatto:
echo     - disinstallare le versioni precedenti di %NOME% e il mod %SOSTITUITI% (ora incluso qui)
echo     - registrare %RADICE% come marketplace %MARKET%
echo     - installare %NOME%@%MARKET% per il tuo utente
echo     - proporre superpowers e claude-mem, se mancano
echo   I piani nei progetti (.claude\sprint) e la cartella C:\Progetti\Mod non vengono toccati.
echo.
if "%SI%"=="0" (
  choice /c SN /n /m "  Procedo? [S/N] "
  if errorlevel 2 goto :annullato
)

rem ---- 3. rimozione ------------------------------------------
echo   3/6 rimuovo versioni precedenti e doppioni...
for %%p in (!VECCHIE!) do (
  call claude plugin uninstall %%p --keep-data >> "%LOG%" 2>&1
  if errorlevel 1 (echo       [avviso] non riesco a disinstallare %%p) else (echo       disinstallato %%p)
)
for %%m in (!MERCATI!) do (
  call claude plugin marketplace remove %%m >> "%LOG%" 2>&1 && echo       marketplace %%m rimosso
)
if defined COPIE (
  for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') do set "STAMP=%%t"
  set "BACKUP=%USERPROFILE%\.claude\backup-%NOME%\!STAMP!"
  mkdir "!BACKUP!" >nul 2>&1
  for %%c in (!COPIE!) do (
    move "%%~c" "!BACKUP!\" >> "%LOG%" 2>&1 && echo       spostato %%~c in !BACKUP!
  )
)
echo       ok

rem ---- 4. installazione --------------------------------------
echo   4/6 installo %NOME%...
call claude plugin marketplace add "%RADICE%" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   [errore] marketplace non registrato: vedi install.log
  goto :fine_errore
)
call claude plugin install %NOME%@%MARKET% >> "%LOG%" 2>&1
if errorlevel 1 (
  echo   [errore] installazione non riuscita: vedi install.log
  goto :fine_errore
)
call claude plugin list > "%TEMP%\gs_plugin_list.txt" 2>nul
findstr /r /c:"> %SOSTITUITI%@" "%TEMP%\gs_plugin_list.txt" >nul && echo       [attenzione] %SOSTITUITI% risulta ancora installato: toglilo con "claude plugin uninstall"
echo       ok

rem ---- 5. superpowers ----------------------------------------
echo   5/6 controllo superpowers (brainstorming)...
findstr /i "superpowers" "%TEMP%\gs_plugin_list.txt" >nul
if not errorlevel 1 (
  echo       gia installato
  goto :memoria
)
echo       superpowers non e installato: serve per il brainstorming di qualita.
set "SP=S"
if "%SI%"=="0" (
  choice /c SN /n /m "  Lo installo ora? [S/N] "
  if errorlevel 2 set "SP=N"
)
if /i "%SP%"=="S" (
  call claude plugin marketplace add obra/superpowers-marketplace >> "%LOG%" 2>&1
  call claude plugin install superpowers@superpowers-marketplace >> "%LOG%" 2>&1
  if errorlevel 1 (echo       [avviso] superpowers non installato: vedi install.log) else (echo       installato)
) else (
  echo       saltato: il mod usera il metodo integrato e te lo ricordera.
)

rem ---- 6. claude-mem ----------------------------------------
:memoria
echo   6/6 controllo claude-mem (memoria tra le sessioni)...
findstr /i "claude-mem" "%TEMP%\gs_plugin_list.txt" >nul
if not errorlevel 1 (
  echo       gia installato
  goto :fatto
)
echo       claude-mem non e installato: senza, ogni sessione riparte dai soli file.
rem serve Node 20 o superiore
set "NODEV="
for /f "tokens=1 delims=." %%v in ('node --version 2^>nul') do set "NODEV=%%v"
if not defined NODEV (
  echo       [avviso] Node.js non trovato: claude-mem richiede Node 20 o superiore.
  echo                installa Node da https://nodejs.org e rilancia install.bat.
  goto :fatto
)
set "NODEV=!NODEV:v=!"
if !NODEV! LSS 20 (
  echo       [avviso] Node !NODEV! troppo vecchio: claude-mem richiede Node 20 o superiore.
  goto :fatto
)
set "CM=S"
if "%SI%"=="0" (
  choice /c SN /n /m "  Lo installo ora? [S/N] "
  if errorlevel 2 set "CM=N"
)
if /i "%CM%"=="S" (
  call claude plugin marketplace add thedotmack/claude-mem >> "%LOG%" 2>&1
  call claude plugin install claude-mem@thedotmack >> "%LOG%" 2>&1
  if errorlevel 1 (echo       [avviso] claude-mem non installato: vedi install.log) else (echo       installato: apri una sessione nuova di Claude Code)
) else (
  echo       saltato: il mod lo proporra dal pannello.
)

:fatto
del "%TEMP%\gs_plugin_list.txt" "%TEMP%\gs_market_list.txt" >nul 2>&1
echo.
echo   Fatto. Apri Claude Code nella cartella del progetto:
echo     sopra il prompt trovi la banda del mod con il pulsante  ^> Crea il piano
echo     poi segui il pulsante: ti dice sempre la prossima cosa da fare.
echo   Se Claude Code era aperto: /reload-plugins
echo.
echo [%date% %time%] completato >> "%LOG%"
endlocal
exit /b 0

:annullato
echo   Annullato: nessuna modifica fatta.
endlocal
exit /b 0

:fine_errore
echo.
echo   Installazione interrotta. Nessun passo successivo eseguito.
echo [%date% %time%] interrotto >> "%LOG%"
endlocal
exit /b 1
