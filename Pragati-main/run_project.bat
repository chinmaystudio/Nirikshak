@echo off
title Start PRAGATI App
cd /d "%~dp0"
echo ===================================================
echo   Starting PRAGATI Project Intelligence Platform
echo ===================================================
echo Opening browser at http://localhost:5173 ...
start "" http://localhost:5173
echo Starting development server...
npm run dev
pause
