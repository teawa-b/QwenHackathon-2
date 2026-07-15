// In-memory realtime sessions. The VR headset hosts a session; phones join
// with a short code and receive every update over Server-Sent Events.

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const HEARTBEAT_MS = 25000;

const sessions = new Map();

function makeCode() {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!sessions.has(code)) return code;
  }
  throw new Error('Could not allocate a session code');
}

export function createSession() {
  const code = makeCode();
  const session = {
    code,
    createdAt: Date.now(),
    status: 'idle', // idle -> planning -> running -> complete
    briefLine: null,
    plan: null,
    imageBuffer: null,
    imageMime: null,
    events: [], // replayed to late joiners
    clients: new Set()
  };
  sessions.set(code, session);
  return session;
}

export function getSession(code) {
  const session = sessions.get(String(code || '').toUpperCase());
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    destroySession(session.code);
    return null;
  }
  return session;
}

function destroySession(code) {
  const session = sessions.get(code);
  if (!session) return;
  for (const res of session.clients) {
    try { res.end(); } catch {}
  }
  sessions.delete(code);
}

export function broadcast(session, type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  if (type === 'event') {
    session.events.push(data);
    if (session.events.length > 40) session.events.shift();
  }
  for (const res of session.clients) {
    try { res.write(payload); } catch {}
  }
}

/** Attach an SSE client. Replays current state so late joiners catch up. */
export function subscribe(session, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`event: hello\ndata: ${JSON.stringify({
    code: session.code,
    status: session.status,
    briefLine: session.briefLine,
    hasPlan: Boolean(session.plan)
  })}\n\n`);
  for (const past of session.events) {
    res.write(`event: event\ndata: ${JSON.stringify(past)}\n\n`);
  }
  if (session.status === 'complete' && session.plan) {
    res.write(`event: complete\ndata: ${JSON.stringify({ plan: session.plan, hasImage: Boolean(session.imageBuffer) })}\n\n`);
  }
  session.clients.add(res);
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch {}
  }, HEARTBEAT_MS);
  res.on('close', () => {
    clearInterval(heartbeat);
    session.clients.delete(res);
  });
}

/** Store the finished plan; fetch the concept image now because Qwen URLs expire. */
export async function completeSession(session, plan, imageUrl) {
  session.plan = plan;
  session.status = 'complete';
  if (imageUrl && /^https:\/\//.test(imageUrl)) {
    try {
      const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
      if (response.ok) {
        const buffer = Buffer.from(await response.arrayBuffer());
        const mime = response.headers.get('content-type') || '';
        // pdfkit only embeds JPEG/PNG
        if (buffer.length < 15_000_000 && /jpe?g|png/.test(mime)) {
          session.imageBuffer = buffer;
          session.imageMime = mime;
        }
      }
    } catch (err) {
      console.warn(`[session ${session.code}] concept image fetch failed:`, err.message);
    }
  }
  broadcast(session, 'complete', { plan, hasImage: Boolean(session.imageBuffer) });
}

// Periodic sweep so dead sessions do not accumulate.
setInterval(() => {
  const now = Date.now();
  for (const [code, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) destroySession(code);
  }
}, 10 * 60 * 1000).unref();
