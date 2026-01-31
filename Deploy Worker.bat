@echo off
setlocal
pushd "%~dp0workers\dmz-media-api"
echo Deploying DMZ Media API Worker...
call npx wrangler deploy
popd
endlocal
