import { createCompanionLink } from './live.js';

// Companion dashboard (/connect): pair a phone with a running VR/3D swarm
// session by code — watch every agent live, inspect them, send requests to a
// specific agent or the Hub, and download the final plan as a PDF.

const ACCENTS = ['#b8f632', '#55e6b1', '#ff9a6e', '#7dd3fc', '#c4b5fd', '#f9a8d4', '#fde68a'];

const money = value =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(value);

const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export function showConnect(app, prefillCode) {
  let link = null;
  const state = {
    code: prefillCode || '',
    data: null,          // server snapshot: {brief, agents, events, requests, plan, image, status}
    hostOnline: true,
    selected: 'HUB',     // selected bubble: 'HUB' or agent name
    toast: null
  };

  function header(sub) {
    return `<header class="topbar">
      <a class="brand" href="/" aria-label="SupplySwarm home"><span class="brand-mark"><i></i><i></i><i></i></span><span>SUPPLY<em>SWARM</em></span></a>
      <div class="mode"><span></span> <b>${sub}</b></div>
      <a class="menu" href="/" aria-label="Back to SupplySwarm">×</a>
    </header>`;
  }

  // ---------- Pairing screen ----------
  function renderEntry(error = '') {
    app.innerHTML = `${header('PAIR A SESSION')}
    <main class="connect-shell">
      <section class="pair-card">
        <div class="pair-orb" aria-hidden="true"><i></i><i></i><b>◈</b></div>
        <h1>Join the swarm<br><strong>from this device.</strong></h1>
        <p>Enter the 5-letter code shown in the 3D ops room — top-left, next to “PHONE LINK”.</p>
        <form id="pair-form">
          <input id="pair-code" inputmode="latin" autocomplete="one-time-code" autocapitalize="characters"
                 spellcheck="false" maxlength="5" placeholder="•••••" value="${esc(state.code)}" aria-label="Connect code">
          <button type="submit">CONNECT <b>↗</b></button>
        </form>
        <p class="pair-error" ${error ? '' : 'hidden'}>${esc(error)}</p>
        <p class="pair-hint">The code appears when someone opens the 3D Ops Room on this site.</p>
      </section>
    </main>`;
    const input = app.querySelector('#pair-code');
    input.addEventListener('input', () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
    app.querySelector('#pair-form').addEventListener('submit', e => {
      e.preventDefault();
      const code = input.value.trim().toUpperCase();
      if (code.length < 4) { renderEntry('Codes are 5 letters — check the ops room header.'); return; }
      join(code);
    });
    if (state.code && state.code.length >= 4) join(state.code);
    else input.focus();
  }

  function join(code) {
    state.code = code;
    history.replaceState(null, '', `/connect/${code}`);
    renderConnecting();
    link?.close();
    link = createCompanionLink(code, {
      onMessage: handleMessage,
      onReconnecting: () => setToast('Reconnecting…', true),
      onError: message => renderEntry(message)
    });
  }

  function renderConnecting() {
    app.innerHTML = `${header('PAIRING…')}
    <main class="connect-shell"><section class="pair-card"><div class="pair-orb wait" aria-hidden="true"><i></i><i></i><b>◈</b></div>
    <h1>Connecting to<br><strong>${esc(state.code)}</strong>…</h1></section></main>`;
  }

  // ---------- Live message handling ----------
  function handleMessage(message) {
    switch (message.type) {
      case 'error': link?.close(); renderEntry(message.message || 'Unknown or expired code'); return;
      case 'ended': link?.close(); renderEntry('That session has ended.'); return;
      case 'snapshot': state.data = message.data; state.hostOnline = message.hostOnline !== false; renderDashboard(); return;
    }
    if (!state.data) return;
    switch (message.type) {
      case 'brief':
        state.data.brief = message.brief; state.data.agents = message.agents || [];
        state.data.events = []; state.data.requests = []; state.data.plan = null; state.data.image = null;
        state.data.status = message.status || null;
        state.selected = 'HUB';
        renderDashboard();
        return;
      case 'agents': state.data.agents = message.agents || []; renderDashboard(); return;
      case 'status': state.data.status = message.status; updateStatus(); return;
      case 'event': state.data.events.push(message.event); addFeedRow(message.event); pulseBubble(message.event[0]); updateDetail(); return;
      case 'plan': state.data.plan = message.plan; updateResults(); updateDetail(); setToast('Launch plan ready — results below'); return;
      case 'image': state.data.image = message.url; updateResults(); return;
      case 'request': state.data.requests.push(message); addFeedRow(['Phone', message.text, null, message.to], true); return;
      case 'host-offline': state.hostOnline = false; setToast('Headset went offline — showing the last known state', true); return;
    }
  }

  // ---------- Dashboard ----------
  const agentAccent = index => ACCENTS[index % ACCENTS.length];

  function agentByName(name) {
    return (state.data?.agents || []).find(agent =>
      agent[1]?.toLowerCase() === String(name).toLowerCase() || agent[0]?.toLowerCase() === String(name).toLowerCase());
  }

  function renderDashboard() {
    const d = state.data;
    const brief = d.brief;
    const agents = d.agents || [];
    app.innerHTML = `${header(`LINKED · ${esc(state.code)}`)}
    <main class="companion">
      <section class="companion-head">
        <div>
          <span class="label">LIVE SWARM SESSION</span>
          <h1 id="c-title">${esc(brief?.type || 'Waiting for a brief…')}</h1>
          <p id="c-sub">${brief ? `${esc(brief.city || 'UK')} · ${money(brief.budget || 0)} ceiling · ${brief.team || 1} people` : 'Ask the headset wearer to speak or type their business idea.'}</p>
        </div>
        <div class="c-status"><i id="c-progress"></i><span id="c-phase">${esc(d.status?.phase || 'IDLE')}</span></div>
      </section>

      <section class="bubble-field" id="bubbles" aria-label="Swarm agents">
        <button class="agent-bubble is-hub ${state.selected === 'HUB' ? 'selected' : ''}" data-bubble="HUB" style="--accent:#b8f632">
          <b>HUB</b><span>Coordinator</span>
        </button>
        ${agents.map((agent, i) => `
          <button class="agent-bubble ${state.selected === agent[1] ? 'selected' : ''}" data-bubble="${esc(agent[1])}" style="--accent:${agentAccent(i)}">
            <b>${esc(agent[0])}</b><span>${esc(agent[1])}</span>
          </button>`).join('')}
        ${agents.length ? '' : '<p class="bubble-empty">Agents appear here the moment the Coordinator assembles the team.</p>'}
      </section>

      <section class="companion-detail" id="detail"></section>

      <section class="composer">
        <span class="label">SEND A REQUEST → <b id="composer-target">${esc(state.selected === 'HUB' ? 'Hub (Coordinator)' : state.selected)}</b></span>
        <form id="composer-form">
          <input id="composer-text" maxlength="200" autocomplete="off"
                 placeholder="${state.selected === 'HUB' ? 'e.g. Keep the total under £12k…' : `e.g. Prefer a cheaper option for this category…`}">
          <button type="submit" ${state.hostOnline ? '' : 'disabled'}>SEND</button>
        </form>
        <p class="composer-note">Requests appear instantly in the 3D room above the ${state.selected === 'HUB' ? 'Coordinator' : 'agent'} — the wearer sees exactly what you wrote.</p>
      </section>

      <section class="companion-results" id="results"></section>

      <section class="companion-feed-wrap">
        <span class="label">LIVE AGENT DIALOGUE</span>
        <div class="companion-feed" id="c-feed" aria-live="polite"></div>
      </section>
      <div class="c-toast" id="c-toast" hidden></div>
    </main>`;

    app.querySelectorAll('[data-bubble]').forEach(button => button.addEventListener('click', () => {
      state.selected = button.dataset.bubble;
      app.querySelectorAll('[data-bubble]').forEach(b => b.classList.toggle('selected', b === button));
      const target = app.querySelector('#composer-target');
      if (target) target.textContent = state.selected === 'HUB' ? 'Hub (Coordinator)' : state.selected;
      updateDetail();
    }));

    app.querySelector('#composer-form').addEventListener('submit', e => {
      e.preventDefault();
      const input = app.querySelector('#composer-text');
      const text = input.value.trim();
      if (!text) return;
      const ok = link.sendRequest(state.selected === 'HUB' ? 'Hub' : state.selected, text);
      if (ok) { input.value = ''; setToast(`Sent to ${state.selected === 'HUB' ? 'the Hub' : state.selected} ✓`); }
      else setToast('Not connected — trying to reconnect…', true);
    });

    // Replay accumulated state
    for (const event of d.events.slice(-30)) addFeedRow(event);
    for (const request of d.requests.slice(-10)) addFeedRow(['Phone', request.text, null, request.to], true);
    updateStatus();
    updateDetail();
    updateResults();
    if (!state.hostOnline) setToast('Headset is offline — showing the last known state', true);
  }

  function updateStatus() {
    const status = state.data?.status;
    const phase = app.querySelector('#c-phase');
    const bar = app.querySelector('#c-progress');
    if (phase && status?.phase) phase.textContent = status.phase;
    if (bar) bar.style.width = `${Math.max(2, Math.min(100, Number(status?.progress) || 0))}%`;
  }

  function addFeedRow([who, text, , to], isRequest = false) {
    const feed = app.querySelector('#c-feed');
    if (!feed) return;
    const row = document.createElement('div');
    row.className = `c-event${isRequest ? ' request' : ''}${/critic/i.test(String(who)) ? ' warning' : ''}`;
    row.innerHTML = `<b>${esc(who)}${to ? ` → ${esc(to)}` : ''}</b><p>${esc(text)}</p>`;
    feed.prepend(row);
    while (feed.children.length > 40) feed.lastChild.remove();
  }

  function pulseBubble(who) {
    const name = /coordinator|swarm|hub/i.test(String(who)) ? 'HUB' : String(who);
    const bubble = app.querySelector(`[data-bubble="${CSS.escape(name)}"]`);
    if (!bubble) return;
    bubble.classList.remove('talking');
    void bubble.offsetWidth; // restart the animation
    bubble.classList.add('talking');
  }

  function updateDetail() {
    const detail = app.querySelector('#detail');
    if (!detail || !state.data) return;
    const d = state.data;
    if (state.selected === 'HUB') {
      const eventCount = d.events.length;
      detail.innerHTML = `
        <div class="detail-head" style="--accent:#b8f632"><b>HUB</b><div><strong>Coordinator</strong><span>Task division · budget arbitration · approval</span></div></div>
        <p class="detail-live">${eventCount ? `${eventCount} dialogue events so far.` : 'The Coordinator is waiting for a brief.'} ${d.plan ? 'Package approved — results below.' : ''}</p>`;
      return;
    }
    const agent = agentByName(state.selected);
    if (!agent) { detail.innerHTML = ''; return; }
    const index = d.agents.indexOf(agent);
    const said = d.events.filter(event => String(event[0]).toLowerCase() === agent[1].toLowerCase()).slice(-3);
    const thoughts = Array.isArray(agent[3]) ? agent[3] : [];
    const lines = (d.plan?.items || []).filter(item => String(item[7] || '').toLowerCase() === agent[1].toLowerCase());
    const spend = lines.reduce((sum, item) => sum + (Number(item[2]) || 0), 0);
    detail.innerHTML = `
      <div class="detail-head" style="--accent:${agentAccent(index)}"><b>${esc(agent[0])}</b><div><strong>${esc(agent[1])}</strong><span>${esc(agent[2] || '')}</span></div></div>
      ${thoughts.length ? `<div class="detail-block"><span>THINKING</span><ul>${thoughts.map(thought => `<li>${esc(thought)}</li>`).join('')}</ul></div>` : ''}
      ${said.length ? `<div class="detail-block"><span>LAST SAID</span><ul>${said.map(event => `<li>“${esc(event[1])}”</li>`).join('')}</ul></div>` : '<p class="detail-live">No dialogue from this agent yet.</p>'}
      ${lines.length ? `<div class="detail-block"><span>SOURCED · ${money(spend)}</span><ul>${lines.map(item => `<li>${esc(item[0])} — ${money(item[2])}${item[5] ? ` · <a href="${esc(item[5])}" target="_blank" rel="noopener noreferrer">listing ↗</a>` : ''}</li>`).join('')}</ul></div>` : ''}`;
  }

  function updateResults() {
    const results = app.querySelector('#results');
    if (!results || !state.data) return;
    const plan = state.data.plan;
    if (!plan) { results.innerHTML = ''; return; }
    const cost = plan.landed_cost || {};
    const cmp = plan.comparison;
    results.innerHTML = `
      <div class="results-card">
        <div class="results-top">
          <div><span class="label">LAUNCH PLAN READY</span><h2>${money(cost.total || 0)} <em>of ${money(cost.budget || plan.budget_gbp || 0)}</em></h2>
          <p>${plan.items.length} items · ${plan.items.filter(item => item[5]).length} live Alibaba listing${plan.items.filter(item => item[5]).length === 1 ? '' : 's'} · ${cost.valid ? 'inside budget ✓' : 'over budget ⚠'}</p></div>
          <button class="pdf-btn" id="pdf-btn">DOWNLOAD PDF ⤓</button>
        </div>
        ${state.data.image ? `<figure class="results-visual"><img src="${esc(state.data.image)}" alt="AI concept visual of the finished business"></figure>` : ''}
        ${cmp ? `<div class="results-compare">
          <div><span>SINGLE AGENT (CONTROL)</span><b>${cmp.single ? `${cmp.single.verified_links} live links` : 'RUN FAILED'}</b><p>${cmp.single ? `${money(cmp.single.landed_total)} · ${cmp.single.budget_valid ? 'inside budget' : 'OVER budget'} · ${cmp.single.seconds}s` : 'No usable package'}</p></div>
          <div class="win"><span>SUPPLYSWARM</span><b>${cmp.swarm.verified_links} live links</b><p>${money(cmp.swarm.landed_total)} · ${cmp.swarm.budget_valid ? 'inside budget' : 'over budget'} · ${cmp.swarm.seconds}s</p></div>
        </div>` : ''}
        <div class="results-items">${plan.items.map((item, i) => `
          <div class="r-item"><span>${String(i + 1).padStart(2, '0')}</span>
            <div><b>${item[5] ? `<a href="${esc(item[5])}" target="_blank" rel="noopener noreferrer">${esc(item[0])} ↗</a>` : esc(item[0])}</b><p>${esc(item[1])}${item[6] ? ` · ${esc(item[6])}` : ''}</p></div>
            <strong>${money(item[2])}</strong></div>`).join('')}
        </div>
      </div>`;
    results.querySelector('#pdf-btn')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true; button.textContent = 'BUILDING PDF…';
      try {
        const { downloadPlanPdf } = await import('./pdf.js');
        await downloadPlanPdf(plan, state.data.brief, state.data.image);
        button.textContent = 'DOWNLOAD PDF ⤓';
      } catch (err) {
        console.warn('PDF failed', err);
        button.textContent = 'PDF FAILED — RETRY';
      } finally {
        button.disabled = false;
      }
    });
  }

  let toastTimer = null;
  function setToast(text, sticky = false) {
    const toast = app.querySelector('#c-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    toast.classList.toggle('warn', sticky);
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  renderEntry();
}
