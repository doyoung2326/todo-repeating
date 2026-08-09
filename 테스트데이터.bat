@echo off
title Study Todo App - Test Data
cd /d "%~dp0"
echo.
echo ====================================
echo   Test Data (Seed)
echo ====================================
echo.
echo   Puts fake data into a TEST-ONLY account
echo   so you can check time-based features
echo   without waiting for days to pass.
echo.
echo   Your real account is NOT touched.
echo.
echo ------------------------------------
echo   1. Insert test data
echo   2. Remove test data
echo ------------------------------------
echo.
set /p choice="Select (1 or 2): "

if "%choice%"=="1" goto seed
if "%choice%"=="2" goto clean

echo.
echo Invalid choice. Please run again and type 1 or 2.
echo.
pause
exit /b 1

:seed
echo.
call npm --prefix backend run seed
if %errorlevel% neq 0 goto failed
echo.
echo ------------------------------------------------
echo  >>> Open http://localhost:5173
echo  >>> Log OUT of your own account first,
echo      then log in with the account shown above.
echo ------------------------------------------------
goto done

:clean
echo.
call npm --prefix backend run seed -- --clean
if %errorlevel% neq 0 goto failed
echo.
echo Test data removed.
goto done

:failed
echo.
echo Something went wrong. Check the message above.
echo (Is the database reachable? See backend\.env)
echo.
pause
exit /b 1

:done
echo.
pause
