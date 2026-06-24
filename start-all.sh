#!/bin/bash

# Trading Bot - Start Both Python Server and React Client
# Run this from the project root directory

echo "🚀 Starting Trading Bot (Python Server + React Client)..."
echo ""

# Check if Python 3.12 or 3.11 is available
if command -v python3.12 &> /dev/null; then
    echo "✅ Python 3.12 found"
elif command -v python3.11 &> /dev/null; then
    echo "✅ Python 3.11 found"
else
    echo "⚠️  Python 3.11 or 3.12 not found"
    echo "⚠️  Install with: brew install python@3.12"
    echo ""
fi

# Make scripts executable
chmod +x start-server.sh
chmod +x start-client.sh

echo "📋 Starting servers in separate terminal windows..."
echo ""
echo "Terminal 1: Python Server (port 4000)"
echo "Terminal 2: React Client (port 5173)"
echo ""
echo "To stop: Press Ctrl+C in each terminal"
echo ""

# Open Python server in new terminal
osascript -e 'tell application "Terminal" to do script "cd \"'"$(pwd)"'\" && ./start-server.sh"'

# Wait a moment for server to start
sleep 2

# Open React client in new terminal
osascript -e 'tell application "Terminal" to do script "cd \"'"$(pwd)"'\" && ./start-client.sh"'

echo "✅ Servers starting in new terminal windows"
echo ""
echo "Access the application:"
echo "  🌐 Frontend: http://localhost:5173"
echo "  📊 API Docs: http://localhost:4000/docs"
echo "  🔌 WebSocket: ws://localhost:4000/ws"
echo ""

# Made with Bob
