@echo off
title Cleanup
echo Removing old installation folders...
if exist "node_modules" rmdir /s /q node_modules
if exist "backend\node_modules" rmdir /s /q backend\node_modules
if exist "frontend\node_modules" rmdir /s /q frontend\node_modules
if exist "backend\todos.db" del backend\todos.db
echo Done! Now run startup.bat to reinstall cleanly.
pause