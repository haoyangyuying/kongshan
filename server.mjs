/**
 * 空山 · 静态站点 + 极轻量在线占座服务。
 * - 5200 提供 dist
 * - /ws 维护 9 个蒲团的真实占用；座位 3 常驻一位“常住”
 * 没有账号、没有聊天、不记录 IP。
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT || 5200);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_CLIENTS = Math.max(1, Math.min(1000, Number(process.env.MAX_CLIENTS || 200)));
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean),
);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const host = String(req.headers.host || '').toLowerCase();
    if (parsed.host.toLowerCase() === host) return true;
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') return true;
    return ALLOWED_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let pathname;
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('bad request');
    return;
  }
  if (pathname === '/') pathname = '/index.html';
  const rel = pathname.replace(/^\/+/, '');
  const resolved = path.resolve(DIST, rel);
  if (resolved !== DIST && !resolved.startsWith(DIST + path.sep)) {
    res.writeHead(403, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    return;
  }
  fs.stat(resolved, (err, stat) => {
    let file = resolved;
    if (err || !stat.isFile()) {
      file = path.join(DIST, 'index.html');
    }
    const ext = path.extname(file).toLowerCase();
    const headers = {
      ...SECURITY_HEADERS,
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': file.includes(`${path.sep}assets${path.sep}`)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    };
    fs.readFile(file, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('not found');
        return;
      }
      headers['Content-Length'] = String(data.length);
      res.writeHead(200, headers);
      res.end(data);
    });
  });
});

const SEAT_COUNT = 9;
const RESIDENT_SEAT = 3;
const seats = new Array(SEAT_COUNT).fill(null);
seats[RESIDENT_SEAT] = 'resident';
const clients = new Map();
let nextId = 1;

const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });

function broadcast(payload) {
  const text = JSON.stringify(payload);
  for (const { ws } of clients.values()) {
    if (ws.readyState === ws.OPEN) ws.send(text);
  }
}

function broadcastSeats() {
  broadcast({ type: 'seats', seats, count: clients.size });
}

function broadcastCount() {
  broadcast({ type: 'count', count: clients.size });
}

function releaseSeat(id) {
  let changed = false;
  for (let i = 0; i < seats.length; i++) {
    if (seats[i] === id) {
      seats[i] = null;
      changed = true;
    }
  }
  return changed;
}

server.on('upgrade', (req, socket, head) => {
  let pathname;
  try {
    pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
  } catch {
    socket.destroy();
    return;
  }
  if (pathname !== '/ws' || !originAllowed(req)) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws) => {
  if (clients.size >= MAX_CLIENTS) {
    ws.close(1013, 'temple-full');
    return;
  }
  const id = `v${nextId++}`;
  clients.set(id, { ws });
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.send(JSON.stringify({ type: 'hello', id, seats, count: clients.size, resident: RESIDENT_SEAT }));
  broadcastCount();
  broadcastSeats();

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'sit') {
      const seat = Number(msg.seat);
      if (!Number.isInteger(seat) || seat < 0 || seat >= SEAT_COUNT) {
        ws.send(JSON.stringify({ type: 'sit-denied', seat, reason: 'bad-seat' }));
        return;
      }
      if (seats[seat] && seats[seat] !== id) {
        ws.send(JSON.stringify({ type: 'sit-denied', seat, reason: 'occupied' }));
        broadcastSeats();
        return;
      }
      releaseSeat(id);
      seats[seat] = id;
      ws.send(JSON.stringify({ type: 'sit-ok', seat }));
      broadcastSeats();
    } else if (msg.type === 'stand') {
      if (releaseSeat(id)) broadcastSeats();
    } else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });

  ws.on('close', () => {
    releaseSeat(id);
    clients.delete(id);
    broadcastCount();
    broadcastSeats();
  });
  ws.on('error', () => {
    /* close 会处理 */
  });
});

const heartbeat = setInterval(() => {
  for (const { ws } of clients.values()) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch { /* noop */ }
  }
}, 30000);
wss.on('close', () => clearInterval(heartbeat));

server.on('error', (err) => {
  console.error('[kongshan] server error', err.message);
});

server.listen(PORT, HOST, () => {
  console.log(`空山 server: http://${HOST}:${PORT}  (ws /ws, max ${MAX_CLIENTS} clients)`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
