import './style.css';
import { sfx } from './audio.js';

const scenarios = {
  studio: {
    match: /game|studio|vr|developer|gaming/i,
    type: 'Game development studio',
    team: 4,
    agents: [
      ['CMP', 'Computing', 'Workstations & displays'],
      ['VR', 'Immersive', 'Headsets & testing'],
      ['FUR', 'Workspace', 'Desks & seating'],
      ['NET', 'Network', 'Storage & connectivity'],
      ['SUP', 'Supplier', 'MOQ & seller checks'],
      ['RISK', 'Critic', 'Risk & budget control']
    ],
    items: [
      ['Mixed-tier creator workstations', '4 units · 2 performance / 2 balanced', 4360, 'Essential', 'Verified spec'],
      ['27-inch IPS displays', '8 units · dual display setup', 1296, 'Essential', 'MOQ compatible'],
      ['Ergonomic task chairs', '4 units · adjustable lumbar', 596, 'Essential', 'Supplier checked'],
      ['Sit/stand work desks', '4 units · cable-managed', 920, 'Essential', 'Landed estimate'],
      ['VR development headsets', '2 units · PC tethered', 830, 'Essential', 'Compatibility checked'],
      ['10 GbE network + NAS', '1 shared kit · 16 TB usable', 735, 'Essential', 'Verified spec'],
      ['Peripherals & cabling', '4 keyboard/mouse sets + spares', 312, 'Essential', 'MOQ compatible']
    ]
  },
  gym: {
    match: /gym|fitness|training/i,
    type: 'Small training gym',
    team: 2,
    agents: [
      ['STR', 'Strength', 'Racks & free weights'], ['CRD', 'Cardio', 'Cardio equipment'],
      ['FLO', 'Facility', 'Flooring & storage'], ['SAF', 'Safety', 'Load & compliance'],
      ['SUP', 'Supplier', 'MOQ & seller checks'], ['RISK', 'Critic', 'Risk & budget control']
    ],
    items: [
      ['Commercial half racks', '2 stations · safety arms included', 2480, 'Essential', 'Verified spec'],
      ['Olympic barbell package', '4 bars + 600 kg plates', 2890, 'Essential', 'MOQ compatible'],
      ['Adjustable benches', '4 units · commercial grade', 1120, 'Essential', 'Supplier checked'],
      ['Rubber flooring tiles', '120 m² · 20 mm', 1720, 'Essential', 'Landed estimate'],
      ['Air bikes', '2 units · belt drive', 1380, 'Essential', 'Warranty unknown'],
      ['Storage & accessory kit', 'Racks, bands, mats, collars', 720, 'Essential', 'Verified spec']
    ]
  },
  podcast: {
    match: /podcast|audio|recording|content/i,
    type: 'Podcast production studio',
    team: 4,
    agents: [
      ['AUD', 'Audio', 'Capture chain'], ['ACO', 'Acoustics', 'Room treatment'],
      ['CMP', 'Computing', 'Editing system'], ['FUR', 'Workspace', 'Studio furniture'],
      ['SUP', 'Supplier', 'MOQ & seller checks'], ['RISK', 'Critic', 'Risk & budget control']
    ],
    items: [
      ['Broadcast microphone kits', '4 mics · arms · shock mounts', 880, 'Essential', 'Verified spec'],
      ['Audio interface & mixer', '8-input recording system', 670, 'Essential', 'Compatibility checked'],
      ['Acoustic treatment pack', 'Panels, bass traps, ceiling cloud', 960, 'Essential', 'Landed estimate'],
      ['Editing workstation', '1 creator PC + calibrated display', 1490, 'Essential', 'Verified spec'],
      ['Monitoring package', '2 monitors + 4 headphones', 740, 'Essential', 'Supplier checked'],
      ['Studio table & seating', '4-person conversation layout', 820, 'Essential', 'MOQ compatible']
    ]
  },
  generic: {
    match: /.*/,
    type: 'Independent business',
    team: 4,
    agents: [
      ['REQ', 'Requirements', 'Needs & priorities'], ['EQP', 'Equipment', 'Core operating kit'],
      ['OPS', 'Operations', 'Workspace essentials'], ['LOG', 'Logistics', 'Landed costs'],
      ['SUP', 'Supplier', 'MOQ & seller checks'], ['RISK', 'Critic', 'Risk & budget control']
    ],
    items: [
      ['Core operating equipment', 'Primary launch package', 3650, 'Essential', 'Category estimate'],
      ['Workspace fit-out', 'Furniture, lighting & storage', 1480, 'Essential', 'Landed estimate'],
      ['Computing & point of sale', 'Shared systems and peripherals', 1260, 'Essential', 'Verified spec'],
      ['Safety & consumables', 'Launch stock and protective kit', 720, 'Essential', 'MOQ compatible'],
      ['Network & connectivity', 'Router, backup and cabling', 490, 'Essential', 'Compatibility checked']
    ]
  }
};

const state = { scenario: scenarios.studio, budget: 10000, city: 'Coventry', team: 4, running: false, plan: null, conceptImage: null, session: null };

