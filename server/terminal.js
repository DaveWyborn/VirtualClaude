const pty = require('node-pty');
const path = require('path');
const url = require('url');

const VALID_NAME = /^[a-zA-Z0-9-]+$/;

// Track active sessions for graceful shutdown
const activeSessions = new Map();

function getProjectsDir() {
  return process.env.PROJECTS_DIR || '/home/writer/projects';
}

function setupTerminalWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    const parsed = url.parse(req.url, true);
    const projectName = parsed.query.project;

    // Validate API key from query param (WebSocket can't use headers easily from browser)
    const apiKey = parsed.query.apiKey;
    if (!process.env.API_KEY || apiKey !== process.env.API_KEY) {
      ws.close(4001, 'Invalid API key');
      return;
    }

    if (!projectName || !VALID_NAME.test(projectName)) {
      ws.close(4002, 'Invalid or missing project name');
      return;
    }

    const projectsDir = getProjectsDir();
    const cwd = path.resolve(projectsDir, projectName);

    // Verify cwd is within projects dir
    if (!cwd.startsWith(path.resolve(projectsDir))) {
      ws.close(4003, 'Path traversal denied');
      return;
    }

    const home = process.env.HOME || '/root';
    const basePath = process.env.PATH || '/usr/local/bin:/usr/bin:/bin';
    const localBin = `${home}/.local/bin`;
    const fullPath = basePath.split(':').includes(localBin)
      ? basePath
      : `${localBin}:${basePath}`;

    let ptyProcess;
    try {
      ptyProcess = pty.spawn('bash', [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          HOME: home,
          PATH: fullPath,
          SHELL: '/bin/bash'
        }
      });
    } catch (err) {
      console.error('Failed to spawn pty:', err.message);
      ws.close(4004, 'Failed to spawn terminal');
      return;
    }

    const sessionId = `${projectName}-${Date.now()}`;
    activeSessions.set(sessionId, ptyProcess);
    console.log(`Terminal opened: ${sessionId} (pid ${ptyProcess.pid})`);

    // pty -> ws
    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    // pty exits -> close ws
    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`Terminal exited: ${sessionId} (code=${exitCode}, signal=${signal})`);
      activeSessions.delete(sessionId);
      if (ws.readyState === ws.OPEN) {
        ws.close(1000, 'Terminal exited');
      }
    });

    // ws -> pty
    ws.on('message', (msg) => {
      const data = msg.toString();

      // Try to parse as JSON for resize messages
      if (data.startsWith('{')) {
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            ptyProcess.resize(
              Math.max(1, Math.min(500, parsed.cols)),
              Math.max(1, Math.min(200, parsed.rows))
            );
            return;
          }
        } catch {
          // Not JSON — fall through and write as text
        }
      }

      ptyProcess.write(data);
    });

    // ws closes -> kill pty
    ws.on('close', () => {
      console.log(`WebSocket closed: ${sessionId}`);
      activeSessions.delete(sessionId);
      try {
        ptyProcess.kill();
      } catch {
        // Already dead
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error: ${sessionId}:`, err.message);
    });
  });
}

function killAllSessions() {
  for (const [id, ptyProcess] of activeSessions) {
    console.log(`Killing session: ${id}`);
    try {
      ptyProcess.kill();
    } catch {
      // Already dead
    }
  }
  activeSessions.clear();
}

module.exports = { setupTerminalWebSocket, killAllSessions };
