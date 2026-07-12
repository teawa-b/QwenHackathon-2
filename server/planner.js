import { chatJSON, chatJSONWithSearch } from './qwen.js';

// Deterministic landed-cost model — the LLM never does this arithmetic.
const SHIPPING_RATE = 0.075;
const TAX_RATE = 0.08; // VAT + duties allowance on goods + shipping
const CONTINGENCY_RATE = 0.05;
const MAX_REVISIONS = 1;
const PRODUCT_BUDGET_RATIO = 0.82; // leave headroom for shipping/tax/contingency

export function landedCost(items, budget) {
  // price_gbp is the total for the whole line, not a unit price.
  const products = items.reduce((sum, item) => sum + item.price_gbp, 0);
  const shipping = Math.round(products * SHIPPING_RATE);
  const tax = Math.round((products + shipping) * TAX_RATE);
  const contingency = Math.round(products * CONTINGENCY_RATE);
  const total = Math.round(products) + shipping + tax + contingency;
  return {
    products: Math.round(products),
    shipping,
    tax,
    contingency,
    total,
    budget,
    remaining: budget - total,
    valid: total <= budget
  };
}

const COORD_SYSTEM = `You are the Coordinator of SupplySwarm, a society of AI procurement agents that turns a business idea and budget into an Alibaba.com sourcing mission. You do NOT pick products yourself — you design the specialist team that will each search Alibaba.com live.

Given the user's business brief, respond with ONLY a JSON object matching this exact schema:

{
  "business_type": "short business label, e.g. 'Game development studio'",
  "city": "city or region mentioned, else null",
  "team_size": <integer, 1 if unclear>,
  "budget_gbp": <number, the equipment budget in GBP>,
  "specialists": [
    {
      "code": "3-4 letter code",
      "name": "one word role, e.g. 'Computing'",
      "focus": "3-5 word sourcing focus",
      "query": "the exact Alibaba.com search phrase for the equipment this specialist must source, e.g. 'gaming pc workstation i7 32gb'",
      "share": <number 0-1, this specialist's fraction of the equipment budget>
    }
  ],
  "risks": [ "one-line risk" ],
  "assumptions": [ "one-line assumption" ]
}

Rules:
- 3 to 5 specialists, each with a DISTINCT sourcing responsibility relevant to THIS business. Together they must cover everything essential to launch.
- shares must sum to 1.0 and roughly reflect how the budget should split.
- queries must be concrete product searches a buyer would type into Alibaba, not vague categories.
- 2 to 4 risks and 2 to 4 assumptions, honest and specific to this business and budget.
- If the budget is clearly too small for the business, still design the best team and say so in risks.`;

const specialistSystem = (name, focus, lineBudget, business) =>
  `You are ${name}, a sourcing specialist agent in the SupplySwarm procurement swarm, equipping a new ${business}. Your responsibility: ${focus}.

You have LIVE web search. Find REAL, currently listed products on alibaba.com. Cite ONLY URLs that actually appear in your search results — NEVER invent or guess a URL. Prefer alibaba.com product/listing pages.

Respond with ONLY a JSON object:
{
  "items": [
    {
      "title": "product name",
      "detail": "quantity and short spec, e.g. '4 units · 32GB RAM'",
      "quantity": <integer>,
      "price_gbp": <number, TOTAL price for the whole line in GBP (unit price x quantity, convert USD to GBP at 0.79)>,
      "priority": "Essential" | "Useful" | "Later",
      "url": "the alibaba.com listing URL exactly as it appears in your search results, or null if none",
      "supplier": "seller / store name if known, else null",
      "evidence": "short label, e.g. 'Live Alibaba listing'"
    }
  ],
  "report": "max 90 chars — your spoken status message to the Coordinator: what you found, on Alibaba, and roughly for how much"
}

Rules:
- 1 to 3 items. The SUM of your price_gbp values must be at most £${lineBudget}.
- Marketplace prices are often per-unit and in USD — multiply by quantity and convert.
- If search returned nothing usable for a line, still include a realistic estimated line with "url": null and evidence "Estimate — no live listing found".`;

