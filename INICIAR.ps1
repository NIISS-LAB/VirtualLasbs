# Inicia Virtual Lab Center (PowerShell)
# Doble clic no ejecuta .ps1 por defecto: clic derecho > "Ejecutar con PowerShell"
# o, desde esta terminal:  powershell -ExecutionPolicy Bypass -File .\INICIAR.ps1

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host ''
  Write-Host '  No se encontro Node.js en este equipo.' -ForegroundColor Yellow
  Write-Host '  Descargalo de https://nodejs.org y ejecuta este archivo otra vez.' -ForegroundColor Yellow
  Write-Host ''
  Read-Host 'Pulsa Enter para salir'
  exit 1
}

Write-Host ''
Write-Host '  Iniciando Virtual Lab Center...' -ForegroundColor Cyan
Write-Host '  Se abrira el navegador en http://localhost:5173'
Write-Host '  Para detener el servidor: Ctrl+C'
Write-Host ''

Start-Process 'http://localhost:5173'
node server.js --open
