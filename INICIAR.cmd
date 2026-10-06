@echo off
setlocal
title Virtual Lab Center

rem Ojo: "%~dp0" termina en barra invertida, así que "ruta\" rompe el cmd.
rem El punto final lo evita; pushd además tolera rutas con espacios.
pushd "%~dp0."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se encontro Node.js en este equipo.
  echo   Descargalo de https://nodejs.org y ejecuta este archivo otra vez.
  echo.
  pause
  exit /b 1
)

echo.
echo   Iniciando Virtual Lab Center...
echo   El navegador se abrira solo en http://localhost:5173
echo   Para detener el servidor: Ctrl+C
echo.

node server.js --open

endlocal