const api = {
  live: false,
  models: null,
  async init() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      this.live = Boolean(data.live);
      this.models = data.models;
    } catch { this.live = false; }
    document.querySelectorAll('[data-mode-label]').forEach(el => { el.textContent = modeLabel(); });
    document.querySelectorAll('[data-live-copy]').forEach(el => {
      el.textContent = this.live ? 'Live planning · Qwen Cloud connected.' : 'Running on the demo catalogue.';
    });
  },
  async request(path, payload) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${response.status})`);
    }
    return response.json();
  },
  plan(text) { return this.request('/api/plan', { text }); },
  transcribe(audio, mime) { return this.request('/api/transcribe', { audio, mime }); },
  image(payload) { return this.request('/api/image', payload); },
  // Session helpers are fire-and-forget where losing one update must not break the run.
  createSession() { return this.request('/api/session', {}); },
  push(code, kind, payload) {
    return fetch(`/api/session/${code}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }
};

function modeLabel() { return api.live ? 'LIVE · QWEN CLOUD' : 'DEMO CATALOGUE'; }

function applyPlan(plan) {
  state.plan = plan;
  state.budget = plan.budget_gbp;
  state.city = plan.city || state.city;
  state.team = plan.team_size;
  state.scenario = { type: plan.business_type, team: plan.team_size, agents: plan.agents, items: plan.items };
}

const app = document.querySelector('#app');

function money(value) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

const alibabaUrl = query => `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(query)}`;
const itemLink = item => item[5] || alibabaUrl(item[0]);

function header() {
  return `<header class="topbar">
    <a class="brand" href="#" aria-label="SupplySwarm home"><span class="brand-mark"><i></i><i></i><i></i></span><span>SUPPLY<em>SWARM</em></span></a>
    <div class="mode"><span></span> <b data-mode-label>${modeLabel()}</b></div>
    <button class="menu" aria-label="About SupplySwarm" data-about>?</button>
  </header>`;
}

// ---------------------------------------------------------------------------
// Landing — two doors only: the VR room, or the mobile companion.
// ---------------------------------------------------------------------------

function landingView() {
  return `${header()}
  <main class="landing">
    <div class="landing-head">
      <div class="eyebrow"><span>SUPPLYSWARM</span> A procurement department, formed on demand</div>
      <h1>Say what you want to build.<br><strong>A swarm sources it.</strong></h1>
      <p class="landing-desc">SupplySwarm turns a spoken business idea into a complete equipment plan. Describe your business and budget to the coordinator robot in VR; it assembles a team of specialist AI agents that pick the equipment, price it realistically, check it against your budget with real shipping and tax maths, and hand you a finished launch plan — with a concept image of your future space, Alibaba product links for every item, and a PDF you can keep.</p>
      <ul class="steps">
        <li><b>1</b> Speak your brief in VR</li>
        <li><b>2</b> Specialist agents source &amp; price</li>
        <li><b>3</b> Critic checks the budget</li>
        <li><b>4</b> PDF plan on your phone</li>
      </ul>
    </div>
    <div class="doors">
      <section class="door door-vr">
        <div class="door-tag">HEADSET / DESKTOP</div>
        <h2>Use in VR</h2>
        <p>Enter the 3D operations room. Hold the coordinator robot, speak your business brief, and watch the specialist swarm assemble around you.</p>
        <button class="assemble" data-vr><span>USE IN VR</span><b>◈</b></button>
        <em>Also works on desktop — drag to orbit, hold the robot to talk.</em>
      </section>
      <section class="door door-mobile">
        <div class="door-tag">PHONE</div>
        <h2>Join session on mobile</h2>
        <p>Enter the 4-letter code shown inside the VR room. Send the brief from your phone, follow the swarm live, and receive the finished plan as a PDF.</p>
        <button class="assemble mobile-join" data-join><span>JOIN SESSION ON MOBILE</span><b>↗</b></button>
        <em>Live progress, concept image, Alibaba product links, downloadable PDF.</em>
      </section>
    </div>
    <p class="fineprint landing-fine">No purchases or supplier messages are ever sent. Every consequential action requires your approval. <span data-live-copy>${api.live ? 'Live planning · Qwen Cloud connected.' : 'Running on the demo catalogue.'}</span></p>
  </main>`;
}

function showLanding() {
  disconnectMobile();
  state.running = false;
  app.innerHTML = landingView();
  document.querySelector('[data-vr]').addEventListener('click', () => runSwarm3D());
  document.querySelector('[data-join]').addEventListener('click', () => showJoin());
  document.querySelector('[data-about]').addEventListener('click', showAbout);
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------
// Mobile companion — join with a code, send the brief, follow along, get PDF.
// ---------------------------------------------------------------------------

const mobile = { source: null, code: null };

function disconnectMobile() {
  mobile.source?.close();
  mobile.source = null;
  mobile.code = null;
}

function showJoin(prefill = '') {
  disconnectMobile();
  app.innerHTML = `${header()}
  <main class="join-shell">
    <section class="join-card">
      <div class="eyebrow"><span>MOBILE</span> Join a live session</div>
      <h1>Enter the room code.</h1>
      <p>The 4-letter code is shown inside the VR operations room, next to the coordinator robot.</p>
      <div class="code-row">
        <input id="join-code" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABCD" value="${prefill}">
        <button class="assemble" data-connect><span>CONNECT</span><b>↗</b></button>
      </div>
      <p class="join-error" id="join-error" hidden></p>
      <button class="linklike" data-back>← Back</button>
    </section>
  </main>`;
  window.scrollTo(0, 0);
  const input = document.querySelector('#join-code');
  const error = document.querySelector('#join-error');
  input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); error.hidden = true; });
  const connect = async () => {
    const code = input.value.trim().toUpperCase();
    if (code.length !== 4) { error.textContent = 'The code is 4 letters — check the VR room.'; error.hidden = false; return; }
    try {
      const response = await fetch(`/api/session/${code}`);
      if (!response.ok) throw new Error();
      showMobileLive(code);
    } catch {
      error.textContent = 'Session not found. Check the code and that the VR room is open.';
      error.hidden = false;
    }
  };
  document.querySelector('[data-connect]').addEventListener('click', connect);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });
  document.querySelector('[data-back]').addEventListener('click', showLanding);
  document.querySelector('[data-about]').addEventListener('click', showAbout);
  input.focus();
}

