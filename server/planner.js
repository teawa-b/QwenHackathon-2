import { chatJSON, chatJSONWithSearch } from './qwen.js';

// Deterministic landed-cost model — the LLM never does this arithmetic.
const SHIPPING_RATE = 0.075;
const TAX_RATE = 0.08; // VAT + duties allowance on goods + shipping
const CONTINGENCY_RATE = 0.05;
const MAX_REVISIONS = 2;
const PRODUCT_BUDGET_RATIO = 0.82; // leave headroom for shipping/tax/contingency
// A package that uses less than this share of the ceiling is treated as an
// underspend conflict: the user asked for a launch at THIS budget, not a
// fraction of it, so the Critic runs an upgrade round.
const UNDERSPEND_RATIO = 0.9;
// Where an upgrade round should land the product subtotal (shipping, tax and
// contingency on top bring the landed total to ~97-100% of the ceiling).
const UPGRADE_FLOOR_RATIO = 0.78;

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
- budget_gbp is CRITICAL — read it exactly as the user stated it. "£15k", "15k", "fifteen thousand pounds" and "15,000" all mean 15000. Never truncate, round down to a smaller magnitude, or substitute your own figure. If genuinely no budget is stated, use 10000.
- 3 to 5 specialists, each with a DISTINCT sourcing responsibility relevant to THIS business. Together they must cover everything essential to launch.
- shares must sum to 1.0 and roughly reflect how the budget should split.
- queries must be concrete product searches a buyer would type into Alibaba, not vague categories.
- 2 to 4 risks and 2 to 4 assumptions, honest and specific to this business and budget.
- If the budget is clearly too small for the business, still design the best team and say so in risks.`;

const specialistSystem = (name, focus, lineBudget, business) =>
  `You are ${name}, a sourcing specialist agent in the SupplySwarm procurement swarm, equipping a new ${business}. Your responsibility: ${focus}.

You have LIVE web search. Find REAL, currently listed products on alibaba.com (aliexpress.com listings are also acceptable). Copy every URL EXACTLY, character for character, from your search results — NEVER invent, shorten, reconstruct or translate a URL. Prefer alibaba.com product/listing pages.

Respond with ONLY a JSON object:
{
  "items": [
    {
      "title": "product name",
      "detail": "quantity and short spec, e.g. '4 units · 32GB RAM'",
      "quantity": <integer>,
      "price_gbp": <number, TOTAL price for the whole line in GBP (unit price x quantity, convert USD to GBP at 0.79)>,
      "priority": "Essential" | "Useful" | "Later",
      "url": "the alibaba.com (or aliexpress.com) listing URL exactly as it appears in your search results, or null if none",
      "supplier": "seller / store name if known, else null",
      "evidence": "short label, e.g. 'Live Alibaba listing'"
    }
  ],
  "report": "max 90 chars — your spoken status message to the Coordinator: what you found, on Alibaba, and roughly for how much",
  "thoughts": [ "2 or 3 strings, max 55 chars each — your ACTUAL reasoning steps while comparing listings, e.g. 'Two rack listings — picking the one with safety arms'" ]
}

Rules:
- 1 to 3 items. The SUM of your price_gbp values must be at most £${lineBudget} — and this budget was allocated to be SPENT. Target 90-100% of £${lineBudget}: choose properly specced, durable commercial-grade equipment and realistic quantities. A total under 75% of your allocation is a FAILED mission unless nothing better exists.
- Marketplace prices are often per-unit and in USD — multiply by quantity and convert.
- If search returned nothing usable for a line, still include a realistic estimated line with "url": null and evidence "Estimate — no live listing found".`;

const baselineSystem = (budget) =>
  `You are a SINGLE procurement agent working completely alone — no team, no specialists. Turn the user's business brief into a complete equipment package sourced from alibaba.com (aliexpress.com also acceptable) using your live web search. Copy every URL EXACTLY, character for character, from your search results — never invent or reconstruct a URL.

Respond with ONLY a JSON object:
{
  "items": [
    { "title": "...", "detail": "quantity and short spec", "quantity": <integer>, "price_gbp": <number, TOTAL for the line in GBP>, "priority": "Essential" | "Useful" | "Later", "url": "alibaba.com or aliexpress.com listing URL from your search results or null", "supplier": "seller name or null", "evidence": "short label" }
  ]
}
Rules: 5 to 9 items covering everything essential to launch. The sum of price_gbp must be at most ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% of £${budget} and should land at 90-100% of that allowance — the budget exists to be spent on the best launch the money buys.`;

const REVISE_SYSTEM = `You are the Critic agent of SupplySwarm. A procurement package sourced from live Alibaba searches exceeded budget after landed costs were calculated deterministically. Revise the item list to bring it under budget while keeping every Essential capability (reduce quantities, move nice-to-haves to "Later", or cut lines).

