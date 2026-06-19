@echo off
title Diagnostics
echo.
echo Running diagnostics, please wait...
echo.
(
echo [1] Node.js version:
node --version 2>&1
echo.
echo [2] npm version:
npm --version 2>&1
echo.
echo [3] Folder check:
if exist "node_modules" (echo root: OK) else (echo root: MISSING)
if exist "backend\node_modules" (echo backend: OK) else (echo backend: MISSING)
if exist "frontend\node_modules" (echo frontend: OK) else (echo frontend: MISSING)
echo.
echo [4] Server test (3 sec):
node -e "setTimeout(function(){process.exit(0)},3000);require('./backend/server.js');" 2>&1
) > result.txt 2>&1
echo.
echo Done! Open result.txt to see results.
echo (the file is in this folder)
echo.
pause