function showMobileLive(code) {
  mobile.code = code;
  app.innerHTML = `${header()}
  <main class="mobile-live">
    <section class="mobile-head">
      <div><div class="eyebrow"><span>CONNECTED</span> Session ${code}</div><h1 id="m-title">Swarm standing by</h1><p id="m-status">Waiting for a brief — send one below or speak in VR.</p></div>
      <div class="code-chip">${code}</div>
    </section>
    <section class="m-brief" id="m-brief-card">
      <label for="m-brief">Send the business brief from your phone</label>
      <div class="input-wrap">
        <textarea id="m-brief" rows="3" maxlength="280" placeholder="e.g. A four-person game studio in Coventry with a £10,000 equipment budget."></textarea>
        ${api.live ? '<button class="voice" type="button" data-voice aria-label="Speak your business brief" title="Speak your brief — transcribed by Qwen ASR">⌁</button>' : ''}
      </div>
      <button class="assemble" data-send><span>SEND TO THE SWARM</span><b>↗</b></button>
      <p class="m-send-note" id="m-send-note" hidden></p>
    </section>
    <section class="status-ribbon m-ribbon"><span id="m-phase">AWAITING BRIEF</span><div class="progress"><i id="m-progress"></i></div><b id="m-pct">00%</b></section>
    <section class="m-feed" id="m-feed" aria-live="polite"></section>
  </main>`;
  window.scrollTo(0, 0);
  document.querySelector('[data-about]').addEventListener('click', showAbout);
  bindVoice('#m-brief');

  const note = document.querySelector('#m-send-note');
  document.querySelector('[data-send]').addEventListener('click', async () => {
    const text = document.querySelector('#m-brief').value.trim();
    if (!text) { note.textContent = 'Describe the business first.'; note.hidden = false; return; }
    try {
      const response = await fetch(`/api/session/${code}/brief`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Could not send the brief');
      }
      note.textContent = 'Brief sent — the coordinator has it.';
      note.hidden = false;
    } catch (err) {
      note.textContent = err.message;
      note.hidden = false;
    }
  });

  const feed = document.querySelector('#m-feed');
  const setStatus = text => { const el = document.querySelector('#m-status'); if (el) el.textContent = text; };
  const setTitle = text => { const el = document.querySelector('#m-title'); if (el) el.textContent = text; };
  const hideBriefCard = () => { const card = document.querySelector('#m-brief-card'); if (card) card.hidden = true; };

  const source = new EventSource(`/api/session/${code}/stream`);
  mobile.source = source;
  source.addEventListener('hello', e => {
    const data = JSON.parse(e.data);
    if (data.status && data.status !== 'idle') { hideBriefCard(); setStatus('Session in progress — following live.'); }
    if (data.briefLine) setTitle(data.briefLine);
  });
  source.addEventListener('brief', () => {
    hideBriefCard();
    setStatus('Brief received — the coordinator is on it.');
  });
  source.addEventListener('state', e => {
    const data = JSON.parse(e.data);
    if (data.briefLine) setTitle(data.briefLine);
    if (data.status === 'planning') { hideBriefCard(); setStatus('Qwen coordinator is planning your launch…'); }
    if (data.status === 'running') { hideBriefCard(); setStatus('Specialists are working — live from the ops room.'); }
  });
  source.addEventListener('event', e => {
    const { who, text, progress, phase } = JSON.parse(e.data);
    const row = document.createElement('div');
    row.className = `event m-event ${/critic/i.test(who) ? 'warning' : ''}`;
    row.innerHTML = `<b>${who}</b><p>${text}</p>`;
    feed?.prepend(row);
    while (feed && feed.children.length > 12) feed.lastChild.remove();
    const bar = document.querySelector('#m-progress'), pct = document.querySelector('#m-pct'), ph = document.querySelector('#m-phase');
    if (bar) bar.style.width = `${progress}%`;
    if (pct) pct.textContent = `${String(progress).padStart(2, '0')}%`;
    if (ph && phase) ph.textContent = phase;
  });
  source.addEventListener('complete', e => {
    const { plan, hasImage } = JSON.parse(e.data);
    showMobileResults(plan, code, hasImage);
  });
  source.onerror = () => setStatus('Connection lost — reconnecting…');
}

