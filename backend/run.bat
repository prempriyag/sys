@echo off
echo Starting OSUCSC Backend Server...

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install/update dependencies
echo Checking dependencies...
pip install -r requirements.txt --quiet

REM Check if .env exists
if not exist ".env" (
    echo WARNING: .env file not found! Please create it with database credentials.
    echo See DATABASE_CONFIG.md for details.
    pause
    exit /b 1
)

REM Clear Python cache for better auto-reload
echo Clearing Python cache for better auto-reload...
for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d" 2>nul
for /r . %%f in (*.pyc) do @if exist "%%f" del /q "%%f" 2>nul

REM Run the server
echo Starting FastAPI server on http://localhost:8001
echo Auto-reload enabled - changes will reflect automatically
echo Press CTRL+C to stop the server
echo When you press CTRL+C, a KeyboardInterrupt/CancelledError traceback may appear - this is normal shutdown.
echo.

REM Use --reload to watch for file changes
REM Uvicorn will automatically restart when .env or .py files change
REM Note: For .env changes, you may need to save the file twice or wait a moment
REM If you see "executor did not finish joining within 300 seconds": a long OCR/extraction
REM was running when the server reloaded (e.g. after saving a file). Wait for the request
REM to finish before saving, or run without --reload when testing long PDF jobs.
uvicorn main:app --reload --reload-dir . --host 0.0.0.0 --port 8000

pause

