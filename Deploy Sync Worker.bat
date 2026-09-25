@echo off
setlocal
pushd "%~dp0workers\dmz-account-sync"
echo Deploying DMZ Account Sync Worker (dmz-account-sync-dev)...
call npx wrangler deploy
popd
pause
endlocal
