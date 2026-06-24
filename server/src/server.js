const express = require('express');
const cors = require('cors');
const session = require('express-session');
const config = require('./config');
const authRoutes = require('./routes/auth.routes');
const marketRoutes = require('./routes/market.routes');

const app = express();

app.use(express.json());

const allowedOrigins = ['http://localhost:5173', config.clientOrigin].filter(Boolean);

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

app.use(
  session({
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
  })
);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);

// Centralized error handler as a last resort
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: 'Unexpected server error' });
});

app.listen(config.port, () => {
  console.log(`Trading bot API listening on http://localhost:${config.port}`);
});