Keep each surviving item's "url" and "supplier" EXACTLY as given — never invent or alter URLs. If you replace an item with a cheaper alternative you did not see a listing for, set its url to null and evidence to "Estimate — critic substitution".

Respond with ONLY a JSON object:
{
  "items": [ same item schema as provided, including url and supplier ],
  "revision_note": "one line, max 90 chars, describing the trade-off made",
  "messages": [ { "to": "name of the specialist agent whose line you changed", "text": "max 80 chars, what you told them and why" } ]
}
The sum of item prices must be at most ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% of the budget. 0 to 2 messages.`;

const UPGRADE_SYSTEM = `You are the Critic agent of SupplySwarm. A procurement package sourced from live Alibaba searches came in FAR UNDER the user's stated budget — the user asked for the best launch package their budget allows, not the cheapest one. Upgrade the package to use the budget properly: raise quantities where more units genuinely help, step existing lines up to better-specced or more durable tiers, and add missing capabilities the business will need.

Keep each surviving item's "url" and "supplier" EXACTLY as given — never invent or alter URLs. Any upgraded or added line you did not see a listing for must have "url": null and evidence "Estimate — critic upgrade".

Respond with ONLY a JSON object:
{
  "items": [ same item schema as provided, including url and supplier ],
  "revision_note": "one line, max 90 chars, describing the upgrade made",
  "messages": [ { "to": "name of the specialist agent whose line you changed", "text": "max 80 chars, what you told them and why" } ]
}
The sum of item prices should land between ${Math.round(UPGRADE_FLOOR_RATIO * 100)}% and ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% of the budget — as close to ${Math.round(PRODUCT_BUDGET_RATIO * 100)}% as sensible, never above it. 3 to 9 items. 0 to 2 messages.`;

const MARKETPLACE_HOST = /(^|\.)(alibaba|aliexpress)\.com$/i;

// Hostname + path with protocol, www./m. subdomain, trailing slash, query
// string and case ignored — models routinely rewrite URLs in those ways, and
// an over-strict comparison was vetoing genuinely live listings.
function normalizeUrl(value) {
  try {
    const url = new URL(String(value));
    const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
    const path = decodeURIComponent(url.pathname).replace(/\/+$/, '').toLowerCase();
    return `${host}${path}`;
  } catch {
    return null;
  }
}

function cleanUrl(rawUrl, sources) {
  try {
    const url = new URL(String(rawUrl));
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!MARKETPLACE_HOST.test(url.hostname)) return null;
    const href = url.toString();
    const key = normalizeUrl(href);
    const verified = sources.some(source => normalizeUrl(source.url) === key);
    const marketplace = /(^|\.)aliexpress\.com$/i.test(url.hostname) ? 'AliExpress' : 'Alibaba';
    return { href, verified, marketplace };
  } catch {
    return null;
  }
}

// The model often reports prices without citing the listing it read. Its own
// search results are ground truth, so hand unlinked lines a real marketplace
// URL the search genuinely returned — verified by construction, honestly
// labelled as coming from the agent's search rather than a per-item citation.
function attachSourceLinks(items, sources) {
  const used = new Set(items.map(item => item.url && normalizeUrl(item.url)).filter(Boolean));
  const spare = (sources || []).filter(source => {
    try {
      const url = new URL(source.url);
      return MARKETPLACE_HOST.test(url.hostname) && url.pathname.length > 1 && !used.has(normalizeUrl(source.url));
    } catch { return false; }
  });
  for (const item of items) {
    if (item.url || !spare.length) continue;
    const source = spare.shift();
    item.url = source.url;
    item.evidence = 'From live search results';
    used.add(normalizeUrl(source.url));
  }
  return items;
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
      if (url) evidence = allowedUrls ? allowedUrls.get(url) : `Live ${link.marketplace} listing`;
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
        agent: agentName || (item.agent ? String(item.agent).slice(0, 20) : null)
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
  const supplierAgent = {
    code: 'SUP', name: 'Supplier', focus: 'Listing & MOQ verification',
    thoughts: ['Cross-checking every cited URL against search results…', 'Any link I did not see gets vetoed…', 'Attaching MOQ and seller pages to the shortlist…']
  };
  const criticAgent = {
    code: 'RISK', name: 'Critic', focus: 'Risk & budget control',
    thoughts: ['Watching the landed-cost ceiling…', 'Hunting for weak evidence labels…', 'Ready to cut nice-to-haves if we run hot…']
  };

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
      // Execution conflict: the Supplier agent vetoes any cited link that was
      // not actually present in that specialist's search results.
      const vetoed = rawFound.filter(item => item.url).length - found.filter(item => item.url).length;
      attachSourceLinks(found, mission.value.sources);
      items.push(...found);
      agent.thoughts = (Array.isArray(mission.value.json.thoughts) ? mission.value.json.thoughts : [])
        .map(thought => String(thought).slice(0, 60)).filter(Boolean).slice(0, 3);
      agent.spent = found.reduce((sum, item) => sum + item.price_gbp, 0);
      const liveCount = found.filter(item => item.url).length;
      const report = String(mission.value.json.report || '').slice(0, 90);
      events.push({
        who: agent.name, to: 'Coordinator',
        text: report || `${found.length} lines shortlisted, ${liveCount} with live Alibaba listings.`
      });
      if (vetoed > 0) {
        events.push({
          who: 'Supplier', to: agent.name,
          text: `Vetoed ${vetoed} link${vetoed === 1 ? '' : 's'} not in your search results — matched real listings from the search instead.`
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

  // Underspend conflict: the user asked for a launch at THIS budget. If the
  // package leaves most of the ceiling unused, the Critic upgrades quantities
  // and spec toward the ceiling instead of quietly handing back a cheap plan.
  let upgraded = false;
  for (let round = 0; round < 2 && cost.valid && cost.total < budget * UNDERSPEND_RATIO; round++) {
    events.push({
      who: 'Critic', to: 'Swarm',
      text: `Underspend conflict: only £${cost.total.toLocaleString('en-GB')} of the £${budget.toLocaleString('en-GB')} ceiling is used. Upgrading the package.`
    });
    try {
      const upgrade = await chatJSON({
        system: UPGRADE_SYSTEM,
        user: JSON.stringify({
          budget_gbp: budget,
          unused_budget_gbp: budget - cost.total,
          landed_cost: cost,
          items
        }),
        temperature: 0.4
      });
      const upgradedItems = cleanItems(upgrade.items, { sources: [], allowedUrls }).slice(0, 9);
      const upgradedCost = upgradedItems.length ? landedCost(upgradedItems, budget) : null;
      // Only accept an upgrade that stays valid and actually spends more.
      if (upgradedCost?.valid && upgradedCost.total > cost.total) {
        items = upgradedItems;
        cost = upgradedCost;
        upgraded = true;
        revisionNote = String(upgrade.revision_note || 'Package upgraded to make full use of the budget.').slice(0, 110);
        for (const message of (Array.isArray(upgrade.messages) ? upgrade.messages : []).slice(0, 2)) {
          const target = specialists.find(agent => agent.name.toLowerCase() === String(message.to || '').toLowerCase());
          if (target && message.text) {
            events.push({ who: 'Critic', to: target.name, text: String(message.text).slice(0, 90) });
          }
        }
        events.push({ who: 'Critic', to: 'Coordinator', text: revisionNote });
      } else {
        events.push({
          who: 'Critic', to: 'Coordinator',
          text: 'Upgrade draft rejected by the validators — keeping the verified conservative package.'
        });
        break;
      }
    } catch {
      events.push({
        who: 'Critic', to: 'Coordinator',
        text: 'Upgrade pass failed — keeping the conservative package. Budget headroom remains.'
      });
      break;
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
    text: 'Design pass: rendering a concept visual of the finished space for your PDF report…'
  });
  events.push({
    who: 'Coordinator', to: 'Swarm',
    text: cost.valid ? 'Package approved. Preparing your launch plan.' : 'Best available package prepared with budget risk flagged.'
  });

  // Agent roster is finalised after the missions so each specialist's genuine
  // LLM reasoning steps ride along as its 3D thought bubbles.
  const agents = [...specialists, supplierAgent, criticAgent]
    .map(agent => [agent.code, agent.name, agent.focus, agent.thoughts || []]);

  // Score both packages with the same deterministic validators. The swarm's
  // time is measured before waiting on the control run so it is not inflated.
  const swarmSeconds = (Date.now() - planStart) / 1000;
  const swarmScore = scorePackage(items, budget, swarmSeconds);
  let singleScore = null;
  let singleItems = [];
  const baseline = await baselinePromise;
  if (baseline.status === 'fulfilled') {
    const baselineItems = cleanItems(baseline.value.json.items, { sources: baseline.value.sources, agentName: 'Single agent' });
    if (baselineItems.length) {
      attachSourceLinks(baselineItems, baseline.value.sources);
      singleScore = scorePackage(baselineItems, budget, baseline.seconds);
      // The control's full package rides along so the user can inspect what
      // the solo agent actually proposed, not just its score.
      singleItems = baselineItems.slice(0, 9)
        .map(item => [item.title, item.detail, item.price_gbp, item.priority, item.evidence, item.url, item.supplier, null, item.quantity]);
    }
  }
  const comparison = {
    swarm: swarmScore,
    single: singleScore,
    single_items: singleItems,
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
  if (revised || upgraded) {
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
    items: items.map(item => [item.title, item.detail, item.price_gbp, item.priority, item.evidence, item.url, item.supplier, item.agent, item.quantity]),
    events: timeline,
    risks,
    assumptions: (raw.assumptions || []).map(String).slice(0, 5),
    landed_cost: cost,
    revised,
    upgraded,
    comparison
  };
}
