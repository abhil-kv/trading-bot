#!/bin/bash

echo "Stopping Trading Bot services..."

# Stop client (port 5173 - Vite default)
echo "Stopping client on port 5173..."
lsof -ti:5173 | xargs kill -9 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Client stopped"
else
    echo "✓ Client not running or already stopped"
fi

# Stop server (port 4000)
echo "Stopping server on port 4000..."
lsof -ti:4000 | xargs kill -9 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✓ Server stopped"
else
    echo "✓ Server not running or already stopped"
fi

echo ""
echo "All services stopped successfully!"

# Made with Bob
