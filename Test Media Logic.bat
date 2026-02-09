@echo off
setlocal
cd /d "%~dp0"
node tests\media-logic.test.cjs
exit /b %ERRORLEVEL%
