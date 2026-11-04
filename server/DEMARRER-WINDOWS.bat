@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js n'est pas installe. Installez la version LTS depuis https://nodejs.org
  echo puis fermez cette fenetre et double-cliquez a nouveau sur DEMARRER-WINDOWS.bat.
  start https://nodejs.org
  pause
  exit /b 1
)
node start.mjs
echo.
echo Le serveur Luma est arrete. Luma ne pourra plus lire avec ElevenLabs.
pause
