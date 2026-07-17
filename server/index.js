import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, liveMode, transcribe, generateImage, QwenError } from './qwen.js';
import { createPlan } from './planner.js';
import { memorySummary } from './memory.js';
import { attachLive } from './live.js';

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

// What the swarm remembers across missions — powers the landing "swarm
// memory" strip and lets judges verify persistence between runs.
app.get('/api/memory', (req, res) => {
  res.json(memorySummary());
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

// Fetch the Qwen-hosted concept image server-side so the companion's PDF can
// embed it without cross-origin canvas tainting. Restricted to DashScope OSS.
app.get('/api/image-proxy', asyncRoute(async (req, res) => {
  let url;
  try { url = new URL(String(req.query.url || '')); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
  if (url.protocol !== 'https:' || !/(^|\.)aliyuncs\.com$/.test(url.hostname)) {
    return res.status(400).json({ error: 'Host not allowed' });
  }
  const upstream = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!upstream.ok) return res.status(502).json({ error: 'Image fetch failed' });
  res.set('Content-Type', upstream.headers.get('content-type') || 'image/png');
  res.set('Cache-Control', 'private, max-age=3600');
  res.send(Buffer.from(await upstream.arrayBuffer()));
}));

// Static frontend (vite build output)
const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, '..', 'dist');
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));

const port = Number(process.env.PORT) || 8787;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`SupplySwarm server on :${port} — live mode: ${liveMode() ? `ON (${MODELS.text}, ${MODELS.asr}, ${MODELS.image})` : 'OFF (demo catalogue)'}`);
});
attachLive(server);
