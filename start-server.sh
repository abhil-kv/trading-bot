#!/bin/bash

# Trading Bot - Python Server Startup Script
# Run this from the project root directory

set -e

echo "🚀 Starting Python Trading Bot Server..."
echo ""

# Navigate to Python server directory
cd server

# Check if Python 3.12 is available
if command -v python3.12 &> /dev/null; then
    PYTHON_CMD="python3.12"
    echo "✅ Using Python 3.12"
elif command -v python3.11 &> /dev/null; then
    PYTHON_CMD="python3.11"
    echo "✅ Using Python 3.11"
elif command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    if [[ "$PYTHON_VERSION" == "3.14" ]] || [[ "$PYTHON_VERSION" == "3.13" ]]; then
        echo "⚠️  Warning: Python $PYTHON_VERSION detected"
        echo "⚠️  Python 3.11 or 3.12 is recommended"
        echo "⚠️  Install with: brew install python@3.12"
        echo ""
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    PYTHON_CMD="python3"
    echo "✅ Using Python 3"
else
    echo "❌ Python 3 not found!"
    echo "Install with: brew install python@3.12"
    exit 1
fi

echo ""

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment with $PYTHON_CMD..."
    $PYTHON_CMD -m venv venv
    
    # Activate virtual environment
    echo "🔧 Activating virtual environment..."
    source venv/bin/activate
    
    # Upgrade pip
    echo "⬆️  Upgrading pip..."
    pip install --upgrade pip --quiet
    
    # Install dependencies
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt --quiet
    
    echo "✅ Dependencies installed"
else
    # Activate existing virtual environment
    echo "🔧 Activating virtual environment..."
    source venv/bin/activate
fi

echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your credentials"
    echo ""
fi

# Start the server
echo "🌟 Starting FastAPI server on port 4000..."
echo "📊 API Documentation: http://localhost:4000/docs"
echo "🔌 WebSocket: ws://localhost:4000/ws"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python app.py

# Made with Bob