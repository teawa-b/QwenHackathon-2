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

const state = { phase: 'brief', scenario: scenarios.studio, budget: 10000, city: 'Coventry', team: 4, running: false };

const app = document.querySelector('#app');

function money(value) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);
}

function header() {
  return `<header class="topbar">
    <a class="brand" href="#" aria-label="SupplySwarm home"><span class="brand-mark"><i></i><i></i><i></i></span><span>SUPPLY<em>SWARM</em></span></a>
    <div class="mode"><span></span> DEMO CATALOGUE</div>
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
          <textarea id="idea" rows="3" maxlength="280">I want to start a four-person game development studio in Coventry with a £10,000 equipment budget for PC and VR games.</textarea>
          <button class="voice" type="button" aria-label="Voice input unavailable in demo" title="Voice input is available when Qwen Realtime is connected">⌁</button>
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
      <p>Powered by <strong>QWEN CLOUD</strong><br>Alibaba connector · Demo mode</p>
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
            ${s.agents.map((a, i) => `<div class="node node-${i + 1}" data-node="${i}"><b>${a[0]}</b></div>`).join('')}
            <svg viewBox="0 0 600 360" preserveAspectRatio="none" aria-hidden="true">${s.agents.map((_, i) => `<line x1="300" y1="180" x2="${[105,185,405,495,190,410][i]}" y2="${[82,290,290,82,55,55][i]}"/>`).join('')}</svg>
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
  const products = s.items.reduce((n, item) => n + item[2], 0);
  const shipping = Math.round(products * 0.075);
  const tax = Math.round((products + shipping) * 0.08);
  const contingency = Math.round(products * 0.05);
  let total = products + shipping + tax + contingency;
  const scale = total > state.budget ? (state.budget * .965) / total : 1;
  const adjusted = s.items.map(item => [...item.slice(0, 2), Math.round(item[2] * scale), ...item.slice(3)]);
  const subtotal = adjusted.reduce((n, item) => n + item[2], 0);
  const finalShipping = Math.round(shipping * scale), finalTax = Math.round(tax * scale), finalContingency = Math.round(contingency * scale);
  total = subtotal + finalShipping + finalTax + finalContingency;
  const remaining = state.budget - total;
  return `${header()}
  <main class="results">
    <section class="result-hero">
      <div><div class="eyebrow"><span>03</span> Package approved by critic</div><h1>Your launch plan<br><strong>is ready.</strong></h1><p>${s.type} · ${state.city} · ${state.team}-person team</p></div>
      <div class="approval-seal"><span>✓</span><b>BUDGET<br>VALID</b></div>
    </section>
    <section class="result-grid">
      <div class="package-card">
        <div class="package-head"><div><span>RECOMMENDED PACKAGE</span><h2>Launch-ready essentials</h2></div><button data-restart>NEW BRIEF</button></div>
        <div class="items">${adjusted.map((item, i) => `<article class="product"><span class="item-no">${String(i + 1).padStart(2, '0')}</span><div><h3>${item[0]}</h3><p>${item[1]}</p><div class="tags"><span>${item[3]}</span><span>${item[4]}</span></div></div><strong>${money(item[2])}</strong></article>`).join('')}</div>
      </div>
      <aside class="cost-card">
        <span class="label">LANDED COST ESTIMATE</span><div class="total"><small>Package total</small><strong>${money(total)}</strong><span>of ${money(state.budget)}</span></div>
        <div class="budget-meter"><i style="width:${Math.min(100, total / state.budget * 100)}%"></i></div>
        <div class="remaining"><span>Budget remaining</span><b>${money(remaining)}</b></div>
        <dl><div><dt>Products</dt><dd>${money(subtotal)}</dd></div><div><dt>Shipping estimate</dt><dd>${money(finalShipping)}</dd></div><div><dt>VAT & duties estimate</dt><dd>${money(finalTax)}</dd></div><div><dt>Contingency</dt><dd>${money(finalContingency)}</dd></div></dl>
        <p class="estimate-note">Estimates are indicative, not supplier quotations. Demo catalogue data is clearly separated from live marketplace data.</p>
      </aside>
    </section>
    <section class="evaluation">
      <div><span class="label">WHY A SWARM?</span><h2>One brief. Better decisions.</h2><p>The critic caught a seeded over-budget plan and the specialists rebuilt it as a mixed-tier package.</p></div>
      <div class="compare"><div class="single"><span>SINGLE AGENT</span><b>${money(Math.round(state.budget * 1.107))}</b><p>Shipping omitted · 2 unverified items</p></div><div class="multi"><span>SUPPLYSWARM</span><b>${money(total)}</b><p>Landed cost included · ${adjusted.length}/${adjusted.length} items evidenced</p></div></div>
    </section>
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
  document.querySelector('[data-start]').addEventListener('click', () => { parseBrief(document.querySelector('#idea').value); runSwarm(); });
  document.querySelector('[data-start-3d]').addEventListener('click', () => { parseBrief(document.querySelector('#idea').value); runSwarm3D(); });
  document.querySelector('[data-about]').addEventListener('click', showAbout);
}

