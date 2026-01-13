# Backend Run Script for Windows PowerShell

Write-Host "Starting OSUCSC Backend Server..." -ForegroundColor Green

# Check if virtual environment exists
if (-not (Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\venv\Scripts\Activate.ps1

# Check if requirements are installed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt --quiet

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "WARNING: .env file not found! Please create it with database credentials." -ForegroundColor Red
    Write-Host "See DATABASE_CONFIG.md for details." -ForegroundColor Yellow
    exit 1
}

# Run the server
Write-Host "Starting FastAPI server on http://localhost:8000" -ForegroundColor Green
Write-Host "Press CTRL+C to stop the server" -ForegroundColor Yellow
Write-Host ""

uvicorn main:app --reload --host 0.0.0.0 --port 8000

