@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  node iniciar.mjs
  if errorlevel 1 pause
  exit /b
)
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" iniciar.mjs
  if errorlevel 1 pause
  exit /b
)
echo Node.js nao encontrado. Instale Node.js conforme LEIA-ME-OUTRO-PC.md e tente novamente.
pause