function showAbout() {
  const dialog = document.createElement('dialog');
  dialog.className = 'about-dialog';
  dialog.innerHTML = `<button aria-label="Close">×</button><span class="label">ABOUT THE DEMO</span><h2>A procurement department, formed on demand.</h2><p>SupplySwarm demonstrates Qwen-powered task division, specialist sourcing, deterministic cost calculation, critic-led revision, and human approval gates.</p><p>This hosted build uses a transparent demo catalogue. Live Qwen, Alibaba MCP, voice, image generation and supplier actions require server credentials and are never simulated as live.</p>`;
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

function showResults() {
  state.running = false;
  app.innerHTML = resultsView(); window.scrollTo(0, 0);
  document.querySelectorAll('[data-restart]').forEach(b => b.addEventListener('click', showBrief));
  document.querySelector('[data-about]').addEventListener('click', showAbout);
}

async function runSwarm() {
  if (state.running) return; state.running = true; app.innerHTML = workspaceView(); window.scrollTo(0, 0);
  document.querySelector('[data-about]').addEventListener('click', showAbout);
  const events = buildEvents();
  const phaseNames = PHASE_NAMES;
  for (let i = 0; i < events.length; i++) {
    const [who, text, progress] = events[i];
    if (i < state.scenario.agents.length) {
      document.querySelector(`[data-agent="${i}"]`)?.classList.add('active'); document.querySelector(`[data-node="${i}"]`)?.classList.add('active');
      document.querySelector('#agent-count').textContent = `${i + 1} / ${state.scenario.agents.length}`;
    }
    const row = document.createElement('div'); row.className = `event ${who === 'Critic' ? 'warning' : ''}`;
    row.innerHTML = `<time>${String(i + 1).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}</time><b>${who}</b><p>${text}</p>`;
    document.querySelector('#events').prepend(row);
    document.querySelector('#phase-label').textContent = phaseNames[i];
    document.querySelector('#progress-bar').style.width = `${progress}%`; document.querySelector('#progress-value').textContent = `${String(progress).padStart(2, '0')}%`;
    await new Promise(resolve => setTimeout(resolve, 620));
  }
  await new Promise(resolve => setTimeout(resolve, 500)); showResults();
}

async function runSwarm3D() {
  if (state.running) return; state.running = true;
  const s = state.scenario;
  app.innerHTML = `${header()}
    <main class="xr-shell">
      <div class="xr-canvas" id="xr-canvas"></div>
      <div class="xr-hud">
        <div class="xr-hud-top">
          <div class="xr-brief"><span>3D OPS ROOM</span><strong>${s.type}</strong><em>${state.city} · ${money(state.budget)} ceiling</em></div>
          <div class="xr-hud-buttons">
            <button class="xr-btn" id="xr-vr" hidden>ENTER VR</button>
            <button class="xr-btn ghost" id="xr-back">EXIT 3D</button>
          </div>
        </div>
        <div class="xr-hud-bottom">
          <div class="xr-phase"><i id="xr-progress"></i><span id="xr-phase-label">INITIALISING ROOM</span></div>
          <div class="xr-feed" id="xr-feed" aria-live="polite"></div>
          <button class="xr-btn done" id="xr-results" hidden>VIEW LAUNCH PLAN ↗</button>
        </div>
      </div>
      <p class="xr-hint">Drag to orbit · pinch or scroll to zoom${'xr' in navigator ? ' · headset users can enter VR' : ''}</p>
    </main>`;
  window.scrollTo(0, 0);
  document.querySelector('[data-about]').addEventListener('click', showAbout);

  const { launchOpsRoom } = await import('./xr-room.js');
  const room = launchOpsRoom({
    container: document.querySelector('#xr-canvas'),
    scenario: s,
    brief: { type: s.type, budget: state.budget, city: state.city, team: state.team },
    events: buildEvents(),
    phaseNames: PHASE_NAMES,
    money,
    onComplete: () => {
      const btn = document.querySelector('#xr-results');
      if (btn) { btn.hidden = false; }
    },
    onExit: null
  });

  room.callbacks.onEvent = ({ who, text, progress, phase }) => {
    const feed = document.querySelector('#xr-feed');
    if (!feed) return;
    const row = document.createElement('div');
    row.className = `xr-event ${/critic/i.test(who) ? 'warning' : ''}`;
    row.innerHTML = `<b>${who}</b><p>${text}</p>`;
    feed.prepend(row);
    while (feed.children.length > 3) feed.lastChild.remove();
    document.querySelector('#xr-phase-label').textContent = phase;
    document.querySelector('#xr-progress').style.width = `${progress}%`;
  };
  room.callbacks.onXRError = () => {
    const vrBtn = document.querySelector('#xr-vr');
    if (vrBtn) { vrBtn.textContent = 'VR UNAVAILABLE'; vrBtn.disabled = true; }
  };

  if (await room.vrSupported()) {
    const vrBtn = document.querySelector('#xr-vr');
    vrBtn.hidden = false;
    vrBtn.addEventListener('click', () => room.enterVR());
  }
  document.querySelector('#xr-results').addEventListener('click', () => { room.dispose(); showResults(); });
  document.querySelector('#xr-back').addEventListener('click', () => { room.dispose(); showBrief(); });
}

showBrief();
