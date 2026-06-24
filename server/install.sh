#!/bin/bash

# Trading Bot Python Server Installation Script

set -e  # Exit on error

echo "🚀 Installing Trading Bot Python Server..."
echo ""

# Check Python version
echo "📋 Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed!"
    echo "Please install Python 3.9+ from:"
    echo "  - macOS: brew install python3"
    echo "  - Linux: sudo apt install python3 python3-pip python3-venv"
    echo "  - Windows: https://www.python.org/downloads/"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "✅ Found Python $PYTHON_VERSION"
echo ""

# Create virtual environment
echo "📦 Creating virtual environment..."
if [ -d "venv" ]; then
    echo "⚠️  Virtual environment already exists. Removing..."
    rm -rf venv
fi

python3 -m venv venv
echo "✅ Virtual environment created"
echo ""

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate
echo "✅ Virtual environment activated"
echo ""

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip setuptools wheel
echo "✅ pip upgraded"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
echo "This may take a few minutes..."
pip install -r requirements.txt
echo "✅ Dependencies installed"
echo ""

# Copy environment file if needed
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    if [ -f "../server/.env" ]; then
        cp ../server/.env .env
        echo "✅ Copied .env from Node.js server"
    else
        cp .env.example .env
        echo "✅ Created .env from template"
        echo "⚠️  Please edit .env with your credentials"
    fi
else
    echo "✅ .env file already exists"
fi
echo ""

# Verify installation
echo "🔍 Verifying installation..."
python3 -c "import fastapi, uvicorn, httpx, pyotp; print('✅ All core packages installed successfully')"
echo ""

echo "🎉 Installation complete!"
echo ""
echo "To start the server:"
echo "  1. Activate virtual environment: source venv/bin/activate"
echo "  2. Run server: python3 app.py"
echo ""
echo "Or simply run: ./start.sh"
echo ""

# Made with Bob
