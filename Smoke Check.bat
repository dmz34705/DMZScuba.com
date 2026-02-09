@echo off
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  set "BASE=https://dmzscuba-com.pages.dev"
) else (
  set "BASE=%~1"
)

echo Running smoke checks against %BASE%
node scripts\smoke-check.mjs --base "%BASE%"
set "CODE=%ERRORLEVEL%"

if not "%CODE%"=="0" (
  echo.
  echo Smoke checks failed.
  exit /b %CODE%
)

echo.
echo Smoke checks passed.
exit /b 0
