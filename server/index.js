require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const url = require('url');

const apiKeyAuth = require('./auth');
const projectsRouter = require('./routes/projects');
const filesRouter = require('./routes/files');
const { setupTerminalWebSocket, killAllSessions } = require('./terminal');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key']
}));

// Body parsing
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Auth on all API routes
app.use('/api', apiKeyAuth);

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/projects', filesRouter);

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server and WebSocket server
const server = http.createServer(app);

const wss = new WebSocketServer({ noServer: true });
setupTerminalWebSocket(wss);

// Handle WebSocket upgrade
server.on('upgrade', (req, socket, head) => {
  const pathname = url.parse(req.url).pathname;

  if (pathname === '/terminal') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// Start
server.listen(PORT, () => {
  console.log(`claude-workspace-api listening on port ${PORT}`);
  console.log(`PROJECTS_DIR: ${process.env.PROJECTS_DIR || '/home/writer/projects'}`);
  console.log(`CORS_ORIGIN: ${process.env.CORS_ORIGIN || '*'}`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received — shutting down`);
  killAllSessions();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
  // Force exit after 5s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
