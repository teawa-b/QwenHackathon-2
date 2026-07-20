import './journal.css';

const github = 'https://github.com/teawa-b/QwenHackathon-2/commit/';

const entries = [
  {
    week: ['Week one', '11–12 July', 'Foundations'],
    date: '11 July 2026',
    label: 'Day one',
    title: 'A procurement swarm, not another shopping list',
    intro: 'The first build established the core idea: turn a business brief into a visible team of specialist agents, then make their work understandable in a browser and in VR.',
    body: [
      'I started with a simple frustration: equipment sourcing mixes research, judgement and arithmetic, but most AI tools flatten all of that into one answer. SupplySwarm began as a way to show the work — who owns each category, how the budget is split, and why an item survives the final review.',
      'By the end of the day, the web experience, the first WebXR operations room and the initial hosted builds were in place. The visual language was intentionally closer to an operations desk than a chatbot.'
    ],
    image: '/journal/choice-picker.png',
    imageAlt: 'SupplySwarm autonomy choice shown inside the WebXR room',
    commits: [['0e00cdc', 'First working experience'], ['b19fa9b', 'WebXR operations room']]
  },
  {
    date: '12 July 2026',
    label: 'Day two',
    title: 'The agents became a society',
    intro: 'Specialists started searching Alibaba independently, talking to one another and reporting into a Coordinator instead of hiding behind one long prompt.',
    body: [
      'This was the day the project stopped feeling like a pipeline. Each specialist received a clear responsibility, query and budget share. Their messages became visible in the 3D room, including thought bubbles and hand-offs between roles.',
      'I also added a fair single-agent control and the first real negotiation path. The same brief and tools now run through both approaches, so the comparison on the results page is measured rather than decorative.'
    ],
    image: '/journal/agent-society.png',
    imageAlt: 'Six specialist robots assembled around the SupplySwarm Coordinator',
    commits: [['5bc765d', 'Live Alibaba search'], ['a4873ba', 'Baseline and negotiation'], ['5349724', 'Visible agent dialogue']]
  },
  {
    week: ['Week two', '13–19 July', 'Trust and interaction'],
    date: '13 July 2026',
    label: 'Day three',
    title: 'Evidence had to survive the demo',
    intro: 'Marketplace links became allow-listed evidence, budgets started accounting for landed cost, and the finished package gained a downloadable PDF.',
    body: [
      'A plausible-looking supplier URL is not proof. SupplySwarm now keeps the sources actually returned to each agent and removes any citation that was not present in those results. That small boundary made the whole output feel more honest.',
      'The plan also became useful away from the screen: a result can be opened on a paired phone, checked line by line and exported as a PDF for later review.'
    ],
    image: '/journal/verified-plan.png',
    imageAlt: 'A completed budget-valid SupplySwarm plan with live marketplace listings',
    commits: [['a2901ac', 'Budget and PDF'], ['f74fbc0', 'Durable evidence links']]
  },
  {
    date: '15 July 2026',
    label: 'Day five',
    title: 'Making the room readable',
    intro: 'A focused VR polish pass improved sharpness, audio and the field-ledger interface so the swarm could be followed without fighting the headset.',
    body: [
      'World-space interfaces have a different failure mode from flat UI: technically visible can still mean physically tiring. I tightened the scale, contrast and hierarchy, then gave key events their own sound cues instead of adding more panels.',
      'The result was quieter and easier to scan. The room could finally hold the agents, their dialogue and the shared budget without turning into a floating dashboard wall.'
    ],
    commits: [['802e832', 'VR clarity and field ledger']]
  },
  {
    date: '17 July 2026',
    label: 'Day seven',
    title: 'Memory, disagreement and consequences',
    intro: 'Agents gained persistent, role-specific memory while negotiation moved into separate Qwen calls with deterministic financial limits.',
    body: [
      'The difficult part was letting agents disagree without letting the numbers drift. A specialist can now argue for more budget and the Coordinator can rule on that request, but ordinary code still owns the ceiling, headroom and landed-cost calculation.',
      'Memory follows the same principle. Agents recall factual mission notes — previous spend, rejected links and approved transfers — through deterministic matching, so the system cannot invent a past event just because it sounds relevant.'
    ],
    commits: [['072ad5a', 'Conflict reporting'], ['8574d7c', 'Persistent memory and Qwen negotiation']]
  },
  {
    date: '18 July 2026',
    label: 'Day eight',
    title: 'The swarm learned when to ask',
    intro: 'Human-in-the-loop mode added a meaningful pause before sourcing, while staged agent arrivals made the planning phase feel alive rather than stalled.',
    body: [
      'Full autonomy is useful, but not every brief should begin with silent assumptions. In Check in with me mode, the agents can ask targeted questions — for example, which headset ecosystem matters — and carry the answer into the live plan.',
      'I also changed the pacing of the room. Specialists now arrive one by one as the Coordinator designs the team, and the phone pairing code stays visible inside VR and passthrough AR.'
    ],
    image: '/journal/check-in.png',
    imageAlt: 'A SupplySwarm specialist asking a human-in-the-loop question in VR',
    commits: [['67a92c1', 'Staged specialist arrivals'], ['6587efc', 'Human check-in mode']]
  },
  {
    week: ['Week three', '20 July onward', 'Launch and proof'],
    date: '20 July 2026',
    label: 'Launch day',
    title: 'From headset fix to Alibaba Cloud',
    intro: 'The final pass fixed controller interaction, stopped the UI from clinging to head movement and packaged the full application for Alibaba Cloud.',
    body: [
      'The autonomy choice had looked correct but was not reliably reachable by the VR ray. I rebuilt that interaction path and changed the world UI to settle into space, so it follows the user only when it genuinely needs to be repositioned.',
      'The same day, the complete Express, WebSocket and Vite application was containerised for Alibaba Cloud Simple Application Server. The deployment reports its provider, region and commit through a public health endpoint, giving the judges a direct piece of hosting evidence.'
    ],
    commits: [['96438a1', 'VR interaction and stable UI'], ['1021b08', 'Alibaba deployment package'], ['18b02e0', 'One-command server bootstrap']]
  }
];

