@echo off
cd /d "%~dp0"
echo Uruchamianie Ulf-cRPG-Engine...
echo Przegladarka otworzy sie automatycznie pod adresem http://localhost:5173
echo Nie zamykaj tego okna podczas dzialania gry.
echo.
call npm run dev -- --open
if errorlevel 1 (
    echo.
    echo Wystapil blad podczas uruchamiania. Sprawdz czy Node.js i zaleznosci npm sa zainstalowane.
    pause
)