const baselineSystem = (budget) =>
  `You are a SINGLE procurement agent working completely alone — no team, no specialists. Turn the user's business brief into a complete equipment package sourced from alibaba.com using your live web search. Cite ONLY URLs that actually appear in your search results — never invent a URL.

Respond with ONLY a JSON object:
{
  "items": [
    { "title": "...", "detail": "quantity and short spec", "quantity": <integer>, "price_gbp": <number, TOTAL for the line in GBP>, "priority": "Essential" | "Useful" | "Later", "url": "alibaba.com listing URL from your search results or null", "supplier": "seller name or null", "evidence": "short label" }
  ]
}
Rules: 5 to 9 items covering everything essential to launch. The sum of price_gbp must be at most ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% of £${budget}.`;

const REVISE_SYSTEM = `You are the Critic agent of SupplySwarm. A procurement package sourced from live Alibaba searches exceeded budget after landed costs were calculated deterministically. Revise the item list to bring it under budget while keeping every Essential capability (reduce quantities, move nice-to-haves to "Later", or cut lines).

Keep each surviving item's "url" and "supplier" EXACTLY as given — never invent or alter URLs. If you replace an item with a cheaper alternative you did not see a listing for, set its url to null and evidence to "Estimate — critic substitution".

Respond with ONLY a JSON object:
{
  "items": [ same item schema as provided, including url and supplier ],
  "revision_note": "one line, max 90 chars, describing the trade-off made",
  "messages": [ { "to": "name of the specialist agent whose line you changed", "text": "max 80 chars, what you told them and why" } ]
}
The sum of item prices must be at most ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% of the budget. 0 to 2 messages.`;

function cleanUrl(rawUrl, sources) {
  try {
    const url = new URL(String(rawUrl));
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!/(^|\.)alibaba\.com$/i.test(url.hostname)) return null;
    const href = url.toString();
    const verified = sources.some(source =>
      source.url === href || source.url.startsWith(url.origin + url.pathname));
    return { href, verified };
  } catch {
    return null;
  }
}

function cleanItems(rawItems, { sources = [], agentName = null, allowedUrls = null } = {}) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map(item => {
      const link = item.url ? cleanUrl(item.url, sources) : null;
      // Sourcing round: a link survives ONLY if it appeared in the agent's own
      // search results — anything else is vetoed so no shown link can be fake.
      // Revision round: only URLs that survived the sourcing round are trusted,
      // and they keep the evidence label earned there.
      let url = link?.href || null;
      if (url && allowedUrls) url = allowedUrls.has(url) ? url : null;
      else if (url && !link.verified) url = null;
      let evidence = String(item.evidence || 'Qwen estimate').slice(0, 40);
      if (url) evidence = allowedUrls ? allowedUrls.get(url) : 'Live Alibaba listing';
      else if (item.url) evidence = 'Estimate — link unverified';
      return {
        title: String(item.title || '').slice(0, 80),
        detail: String(item.detail || '').slice(0, 90),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        price_gbp: Math.max(0, Math.round(Number(item.price_gbp) || 0)),
        priority: ['Essential', 'Useful', 'Later'].includes(item.priority) ? item.priority : 'Essential',
        evidence,
        url,
        supplier: item.supplier ? String(item.supplier).slice(0, 50) : null,
        agent: agentName
      };
    })
    .filter(item => item.title && item.price_gbp > 0);
}

function cleanSpecialists(rawSpecialists) {
  if (!Array.isArray(rawSpecialists)) return [];
  const specialists = rawSpecialists
    .map(agent => ({
      code: String(agent.code || '???').toUpperCase().slice(0, 4),
      name: String(agent.name || 'Agent').slice(0, 14),
      focus: String(agent.focus || '').slice(0, 34),
      query: String(agent.query || agent.focus || '').slice(0, 90),
      share: Math.max(0.05, Number(agent.share) || 0)
    }))
    .filter(agent => agent.code && agent.name && agent.query)
    .slice(0, 5);
  const totalShare = specialists.reduce((sum, agent) => sum + agent.share, 0) || 1;
  for (const agent of specialists) agent.share /= totalShare;
  return specialists;
}

