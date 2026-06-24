"""
WebSocket Service
Handles broadcasting market data to connected WebSocket clients
"""
import asyncio
from typing import Dict
from datetime import datetime
from fastapi import WebSocket

from services.market_data_service import market_data_service


class WebSocketService:
    """Service for managing WebSocket connections and broadcasting"""
    
    def __init__(self, connections: Dict[WebSocket, dict]):
        """
        Initialize WebSocket service.
        
        Args:
            connections: Dictionary mapping WebSocket to connection info
        """
        self.connections = connections
        self.broadcast_task: asyncio.Task = None
        self.is_running = False
        self.interval_ms = 3000
    
    async def start_broadcasting(self, interval_ms: int = 3000):
        """
        Start broadcasting market data to all connected clients.
        
        Args:
            interval_ms: Interval in milliseconds between broadcasts
        """
        if self.is_running:
            print("WebSocket broadcasting already running")
            return
        
        self.is_running = True
        self.interval_ms = interval_ms
        print(f"Starting WebSocket broadcast every {interval_ms}ms")
        
        # Start the broadcast loop
        self.broadcast_task = asyncio.create_task(self._broadcast_loop())
    
    def stop_broadcasting(self):
        """Stop broadcasting market data"""
        if self.broadcast_task and not self.broadcast_task.done():
            self.broadcast_task.cancel()
            self.is_running = False
            print("WebSocket broadcasting stopped")
    
    async def _broadcast_loop(self):
        """Internal loop for broadcasting market data"""
        try:
            while self.is_running:
                await self.broadcast_market_data()
                await asyncio.sleep(self.interval_ms / 1000.0)
        except asyncio.CancelledError:
            print("Broadcast loop cancelled")
        except Exception as e:
            print(f"Error in broadcast loop: {e}")
            self.is_running = False
    
    async def broadcast_market_data(self):
        """Broadcast market data to all connected and authenticated clients"""
        if not self.connections:
            return
        
        clients_to_remove = []
        
        for ws, conn_info in list(self.connections.items()):
            # Check if client is authenticated
            session = conn_info.get("session")
            if not session or not session.get("angel"):
                continue
            
            try:
                # Fetch fresh market data using the client's session
                data = await market_data_service.get_nifty50_quotes(session["angel"])
                
                # Send data if connection is open
                if ws.client_state.name == "CONNECTED":
                    await ws.send_json({
                        "type": "market_update",
                        "data": {
                            "stocks": data["stocks"],
                            "asOf": data["asOf"],
                            "unresolvedSymbols": data.get("unresolvedSymbols", []),
                            "unfetched": data.get("unfetched", []),
                        },
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                    })
                else:
                    clients_to_remove.append(ws)
            
            except Exception as error:
                print(f"Error fetching market data for WebSocket client: {error}")
                
                # Send error to client if connection is still open
                try:
                    if ws.client_state.name == "CONNECTED":
                        await ws.send_json({
                            "type": "error",
                            "message": "Failed to fetch market data",
                            "timestamp": datetime.utcnow().isoformat() + "Z",
                        })
                except Exception:
                    clients_to_remove.append(ws)
        
        # Clean up closed connections
        for ws in clients_to_remove:
            self.connections.pop(ws, None)
    
    async def send_to_client(self, ws: WebSocket, msg_type: str, data: dict):
        """
        Send a message to a specific client.
        
        Args:
            ws: WebSocket connection
            msg_type: Message type
            data: Message data
        """
        if ws.client_state.name == "CONNECTED":
            await ws.send_json({
                "type": msg_type,
                "data": data,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
    
    async def broadcast(self, msg_type: str, data: dict):
        """
        Broadcast a message to all connected clients.
        
        Args:
            msg_type: Message type
            data: Message data
        """
        message = {
            "type": msg_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        
        for ws in list(self.connections.keys()):
            try:
                if ws.client_state.name == "CONNECTED":
                    await ws.send_json(message)
            except Exception:
                pass
    
    def get_connection_count(self) -> int:
        """Get the number of active connections"""
        return len(self.connections)

# Made with Bob
