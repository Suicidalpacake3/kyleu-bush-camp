@echo off
title Kyleu website preview
cd /d "%~dp0"
echo.
echo  Starting the Kyleu website preview...
echo  Your browser will open at http://localhost:8090
echo  Keep this window open while you look around. Close it to stop.
echo.
start "" http://localhost:8090
where py >nul 2>nul && (py -m http.server 8090 & goto :eof)
where python >nul 2>nul && (python -m http.server 8090 & goto :eof)
where npx >nul 2>nul && (npx --yes serve -l 8090 . & goto :eof)
echo  Could not find Python or Node.js. Install Python from https://www.python.org and try again.
pause