const entryMarkup = (entry, index) => `
  ${entry.week ? `<header class="week-divider"><span>${entry.week[0]}</span><strong>${entry.week[2]}</strong><time>${entry.week[1]}</time></header>` : ''}
  <article class="journal-entry" style="--entry:${index}">
    <aside class="journal-date"><span>${entry.label}</span><time>${entry.date}</time></aside>
    <div class="journal-card">
      ${entry.image ? `<figure><img src="${entry.image}" alt="${entry.imageAlt}" loading="lazy"></figure>` : ''}
      <div class="journal-copy">
        <p class="journal-kicker">BUILD NOTE ${String(index + 1).padStart(2, '0')}</p>
        <h2>${entry.title}</h2>
        <p class="journal-intro">${entry.intro}</p>
        <details>
          <summary><span>Read the full update</span><i aria-hidden="true">+</i></summary>
          <div class="journal-full">${entry.body.map(paragraph => `<p>${paragraph}</p>`).join('')}</div>
        </details>
        <div class="journal-commits" aria-label="Related Git commits">
          ${entry.commits.map(([hash, label]) => `<a href="${github}${hash}" target="_blank" rel="noopener noreferrer"><code>${hash}</code><span>${label}</span></a>`).join('')}
        </div>
      </div>
    </div>
  </article>`;

export function showJournal(app) {
  document.body.className = 'journal-mode';
  document.title = 'SupplySwarm build journal — Shroozy Studios';
  app.innerHTML = `
    <header class="journal-nav">
      <a class="shroozy-lockup" href="https://shroozy.com" target="_blank" rel="noopener noreferrer" aria-label="Visit Shroozy Studios">
        <img src="https://stage.shroozy.com/assets/shroozy-mark.svg" alt="Shroozy Studios">
        <span>SHROOZY<small>STUDIOS</small></span>
      </a>
      <nav aria-label="Journal navigation">
        <a href="/">Open SupplySwarm</a>
        <a href="https://github.com/teawa-b/QwenHackathon-2" target="_blank" rel="noopener noreferrer">Source ↗</a>
      </nav>
    </header>
    <main class="journal-shell">
      <section class="journal-hero">
        <div class="journal-eyebrow"><span></span> SupplySwarm / build journal</div>
        <h1>Three build weeks.<br><em>One working swarm.</em></h1>
        <div class="journal-hero-foot">
          <p>A short, honest record of turning a procurement idea into a visible society of Qwen agents — with live evidence, memory, negotiation, VR and an Alibaba Cloud deployment.</p>
          <dl>
            <div><dt>Timeline</dt><dd>3 build weeks</dd></div>
            <div><dt>Public commits</dt><dd>35</dd></div>
            <div><dt>Track</dt><dd>Agent Society</dd></div>
          </dl>
        </div>
      </section>
      <section class="journal-timeline" aria-label="SupplySwarm development timeline">
        ${entries.map(entryMarkup).join('')}
      </section>
      <section class="journal-end">
        <p>Built in public for the Global AI Hackathon Series with Qwen Cloud.</p>
        <a href="/">Try SupplySwarm <span>→</span></a>
      </section>
    </main>
    <footer class="journal-footer">
      <a href="https://shroozy.com" target="_blank" rel="noopener noreferrer"><img src="https://stage.shroozy.com/assets/shroozy-mark.svg" alt="Shroozy Studios"></a>
      <p>A Shroozy Studios build log · Tiwa Bakree · 2026</p>
    </footer>`;
}