function showMobileResults(plan, code, hasImage) {
  mobile.source?.close();
  mobile.source = null;
  const costs = plan.costs || {};
  const overBudget = (costs.remaining ?? 0) < 0;
  app.innerHTML = `${header()}
  <main class="results mobile-results">
    <section class="result-hero">
      <div><div class="eyebrow"><span>SESSION ${code}</span> ${plan.live ? 'Live plan generated by Qwen Cloud' : 'Demo catalogue plan'}</div><h1>Your launch plan<br><strong>is ready.</strong></h1><p>${plan.business_type} · ${plan.city || 'United Kingdom'} · ${plan.team_size}-person team</p></div>
      <div class="approval-seal ${overBudget ? 'warn' : ''}"><span>${overBudget ? '!' : '✓'}</span><b>${overBudget ? 'OVER<br>BUDGET' : 'BUDGET<br>VALID'}</b></div>
    </section>
    <a class="assemble pdf-cta" href="/api/session/${code}/report.pdf"><span>DOWNLOAD YOUR PDF PLAN</span><b>⬇</b></a>
    ${hasImage ? `<figure class="concept-frame m-concept"><img src="/api/session/${code}/image" alt="AI concept visual of the business"><figcaption>AI concept visual — illustrative only.</figcaption></figure>` : ''}
    <section class="result-grid">
      <div class="package-card">
        <div class="package-head"><div><span>RECOMMENDED PACKAGE</span><h2>Launch-ready essentials</h2></div></div>
        <div class="items">${plan.items.map((item, i) => `<article class="product"><span class="item-no">${String(i + 1).padStart(2, '0')}</span><div><h3>${item[0]}</h3><p>${item[1]}</p><div class="tags"><span>${item[3]}</span><span>${item[4]}</span></div><a class="ali-link" href="${item[5] || alibabaUrl(item[0])}" target="_blank" rel="noopener">Find on Alibaba.com ↗</a></div><strong>${money(item[2])}</strong></article>`).join('')}</div>
      </div>
      <aside class="cost-card">
        <span class="label">LANDED COST ESTIMATE</span><div class="total"><small>Package total</small><strong>${money(costs.total || 0)}</strong><span>of ${money(plan.budget_gbp)}</span></div>
        <div class="budget-meter"><i style="width:${Math.min(100, (costs.total || 0) / plan.budget_gbp * 100)}%"></i></div>
        <div class="remaining"><span>Budget ${overBudget ? 'exceeded by' : 'remaining'}</span><b>${money(Math.abs(costs.remaining || 0))}</b></div>
        <dl><div><dt>Products</dt><dd>${money(costs.products || 0)}</dd></div><div><dt>Shipping estimate</dt><dd>${money(costs.shipping || 0)}</dd></div><div><dt>VAT & duties estimate</dt><dd>${money(costs.tax || 0)}</dd></div><div><dt>Contingency</dt><dd>${money(costs.contingency || 0)}</dd></div></dl>
        <p class="estimate-note">Prices are ${plan.live ? 'live Qwen model estimates' : 'demo catalogue estimates'}, not supplier quotations. Alibaba links open live marketplace searches — verify before purchasing.</p>
      </aside>
    </section>
    ${plan.risks?.length || plan.assumptions?.length ? `<section class="evaluation"><div><span class="label">SWARM FINDINGS</span><h2>Risks &amp; assumptions.</h2></div><div class="findings"><div><span>RISKS</span><ul>${(plan.risks || []).map(r => `<li>${r}</li>`).join('') || '<li>No blocking risks recorded.</li>'}</ul></div><div><span>ASSUMPTIONS</span><ul>${(plan.assumptions || []).map(a => `<li>${a}</li>`).join('') || '<li>No assumptions recorded.</li>'}</ul></div></div></section>` : ''}
    <section class="result-actions"><button class="primary" data-restart>DONE <b>✓</b></button></section>
  </main>`;
  window.scrollTo(0, 0);
  sfx.play('complete', 0.6);
  document.querySelector('[data-restart]').addEventListener('click', showLanding);
  document.querySelector('[data-about]').addEventListener('click', showAbout);
}

// ---------------------------------------------------------------------------
// Brief parsing + voice (shared by VR host and mobile)
// ---------------------------------------------------------------------------

function parseBrief(text) {
  state.scenario = Object.values(scenarios).find(s => s !== scenarios.generic && s.match.test(text)) || scenarios.generic;
  const budget = text.match(/(?:£|gbp\s?)([\d,.]+)|([\d,.]+)\s?(?:pounds|budget|k\b)/i);
  if (budget) {
    let raw = (budget[1] || budget[2] || '').replace(/,/g, '');
    let parsed = Number(raw);
    if (/\d\s?k\b/i.test(budget[0])) parsed *= 1000;
    if (parsed >= 1000) state.budget = parsed;
  }
  const team = text.match(/(\d+)[- ]?(?:person|people|member)/i);
  state.team = team ? Number(team[1]) : state.scenario.team;
  const places = ['Coventry', 'Birmingham', 'London', 'Manchester', 'Leeds', 'Bristol', 'Liverpool'];
  state.city = places.find(p => new RegExp(p, 'i').test(text)) || 'United Kingdom';
}

function createVoiceRecorder() {
  let recorder = null, stream = null, chunks = [];
  return {
    active: () => Boolean(recorder),
    async start() {
      if (recorder) return;
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error('This browser does not support voice recording');
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.start();
    },
    stop() {
      return new Promise((resolve, reject) => {
        if (!recorder) return reject(new Error('Not recording'));
        const current = recorder;
        recorder = null;
        current.onstop = async () => {
          stream?.getTracks().forEach(track => track.stop());
          try {
            const blob = new Blob(chunks, { type: current.mimeType || 'audio/webm' });
            if (blob.size < 1500) return reject(new Error('Recording too short'));
            // Browsers usually record WebM or MP4, while Qwen ASR accepts a
            // WAV/MP3 data URL. Convert to a predictable mono WAV first.
            const wav = await recordingToWav(blob);
            const base64 = await blobToBase64(wav);
            resolve({ base64, mime: 'audio/wav' });
          } catch (err) { reject(err); }
        };
        current.stop();
      });
    }
  };
}

