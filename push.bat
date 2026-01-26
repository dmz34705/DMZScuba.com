@echo off
setlocal EnableExtensions

REM ============================
REM DMZScuba GitHub Push Script
REM ============================

cd /d "%~dp0"

echo.
echo === DMZScuba Git Push ===
echo Current folder: %cd%
echo.

REM Confirm this is a git repo
if not exist ".git" goto not_repo

REM Show changes
echo --- Git status ---
git status
echo.

REM Add all changes
echo --- Adding changes ---
git add -A
if errorlevel 1 goto add_failed

REM Ask for commit message
set "msg="
set /p "msg=Commit message (leave blank for timestamp): "
if "%msg%"=="" goto set_default_msg
goto have_msg

:set_default_msg
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set "ts=%%i"
set "msg=Update %ts%"

:have_msg

REM Commit
echo --- Committing ---
git commit -m "%msg%"
if errorlevel 1 goto commit_note

REM Push
echo --- Pushing to GitHub ---
git push
if errorlevel 1 goto push_failed

echo.
echo Push complete.
pause
exit /b 0

:not_repo
echo ERROR: This folder is not a git repository (.git not found).
pause
exit /b 1

:add_failed
echo ERROR: git add failed.
pause
exit /b 1

:commit_note
echo NOTE: Nothing new to commit (or commit failed).
goto push_step

:push_step
echo --- Pushing to GitHub ---
git push
if errorlevel 1 goto push_failed
echo.
echo Push complete.
pause
exit /b 0

:push_failed
echo ERROR: Push failed. (Possibly auth issue or remote mismatch.)
pause
exit /b 1
