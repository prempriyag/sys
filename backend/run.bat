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

REM Run the server
echo Starting FastAPI server on http://localhost:8000
echo Press CTRL+C to stop the server
echo.

uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause

