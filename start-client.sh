#!/bin/bash

# Trading Bot - React Client Startup Script
# Run this from the project root directory

set -e

echo "🚀 Starting React Trading Bot Client..."
echo ""

# Navigate to client directory
cd client

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed"
    echo ""
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✅ Created .env file"
    echo ""
fi

# Start the development server
echo "🌟 Starting React development server..."
echo "🌐 Client: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

npm run dev

# Made with Bob
