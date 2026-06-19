@echo off
title Study Todo App
echo.
echo ====================================
echo   Study Todo App - Starting Up
echo ====================================
echo.
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please go to https://nodejs.org and install the LTS version.
    echo After installation, run this file again.
    echo.
    pause
    exit /b 1
)
echo Node.js found:
node --version
echo.
if not exist "node_modules" (
    echo Installing root packages...
    call npm install
    echo.
)
if not exist "backend\node_modules" (
    echo Installing backend packages...
    cd backend
    call npm install
    cd ..
    echo.
)
if not exist "frontend\node_modules" (
    echo Installing frontend packages...
    cd frontend
    call npm install
    cd ..
    echo.
)
echo.
echo Starting servers...
echo.
echo  >>> Open your browser at: http://localhost:5173
echo  >>> Do NOT close this window while using the app!
echo ------------------------------------------------
echo.
call npm start
echo.
echo App has stopped.
pause