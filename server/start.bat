@echo off
REM Trading Bot Python Server Startup Script for Windows

echo 🚀 Starting Trading Bot Python Server...

REM Check if virtual environment exists
if not exist "venv" (
    echo 📦 Virtual environment not found. Creating...
    python -m venv venv
    echo ✅ Virtual environment created
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if dependencies are installed
if not exist "venv\Scripts\uvicorn.exe" (
    echo 📦 Installing dependencies...
    pip install -r requirements.txt
    echo ✅ Dependencies installed
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  .env file not found. Copying from .env.example...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your credentials
)

REM Start the server
echo 🌟 Starting FastAPI server on port 4000...
python app.py

@REM Made with Bob
