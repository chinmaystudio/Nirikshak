@echo off
title Push Changes to GitHub
cd /d "%~dp0"
echo ===================================================
echo       Sync and Push Changes to GitHub
echo ===================================================
echo.
set /p commit_msg="Enter commit message (or press ENTER for default 'Update landing page and assets'): "
if "%commit_msg%"=="" set commit_msg=Update landing page and assets

echo.
echo [1/3] Staging all modified and new files...
git add .

echo.
echo [2/3] Committing changes with message: "%commit_msg%"
git commit -m "%commit_msg%"

echo.
echo [3/3] Pushing commits to GitHub (main branch)...
git push origin main

echo.
echo ===================================================
echo   Sync Complete! Check your repo on GitHub:
echo   https://github.com/Neeraj-Bhosale/Pragati
echo ===================================================
echo.
pause
