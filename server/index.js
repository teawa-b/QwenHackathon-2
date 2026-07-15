import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, liveMode, transcribe, generateImage, QwenError } from './qwen.js';
import { createPlan } from './planner.js';
import { createSession, getSession, subscribe, broadcast, completeSession } from './sessions.js';
import { renderReport } from './report.js';

const app = express();
app.use(express.json({ limit: '15mb' })); // voice clips arrive as base64

const asyncRoute = handler => (req, res) => {
  handler(req, res).catch(err => {
    const status = err.status || 500;
    console.error(`[api] ${req.method} ${req.path} failed:`, err.message);
    res.status(status).json({ error: err instanceof QwenError ? err.message : 'Internal error' });
  });
};

app.get('/api/health', (req, res) => {
  res.json({ live: liveMode(), models: liveMode() ? MODELS : null });
});

app.post('/api/plan', asyncRoute(async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 1200) {
    return res.status(400).json({ error: 'Provide a business brief between 1 and 1200 characters.' });
  }
  if (!liveMode()) return res.status(503).json({ error: 'Live mode is not configured.' });
  const plan = await createPlan(text);
  res.json(plan);
}));

app.post('/api/transcribe', asyncRoute(async (req, res) => {
  const { audio, mime } = req.body || {};
  if (!audio || typeof audio !== 'string') {
    return res.status(400).json({ error: 'Provide base64 audio.' });
  }
  if (!liveMode()) return res.status(503).json({ error: 'Live mode is not configured.' });
  const decoded = Buffer.from(audio, 'base64');
  if (decoded.length > 10_000_000) return res.status(413).json({ error: 'Voice recording is too large.' });
  if (mime === 'audio/wav' && decoded.subarray(0, 4).toString('ascii') !== 'RIFF') {
    return res.status(400).json({ error: 'The browser produced an invalid WAV recording.' });
  }
  const text = await transcribe({
    base64: audio,
    mime: typeof mime === 'string' ? mime.slice(0, 40) : 'audio/wav'
  });
  res.json({ text });
}));

app.post('/api/image', asyncRoute(async (req, res) => {
  const { business, city, items } = req.body || {};
  if (!business || typeof business !== 'string') {
    return res.status(400).json({ error: 'Provide the business type.' });
  }
  if (!liveMode()) return res.status(503).json({ error: 'Live mode is not configured.' });
  const equipment = Array.isArray(items) ? items.map(String).slice(0, 10).join(', ') : '';
  const prompt = `Wide-angle concept visualisation of a newly opened ${business.slice(0, 60)}${city ? ` in ${String(city).slice(0, 40)}` : ''}, fully equipped and ready to launch. Visible equipment: ${equipment || 'the essential equipment for this business'}. Optimistic, clean, photorealistic interior render with warm practical lighting. No people, no text, no logos.`;
  const url = await generateImage({ prompt });
  res.json({ url });
}));

// --- Realtime sessions: VR hosts, phones join with a code ---

const withSession = handler => (req, res) => {
  const session = getSession(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found or expired.' });
  return handler(req, res, session);
};

app.post('/api/session', (req, res) => {
  const session = createSession();
  res.json({ code: session.code });
});

app.get('/api/session/:code', withSession((req, res, session) => {
  res.json({ code: session.code, status: session.status, briefLine: session.briefLine });
}));

app.get('/api/session/:code/stream', withSession((req, res, session) => {
  subscribe(session, res);
}));

// Phone -> host: submit the business brief
app.post('/api/session/:code/brief', withSession((req, res, session) => {
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 1200) return res.status(400).json({ error: 'Provide a brief between 1 and 1200 characters.' });
  if (session.status !== 'idle') return res.status(409).json({ error: 'This session is already running.' });
  broadcast(session, 'brief', { text });
  res.json({ ok: true });
}));

// Host -> phones: status changes and live agent events
app.post('/api/session/:code/state', withSession((req, res, session) => {
  const status = String(req.body?.status || '');
  if (['idle', 'planning', 'running'].includes(status)) session.status = status;
  if (req.body?.briefLine) session.briefLine = String(req.body.briefLine).slice(0, 120);
  broadcast(session, 'state', { status: session.status, briefLine: session.briefLine });
  res.json({ ok: true });
}));

app.post('/api/session/:code/event', withSession((req, res, session) => {
  const { who, text, progress, phase } = req.body || {};
  broadcast(session, 'event', {
    who: String(who || '').slice(0, 24),
    text: String(text || '').slice(0, 140),
    progress: Math.max(0, Math.min(100, Number(progress) || 0)),
    phase: String(phase || '').slice(0, 40)
  });
  res.json({ ok: true });
}));

app.post('/api/session/:code/complete', asyncRoute(async (req, res) => {
  const session = getSession(req.params.code);
  if (!session) return res.status(404).json({ error: 'Session not found or expired.' });
  const plan = req.body?.plan;
  if (!plan || !Array.isArray(plan.items) || !plan.items.length) {
    return res.status(400).json({ error: 'Provide the completed plan.' });
  }
  await completeSession(session, plan, req.body?.imageUrl);
  res.json({ ok: true });
}));

app.get('/api/session/:code/report.pdf', withSession((req, res, session) => {
  if (!session.plan) return res.status(409).json({ error: 'The plan is not finished yet.' });
  renderReport(res, session);
}));

app.get('/api/session/:code/image', withSession((req, res, session) => {
  if (!session.imageBuffer) return res.status(404).json({ error: 'No concept image for this session.' });
  res.setHeader('Content-Type', session.imageMime || 'image/jpeg');
  res.send(session.imageBuffer);
}));

// Static frontend (vite build output)
const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, '..', 'dist');
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = Number(process.env.PORT) || 8787;
app.listen(port, '0.0.0.0', () => {
  console.log(`SupplySwarm server on :${port} — live mode: ${liveMode() ? `ON (${MODELS.text}, ${MODELS.asr}, ${MODELS.image})` : 'OFF (demo catalogue)'}`);
});