function bindVoice(inputSelector = '#idea') {
  const button = document.querySelector('[data-voice]');
  if (!button) return;
  const recorder = createVoiceRecorder();
  button.addEventListener('click', async () => {
    if (!api.live) return;
    if (recorder.active()) {
      button.classList.remove('rec');
      button.textContent = '…'; button.disabled = true;
      try {
        const { base64, mime } = await recorder.stop();
        const { text } = await api.transcribe(base64, mime);
        const target = document.querySelector(inputSelector);
        if (target && text) target.value = text;
      } catch (err) {
        button.title = `Transcription failed: ${err.message}`;
      } finally {
        button.textContent = '⌁'; button.disabled = false;
      }
      return;
    }
    try {
      await recorder.start();
      button.classList.add('rec');
      button.textContent = '■';
      button.title = 'Tap to stop recording';
    } catch (err) {
      button.title = err.message || 'Microphone access was denied';
    }
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read recording'));
    reader.readAsDataURL(blob);
  });
}

async function recordingToWav(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const OfflineAudioContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AudioContextClass || !OfflineAudioContextClass) throw new Error('Audio conversion is not supported in this browser');

  const context = new AudioContextClass();
  let decoded;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    await context.close();
  }

  // This Qwen ASR deployment accepts PCM WAV at 22.05 kHz; 16 kHz recordings
  // are rejected even though the container itself is valid.
  const sampleRate = 22050;
  const frames = Math.max(1, Math.ceil(decoded.duration * sampleRate));
  const offline = new OfflineAudioContextClass(1, frames, sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const write = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function showAbout() {
  const dialog = document.createElement('dialog');
  dialog.className = 'about-dialog';
  dialog.innerHTML = `<button aria-label="Close">×</button><span class="label">ABOUT THE DEMO</span><h2>A procurement department, formed on demand.</h2><p>SupplySwarm demonstrates Qwen-powered task division, specialist sourcing, deterministic cost calculation, critic-led revision, and human approval gates — hosted in VR with a live mobile companion.</p><p>Prices are estimates and Alibaba links open live marketplace searches. No purchases or supplier messages are ever sent.</p>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('button').onclick = () => { dialog.close(); dialog.remove(); };
}

const PHASE_NAMES = ['VALIDATING BRIEF', 'SPAWNING SPECIALISTS', 'SOURCING CANDIDATES', 'VERIFYING SUPPLIERS', 'CALCULATING LANDED COST', 'CRITIC REVIEW', 'REVISING PACKAGE', 'FINAL VERIFICATION', 'COMPLETE'];

function buildEvents() {
  return [
    ['Coordinator', 'Structured brief validated. No blocking questions.', 8],
    [state.scenario.agents[0][1], `Searching ${state.scenario.items[0][0].toLowerCase()} candidates.`, 20],
    [state.scenario.agents[1][1], 'Rejected 9 listings with incompatible specifications.', 34],
    [state.scenario.agents[2][1], 'Supplier and MOQ evidence attached to shortlist.', 48],
    [state.scenario.agents[3][1], 'Calculating shipping, VAT and landed cost estimates.', 61],
    ['Critic', 'Budget conflict detected: first package is 10.7% over ceiling.', 72],
    [state.scenario.agents[0][1], 'Revised package with mixed-tier equipment.', 84],
    ['Critic', 'All essentials covered. Evidence and uncertainty labels verified.', 96],
    ['Coordinator', 'Package approved. Preparing your launch plan.', 100]
  ];
}

// ---------------------------------------------------------------------------
// Costs + plan payload (shared by the host results page, mobile, and the PDF)
// ---------------------------------------------------------------------------

function computeCosts() {
  const s = state.scenario;
  const rawProducts = s.items.reduce((n, item) => n + item[2], 0);
  const rawShipping = Math.round(rawProducts * 0.075);
  const rawTax = Math.round((rawProducts + rawShipping) * 0.08);
  const rawContingency = Math.round(rawProducts * 0.05);
  let total = rawProducts + rawShipping + rawTax + rawContingency;
  // Demo catalogue items may be rescaled to a custom budget. Live Qwen plans are
  // never silently rescaled: if the critic could not fit the budget, we say so.
  const scale = !state.plan && total > state.budget ? (state.budget * .965) / total : 1;
  const items = s.items.map(item => [item[0], item[1], Math.round(item[2] * scale), item[3], item[4], itemLink(item)]);
  const products = items.reduce((n, item) => n + item[2], 0);
  const shipping = Math.round(rawShipping * scale), tax = Math.round(rawTax * scale), contingency = Math.round(rawContingency * scale);
  total = products + shipping + tax + contingency;
  return { items, products, shipping, tax, contingency, total, remaining: state.budget - total, overBudget: total > state.budget };
}

function buildPlanPayload() {
  const costs = computeCosts();
  return {
    live: Boolean(state.plan),
    business_type: state.scenario.type,
    city: state.city,
    team_size: state.team,
    budget_gbp: state.budget,
    items: costs.items,
    costs: { products: costs.products, shipping: costs.shipping, tax: costs.tax, contingency: costs.contingency, total: costs.total, remaining: costs.remaining },
    risks: state.plan?.risks || [],
    assumptions: state.plan?.assumptions || []
  };
}

// ---------------------------------------------------------------------------
// Host results page (shown on the hosting device after the VR run)
// ---------------------------------------------------------------------------

function resultsView() {
  const s = state.scenario;
  const plan = state.plan;
  const costs = computeCosts();
  const { total, remaining, overBudget } = costs;
  const insight = plan
    ? `<section class="evaluation">
        <div><span class="label">QWEN SWARM FINDINGS</span><h2>Risks &amp; assumptions.</h2><p>Generated live by Qwen Cloud${plan.revised ? ' — the critic caught an over-budget package and revised it before approval.' : '.'}</p></div>
        <div class="findings">
          <div><span>RISKS</span><ul>${plan.risks.map(r => `<li>${r}</li>`).join('') || '<li>No blocking risks recorded.</li>'}</ul></div>
          <div><span>ASSUMPTIONS</span><ul>${plan.assumptions.map(a => `<li>${a}</li>`).join('') || '<li>No assumptions recorded.</li>'}</ul></div>
        </div>
      </section>
      <section class="concept">
        <div><span class="label">CONCEPT VISUAL</span><h2>See your business.</h2><p>Qwen generated an illustrative visual of the finished space. Illustrative only — not a floor plan.</p>${state.conceptImage ? '' : '<button class="secondary" data-generate-image>GENERATE CONCEPT IMAGE</button>'}</div>
        <figure class="concept-frame" data-concept>${state.conceptImage ? `<img src="${state.conceptImage}" alt="AI concept visual of the business">` : '<span>No image generated yet</span>'}</figure>
      </section>`
    : `<section class="evaluation">
        <div><span class="label">WHY A SWARM?</span><h2>One brief. Better decisions.</h2><p>The critic caught a seeded over-budget plan and the specialists rebuilt it as a mixed-tier package. (Scripted demo comparison.)</p></div>
        <div class="compare"><div class="single"><span>SINGLE AGENT</span><b>${money(Math.round(state.budget * 1.107))}</b><p>Shipping omitted · 2 unverified items</p></div><div class="multi"><span>SUPPLYSWARM</span><b>${money(total)}</b><p>Landed cost included · ${costs.items.length}/${costs.items.length} items evidenced</p></div></div>
      </section>`;
  return `${header()}
  <main class="results">
    <section class="result-hero">
      <div><div class="eyebrow"><span>03</span> ${plan ? 'Live plan generated by Qwen Cloud' : 'Package approved by critic'}</div><h1>Your launch plan<br><strong>is ready.</strong></h1><p>${s.type} · ${state.city} · ${state.team}-person team</p></div>
      <div class="approval-seal ${overBudget ? 'warn' : ''}"><span>${overBudget ? '!' : '✓'}</span><b>${overBudget ? 'OVER<br>BUDGET' : 'BUDGET<br>VALID'}</b></div>
    </section>
    ${state.session ? `<a class="assemble pdf-cta" href="/api/session/${state.session}/report.pdf"><span>DOWNLOAD YOUR PDF PLAN</span><b>⬇</b></a>` : ''}
    <section class="result-grid">
      <div class="package-card">
        <div class="package-head"><div><span>RECOMMENDED PACKAGE</span><h2>Launch-ready essentials</h2></div><button data-restart>NEW BRIEF</button></div>
        <div class="items">${costs.items.map((item, i) => `<article class="product"><span class="item-no">${String(i + 1).padStart(2, '0')}</span><div><h3>${item[0]}</h3><p>${item[1]}</p><div class="tags"><span>${item[3]}</span><span>${item[4]}</span></div><a class="ali-link" href="${item[5]}" target="_blank" rel="noopener">Find on Alibaba.com ↗</a></div><strong>${money(item[2])}</strong></article>`).join('')}</div>
      </div>
      <aside class="cost-card">
        <span class="label">LANDED COST ESTIMATE</span><div class="total"><small>Package total</small><strong>${money(total)}</strong><span>of ${money(state.budget)}</span></div>
        <div class="budget-meter"><i style="width:${Math.min(100, total / state.budget * 100)}%"></i></div>
        <div class="remaining"><span>Budget ${overBudget ? 'exceeded by' : 'remaining'}</span><b>${money(Math.abs(remaining))}</b></div>
        <dl><div><dt>Products</dt><dd>${money(costs.products)}</dd></div><div><dt>Shipping estimate</dt><dd>${money(costs.shipping)}</dd></div><div><dt>VAT & duties estimate</dt><dd>${money(costs.tax)}</dd></div><div><dt>Contingency</dt><dd>${money(costs.contingency)}</dd></div></dl>
        <p class="estimate-note">${plan ? 'Prices are live Qwen model estimates, not supplier quotations. Verify against real listings before purchasing.' : 'Estimates are indicative, not supplier quotations. Demo catalogue data is clearly separated from live marketplace data.'}</p>
      </aside>
    </section>
    ${insight}
    <section class="result-actions"><button class="secondary" onclick="window.print()">PRINT REPORT</button><button class="primary" data-restart>START ANOTHER PLAN <b>↗</b></button></section>
  </main>`;
}

function showResults() {
  state.running = false;
  app.innerHTML = resultsView(); window.scrollTo(0, 0);
  document.querySelectorAll('[data-restart]').forEach(b => b.addEventListener('click', showLanding));
  document.querySelector('[data-about]').addEventListener('click', showAbout);
  document.querySelector('[data-generate-image]')?.addEventListener('click', generateConceptImage);
}

async function generateConceptImage(event) {
  const button = event.currentTarget;
  const frame = document.querySelector('[data-concept]');
  if (!frame || button.disabled) return;
  button.disabled = true; button.textContent = 'GENERATING…';
  frame.innerHTML = '<span class="generating">Qwen is rendering your concept…</span>';
  try {
    const { url } = await api.image({
      business: state.scenario.type,
      city: state.city,
      items: state.scenario.items.map(item => item[0])
    });
    state.conceptImage = url;
    frame.innerHTML = `<img src="${url}" alt="AI concept visual of the business">`;
    button.textContent = 'REGENERATE IMAGE';
  } catch (err) {
    frame.innerHTML = `<span>Image generation failed: ${err.message}</span>`;
    button.textContent = 'TRY AGAIN';
  } finally {
    button.disabled = false;
  }
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const PLANNING_LINES = [
  'Qwen Coordinator is analysing your brief…',
  'Designing your specialist agent team…',
  'Estimating realistic equipment prices…',
  'Fitting the package inside your budget envelope…',
  'Running critic review on the draft package…'
];

// ---------------------------------------------------------------------------
// The VR / 3D operations room (host)
// ---------------------------------------------------------------------------

async function runSwarm3D() {
  if (state.running) return;
  state.plan = null; state.conceptImage = null; state.session = null;
  app.innerHTML = `${header()}
    <main class="xr-shell">
      <div class="xr-canvas" id="xr-canvas"></div>
      <div class="xr-hud">
        <div class="xr-hud-top">
          <div class="xr-brief"><span>3D OPS ROOM</span><strong id="xr-title">SupplySwarm</strong><em id="xr-sub">Hold the coordinator and speak — or type your brief</em>
            <div class="xr-code" id="xr-code" hidden><span>MOBILE JOIN CODE</span><b id="xr-code-value">····</b></div>
          </div>
          <div class="xr-hud-buttons">
            <button class="xr-btn" id="xr-vr" hidden>ENTER VR</button>
            <button class="xr-btn ghost" id="xr-back">EXIT 3D</button>
          </div>
        </div>
        <div class="xr-hud-bottom">
          <div class="xr-phase"><i id="xr-progress"></i><span id="xr-phase-label">AWAITING YOUR BRIEF</span></div>
          <div class="xr-feed" id="xr-feed" aria-live="polite"></div>
          <div class="xr-ask" id="xr-ask">
            <input id="xr-idea" maxlength="280" autocomplete="off" placeholder="Or type: a small gym in Birmingham with a £15,000 budget…">
            <button id="xr-go" aria-label="Assemble the swarm">GO ↗</button>
          </div>
          <button class="xr-btn done" id="xr-results" hidden>VIEW LAUNCH PLAN ↗</button>
        </div>
      </div>
      <p class="xr-hint">Hold the centre robot to talk · drag to orbit · scroll to zoom</p>
    </main>`;
  window.scrollTo(0, 0);
  document.querySelector('[data-about]').addEventListener('click', showAbout);
  let room = null;
  let hostStream = null;
  const cleanupHost = () => { hostStream?.close(); hostStream = null; };
  document.querySelector('#xr-back').addEventListener('click', () => { cleanupHost(); room?.dispose(); sfx.stopMusic(); showLanding(); });

  const { launchOpsRoom } = await import('./xr-room.js');
  if (!document.querySelector('#xr-canvas')) return;
  room = launchOpsRoom({
    container: document.querySelector('#xr-canvas'),
    brief: null,
    phaseNames: PHASE_NAMES,
    money,
    onComplete: () => {
      const btn = document.querySelector('#xr-results');
      if (btn) { btn.hidden = false; }
    },
    onExit: null
  });
  sfx.startMusic();

  // Create the realtime session so phones can join with the code.
  let sessionCode = null;
  try {
    sessionCode = (await api.createSession()).code;
    state.session = sessionCode;
    const chip = document.querySelector('#xr-code');
    if (chip) { chip.hidden = false; document.querySelector('#xr-code-value').textContent = sessionCode; }
    room.setSessionCode?.(sessionCode);
    hostStream = new EventSource(`/api/session/${sessionCode}/stream`);
    hostStream.addEventListener('brief', e => {
      const { text } = JSON.parse(e.data);
      if (state.running || room.isRunning()) return;
      const input = document.querySelector('#xr-idea');
      if (input) input.value = text;
      room.setStatus('Brief received from mobile — assembling the swarm');
      beginRun(text);
    });
  } catch { /* sessions unavailable — the room still works standalone */ }

  const postState = (status, briefLine) => { if (sessionCode) api.push(sessionCode, 'state', { status, briefLine }); };
  const postEvent = payload => { if (sessionCode) api.push(sessionCode, 'event', payload); };

  let finalized = false;
  async function finalizeRun() {
    if (finalized) return; finalized = true;
    let imageUrl = null;
    if (api.live) {
      postEvent({ who: 'Coordinator', text: 'Rendering your concept visual…', progress: 100, phase: 'RENDERING CONCEPT' });
      try {
        const { url } = await api.image({
          business: state.scenario.type,
          city: state.city,
          items: state.scenario.items.map(item => item[0])
        });
        imageUrl = url;
        state.conceptImage = url;
      } catch (err) { console.warn('Concept image failed:', err.message); }
    }
    if (sessionCode) {
      try { await api.request(`/api/session/${sessionCode}/complete`, { plan: buildPlanPayload(), imageUrl }); } catch {}
    }
  }

  room.callbacks.onEvent = ({ who, text, progress, phase }) => {
    const feed = document.querySelector('#xr-feed');
    if (feed) {
      const row = document.createElement('div');
      row.className = `xr-event ${/critic/i.test(who) ? 'warning' : ''}`;
      row.innerHTML = `<b>${who}</b><p>${text}</p>`;
      feed.prepend(row);
      while (feed.children.length > 3) feed.lastChild.remove();
    }
    const phaseLabel = document.querySelector('#xr-phase-label');
    if (phaseLabel) phaseLabel.textContent = phase;
    const bar = document.querySelector('#xr-progress');
    if (bar) bar.style.width = `${progress}%`;
    postEvent({ who, text, progress, phase });
    if (progress >= 100) finalizeRun();
  };
  room.callbacks.onXRError = () => {
    const vrBtn = document.querySelector('#xr-vr');
    if (vrBtn) { vrBtn.textContent = 'VR UNAVAILABLE'; vrBtn.disabled = true; }
  };

  const setHudBrief = (label) => {
    const title = document.querySelector('#xr-title'), sub = document.querySelector('#xr-sub');
    if (title) title.textContent = state.scenario.type;
    if (sub) sub.textContent = `${state.city} · ${money(state.budget)} ceiling${label ? ` · ${label}` : ''}`;
  };
  const setPhase = (text) => {
    const label = document.querySelector('#xr-phase-label');
    if (label) label.textContent = text;
  };

  async function beginRun(text) {
    const trimmed = (text || '').trim();
    if (state.running) return;
    if (!trimmed) {
      room.setStatus('Hold the coordinator and speak, or type your business brief below');
      document.querySelector('#xr-idea')?.focus();
      return;
    }
    state.running = true;
    const ask = document.querySelector('#xr-ask');
    if (ask) ask.hidden = true;
    parseBrief(trimmed);
    const briefLine = `${state.scenario.type} · ${money(state.budget)}`;
    if (api.live) {
      setPhase('QWEN COORDINATOR PLANNING');
      postState('planning', briefLine);
      let lineIndex = 0;
      room.setStatus(PLANNING_LINES[0]);
      const ticker = setInterval(() => { lineIndex++; room.setStatus(PLANNING_LINES[lineIndex % PLANNING_LINES.length]); }, 2400);
      try {
        const plan = await api.plan(trimmed);
        clearInterval(ticker);
        applyPlan(plan);
        setHudBrief('live Qwen plan');
        postState('running', `${state.scenario.type} · ${money(state.budget)}`);
        room.begin(state.scenario, plan.events, { type: state.scenario.type, budget: state.budget });
      } catch (err) {
        clearInterval(ticker);
        setHudBrief(`live planning unavailable · demo catalogue`);
        room.setStatus(`Live planning unavailable — showing the demo catalogue`);
        console.warn('Live planning failed:', err.message);
        await wait(1600);
        postState('running', briefLine);
        room.begin(state.scenario, buildEvents(), { type: state.scenario.type, budget: state.budget });
      }
    } else {
      setHudBrief('demo catalogue');
      postState('running', briefLine);
      room.begin(state.scenario, buildEvents(), { type: state.scenario.type, budget: state.budget });
    }
  }

  document.querySelector('#xr-go').addEventListener('click', () => beginRun(document.querySelector('#xr-idea').value));
  document.querySelector('#xr-idea').addEventListener('keydown', e => { if (e.key === 'Enter') beginRun(e.currentTarget.value); });

  // Hold the coordinator (or point a VR controller at it and hold trigger) to speak.
  const recorder = createVoiceRecorder();
  let holdActive = false;
  let recorderStarting = false;
  let transcribing = false;

  const finishVoiceBrief = async () => {
    if (transcribing || !recorder.active()) return;
    transcribing = true;
    room.setListening(false);
    room.setStatus('Transcribing with Qwen ASR…');
    try {
      const { base64, mime } = await recorder.stop();
      const { text } = await api.transcribe(base64, mime);
      if (!text?.trim()) { room.setStatus("I didn't catch that — hold me and try again"); return; }
      const input = document.querySelector('#xr-idea');
      if (input) input.value = text;
      beginRun(text);
    } catch (err) {
      room.setStatus(err.message === 'Recording too short' ? 'Keep holding while you speak, then release' : 'Transcription failed — hold me and try again, or type below');
    } finally {
      transcribing = false;
    }
  };

  room.callbacks.onHoldStart = async () => {
    if (state.running || room.isRunning() || recorderStarting || recorder.active() || transcribing) return;
    if (!api.live) { room.setStatus('Voice needs a Qwen Cloud key — type your brief instead'); return; }
    holdActive = true;
    recorderStarting = true;
    try {
      await recorder.start();
      recorderStarting = false;
      if (holdActive) room.setListening(true);
      else await finishVoiceBrief();
    } catch {
      recorderStarting = false;
      room.setStatus('Microphone access denied — type your brief instead');
    }
  };
  room.callbacks.onHoldEnd = async () => {
    holdActive = false;
    if (recorderStarting) return;
    await finishVoiceBrief();
  };

  if (await room.vrSupported()) {
    const vrBtn = document.querySelector('#xr-vr');
    vrBtn.hidden = false;
    vrBtn.addEventListener('click', () => room.enterVR());
  }
  document.querySelector('#xr-results').addEventListener('click', () => { cleanupHost(); room.dispose(); sfx.stopMusic(); showResults(); });
}

// ---------------------------------------------------------------------------
// Boot — support deep links straight to the mobile join screen.
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
if (location.hash.startsWith('#join') || params.has('join')) {
  showJoin((params.get('join') || location.hash.split('=')[1] || '').toUpperCase().slice(0, 4));
} else {
  showLanding();
}
api.init();
