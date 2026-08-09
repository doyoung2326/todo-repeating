@echo off
title Study Todo App - Stop
cd /d "%~dp0"
echo.
echo ====================================
echo   Study Todo App - Stop
echo ====================================
echo.
echo Closing the app window with [X] can leave
echo background processes holding the ports.
echo The next startup then fails with EADDRINUSE
echo and the app never comes up.
echo.
echo This cleans them up.
echo.

set found=0
for %%p in (3001 5173 5174 5175) do call :killport %%p

if "%found%"=="0" (
    echo Nothing was running. Ports are already free.
) else (
    echo.
    echo Done. You can start the app again now.
)
echo.
pause
exit /b 0

:killport
rem A port can appear twice (IPv4 and IPv6). Only report the kill that actually did something.
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%1 " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1 && echo   port %1 - stopped PID %%a && set found=1
)
exit /b 0
