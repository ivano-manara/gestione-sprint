@echo off
rem ==========================================================
rem  gestione-sprint - disinstallazione
rem  uso: uninstall.bat      (chiede conferma)
rem       uninstall.bat /y   (senza conferma)
rem  I piani nei progetti (.claude\sprint) restano.
rem  Il modulo contesto (ex controllo-contesto) e incluso: si toglie insieme.
rem ==========================================================
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "RADICE=%~dp0"
if "%RADICE:~-1%"=="\" set "RADICE=%RADICE:~0,-1%"
set "MARKET=mod-progetti"
set "NOME=gestione-sprint"
set "LOG=%RADICE%\uninstall.log"
set "SI=0"
if /i "%~1"=="/y" set "SI=1"

where claude >nul 2>&1
if errorlevel 1 (
  echo   [errore] comando "claude" non trovato nel PATH.
  exit /b 1
)

set "VECCHIE="
for /f "tokens=2" %%a in ('call claude plugin list 2^>nul ^| findstr /r /c:"> %NOME%@"') do set "VECCHIE=!VECCHIE! %%a"
if not defined VECCHIE (
  echo   %NOME% non risulta installato.
) else (
  echo   Da disinstallare:!VECCHIE!
)
echo   Il marketplace %MARKET% verra rimosso. Superpowers e i tuoi piani restano.
if "%SI%"=="0" (
  choice /c SN /n /m "  Procedo? [S/N] "
  if errorlevel 2 (
    echo   Annullato.
    exit /b 0
  )
)
echo [%date% %time%] disinstallazione > "%LOG%"
for %%p in (!VECCHIE!) do (
  call claude plugin uninstall %%p >> "%LOG%" 2>&1
  if errorlevel 1 (echo   [avviso] non riesco a disinstallare %%p) else (echo   disinstallato %%p)
)
call claude plugin marketplace list 2>nul | findstr /c:"> %MARKET%" >nul && (
  call claude plugin marketplace remove %MARKET% >> "%LOG%" 2>&1
  echo   marketplace %MARKET% rimosso
)
echo   Fatto. In Claude Code aperto: /reload-plugins
endlocal
exit /b 0
