@echo off
:: Navigate to the folder where this script is located
cd /d "%~dp0"

:: Activate the virtual environment
:: Note: Windows uses 'Scripts', not 'bin'
call venv\Scripts\activate

:: Run the python script
python -u "bridge.py"

:: Pause at the end so the window doesn't close immediately on error
pause