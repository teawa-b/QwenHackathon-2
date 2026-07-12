import { WebSocketServer } from 'ws';

// Live companion sessions: a VR/3D host registers and receives a short
// connect code; phones join with that code at /connect and get the full
// session state plus every update, and can send requests back to the swarm.

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const HOST_GONE_GRACE_MS = 5 * 60 * 1000;
const MAX_SESSIONS = 200;
const MAX_COMPANIONS = 8;
const MAX_EVENTS = 80;
const MAX_REQUESTS = 40;

const sessions = new Map();

function generateCode() {
  for (let attempt = 0; attempt < 64; attempt++) {
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!sessions.has(code)) return code;
  }
  return null;
}

function send(socket, message) {
  if (socket && socket.readyState === 1) {
    try { socket.send(JSON.stringify(message)); } catch {}
  }
}

function parse(raw) {
  try {
    const message = JSON.parse(String(raw).slice(0, 64_000));
    return message && typeof message === 'object' ? message : null;
  } catch { return null; }
}

function emptyData(code) {
  return { code, status: null, brief: null, agents: [], events: [], requests: [], plan: null, image: null };
}

export function attachLive(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

  server.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://internal'); } catch { socket.destroy(); return; }
    if (url.pathname !== '/ws') { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, url));
  });

  // Expire idle sessions and keep proxied connections alive.
  setInterval(() => {
    const now = Date.now();
    for (const [code, session] of sessions) {
      const expired = now - session.createdAt > SESSION_TTL_MS
        || (!session.host && session.hostGoneAt && now - session.hostGoneAt > HOST_GONE_GRACE_MS);
      if (expired) {
        for (const companion of session.companions) { send(companion, { type: 'ended' }); companion.close(); }
        session.host?.close();
        sessions.delete(code);
      }
    }
  }, 60_000).unref();
  setInterval(() => {
    for (const session of sessions.values()) {
      try { session.host?.ping(); } catch {}
      for (const companion of session.companions) { try { companion.ping(); } catch {} }
    }
  }, 30_000).unref();

  wss.on('connection', (ws, url) => {
    const role = url.searchParams.get('role');
    if (role === 'host') return handleHost(ws);
    if (role === 'companion') {
      return handleCompanion(ws, String(url.searchParams.get('code') || '').toUpperCase().trim());
    }
    ws.close();
  });

  function handleHost(ws) {
    if (sessions.size >= MAX_SESSIONS) { send(ws, { type: 'error', message: 'Server is at capacity' }); return void ws.close(); }
    const code = generateCode();
    if (!code) { send(ws, { type: 'error', message: 'Could not allocate a code' }); return void ws.close(); }
    const session = { code, host: ws, companions: new Set(), createdAt: Date.now(), hostGoneAt: 0, data: emptyData(code) };
    sessions.set(code, session);
    send(ws, { type: 'code', code });

    ws.on('message', raw => {
      const message = parse(raw);
      if (!message) return;
      const data = session.data;
      switch (message.type) {
        case 'brief': // a new run begins — reset downstream state
          data.brief = message.brief || null;
          data.agents = Array.isArray(message.agents) ? message.agents.slice(0, 10) : [];
          data.events = []; data.requests = []; data.plan = null; data.image = null; data.status = message.status || null;
          break;
        case 'agents':
          data.agents = Array.isArray(message.agents) ? message.agents.slice(0, 10) : [];
          break;
        case 'status':
          data.status = message.status || null;
          break;
        case 'event':
          if (Array.isArray(message.event) && data.events.length < MAX_EVENTS) data.events.push(message.event);
          break;
        case 'plan':
          data.plan = message.plan || null;
          break;
        case 'image':
          data.image = typeof message.url === 'string' ? message.url.slice(0, 2000) : null;
          break;
        default:
          return; // unknown types are not rebroadcast
      }
      for (const companion of session.companions) send(companion, message);
    });
    ws.on('close', () => {
      session.host = null;
      session.hostGoneAt = Date.now();
      for (const companion of session.companions) send(companion, { type: 'host-offline' });
    });
    ws.on('error', () => {});
  }

  function handleCompanion(ws, code) {
    const session = sessions.get(code);
    if (!session) { send(ws, { type: 'error', message: 'Unknown or expired code' }); return void ws.close(); }
    if (session.companions.size >= MAX_COMPANIONS) { send(ws, { type: 'error', message: 'This session is full' }); return void ws.close(); }
    session.companions.add(ws);
    send(ws, { type: 'snapshot', data: session.data, hostOnline: Boolean(session.host) });

    ws.on('message', raw => {
      const message = parse(raw);
      if (!message || message.type !== 'request') return;
      const request = {
        to: String(message.to || 'Hub').slice(0, 20),
        text: String(message.text || '').trim().slice(0, 200),
        at: Date.now()
      };
      if (!request.text) return;
      if (session.data.requests.length < MAX_REQUESTS) session.data.requests.push(request);
      const outbound = { type: 'request', ...request };
      send(session.host, outbound);
      for (const companion of session.companions) send(companion, outbound);
    });
    ws.on('close', () => session.companions.delete(ws));
    ws.on('error', () => {});
  }

  return wss;
}