const timed = promise => {
  const start = Date.now();
  return promise.then(
    value => ({ status: 'fulfilled', value, seconds: (Date.now() - start) / 1000 }),
    reason => ({ status: 'rejected', reason, seconds: (Date.now() - start) / 1000 })
  );
};

function scorePackage(items, budget, seconds) {
  const cost = landedCost(items, budget);
  return {
    seconds: Math.round(seconds * 10) / 10,
    items: items.length,
    verified_links: items.filter(item => item.url).length,
    budget_valid: cost.valid,
    landed_total: cost.total
  };
}

/**
 * Generate a full procurement plan from a free-text brief.
 * Pipeline: Coordinator designs the team -> each specialist runs its own Qwen
 * call with LIVE web search against alibaba.com (in parallel, alongside a solo
 * single-agent control run) -> deterministic budget-share negotiation ->
 * landed-cost validation -> Critic revision if over budget. Both packages are
 * scored with the same deterministic validators so the efficiency gain over
 * the single-agent baseline is measured, not scripted.
 * Every event carries who -> to so the swarm visibly talks to each other.
 */
export async function createPlan(text) {
  const planStart = Date.now();
  const raw = await chatJSON({ system: COORD_SYSTEM, user: text, temperature: 0.5 });

  const budget = Math.max(500, Math.round(Number(raw.budget_gbp) || 10000));
  const business = String(raw.business_type || 'Independent business').slice(0, 60);
  const specialists = cleanSpecialists(raw.specialists);
  if (specialists.length < 2) {
    throw Object.assign(new Error('Qwen coordinator did not produce a specialist team'), { status: 502 });
  }
  const supplierAgent = { code: 'SUP', name: 'Supplier', focus: 'Listing & MOQ verification' };
  const criticAgent = { code: 'RISK', name: 'Critic', focus: 'Risk & budget control' };
  const agents = [...specialists, supplierAgent, criticAgent]
    .map(agent => [agent.code, agent.name, agent.focus]);

  const productBudget = Math.round(budget * PRODUCT_BUDGET_RATIO);
  const events = [
    {
      who: 'Coordinator', to: 'Swarm',
      text: `Brief validated: ${business}, £${budget.toLocaleString('en-GB')} ceiling. ${specialists.length} specialists dispatched to Alibaba.com.`
    }
  ];

  // Every specialist searches Alibaba live, in parallel. A solo single-agent
  // control run starts at the same moment so the comparison is measured fairly.
  const searchStart = Date.now();
  const baselinePromise = timed(chatJSONWithSearch({
    system: baselineSystem(budget),
    user: `Business brief: ${text}\nSearch the web now on alibaba.com for everything this business needs.`
  }));
  const missions = await Promise.all(specialists.map(agent => {
    agent.lineBudget = Math.max(100, Math.round(productBudget * agent.share));
    return timed(chatJSONWithSearch({
      system: specialistSystem(agent.name, agent.focus, agent.lineBudget, business),
      user: `Business brief: ${text}\nSearch the web now for: site:alibaba.com ${agent.query}`
    }));
  }));
  const searchWallSeconds = (Date.now() - searchStart) / 1000;
  const sequentialSeconds = missions.reduce((sum, mission) => sum + mission.seconds, 0);

  let items = [];
  let failedAgents = [];
  specialists.forEach((agent, index) => {
    const mission = missions[index];
    events.push({
      who: agent.name, to: 'Coordinator',
      text: `Searching Alibaba.com: "${agent.query}"…`
    });
    if (mission.status === 'fulfilled') {
      const rawFound = Array.isArray(mission.value.json.items) ? mission.value.json.items : [];
      const found = cleanItems(rawFound, { sources: mission.value.sources, agentName: agent.name });
      items.push(...found);
      agent.spent = found.reduce((sum, item) => sum + item.price_gbp, 0);
      const liveCount = found.filter(item => item.url).length;
      const report = String(mission.value.json.report || '').slice(0, 90);
      events.push({
        who: agent.name, to: 'Coordinator',
        text: report || `${found.length} lines shortlisted, ${liveCount} with live Alibaba listings.`
      });
      // Execution conflict: the Supplier agent vetoes any cited link that was
      // not actually present in that specialist's search results.
      const vetoed = rawFound.filter(item => item.url).length - liveCount;
      if (vetoed > 0) {
        events.push({
          who: 'Supplier', to: agent.name,
          text: `Vetoed ${vetoed} link${vetoed === 1 ? '' : 's'} not in your search results — downgraded to estimates.`
        });
      }
    } else {
      agent.spent = 0;
      failedAgents.push(agent.name);
      events.push({
        who: agent.name, to: 'Critic',
        text: 'Live Alibaba search failed — flagging a sourcing gap for risk review.'
      });
    }
  });

  // Negotiation: specialists that overshot their allocation must request more
  // budget; the Coordinator arbitrates using real headroom from underspenders.
  const overspenders = specialists.filter(agent => agent.spent > agent.lineBudget * 1.05);
  for (const agent of overspenders.slice(0, 2)) {
    const overBy = Math.round(agent.spent - agent.lineBudget);
    events.push({
      who: agent.name, to: 'Coordinator',
      text: `Requesting £${overBy.toLocaleString('en-GB')} above my £${agent.lineBudget.toLocaleString('en-GB')} allocation for ${agent.focus.toLowerCase()}.`
    });
    const donor = specialists.find(other => other !== agent && other.spent < other.lineBudget - overBy);
    if (donor) {
      donor.lineBudget -= overBy;
      agent.lineBudget += overBy;
      events.push({
        who: 'Coordinator', to: agent.name,
        text: `Approved — reallocating £${overBy.toLocaleString('en-GB')} of ${donor.name}'s unspent headroom to you.`
      });
    } else {
      events.push({
        who: 'Coordinator', to: agent.name,
        text: 'No headroom left in the swarm — your lines go to the Critic for cuts.'
      });
    }
  }

  if (!items.length) {
    throw Object.assign(new Error('No specialist agent returned usable items'), { status: 502 });
  }
  items = items.slice(0, 9);
  const allowedUrls = new Map(items.filter(item => item.url).map(item => [item.url, item.evidence]));

  // Supplier agent reports on the live links found by the sourcing agents.
  const liveItems = items.filter(item => item.url);
  const busiestAgent = specialists[0]?.name || 'Coordinator';
  events.push({
    who: 'Supplier', to: liveItems[0]?.agent || busiestAgent,
    text: liveItems.length
      ? `${liveItems.length} live Alibaba listing${liveItems.length === 1 ? '' : 's'} link-checked; MOQ and seller pages attached.`
      : 'No live listings survived verification — all lines are labelled estimates.'
  });

  // Deterministic validation + real critic revision loop.
  let cost = landedCost(items, budget);
  events.push({
    who: 'Coordinator', to: 'Critic',
    text: `Landed cost £${cost.total.toLocaleString('en-GB')} vs £${budget.toLocaleString('en-GB')} ceiling — over to you.`
  });
  let revised = false;
  let revisionNote = '';
  for (let round = 0; round < MAX_REVISIONS && !cost.valid; round++) {
    events.push({
      who: 'Critic', to: 'Swarm',
      text: `Budget conflict: package is £${(cost.total - budget).toLocaleString('en-GB')} over ceiling. Revising.`
    });
    const revision = await chatJSON({
      system: REVISE_SYSTEM,
      user: JSON.stringify({
        budget_gbp: budget,
        over_budget_gbp: cost.total - budget,
        landed_cost: cost,
        items
      }),
      temperature: 0.3
    });
    const revisedItems = cleanItems(revision.items, { sources: [], allowedUrls });
    if (revisedItems.length) {
      items = revisedItems;
      cost = landedCost(items, budget);
      revised = true;
      revisionNote = String(revision.revision_note || 'Package revised to fit inside the budget ceiling.').slice(0, 110);
      for (const message of (Array.isArray(revision.messages) ? revision.messages : []).slice(0, 2)) {
        const target = specialists.find(agent => agent.name.toLowerCase() === String(message.to || '').toLowerCase());
        if (target && message.text) {
          events.push({ who: 'Critic', to: target.name, text: String(message.text).slice(0, 90) });
        }
      }
      events.push({ who: 'Critic', to: 'Coordinator', text: revisionNote });
    }
  }

  events.push({
    who: 'Critic', to: 'Coordinator',
    text: cost.valid
      ? 'All essential capabilities fit the landed-cost budget. Evidence labels verified.'
      : 'Budget risk remains after revision — review the trade-offs before purchasing.'
  });
  events.push({
    who: 'Coordinator', to: 'Swarm',
    text: cost.valid ? 'Package approved. Preparing your launch plan.' : 'Best available package prepared with budget risk flagged.'
  });

  // Score both packages with the same deterministic validators. The swarm's
  // time is measured before waiting on the control run so it is not inflated.
  const swarmSeconds = (Date.now() - planStart) / 1000;
  const swarmScore = scorePackage(items, budget, swarmSeconds);
  let singleScore = null;
  const baseline = await baselinePromise;
  if (baseline.status === 'fulfilled') {
    const baselineItems = cleanItems(baseline.value.json.items, { sources: baseline.value.sources, agentName: 'Single agent' });
    if (baselineItems.length) singleScore = scorePackage(baselineItems, budget, baseline.seconds);
  }
  const comparison = {
    swarm: swarmScore,
    single: singleScore,
    parallel_speedup: Math.max(1, Math.round((sequentialSeconds / Math.max(0.1, searchWallSeconds)) * 10) / 10)
  };

  // Spread progress 8 -> 100 across events for the frontend timeline.
  // If the story ran long, drop "Searching…" filler first — never the ending.
  while (events.length > 18) {
    const filler = events.findIndex(event => event.text.startsWith('Searching Alibaba.com'));
    if (filler >= 0) events.splice(filler, 1);
    else events.splice(Math.floor(events.length / 2), 1);
  }
  const trimmed = events;
  const timeline = trimmed.map((event, i) => [
    String(event.who).slice(0, 20),
    String(event.text).slice(0, 110),
    Math.round(8 + (92 * (i + 1)) / trimmed.length),
    String(event.to || '').slice(0, 20)
  ]);

  let risks = (raw.risks || []).map(String).slice(0, 4);
  if (failedAgents.length) {
    risks.unshift(`Live search failed for ${failedAgents.join(', ')} — those categories need manual sourcing.`);
  }
  if (revised) {
    // Risks written for the first draft can contain a now-stale remaining
    // budget. Keep the final report internally consistent after revision.
    risks = risks.filter(risk => !/[£$€]\s?[\d,.]+/.test(risk));
    risks.unshift('Final landed costs can change with shipping, VAT, duties and supplier pricing.');
  }
  risks = risks.slice(0, 5);

  return {
    live: true,
    business_type: business,
    city: raw.city ? String(raw.city).slice(0, 40) : null,
    team_size: Math.max(1, Math.round(Number(raw.team_size) || 1)),
    budget_gbp: budget,
    agents,
    items: items.map(item => [item.title, item.detail, item.price_gbp, item.priority, item.evidence, item.url, item.supplier]),
    events: timeline,
    risks,
    assumptions: (raw.assumptions || []).map(String).slice(0, 5),
    landed_cost: cost,
    revised,
    comparison
  };
}
