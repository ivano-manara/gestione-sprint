@echo off
rem Disegna banda e pannello con dati di esempio: anteprima.html e immagini in img\.
rem Richiede: claude, python; per le immagini anche node con playwright.
setlocal
set "QUI=%~dp0"
set "MOD=%QUI%..\..\gestione-sprint"
copy /y "%QUI%anteprima.test.tsx" "%MOD%\hooks\zz_anteprima.test.tsx" >nul
pushd "%MOD%"
claude plugin test . 2>&1 | findstr /b "@@" > "%QUI%disegni.txt"
popd
del "%MOD%\hooks\zz_anteprima.test.tsx"
python "%QUI%render.py" "%QUI%disegni.txt" "%QUI%anteprima.html"
where node >nul 2>&1 && (mkdir "%QUI%img" 2>nul & node "%QUI%foto.js" "%QUI%anteprima.html" "%QUI%img")
