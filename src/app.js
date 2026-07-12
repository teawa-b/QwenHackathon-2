import './style.css';

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

const state = { phase: 'brief', scenario: scenarios.studio, budget: 10000, city: 'Coventry', team: 4, running: false, plan: null, conceptImage: null };

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
      el.textContent = this.live ? 'Live planning · Qwen speech recognition' : 'Demo catalogue · add a Qwen key for live voice';
    });
    document.querySelectorAll('[data-voice]').forEach(button => {
      button.setAttribute('aria-label', this.live ? 'Speak your business brief' : 'Voice input unavailable in demo mode');
      button.title = this.live ? 'Speak your brief — transcribed by Qwen ASR' : 'Voice input activates when Qwen Cloud is connected';
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
  image(payload) { return this.request('/api/image', payload); }
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

function header() {
  return `<header class="topbar">
    <a class="brand" href="#" aria-label="SupplySwarm home"><span class="brand-mark"><i></i><i></i><i></i></span><span>SUPPLY<em>SWARM</em></span></a>
    <div class="mode"><span></span> <b data-mode-label>${modeLabel()}</b></div>
    <button class="menu" aria-label="About SupplySwarm" data-about>?</button>
  </header>`;
}

function briefView() {
  return `${header()}
  <main class="brief-shell">
    <section class="hero-copy">
      <div class="eyebrow"><span>01</span> Procurement, assembled</div>
      <h1>Build the business.<br><strong>We’ll source the rest.</strong></h1>
      <p>Describe your idea. A society of specialist agents will turn it into an evidence-led equipment and supplier plan—without crossing your budget.</p>
    </section>
    <section class="command-card">
      <div class="robot-stage" aria-hidden="true">
        <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
        <div class="bot-shadow"></div>
        <div class="bot">
          <div class="antenna"><span></span></div><div class="ear left"></div><div class="ear right"></div>
          <div class="face"><b></b><b></b><div class="mouth"></div></div>
          <div class="body"><span class="core"></span></div>
        </div>
        <div class="signal signal-a">£</div><div class="signal signal-b">✓</div><div class="signal signal-c">⌁</div>
      </div>
      <div class="prompt-area">
        <div class="prompt-label"><span class="live-dot"></span> MAIN ROBOT // READY</div>
        <label for="idea">What business are you building?</label>
        <div class="input-wrap">
          <textarea id="idea" rows="3" maxlength="280" placeholder="Tell us what you're building, where, your budget, and roughly how many people it needs to support."></textarea>
          <button class="voice" type="button" data-voice aria-label="${api.live ? 'Speak your business brief' : 'Voice input unavailable in demo mode'}" title="${api.live ? 'Speak your brief — transcribed by Qwen ASR' : 'Voice input activates when Qwen Cloud is connected'}">⌁</button>
        </div>
        <div class="examples" aria-label="Example briefs">
          <button data-example="studio">Game studio · £10k</button>
          <button data-example="gym">Small gym · £15k</button>
          <button data-example="podcast">Podcast room · £5k</button>
        </div>
        <button class="assemble" data-start><span>ASSEMBLE MY SWARM</span><b>↗</b></button>
        <button class="assemble xr-launch" data-start-3d><span>ENTER 3D OPS ROOM · VR</span><b>◈</b></button>
        <p class="fineprint">No purchases or supplier messages are sent. Every consequential action requires your approval.</p>
      </div>
    </section>
    <section class="proof-strip">
      <div><b>06</b><span>Specialist agents</span></div><div><b>01</b><span>Shared budget</span></div><div><b>100%</b><span>Evidence labelled</span></div>
      <p>Powered by <strong>QWEN CLOUD</strong><br><span data-live-copy>${api.live ? 'Live planning · Qwen speech recognition' : 'Demo catalogue · add a Qwen key for live voice'}</span></p>
    </section>
  </main>`;
}

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

function workspaceView() {
  const s = state.scenario;
  return `${header()}
    <main class="workspace">
      <section class="workspace-head">
        <div><div class="eyebrow"><span>02</span> Swarm operations room</div><h1>${s.type}</h1><p>${state.team}-person launch · ${state.city} · Equipment only</p></div>
        <div class="budget-chip"><span>BUDGET CEILING</span><strong>${money(state.budget)}</strong></div>
      </section>
      <section class="ops-grid">
        <aside class="agent-panel">
          <div class="panel-title"><span>ACTIVE AGENTS</span><b id="agent-count">0 / ${s.agents.length}</b></div>
          <div class="agent-list">${s.agents.map((a, i) => `<article class="agent" data-agent="${i}"><div class="agent-avatar">${a[0]}</div><div><strong>${a[1]}</strong><span>${a[2]}</span></div><i></i></article>`).join('')}</div>
        </aside>
        <section class="mission-panel">
          <div class="hive-visual" aria-label="Animated agent coordination map">
            <div class="hub"><div class="mini-face"><i></i><i></i></div><span>COORDINATOR</span></div>
            ${s.agents.slice(0, 7).map((a, i) => `<div class="node node-${i + 1}" data-node="${i}"><b>${a[0]}</b></div>`).join('')}
            <svg viewBox="0 0 600 360" preserveAspectRatio="none" aria-hidden="true">${s.agents.slice(0, 7).map((_, i) => `<line x1="300" y1="180" x2="${[105,185,405,495,190,410,300][i]}" y2="${[82,290,290,82,55,55,325][i]}"/>`).join('')}</svg>
          </div>
          <div class="event-console">
            <div class="console-head"><span>LIVE AGENT EVENTS</span><div><i></i><i></i><i></i></div></div>
            <div id="events" class="events" aria-live="polite"></div>
          </div>
        </section>
        <aside class="brief-panel">
          <div class="panel-title"><span>VALIDATED BRIEF</span><b>LOCKED</b></div>
          <dl><div><dt>Business</dt><dd>${s.type}</dd></div><div><dt>Location</dt><dd>${state.city}, UK</dd></div><div><dt>Team</dt><dd>${state.team} people</dd></div><div><dt>Budget</dt><dd>${money(state.budget)}</dd></div><div><dt>Scope</dt><dd>Equipment only</dd></div><div><dt>Marketplace</dt><dd>Alibaba.com</dd></div></dl>
          <div class="guardrail"><b>HUMAN APPROVAL</b><span>Required before supplier contact or purchase</span></div>
        </aside>
      </section>
      <section class="status-ribbon"><span id="phase-label">VALIDATING BRIEF</span><div class="progress"><i id="progress-bar"></i></div><b id="progress-value">08%</b></section>
    </main>`;
}

function resultsView() {
  const s = state.scenario;
  const plan = state.plan;
  const rawProducts = s.items.reduce((n, item) => n + item[2], 0);
  const rawShipping = Math.round(rawProducts * 0.075);
  const rawTax = Math.round((rawProducts + rawShipping) * 0.08);
  const rawContingency = Math.round(rawProducts * 0.05);
  let total = rawProducts + rawShipping + rawTax + rawContingency;
  // Demo catalogue items may be rescaled to a custom budget. Live Qwen plans are
  // never silently rescaled: if the critic could not fit the budget, we say so.
  const scale = !plan && total > state.budget ? (state.budget * .965) / total : 1;
  const adjusted = s.items.map(item => [...item.slice(0, 2), Math.round(item[2] * scale), ...item.slice(3)]);
  const subtotal = adjusted.reduce((n, item) => n + item[2], 0);
  const finalShipping = Math.round(rawShipping * scale), finalTax = Math.round(rawTax * scale), finalContingency = Math.round(rawContingency * scale);
  total = subtotal + finalShipping + finalTax + finalContingency;
  const remaining = state.budget - total;
  const overBudget = total > state.budget;
  const cmp = plan?.comparison;
  const measuredCompare = cmp ? `<section class="evaluation">
        <div><span class="label">MEASURED VS SINGLE AGENT</span><h2>The swarm advantage, measured.</h2><p>This exact brief was also given to one solo Qwen agent with identical web-search tools, run live in parallel as a control. Both packages were scored by the same deterministic validators — nothing scripted.${cmp.parallel_speedup > 1 ? ` Running the specialists in parallel was ${cmp.parallel_speedup}× faster than running them one at a time.` : ''}</p></div>
        <div class="compare">
          <div class="single"><span>SINGLE AGENT (CONTROL)</span><b>${cmp.single ? `${cmp.single.verified_links} live listing${cmp.single.verified_links === 1 ? '' : 's'}` : 'RUN FAILED'}</b><p>${cmp.single ? `${cmp.single.items} items · ${money(cmp.single.landed_total)} landed · ${cmp.single.budget_valid ? 'inside budget' : 'OVER budget'} · ${cmp.single.seconds}s` : 'The solo agent returned no usable package for this brief.'}</p></div>
          <div class="multi"><span>SUPPLYSWARM</span><b>${cmp.swarm.verified_links} live listing${cmp.swarm.verified_links === 1 ? '' : 's'}</b><p>${cmp.swarm.items} items · ${money(cmp.swarm.landed_total)} landed · ${cmp.swarm.budget_valid ? 'inside budget' : 'over budget'} · ${cmp.swarm.seconds}s</p></div>
        </div>
      </section>` : '';
  const insight = plan
    ? `${measuredCompare}<section class="evaluation">
        <div><span class="label">QWEN SWARM FINDINGS</span><h2>Risks &amp; assumptions.</h2><p>Generated live by Qwen Cloud${plan.revised ? ' — the critic caught an over-budget package and revised it before approval.' : '.'}</p></div>
        <div class="findings">
          <div><span>RISKS</span><ul>${plan.risks.map(r => `<li>${r}</li>`).join('') || '<li>No blocking risks recorded.</li>'}</ul></div>
          <div><span>ASSUMPTIONS</span><ul>${plan.assumptions.map(a => `<li>${a}</li>`).join('') || '<li>No assumptions recorded.</li>'}</ul></div>
        </div>
      </section>
      <section class="concept">
        <div><span class="label">CONCEPT VISUAL</span><h2>See your business.</h2><p>Qwen can generate an illustrative concept image of the finished space. Illustrative only — not a floor plan.</p><button class="secondary" data-generate-image>GENERATE CONCEPT IMAGE</button></div>
        <figure class="concept-frame" data-concept>${state.conceptImage ? `<img src="${state.conceptImage}" alt="AI concept visual of the business">` : '<span>No image generated yet</span>'}</figure>
      </section>`
    : `<section class="evaluation">
        <div><span class="label">WHY A SWARM?</span><h2>One brief. Better decisions.</h2><p>The critic caught a seeded over-budget plan and the specialists rebuilt it as a mixed-tier package. (Scripted demo comparison.)</p></div>
        <div class="compare"><div class="single"><span>SINGLE AGENT</span><b>${money(Math.round(state.budget * 1.107))}</b><p>Shipping omitted · 2 unverified items</p></div><div class="multi"><span>SUPPLYSWARM</span><b>${money(total)}</b><p>Landed cost included · ${adjusted.length}/${adjusted.length} items evidenced</p></div></div>
      </section>`;
  return `${header()}
  <main class="results">
    <section class="result-hero">
      <div><div class="eyebrow"><span>03</span> ${plan ? 'Live plan generated by Qwen Cloud' : 'Package approved by critic'}</div><h1>Your launch plan<br><strong>is ready.</strong></h1><p>${s.type} · ${state.city} · ${state.team}-person team</p></div>
      <div class="approval-seal ${overBudget ? 'warn' : ''}"><span>${overBudget ? '!' : '✓'}</span><b>${overBudget ? 'OVER<br>BUDGET' : 'BUDGET<br>VALID'}</b></div>
    </section>
    <section class="result-grid">
      <div class="package-card">
        <div class="package-head"><div><span>RECOMMENDED PACKAGE</span><h2>Launch-ready essentials</h2></div><button data-restart>NEW BRIEF</button></div>
        <div class="items">${adjusted.map((item, i) => `<article class="product"><span class="item-no">${String(i + 1).padStart(2, '0')}</span><div><h3>${item[5] ? `<a href="${item[5]}" target="_blank" rel="noopener noreferrer">${item[0]} ↗</a>` : item[0]}</h3><p>${item[1]}${item[6] ? ` · ${item[6]}` : ''}</p><div class="tags"><span>${item[3]}</span><span>${item[4]}</span>${item[5] ? '<span class="tag-link">ALIBABA.COM</span>' : ''}</div></div><strong>${money(item[2])}</strong></article>`).join('')}</div>
      </div>
      <aside class="cost-card">
        <span class="label">LANDED COST ESTIMATE</span><div class="total"><small>Package total</small><strong>${money(total)}</strong><span>of ${money(state.budget)}</span></div>
        <div class="budget-meter"><i style="width:${Math.min(100, total / state.budget * 100)}%"></i></div>
        <div class="remaining"><span>Budget ${overBudget ? 'exceeded by' : 'remaining'}</span><b>${money(Math.abs(remaining))}</b></div>
        <dl><div><dt>Products</dt><dd>${money(subtotal)}</dd></div><div><dt>Shipping estimate</dt><dd>${money(finalShipping)}</dd></div><div><dt>VAT & duties estimate</dt><dd>${money(finalTax)}</dd></div><div><dt>Contingency</dt><dd>${money(finalContingency)}</dd></div></dl>
        <p class="estimate-note">${plan ? 'Linked items point to real Alibaba.com listings found by Qwen live web search; unlinked lines are labelled estimates. Confirm prices and MOQ on the listing before purchasing.' : 'Estimates are indicative, not supplier quotations. Demo catalogue data is clearly separated from live marketplace data.'}</p>
      </aside>
    </section>
    ${insight}
    <section class="result-actions"><button class="secondary" onclick="window.print()">PRINT REPORT</button><button class="primary" data-restart>START ANOTHER PLAN <b>↗</b></button></section>
  </main>`;
}

function showBrief() {
  state.running = false; app.innerHTML = briefView(); bindBrief(); window.scrollTo(0, 0);
}

function bindBrief() {
  document.querySelectorAll('[data-example]').forEach(btn => btn.addEventListener('click', () => {
    const copy = { studio: 'I want to start a four-person game development studio in Coventry with a £10,000 equipment budget for PC and VR games.', gym: 'I want to open a small training gym in Birmingham with a £15,000 equipment budget.', podcast: 'I need a four-person podcast production room in Manchester with a £5,000 equipment budget.' };
    document.querySelector('#idea').value = copy[btn.dataset.example];
  }));
  document.querySelector('[data-start]').addEventListener('click', () => {
    const idea = document.querySelector('#idea');
    const text = idea.value.trim();
    if (!text) {
      idea.setCustomValidity('Describe your business first, or choose an example brief.');
      idea.reportValidity();
      idea.focus();
      return;
    }
    idea.setCustomValidity('');
    parseBrief(text);
    runSwarm(text);
  });
  // The 3D room always opens idle. A landing-page example must never start or
  // prefill the room: the user talks to the coordinator (or types) from there.
  document.querySelector('[data-start-3d]').addEventListener('click', () => runSwarm3D());
  document.querySelector('#idea').addEventListener('input', event => event.currentTarget.setCustomValidity(''));
  document.querySelector('[data-about]').addEventListener('click', showAbout);
  bindVoice();
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

function bindVoice() {
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
        const idea = document.querySelector('#idea');
        if (idea && text) idea.value = text;
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
  dialog.innerHTML = `<button aria-label="Close">×</button><span class="label">ABOUT THE DEMO</span><h2>A procurement department, formed on demand.</h2><p>SupplySwarm demonstrates Qwen-powered task division: each specialist agent runs its own Qwen call with live web search against Alibaba.com, real listing links are verified against the search results, a deterministic calculator handles landed costs, and a Critic agent revises over-budget packages.</p><p>Without a Qwen Cloud key the app falls back to a transparent demo catalogue — nothing is ever simulated as live.</p>`;
  document.body.append(dialog); dialog.showModal();
  dialog.querySelector('button').onclick = () => { dialog.close(); dialog.remove(); };
}

const PHASE_NAMES = ['VALIDATING BRIEF', 'SPAWNING SPECIALISTS', 'SOURCING CANDIDATES', 'VERIFYING SUPPLIERS', 'CALCULATING LANDED COST', 'CRITIC REVIEW', 'REVISING PACKAGE', 'FINAL VERIFICATION', 'COMPLETE'];

function buildEvents() {
  return [
    ['Coordinator', 'Structured brief validated. No blocking questions.', 8, 'Swarm'],
    [state.scenario.agents[0][1], `Searching ${state.scenario.items[0][0].toLowerCase()} candidates.`, 20, 'Coordinator'],
    [state.scenario.agents[1][1], 'Rejected 9 listings with incompatible specifications.', 34, 'Coordinator'],
    [state.scenario.agents[2][1], 'Supplier and MOQ evidence attached to shortlist.', 48, state.scenario.agents[0][1]],
    [state.scenario.agents[3][1], 'Calculating shipping, VAT and landed cost estimates.', 61, 'Coordinator'],
    ['Critic', 'Budget conflict detected: first package is 10.7% over ceiling.', 72, 'Swarm'],
    [state.scenario.agents[0][1], 'Revised package with mixed-tier equipment.', 84, 'Critic'],
    ['Critic', 'All essentials covered. Evidence and uncertainty labels verified.', 96, 'Coordinator'],
    ['Coordinator', 'Package approved. Preparing your launch plan.', 100, 'Swarm']
  ];
}

function showResults() {
  state.running = false;
  app.innerHTML = resultsView(); window.scrollTo(0, 0);
  document.querySelectorAll('[data-restart]').forEach(b => b.addEventListener('click', showBrief));
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

function pushConsoleEvent(index, who, text, warning = false, to = '') {
  const feed = document.querySelector('#events');
  if (!feed) return;
  const row = document.createElement('div');
  row.className = `event ${warning ? 'warning' : ''}`;
  row.innerHTML = `<time>${String(index + 1).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}</time><b>${who}${to ? ` → ${to}` : ''}</b><p>${text}</p>`;
  feed.prepend(row);
}

async function playTimeline(events) {
  const agentTotal = state.scenario.agents.length;
  for (let i = 0; i < events.length; i++) {
    const [who, text, progress, to] = events[i];
    // Light up the panel entry for whichever agent is actually speaking.
    const speakerIndex = state.scenario.agents.findIndex(a =>
      a[1].toLowerCase() === String(who).toLowerCase() || a[0].toLowerCase() === String(who).toLowerCase());
    if (speakerIndex >= 0) {
      document.querySelector(`[data-agent="${speakerIndex}"]`)?.classList.add('active');
      document.querySelector(`[data-node="${speakerIndex}"]`)?.classList.add('active');
      const counter = document.querySelector('#agent-count');
      if (counter) counter.textContent = `${document.querySelectorAll('.agent.active').length} / ${agentTotal}`;
    }
    pushConsoleEvent(i, who, text, /critic/i.test(who), to);
    const phaseIndex = Math.min(PHASE_NAMES.length - 1, Math.floor(i / Math.max(1, events.length - 1) * (PHASE_NAMES.length - 1)));
    const label = document.querySelector('#phase-label');
    if (label) label.textContent = PHASE_NAMES[phaseIndex];
    const bar = document.querySelector('#progress-bar'), value = document.querySelector('#progress-value');
    if (bar) bar.style.width = `${progress}%`;
    if (value) value.textContent = `${String(progress).padStart(2, '0')}%`;
    await wait(state.plan ? 900 : 620);
  }
}

const PLANNING_LINES = [
  'Qwen Coordinator is analysing your brief…',
  'Designing your specialist agent team…',
  'Specialists are searching Alibaba.com live for real listings…',
  'Verifying listing links, prices and suppliers…',
  'Fitting the package inside your budget envelope…',
  'Running critic review on the draft package…'
];

function startPlanningTicker() {
  let index = 0;
  const label = document.querySelector('#phase-label');
  if (label) label.textContent = 'QWEN COORDINATOR PLANNING';
  pushConsoleEvent(index, 'Coordinator', PLANNING_LINES[0]);
  const interval = setInterval(() => {
    index++;
    pushConsoleEvent(index, 'Coordinator', PLANNING_LINES[index % PLANNING_LINES.length]);
    const bar = document.querySelector('#progress-bar');
    if (bar) bar.style.width = `${Math.min(18, 4 + index * 3)}%`;
  }, 2400);
  return () => clearInterval(interval);
}

async function runSwarm(text) {
  if (state.running) return; state.running = true;
  state.plan = null; state.conceptImage = null;
  app.innerHTML = workspaceView(); window.scrollTo(0, 0);
  document.querySelector('[data-about]').addEventListener('click', showAbout);
  if (api.live && text) {
    const stopTicker = startPlanningTicker();
    try {
      const plan = await api.plan(text);
      stopTicker();
      applyPlan(plan);
      app.innerHTML = workspaceView();
      document.querySelector('[data-about]').addEventListener('click', showAbout);
      await playTimeline(plan.events);
    } catch (err) {
      stopTicker();
      pushConsoleEvent(0, 'Coordinator', `Live planning unavailable (${err.message}). Continuing with the demo catalogue.`, true);
      await wait(1400);
      await playTimeline(buildEvents());
    }
  } else {
    await playTimeline(buildEvents());
  }
  await wait(500); showResults();
}

async function runSwarm3D() {
  if (state.running) return;
  state.plan = null; state.conceptImage = null;
  app.innerHTML = `${header()}
    <main class="xr-shell">
      <div class="xr-canvas" id="xr-canvas"></div>
      <div class="xr-hud">
        <div class="xr-hud-top">
          <div class="xr-brief"><span>3D OPS ROOM</span><strong id="xr-title">SupplySwarm</strong><em id="xr-sub">Hold the coordinator and speak — or type your brief</em></div>
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
  document.querySelector('#xr-back').addEventListener('click', () => { room?.dispose(); showBrief(); });

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

  room.callbacks.onEvent = ({ who, to, text, progress, phase }) => {
    const feed = document.querySelector('#xr-feed');
    if (!feed) return;
    const row = document.createElement('div');
    row.className = `xr-event ${/critic/i.test(who) ? 'warning' : ''}`;
    row.innerHTML = `<b>${who}${to ? ` → ${to}` : ''}</b><p>${text}</p>`;
    feed.prepend(row);
    while (feed.children.length > 3) feed.lastChild.remove();
    document.querySelector('#xr-phase-label').textContent = phase;
    document.querySelector('#xr-progress').style.width = `${progress}%`;
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
    if (api.live) {
      setPhase('QWEN COORDINATOR PLANNING');
      let lineIndex = 0;
      room.setStatus(PLANNING_LINES[0]);
      const ticker = setInterval(() => { lineIndex++; room.setStatus(PLANNING_LINES[lineIndex % PLANNING_LINES.length]); }, 2400);
      try {
        const plan = await api.plan(trimmed);
        clearInterval(ticker);
        applyPlan(plan);
        setHudBrief('live Qwen plan');
        room.begin(state.scenario, plan.events, { type: state.scenario.type, budget: state.budget });
      } catch (err) {
        clearInterval(ticker);
        setHudBrief(`live planning unavailable · demo catalogue`);
        room.setStatus(`Live planning unavailable — showing the demo catalogue`);
        console.warn('Live planning failed:', err.message);
        await wait(1600);
        room.begin(state.scenario, buildEvents(), { type: state.scenario.type, budget: state.budget });
      }
    } else {
      setHudBrief('demo catalogue');
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
  document.querySelector('#xr-results').addEventListener('click', () => { room.dispose(); showResults(); });
}

showBrief();
api.init();
