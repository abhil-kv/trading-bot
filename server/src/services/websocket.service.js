const { getNifty50Quotes } = require('./marketData.service');

class WebSocketService {
  constructor(wss, connections) {
    this.wss = wss;
    this.connections = connections;
    this.broadcastInterval = null;
    this.isRunning = false;
  }

  /**
   * Start broadcasting market data to all connected clients
   * @param {number} intervalMs - Interval in milliseconds (default: 3000ms = 3 seconds)
   */
  startBroadcasting(intervalMs = 3000) {
    if (this.isRunning) {
      console.log('WebSocket broadcasting already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting WebSocket broadcast every ${intervalMs}ms`);

    // Broadcast immediately on start
    this.broadcastMarketData();

    // Then broadcast at intervals
    this.broadcastInterval = setInterval(() => {
      this.broadcastMarketData();
    }, intervalMs);
  }

  /**
   * Stop broadcasting market data
   */
  stopBroadcasting() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
      this.isRunning = false;
      console.log('WebSocket broadcasting stopped');
    }
  }

  /**
   * Broadcast market data to all connected and authenticated clients
   */
  async broadcastMarketData() {
    if (this.connections.size === 0) {
      return; // No clients connected
    }

    const clientsToRemove = [];

    for (const [ws, connInfo] of this.connections.entries()) {
      // Check if client is authenticated
      if (!connInfo.session || !connInfo.session.angel) {
        continue;
      }

      try {
        // Fetch fresh market data using the client's session
        const data = await getNifty50Quotes(connInfo.session.angel);
        
        // Send data if connection is open
        if (ws.readyState === 1) { // 1 = OPEN
          ws.send(JSON.stringify({
            type: 'market_update',
            data: {
              stocks: data.stocks,
              asOf: data.asOf,
              unresolvedSymbols: data.unresolvedSymbols,
              unfetched: data.unfetched,
            },
            timestamp: new Date().toISOString(),
          }));
        } else {
          clientsToRemove.push(ws);
        }
      } catch (error) {
        console.error('Error fetching market data for WebSocket client:', error.message);
        
        // Send error to client if connection is still open
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to fetch market data',
            timestamp: new Date().toISOString(),
          }));
        }
      }
    }

    // Clean up closed connections
    clientsToRemove.forEach(ws => {
      this.connections.delete(ws);
    });
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(ws, type, data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString(),
      }));
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(type, data) {
    const message = JSON.stringify({
      type,
      data,
      timestamp: new Date().toISOString(),
    });

    this.wss.clients.forEach(client => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }

  /**
   * Get the number of active connections
   */
  getConnectionCount() {
    return this.connections.size;
  }
}

module.exports = WebSocketService;

// Made with Bob
