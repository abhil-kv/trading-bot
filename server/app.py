"""
Trading Bot API Server - Python/FastAPI Implementation
Main application entry point with routes, WebSocket, and middleware
"""
import os
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

from config import settings
from routes import auth_routes, market_routes, news_routes, strategy_routes
from services.websocket_service import WebSocketService
from middleware.require_auth import get_current_session

# Initialize FastAPI app
app = FastAPI(title="Trading Bot API", version="0.1.0")

# CORS Configuration
# In development mode, allow all origins for easier testing
if settings.is_development:
    allowed_origins = ["*"]
else:
    allowed_origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        settings.CLIENT_ORIGIN
    ]
    allowed_origins = [origin for origin in allowed_origins if origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
    expose_headers=["*"],  # Expose all headers
)

# Session middleware for authentication
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET,
    session_cookie="connect.sid",
    max_age=12 * 60 * 60,  # 12 hours
    same_site="lax",
    https_only=settings.COOKIE_SECURE,
)

# WebSocket connections storage
ws_connections: Dict[WebSocket, dict] = {}
ws_service = WebSocketService(ws_connections)

# Health check endpoint
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Include routers
app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(market_routes.router, prefix="/api/market", tags=["market"])
app.include_router(news_routes.router, prefix="/api/news", tags=["news"])
app.include_router(strategy_routes.router, prefix="/api/strategies", tags=["strategies"])

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket client connected")
    
    # Get session from cookies
    session_cookie = websocket.cookies.get("connect.sid")
    
    if not session_cookie:
        print("No session cookie found")
        await websocket.send_json({
            "type": "connected",
            "authenticated": False,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        })
        await websocket.close()
        return
    
    # Parse session (simplified - in production use proper session parsing)
    session_data = websocket.session if hasattr(websocket, 'session') else None
    
    # Store connection
    ws_connections[websocket] = {
        "session_id": session_cookie,
        "session": session_data,
        "authenticated": bool(session_data and session_data.get("angel"))
    }
    
    print(f"Authenticated WebSocket connection. Total connections: {len(ws_connections)}")
    
    # Start broadcasting if this is the first connection
    if len(ws_connections) == 1:
        asyncio.create_task(ws_service.start_broadcasting(3000))
    
    # Send initial connection message
    await websocket.send_json({
        "type": "connected",
        "authenticated": ws_connections[websocket]["authenticated"],
        "timestamp": datetime.utcnow().isoformat() + "Z"
    })
    
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_json()
            print(f"Received message: {data}")
            
            # Handle ping/pong
            if data.get("type") == "ping":
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat() + "Z"
                })
    
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
        ws_connections.pop(websocket, None)
        
        # Stop broadcasting if no more connections
        if len(ws_connections) == 0:
            ws_service.stop_broadcasting()
    
    except Exception as e:
        print(f"WebSocket error: {e}")
        ws_connections.pop(websocket, None)
        
        if len(ws_connections) == 0:
            ws_service.stop_broadcasting()

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unexpected error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "message": "Unexpected server error"}
    )

if __name__ == "__main__":
    print(f"Trading bot API listening on http://localhost:{settings.PORT}")
    print(f"WebSocket server available at ws://localhost:{settings.PORT}/ws")
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=True,
        log_level="info"
    )

# Made with Bob
