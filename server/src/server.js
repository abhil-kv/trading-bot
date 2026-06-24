const express = require('express');
const cors = require('cors');
const session = require('express-session');
const http = require('http');
const { WebSocketServer } = require('ws');
const cookie = require('cookie');
const config = require('./config');
const authRoutes = require('./routes/auth.routes');
const marketRoutes = require('./routes/market.routes');
const newsRoutes = require('./routes/news.routes');

const app = express();
const server = http.createServer(app);

app.use(express.json());

const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174', config.clientOrigin].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, origin || true);
      }

      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);

app.options('*', cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, origin || true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}));

const sessionMiddleware = session({
  name: 'connect.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000, // Angel One sessions die at midnight anyway
  },
});

app.use(sessionMiddleware);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/news', newsRoutes);

// Centralized error handler as a last resort
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Unexpected server error' });
});

// WebSocket server setup
const wss = new WebSocketServer({ server, path: '/ws' });
const WebSocketService = require('./services/websocket.service');

// Store active connections with their session info
const connections = new Map();
const wsService = new WebSocketService(wss, connections);

wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');
  
  // Parse cookies from the request
  const cookies = cookie.parse(req.headers.cookie || '');
  const sessionId = cookies['connect.sid'];
  
  if (!sessionId) {
    console.log('No session cookie found');
    ws.send(JSON.stringify({ type: 'connected', authenticated: false, timestamp: new Date().toISOString() }));
    return;
  }

  // Create a proper request/response object for session middleware
  const fakeReq = {
    url: '/ws',
    method: 'GET',
    originalUrl: '/ws',
    headers: req.headers || {},
    connection: req.connection || req.socket,
  };
  
  const fakeRes = {
    getHeader: () => {},
    setHeader: () => {},
    end: () => {}
  };
  
  // Parse session from cookie
  sessionMiddleware(fakeReq, fakeRes, () => {
    if (fakeReq.session && fakeReq.session.angel) {
      connections.set(ws, { sessionId: fakeReq.session.id, session: fakeReq.session });
      console.log(`Authenticated WebSocket connection. Total connections: ${connections.size}`);
      
      // Start broadcasting if this is the first connection
      if (connections.size === 1) {
        wsService.startBroadcasting(3000); // Broadcast every 3 seconds
      }
      
      // Send initial connection success message
      ws.send(JSON.stringify({ type: 'connected', authenticated: true, timestamp: new Date().toISOString() }));
    } else {
      console.log('Unauthenticated WebSocket connection attempt - no angel session');
      ws.send(JSON.stringify({ type: 'connected', authenticated: false, timestamp: new Date().toISOString() }));
    }
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      // Handle ping/pong for connection health check
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch (err) {
      console.error('Invalid WebSocket message:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    connections.delete(ws);
    
    // Stop broadcasting if no more connections
    if (connections.size === 0) {
      wsService.stopBroadcasting();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connections.delete(ws);
    
    // Stop broadcasting if no more connections
    if (connections.size === 0) {
      wsService.stopBroadcasting();
    }
  });
});

server.listen(config.port, () => {
  console.log(`Trading bot API listening on http://localhost:${config.port}`);
  console.log(`WebSocket server available at ws://localhost:${config.port}/ws`);
});

// Export for use in other modules
module.exports = { wss, connections, wsService };
